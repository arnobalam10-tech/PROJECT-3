-- Bug fix (PRD §13 audit, not caught until now): "user assigned to a
-- workflow" was only ever sent to the FIRST participant at submission
-- (bundled with memo_requires_action). Participants 2..N in the original
-- chain got no notification at all until it became their turn. Also add the
-- same 'workflow_assignment' notification when someone is added mid-chain
-- (forward-to-someone-new / decline-reroute) — that's their first time on
-- this workflow too, distinct from "it's your turn right now."
create or replace function submit_memo(p_memo_id uuid, p_participant_ids uuid[]) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_memo public.memos;
  v_org_id uuid;
  v_uid uuid;
  v_order double precision := 1000;
  v_first_holder uuid;
  v_invalid_count int;
begin
  select * into v_memo from public.memos where id = p_memo_id for update;
  if v_memo.id is null then
    raise exception 'Memo not found.';
  end if;
  if v_memo.author_id != auth.uid() then
    raise exception 'Only the author may submit this memo.';
  end if;
  if v_memo.status != 'draft' then
    raise exception 'Only a draft may be submitted.';
  end if;
  if p_participant_ids is null or array_length(p_participant_ids, 1) is null then
    raise exception 'At least one participant is required.';
  end if;

  v_org_id := v_memo.organization_id;

  select count(*) into v_invalid_count
  from unnest(p_participant_ids) pid
  where not exists (
    select 1 from public.profiles pr
    where pr.id = pid and pr.organization_id = v_org_id and pr.status = 'active'
  );
  if v_invalid_count > 0 then
    raise exception 'One or more selected participants are invalid.';
  end if;

  foreach v_uid in array p_participant_ids loop
    insert into public.workflow_steps
      (memo_id, sequence_order, assigned_user_id, status, is_original)
    values
      (
        p_memo_id, v_order, v_uid,
        (case when v_order = 1000 then 'current' else 'queued' end)::public.workflow_step_status,
        true
      );
    -- Every participant in the initial chain is "assigned to a workflow"
    -- right now, regardless of turn order.
    perform private.notify_user(
      v_org_id, v_uid, 'workflow_assignment', p_memo_id,
      format('You were added to the workflow for "%s".', v_memo.subject)
    );
    v_order := v_order + 1000;
  end loop;

  v_first_holder := p_participant_ids[1];

  update public.memos
  set status = 'submitted', submitted_at = now()
  where id = p_memo_id;

  insert into public.memo_versions (memo_id, version_number, editor_id, content_snapshot, associated_submission_at)
  values (p_memo_id, 1, auth.uid(), jsonb_build_object('subject', v_memo.subject, 'body', v_memo.body), now());

  perform private.log_audit_event(
    v_org_id, 'memo_submission', auth.uid(), 'memo', p_memo_id,
    format('Memo "%s" submitted with %s participant(s).', v_memo.subject, array_length(p_participant_ids, 1))
  );
  -- The first holder ALSO needs to know it's their turn right now, on top
  -- of the workflow_assignment notification everyone already got above.
  perform private.notify_user(
    v_org_id, v_first_holder, 'memo_requires_action', p_memo_id,
    format('"%s" requires your action.', v_memo.subject)
  );
end;
$$;

