create type workflow_step_status as enum (
  'queued', 'current', 'approved', 'rejected', 'changes_requested', 'declined', 'skipped'
);
create type workflow_action_taken as enum (
  'approve', 'reject', 'comment', 'request_changes', 'forward', 'decline'
);

create table workflow_steps (
  id uuid primary key default gen_random_uuid(),
  memo_id uuid not null references memos(id) on delete cascade,
  sequence_order double precision not null,
  assigned_user_id uuid not null references profiles(id) on delete restrict,
  status workflow_step_status not null default 'queued',
  action_taken workflow_action_taken,
  comment text,
  is_original boolean not null default true,
  added_by uuid references profiles(id) on delete set null,
  acted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index workflow_steps_memo_id_idx on workflow_steps(memo_id);
create index workflow_steps_assigned_user_id_idx on workflow_steps(assigned_user_id);

-- Exactly one `current` holder PER MEMO (scoped by memo_id, not a global
-- singleton) — confirmed explicitly with the user before creating this.
create unique index workflow_steps_one_current_per_memo
  on workflow_steps (memo_id) where (status = 'current');

alter table workflow_steps enable row level security;

create trigger workflow_steps_set_updated_at
  before update on workflow_steps
  for each row execute function set_updated_at();

-- Participation check as a SECURITY DEFINER helper, NOT a subquery on
-- workflow_steps from within its own policy — that reproduces the exact
-- self-referential-RLS bug fixed in migration 004 (a policy on table T that
-- resolves via a subquery on T itself can never bootstrap: there's no
-- non-recursive base case for a plain participant, only for the
-- author/admin branches). This function bypasses RLS for one narrow,
-- specific lookup, same pattern as private.current_organization_id().
create function private.is_workflow_participant(p_memo_id uuid) returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.workflow_steps
    where memo_id = p_memo_id and assigned_user_id = auth.uid()
  );
$$;

revoke all on function private.is_workflow_participant(uuid) from public, anon;
grant execute on function private.is_workflow_participant(uuid) to authenticated;

-- Visible to: org admin, the memo's author, or anyone who ever held a step
-- on it (queued/current/resolved all count as "participant" per PRD §14's
-- "authored, or are/were a participant in").
create policy "workflow_steps_select_authorized" on workflow_steps
  for select using (
    exists (
      select 1 from memos m
      where m.id = workflow_steps.memo_id
        and m.organization_id = private.current_organization_id()
        and (
          m.author_id = auth.uid()
          or private.current_role() = 'org_admin'
          or private.is_workflow_participant(m.id)
        )
    )
  );

-- Deliberately NO insert/update/delete policies here at all. Every mutation
-- goes through the SECURITY DEFINER workflow-action functions (migration
-- 013), which perform their own authorization check (current holder only)
-- before touching any row. This means even a client with a valid session
-- cannot directly INSERT/UPDATE/DELETE a workflow_steps row via the normal
-- REST API — only by calling one of those functions.
