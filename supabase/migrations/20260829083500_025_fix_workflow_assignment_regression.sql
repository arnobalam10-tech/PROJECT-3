-- Self-caught regression: migration 023 (delegation attribution) rewrote
-- workflow_approve/workflow_decline_reroute from the wrong baseline — the
-- original migration 013 bodies rather than migration 019's actual live
-- versions — and in doing so silently dropped migration 019's
-- 'workflow_assignment' notification for a participant added mid-chain
-- (forward-to-someone-new in workflow_approve; the reroute target in
-- workflow_decline_reroute). Caught by re-querying the live function
-- definition via pg_get_functiondef rather than trusting memory, immediately
-- after applying migration 024 and noticing the diff didn't match. Restores
-- exactly the notify_user calls migration 019 added, on top of migration
-- 023's acted_by/on_behalf_of attribution (both keep, neither regresses).

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
  v_on_behalf_of uuid;
begin
  v_current := private.assert_current_holder(p_memo_id);
  v_on_behalf_of := case when auth.uid() != v_current.assigned_user_id then v_current.assigned_user_id else null end;
  select * into v_memo from public.memos where id = p_memo_id;

  update public.workflow_steps
  set status = 'approved', action_taken = 'approve', comment = p_comment, acted_at = now(), acted_by = auth.uid()
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
      format('Approved and forwarded "%s" to a new participant outside the original chain.', v_memo.subject),
      v_on_behalf_of
    );
    -- New to this workflow AND it's their turn right now — both apply
    -- (restored from migration 019, dropped by mistake in migration 023).
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
        format('Approved "%s", forwarded to the next participant in the original chain.', v_memo.subject),
        v_on_behalf_of
      );
      perform private.notify_user(
        v_memo.organization_id, v_next.assigned_user_id, 'memo_requires_action', p_memo_id,
        format('"%s" requires your action.', v_memo.subject)
      );
    else
      update public.memos set status = 'approved', completed_at = now() where id = p_memo_id;

      perform private.log_audit_event(
        v_memo.organization_id, 'approval', auth.uid(), 'memo', p_memo_id,
        format('Approved "%s" — no remaining participants.', v_memo.subject),
        v_on_behalf_of
      );
      perform private.log_audit_event(
        v_memo.organization_id, 'workflow_completion', auth.uid(), 'memo', p_memo_id,
        format('"%s" completed (approved).', v_memo.subject),
        v_on_behalf_of
      );
      perform private.notify_user(
        v_memo.organization_id, v_memo.author_id, 'workflow_completed', p_memo_id,
        format('"%s" was approved and is now complete.', v_memo.subject)
      );
    end if;
  end if;

  if p_comment is not null and length(trim(p_comment)) > 0 then
    insert into public.comments (memo_id, author_id, body, comment_type, on_behalf_of_user_id)
    values (p_memo_id, auth.uid(), p_comment, 'approval', v_on_behalf_of);
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
  v_on_behalf_of uuid;
begin
  v_current := private.assert_current_holder(p_memo_id);
  v_on_behalf_of := case when auth.uid() != v_current.assigned_user_id then v_current.assigned_user_id else null end;
  select * into v_memo from public.memos where id = p_memo_id;

  if not exists (
    select 1 from public.profiles
    where id = p_new_holder_id and organization_id = v_memo.organization_id and status = 'active'
  ) then
    raise exception 'Invalid reroute target.';
  end if;

  update public.workflow_steps
  set status = 'declined', action_taken = 'decline', comment = p_comment, acted_at = now(), acted_by = auth.uid()
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
    insert into public.comments (memo_id, author_id, body, comment_type, on_behalf_of_user_id)
    values (p_memo_id, auth.uid(), p_comment, 'general', v_on_behalf_of);
  end if;

  perform private.log_audit_event(
    v_memo.organization_id, 'decline', auth.uid(), 'memo', p_memo_id,
    format('Declined and rerouted "%s" to a different participant.', v_memo.subject),
    v_on_behalf_of
  );
  -- Restored from migration 019 (see note above).
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