create or replace function workflow_approve(
  p_memo_id uuid,
  p_comment text default null,
  p_forward_to_user_id uuid default null
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current public.workflow_steps;
  v_memo public.memos;
  v_next public.workflow_steps;
  v_new_order double precision;
  v_next_queued_order double precision;
begin
  v_current := private.assert_current_holder(p_memo_id);
  select * into v_memo from public.memos where id = p_memo_id;

  update public.workflow_steps
  set status = 'approved', action_taken = 'approve', comment = p_comment, acted_at = now()
  where id = v_current.id;

  if p_forward_to_user_id is not null then
    if not exists (
      select 1 from public.profiles
      where id = p_forward_to_user_id and organization_id = v_memo.organization_id and status = 'active'
    ) then
      raise exception 'Invalid forwarding target.';
    end if;

    select min(sequence_order) into v_next_queued_order
    from public.workflow_steps where memo_id = p_memo_id and status = 'queued';

    v_new_order := case
      when v_next_queued_order is null then v_current.sequence_order + 1000
      else (v_current.sequence_order + v_next_queued_order) / 2
    end;

    insert into public.workflow_steps
      (memo_id, sequence_order, assigned_user_id, status, is_original, added_by)
    values
      (p_memo_id, v_new_order, p_forward_to_user_id, 'current', false, auth.uid());

    perform private.log_audit_event(
      v_memo.organization_id, 'approval', auth.uid(), 'memo', p_memo_id,
      format('Approved and forwarded "%s" to a new participant outside the original chain.', v_memo.subject)
    );
    -- New to this workflow AND it's their turn right now — both apply.
    perform private.notify_user(
      v_memo.organization_id, p_forward_to_user_id, 'workflow_assignment', p_memo_id,
      format('You were added to the workflow for "%s".', v_memo.subject)
    );
    perform private.notify_user(
      v_memo.organization_id, p_forward_to_user_id, 'memo_requires_action', p_memo_id,
      format('"%s" requires your action.', v_memo.subject)
    );
  else
    select * into v_next from public.workflow_steps
    where memo_id = p_memo_id and status = 'queued'
    order by sequence_order asc
    limit 1
    for update;

    if v_next.id is not null then
      update public.workflow_steps set status = 'current' where id = v_next.id;

      perform private.log_audit_event(
        v_memo.organization_id, 'approval', auth.uid(), 'memo', p_memo_id,
        format('Approved "%s", forwarded to the next participant in the original chain.', v_memo.subject)
      );
      perform private.notify_user(
        v_memo.organization_id, v_next.assigned_user_id, 'memo_requires_action', p_memo_id,
        format('"%s" requires your action.', v_memo.subject)
      );
    else
      update public.memos set status = 'approved', completed_at = now() where id = p_memo_id;

      perform private.log_audit_event(
        v_memo.organization_id, 'approval', auth.uid(), 'memo', p_memo_id,
        format('Approved "%s" — no remaining participants.', v_memo.subject)
      );
      perform private.log_audit_event(
        v_memo.organization_id, 'workflow_completion', auth.uid(), 'memo', p_memo_id,
        format('"%s" completed (approved).', v_memo.subject)
      );
      -- "memo approved" and "workflow completed" are the same instant in
      -- this system (no partial-approval state exists) — one notification
      -- covers both PRD §13 bullet points rather than sending a duplicate.
      perform private.notify_user(
        v_memo.organization_id, v_memo.author_id, 'workflow_completed', p_memo_id,
        format('"%s" was approved and is now complete.', v_memo.subject)
      );
    end if;
  end if;

  if p_comment is not null and length(trim(p_comment)) > 0 then
    insert into public.comments (memo_id, author_id, body, comment_type)
    values (p_memo_id, auth.uid(), p_comment, 'approval');
  end if;
end;
$$;

create or replace function workflow_decline_reroute(
  p_memo_id uuid,
  p_new_holder_id uuid,
  p_comment text default null
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current public.workflow_steps;
  v_memo public.memos;
  v_new_order double precision;
  v_next_queued_order double precision;
begin
  v_current := private.assert_current_holder(p_memo_id);
  select * into v_memo from public.memos where id = p_memo_id;

  if not exists (
    select 1 from public.profiles
    where id = p_new_holder_id and organization_id = v_memo.organization_id and status = 'active'
  ) then
    raise exception 'Invalid reroute target.';
  end if;

  update public.workflow_steps
  set status = 'declined', action_taken = 'decline', comment = p_comment, acted_at = now()
  where id = v_current.id;

  select min(sequence_order) into v_next_queued_order
  from public.workflow_steps where memo_id = p_memo_id and status = 'queued';

  v_new_order := case
    when v_next_queued_order is null then v_current.sequence_order + 1000
    else (v_current.sequence_order + v_next_queued_order) / 2
  end;

  insert into public.workflow_steps
    (memo_id, sequence_order, assigned_user_id, status, is_original, added_by)
  values
    (p_memo_id, v_new_order, p_new_holder_id, 'current', false, auth.uid());

  if p_comment is not null and length(trim(p_comment)) > 0 then
    insert into public.comments (memo_id, author_id, body, comment_type)
    values (p_memo_id, auth.uid(), p_comment, 'general');
  end if;

  perform private.log_audit_event(
    v_memo.organization_id, 'decline', auth.uid(), 'memo', p_memo_id,
    format('Declined and rerouted "%s" to a different participant.', v_memo.subject)
  );
  perform private.notify_user(
    v_memo.organization_id, p_new_holder_id, 'workflow_assignment', p_memo_id,
    format('You were added to the workflow for "%s".', v_memo.subject)
  );
  perform private.notify_user(
    v_memo.organization_id, p_new_holder_id, 'memo_requires_action', p_memo_id,
    format('"%s" requires your action.', v_memo.subject)
  );
end;
$$;
