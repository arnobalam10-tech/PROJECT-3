-- PRD §19: a user can designate another authorized user to act on their
-- behalf for a date range, with an optional reason. Writes are deliberately
-- NOT plain RLS-gated INSERT/UPDATE — same reasoning as workflow_steps: the
-- validation (same-org, active target, not self, sane date range, only the
-- delegator may revoke their own delegation) needs to be enforced
-- server-side in one place, not duplicated between RLS and app code. So
-- this table has SELECT-only RLS; all writes go through the two SECURITY
-- DEFINER functions below.

create type delegation_status as enum ('active', 'expired', 'revoked');
-- NOTE: 'expired' is kept in the enum for documentation/future use, but no
-- function in this migration ever writes it. Enforcement (see migration 023's
-- updated private.assert_current_holder()) checks `current_date between
-- start_date and end_date` directly, independent of the stored status label
-- — so a delegation past its end_date is correctly unusable immediately,
-- without needing a scheduled job to flip a status column. The app's read
-- queries compute an "expired" *display* label from end_date at read time
-- (see STATUS.md's Phase 8 decisions) rather than relying on the stored
-- value, which only ever transitions active -> revoked.

create table delegations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  delegating_user_id uuid not null references profiles(id) on delete cascade,
  delegate_user_id uuid not null references profiles(id) on delete cascade,
  start_date date not null,
  end_date date not null,
  reason text,
  status delegation_status not null default 'active',
  created_at timestamptz not null default now(),
  check (end_date >= start_date),
  check (delegating_user_id != delegate_user_id)
);

create index delegations_delegating_user_id_idx on delegations(delegating_user_id);
create index delegations_delegate_user_id_idx on delegations(delegate_user_id);

alter table delegations enable row level security;

-- Visible to: the delegator, the delegate, and org admins (oversight —
-- PRD §5 gives admins "view org-level stats and memo info"; delegation is
-- an authorization-relevant fact about the org worth the same visibility).
create policy "delegations_select_involved_or_admin" on delegations
  for select using (
    organization_id = private.current_organization_id()
    and (
      delegating_user_id = auth.uid()
      or delegate_user_id = auth.uid()
      or private.current_role() = 'org_admin'
    )
  );
-- No INSERT/UPDATE/DELETE policy for any client role — only the two
-- SECURITY DEFINER functions below may write.

create function create_delegation(
  p_delegate_user_id uuid,
  p_start_date date,
  p_end_date date,
  p_reason text default null
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org_id uuid;
  v_new_id uuid;
  v_delegate_name text;
  v_delegator_name text;
begin
  v_org_id := private.current_organization_id();

  if p_delegate_user_id = auth.uid() then
    raise exception 'You cannot delegate to yourself.';
  end if;

  if not exists (
    select 1 from public.profiles
    where id = p_delegate_user_id and organization_id = v_org_id and status = 'active'
  ) then
    raise exception 'Invalid delegate — must be an active member of your organization.';
  end if;

  if p_start_date is null or p_end_date is null or p_end_date < p_start_date then
    raise exception 'Invalid date range.';
  end if;
  if p_end_date < current_date then
    raise exception 'End date cannot be in the past.';
  end if;

  insert into public.delegations
    (organization_id, delegating_user_id, delegate_user_id, start_date, end_date, reason, status)
  values
    (v_org_id, auth.uid(), p_delegate_user_id, p_start_date, p_end_date, p_reason, 'active')
  returning id into v_new_id;

  select name into v_delegate_name from public.profiles where id = p_delegate_user_id;
  select name into v_delegator_name from public.profiles where id = auth.uid();

  perform private.log_audit_event(
    v_org_id, 'delegation_created', auth.uid(), 'delegation', v_new_id,
    format('%s delegated authority to %s (%s to %s).', v_delegator_name, v_delegate_name, p_start_date, p_end_date)
  );
  perform private.notify_user(
    v_org_id, p_delegate_user_id, 'delegation_assigned', null,
    format('%s delegated their workflow authority to you from %s to %s.', v_delegator_name, p_start_date, p_end_date)
  );

  return v_new_id;
end;
$$;

create function revoke_delegation(p_delegation_id uuid) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.delegations;
begin
  select * into v_row from public.delegations where id = p_delegation_id for update;

  if v_row.id is null then
    raise exception 'Delegation not found.';
  end if;
  if v_row.delegating_user_id != auth.uid() then
    raise exception 'Only the person who created a delegation may revoke it.';
  end if;
  if v_row.status != 'active' then
    raise exception 'This delegation is not active.';
  end if;

  update public.delegations set status = 'revoked' where id = p_delegation_id;

  perform private.log_audit_event(
    v_row.organization_id, 'delegation_revoked', auth.uid(), 'delegation', p_delegation_id, 'Delegation revoked.'
  );
end;
$$;

revoke all on function create_delegation(uuid, date, date, text) from public, anon;
revoke all on function revoke_delegation(uuid) from public, anon;
grant execute on function create_delegation(uuid, date, date, text) to authenticated;
grant execute on function revoke_delegation(uuid) to authenticated;
