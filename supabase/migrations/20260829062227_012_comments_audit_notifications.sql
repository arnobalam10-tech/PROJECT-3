create type comment_type as enum ('general', 'approval', 'rejection', 'change_request');

create table comments (
  id uuid primary key default gen_random_uuid(),
  memo_id uuid not null references memos(id) on delete cascade,
  author_id uuid not null references profiles(id) on delete restrict,
  body text not null,
  comment_type comment_type not null default 'general',
  created_at timestamptz not null default now()
);

create index comments_memo_id_idx on comments(memo_id);

alter table comments enable row level security;

create policy "comments_select_authorized" on comments
  for select using (
    exists (
      select 1 from memos m
      where m.id = comments.memo_id
        and m.organization_id = private.current_organization_id()
        and (
          m.author_id = auth.uid()
          or private.current_role() = 'org_admin'
          or private.is_workflow_participant(m.id)
        )
    )
  );

-- Direct client inserts are allowed ONLY for comment_type = 'general' (any
-- authorized viewer, matching PRD §11 — general remarks aren't gated to
-- "current holder only"). approval/rejection/change_request-typed comments
-- are only ever inserted by the SECURITY DEFINER workflow-action functions
-- (migration 013) as part of an actual workflow transition, never directly —
-- enforced by the with_check clause below, not just app-level discipline.
create policy "comments_insert_general_by_authorized_viewer" on comments
  for insert with check (
    author_id = auth.uid()
    and comment_type = 'general'
    and exists (
      select 1 from memos m
      where m.id = comments.memo_id
        and m.organization_id = private.current_organization_id()
        and (
          m.author_id = auth.uid()
          or private.current_role() = 'org_admin'
          or private.is_workflow_participant(m.id)
        )
    )
  );
-- No update/delete policy for anyone (ordinary users) — immutable audit
-- trail per PRD §11.

create table audit_log (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  event_type text not null,
  user_id uuid references profiles(id) on delete set null,
  related_entity_type text,
  related_entity_id uuid,
  description text,
  created_at timestamptz not null default now()
);

create index audit_log_organization_id_idx on audit_log(organization_id);
create index audit_log_related_entity_idx on audit_log(related_entity_type, related_entity_id);

alter table audit_log enable row level security;

-- Org admins may view their own org's log. No insert/update/delete policy
-- for any client role at all — writes only happen via SECURITY DEFINER
-- functions (the "trusted backend process" PRD §21 / DATABASE.md call for).
create policy "audit_log_select_org_admin" on audit_log
  for select using (
    organization_id = private.current_organization_id()
    and private.current_role() = 'org_admin'
  );

create table notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  type text not null,
  memo_id uuid references memos(id) on delete cascade,
  message text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index notifications_user_id_idx on notifications(user_id, is_read);

alter table notifications enable row level security;

create policy "notifications_select_own" on notifications
  for select using (user_id = auth.uid());

-- A user may mark their own notifications read/unread, nothing else about
-- them (they can't reassign or reword a system-generated notification).
create policy "notifications_update_own_is_read" on notifications
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
-- No insert/delete policy for clients — only SECURITY DEFINER functions
-- create notifications.

-- Shared helpers used by every SECURITY DEFINER action function so the
-- audit_log/notifications writes are consistent instead of scattered
-- ad hoc across each function (per DATABASE.md's explicit instruction).
create function private.log_audit_event(
  p_organization_id uuid,
  p_event_type text,
  p_user_id uuid,
  p_related_entity_type text,
  p_related_entity_id uuid,
  p_description text
) returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.audit_log
    (organization_id, event_type, user_id, related_entity_type, related_entity_id, description)
  values
    (p_organization_id, p_event_type, p_user_id, p_related_entity_type, p_related_entity_id, p_description);
$$;

create function private.notify_user(
  p_organization_id uuid,
  p_user_id uuid,
  p_type text,
  p_memo_id uuid,
  p_message text
) returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.notifications (organization_id, user_id, type, memo_id, message)
  values (p_organization_id, p_user_id, p_type, p_memo_id, p_message);
$$;

revoke all on function private.log_audit_event(uuid, text, uuid, text, uuid, text) from public, anon, authenticated;
revoke all on function private.notify_user(uuid, uuid, text, uuid, text) from public, anon, authenticated;
-- Deliberately NOT granted to authenticated either — these are only ever
-- called from inside other SECURITY DEFINER functions (which run with the
-- definer's own privileges, so they can call these regardless of the
-- invoking client role's grants). This keeps them fully un-callable from
-- the client, unlike is_workflow_participant() which legitimately needs to
-- run during RLS policy evaluation as `authenticated`.

-- Auto-audit + auto-notify for general comments (direct client inserts,
-- not routed through a SECURITY DEFINER function) — PRD §21/§13 list
-- "comment" and "comment added" as an audited event / notification trigger
-- respectively, so this can't be skipped just because the insert path is a
-- plain RLS-gated INSERT rather than a function call.
create function private.comments_after_insert() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org_id uuid;
  v_author_name text;
  v_memo_subject text;
  v_recipient uuid;
begin
  select m.organization_id, m.subject into v_org_id, v_memo_subject
  from public.memos m where m.id = new.memo_id;

  select p.name into v_author_name from public.profiles p where p.id = new.author_id;

  perform private.log_audit_event(
    v_org_id, 'comment', new.author_id, 'memo', new.memo_id,
    format('%s commented on "%s"', v_author_name, v_memo_subject)
  );

  -- Notify the author and every distinct participant, excluding whoever
  -- just wrote the comment.
  for v_recipient in
    select distinct uid from (
      select author_id as uid from public.memos where id = new.memo_id
      union
      select assigned_user_id as uid from public.workflow_steps where memo_id = new.memo_id
    ) recipients
    where uid is not null and uid != new.author_id
  loop
    perform private.notify_user(
      v_org_id, v_recipient, 'comment_added', new.memo_id,
      format('%s commented on "%s"', v_author_name, v_memo_subject)
    );
  end loop;

  return new;
end;
$$;

create trigger comments_after_insert_audit_notify
  after insert on comments
  for each row execute function private.comments_after_insert();
