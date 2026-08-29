-- Locks and returns the current-holder row for a memo, raising if there is
-- no current row or the caller isn't its holder. Every action function below
-- calls this FIRST. Delegation (PRD §19) isn't built until Phase 8 — the
-- `delegations` table doesn't exist yet — so this only checks
-- assigned_user_id for now.
--   TODO(Phase 8): also allow an active delegate here, per `delegations`.
create function private.assert_current_holder(p_memo_id uuid) returns workflow_steps
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.workflow_steps;
begin
  select * into v_row from public.workflow_steps
  where memo_id = p_memo_id and status = 'current'
  for update;

  if v_row.id is null then
    raise exception 'This memo has no current holder — it is not in an active workflow.';
  end if;

  if v_row.assigned_user_id != auth.uid() then
    raise exception 'Only the current holder may act on this memo.';
  end if;

  return v_row;
end;
$$;

revoke all on function private.assert_current_holder(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- submit_memo: author-only, draft -> submitted, creates the initial chain.
-- ---------------------------------------------------------------------
create function submit_memo(p_memo_id uuid, p_participant_ids uuid[]) returns void
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
      (p_memo_id, v_order, v_uid, case when v_order = 1000 then 'current' else 'queued' end, true);
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
  perform private.notify_user(
    v_org_id, v_first_holder, 'memo_requires_action', p_memo_id,
    format('"%s" requires your action.', v_memo.subject)
  );
end;
$$;

-- ---------------------------------------------------------------------
-- workflow_approve: current holder only. Forwards to next-in-chain, or to
-- someone new if p_forward_to_user_id is given, or completes the memo if
-- nothing is left.
-- ---------------------------------------------------------------------
create function workflow_approve(
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

-- ---------------------------------------------------------------------
-- workflow_decline_reroute: current holder only. Not a judgment on content
-- — same insertion mechanism as approve-forward-to-new (confirmed with the
-- user), but the current row resolves to 'declined', not 'approved'.
-- ---------------------------------------------------------------------
create function workflow_decline_reroute(
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
    v_memo.organization_id, p_new_holder_id, 'memo_requires_action', p_memo_id,
    format('"%s" requires your action.', v_memo.subject)
  );
end;
$$;

-- ---------------------------------------------------------------------
-- workflow_reject: current holder only. Terminal. Reason required.
-- ---------------------------------------------------------------------
create function workflow_reject(p_memo_id uuid, p_reason text) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current public.workflow_steps;
  v_memo public.memos;
begin
  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'A reason is required to reject a memo.';
  end if;

  v_current := private.assert_current_holder(p_memo_id);
  select * into v_memo from public.memos where id = p_memo_id;

  update public.workflow_steps
  set status = 'rejected', action_taken = 'reject', comment = p_reason, acted_at = now()
  where id = v_current.id;

  update public.workflow_steps
  set status = 'skipped'
  where memo_id = p_memo_id and status = 'queued';

  update public.memos set status = 'rejected', completed_at = now() where id = p_memo_id;

  insert into public.comments (memo_id, author_id, body, comment_type)
  values (p_memo_id, auth.uid(), p_reason, 'rejection');

  perform private.log_audit_event(
    v_memo.organization_id, 'rejection', auth.uid(), 'memo', p_memo_id,
    format('Rejected "%s".', v_memo.subject)
  );
  perform private.notify_user(
    v_memo.organization_id, v_memo.author_id, 'memo_rejected', p_memo_id,
    format('"%s" was rejected.', v_memo.subject)
  );
end;
$$;

-- ---------------------------------------------------------------------
-- workflow_request_changes: current holder only. Not terminal — returns to
-- the author. Explanation required.
-- ---------------------------------------------------------------------
create function workflow_request_changes(p_memo_id uuid, p_explanation text) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current public.workflow_steps;
  v_memo public.memos;
begin
  if p_explanation is null or length(trim(p_explanation)) = 0 then
    raise exception 'An explanation is required to request changes.';
  end if;

  v_current := private.assert_current_holder(p_memo_id);
  select * into v_memo from public.memos where id = p_memo_id;

  update public.workflow_steps
  set status = 'changes_requested', action_taken = 'request_changes', comment = p_explanation, acted_at = now()
  where id = v_current.id;

  update public.memos set status = 'changes_requested' where id = p_memo_id;

  insert into public.comments (memo_id, author_id, body, comment_type)
  values (p_memo_id, auth.uid(), p_explanation, 'change_request');

  perform private.log_audit_event(
    v_memo.organization_id, 'change_request', auth.uid(), 'memo', p_memo_id,
    format('Requested changes on "%s".', v_memo.subject)
  );
  perform private.notify_user(
    v_memo.organization_id, v_memo.author_id, 'changes_requested', p_memo_id,
    format('Changes were requested on "%s".', v_memo.subject)
  );
end;
$$;

-- ---------------------------------------------------------------------
-- resubmit_memo: author-only, changes_requested -> submitted. The author
-- becomes a transient current holder and then uses workflow_approve /
-- workflow_decline_reroute (the same primitives as anyone else) to decide
-- where it goes next — no separate "resume" logic, per PRD §7.1 item 5.
-- ---------------------------------------------------------------------
create function resubmit_memo(p_memo_id uuid) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_memo public.memos;
  v_next_version int;
  v_min_queued_order double precision;
  v_new_order double precision;
  v_recipient uuid;
begin
  select * into v_memo from public.memos where id = p_memo_id for update;
  if v_memo.id is null then
    raise exception 'Memo not found.';
  end if;
  if v_memo.author_id != auth.uid() then
    raise exception 'Only the author may resubmit this memo.';
  end if;
  if v_memo.status != 'changes_requested' then
    raise exception 'Only a memo with changes requested may be resubmitted.';
  end if;

  select coalesce(max(version_number), 0) + 1 into v_next_version
  from public.memo_versions where memo_id = p_memo_id;

  insert into public.memo_versions (memo_id, version_number, editor_id, content_snapshot, associated_submission_at)
  values (p_memo_id, v_next_version, auth.uid(), jsonb_build_object('subject', v_memo.subject, 'body', v_memo.body), now());

  select min(sequence_order) into v_min_queued_order
  from public.workflow_steps where memo_id = p_memo_id and status = 'queued';

  v_new_order := case
    when v_min_queued_order is null then
      (select coalesce(max(sequence_order), 0) + 1000 from public.workflow_steps where memo_id = p_memo_id)
    else v_min_queued_order - 1000
  end;

  insert into public.workflow_steps
    (memo_id, sequence_order, assigned_user_id, status, is_original, added_by)
  values
    (p_memo_id, v_new_order, auth.uid(), 'current', false, null);

  update public.memos set status = 'submitted' where id = p_memo_id;

  perform private.log_audit_event(
    v_memo.organization_id, 'resubmission', auth.uid(), 'memo', p_memo_id,
    format('"%s" resubmitted as version %s.', v_memo.subject, v_next_version)
  );

  for v_recipient in
    select distinct assigned_user_id from public.workflow_steps
    where memo_id = p_memo_id and assigned_user_id != auth.uid()
  loop
    perform private.notify_user(
      v_memo.organization_id, v_recipient, 'memo_resubmitted', p_memo_id,
      format('"%s" was resubmitted after changes.', v_memo.subject)
    );
  end loop;
end;
$$;

revoke all on function submit_memo(uuid, uuid[]) from public, anon;
revoke all on function workflow_approve(uuid, text, uuid) from public, anon;
revoke all on function workflow_decline_reroute(uuid, uuid, text) from public, anon;
revoke all on function workflow_reject(uuid, text) from public, anon;
revoke all on function workflow_request_changes(uuid, text) from public, anon;
revoke all on function resubmit_memo(uuid) from public, anon;

grant execute on function submit_memo(uuid, uuid[]) to authenticated;
grant execute on function workflow_approve(uuid, text, uuid) to authenticated;
grant execute on function workflow_decline_reroute(uuid, uuid, text) to authenticated;
grant execute on function workflow_reject(uuid, text) to authenticated;
grant execute on function workflow_request_changes(uuid, text) to authenticated;
grant execute on function resubmit_memo(uuid) to authenticated;
