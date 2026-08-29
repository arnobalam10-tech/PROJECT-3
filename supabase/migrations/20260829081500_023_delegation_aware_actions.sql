-- Wires delegations (migration 022) into the workflow action functions, and
-- adds the "acted by X on behalf of Y" attribution PRD §19 requires: "Any
-- action a delegate performs must clearly show both 'acted by [delegate]
-- on behalf of [delegating user]' in the timeline — never silently
-- attributed to just one of them." Resolves the TODO(Phase 8) left in
-- migration 013's private.assert_current_holder().

-- acted_by: who actually performed the action (always set — equals
-- assigned_user_id for a non-delegated action, or the delegate's id when
-- acting on someone's behalf). assigned_user_id stays untouched as "whose
-- position in the chain this is" either way, so is_workflow_participant()
-- and every existing visibility policy keyed off assigned_user_id needs no
-- change.
alter table workflow_steps add column acted_by uuid references profiles(id) on delete set null;

alter table comments add column on_behalf_of_user_id uuid references profiles(id) on delete set null;
alter table audit_log add column on_behalf_of_user_id uuid references profiles(id) on delete set null;

-- log_audit_event gains an optional 7th param instead of a follow-up UPDATE
-- to backfill attribution — a separate "find the row I just inserted and
-- patch it" step would need to match on (org, event_type, entity, user,
-- most-recent), which is unnecessary ambiguity to introduce when the caller
-- already knows the value at insert time. Drop + recreate (rather than
-- CREATE OR REPLACE with a new parameter list, which would just add a
-- second overload alongside the old one) so there's exactly one version of
-- this function.
drop function private.log_audit_event(uuid, text, uuid, text, uuid, text);

create function private.log_audit_event(
  p_organization_id uuid,
  p_event_type text,
  p_user_id uuid,
  p_related_entity_type text,
  p_related_entity_id uuid,
  p_description text,
  p_on_behalf_of_user_id uuid default null
) returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.audit_log
    (organization_id, event_type, user_id, related_entity_type, related_entity_id, description, on_behalf_of_user_id)
  values
    (p_organization_id, p_event_type, p_user_id, p_related_entity_type, p_related_entity_id, p_description, p_on_behalf_of_user_id);
$$;

revoke all on function private.log_audit_event(uuid, text, uuid, text, uuid, text, uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- assert_current_holder: now accepts an active delegate too, not just the
-- literal assigned_user_id. "Active" means status = 'active' AND today
-- falls within [start_date, end_date] — checked directly against the date
-- range rather than trusting the stored status label alone, so a
-- delegation that's simply run past its end_date is correctly refused
-- immediately without needing anything to flip its status first. A
-- revoked delegation (status = 'revoked') fails the status check
-- immediately regardless of dates.
-- ---------------------------------------------------------------------
create or replace function private.assert_current_holder(p_memo_id uuid) returns workflow_steps
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
    if not exists (
      select 1 from public.delegations d
      where d.delegating_user_id = v_row.assigned_user_id
        and d.delegate_user_id = auth.uid()
        and d.status = 'active'
        and current_date between d.start_date and d.end_date
    ) then
      raise exception 'Only the current holder (or their active delegate) may act on this memo.';
    end if;
  end if;

  return v_row;
end;
$$;

-- ---------------------------------------------------------------------
-- workflow_approve: set acted_by; attribute comments/audit_log with
-- on_behalf_of_user_id whenever the actor isn't the position holder.
-- ---------------------------------------------------------------------
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

-- ---------------------------------------------------------------------
-- workflow_decline_reroute
-- ---------------------------------------------------------------------
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
  perform private.notify_user(
    v_memo.organization_id, p_new_holder_id, 'memo_requires_action', p_memo_id,
    format('"%s" requires your action.', v_memo.subject)
  );
end;
$$;

-- ---------------------------------------------------------------------
-- workflow_reject
-- ---------------------------------------------------------------------
create or replace function workflow_reject(p_memo_id uuid, p_reason text) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current public.workflow_steps;
  v_memo public.memos;
  v_on_behalf_of uuid;
begin
  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'A reason is required to reject a memo.';
  end if;

  v_current := private.assert_current_holder(p_memo_id);
  v_on_behalf_of := case when auth.uid() != v_current.assigned_user_id then v_current.assigned_user_id else null end;
  select * into v_memo from public.memos where id = p_memo_id;

  update public.workflow_steps
  set status = 'rejected', action_taken = 'reject', comment = p_reason, acted_at = now(), acted_by = auth.uid()
  where id = v_current.id;

  update public.workflow_steps
  set status = 'skipped'
  where memo_id = p_memo_id and status = 'queued';

  update public.memos set status = 'rejected', completed_at = now() where id = p_memo_id;

  insert into public.comments (memo_id, author_id, body, comment_type, on_behalf_of_user_id)
  values (p_memo_id, auth.uid(), p_reason, 'rejection', v_on_behalf_of);

  perform private.log_audit_event(
    v_memo.organization_id, 'rejection', auth.uid(), 'memo', p_memo_id,
    format('Rejected "%s".', v_memo.subject),
    v_on_behalf_of
  );
  perform private.notify_user(
    v_memo.organization_id, v_memo.author_id, 'memo_rejected', p_memo_id,
    format('"%s" was rejected.', v_memo.subject)
  );
end;
$$;

-- ---------------------------------------------------------------------
-- workflow_request_changes
-- ---------------------------------------------------------------------
create or replace function workflow_request_changes(p_memo_id uuid, p_explanation text) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current public.workflow_steps;
  v_memo public.memos;
  v_on_behalf_of uuid;
begin
  if p_explanation is null or length(trim(p_explanation)) = 0 then
    raise exception 'An explanation is required to request changes.';
  end if;

  v_current := private.assert_current_holder(p_memo_id);
  v_on_behalf_of := case when auth.uid() != v_current.assigned_user_id then v_current.assigned_user_id else null end;
  select * into v_memo from public.memos where id = p_memo_id;

  update public.workflow_steps
  set status = 'changes_requested', action_taken = 'request_changes', comment = p_explanation, acted_at = now(), acted_by = auth.uid()
  where id = v_current.id;

  update public.memos set status = 'changes_requested' where id = p_memo_id;

  insert into public.comments (memo_id, author_id, body, comment_type, on_behalf_of_user_id)
  values (p_memo_id, auth.uid(), p_explanation, 'change_request', v_on_behalf_of);

  perform private.log_audit_event(
    v_memo.organization_id, 'change_request', auth.uid(), 'memo', p_memo_id,
    format('Requested changes on "%s".', v_memo.subject),
    v_on_behalf_of
  );
  perform private.notify_user(
    v_memo.organization_id, v_memo.author_id, 'changes_requested', p_memo_id,
    format('Changes were requested on "%s".', v_memo.subject)
  );
end;
$$;

-- ---------------------------------------------------------------------
-- Non-current-holder-gated functions (submit_memo, resubmit_memo,
-- comments_after_insert trigger) are unaffected — delegation per PRD §19 is
-- scoped to acting on the memo currently held, i.e. the assert_current_holder
-- gate, not to author-only actions like submitting or resubmitting. See
-- STATUS.md's Phase 8 decisions log for why this scope was chosen.
-- ---------------------------------------------------------------------
