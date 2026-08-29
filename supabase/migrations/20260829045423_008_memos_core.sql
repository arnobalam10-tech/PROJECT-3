create type memo_priority as enum ('normal', 'high', 'urgent');
create type memo_status as enum (
  'draft', 'submitted', 'pending_review', 'pending_approval',
  'changes_requested', 'rejected', 'approved', 'cancelled'
);

create table memos (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  memo_number text not null,
  subject text not null,
  body jsonb not null default '{}'::jsonb,
  author_id uuid not null references profiles(id) on delete restrict,
  department_id uuid references departments(id) on delete set null,
  category_id uuid references memo_categories(id) on delete set null,
  priority memo_priority not null default 'normal',
  status memo_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  submitted_at timestamptz,
  completed_at timestamptz,
  unique (organization_id, memo_number)
);

create index memos_organization_id_idx on memos(organization_id);
create index memos_author_id_idx on memos(author_id);

alter table memos enable row level security;

create trigger memos_set_updated_at
  before update on memos
  for each row execute function set_updated_at();

-- Per-org atomic memo-number counter. Not RLS-protected — only ever touched
-- via the SECURITY DEFINER generate_memo_number() below.
create table memo_number_counters (
  organization_id uuid primary key references organizations(id) on delete cascade,
  next_number int not null default 1
);

create function generate_memo_number(org_id uuid) returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  n int;
  org_slug text;
begin
  insert into public.memo_number_counters (organization_id, next_number)
  values (org_id, 2)
  on conflict (organization_id) do update set next_number = memo_number_counters.next_number + 1
  returning next_number - 1 into n;

  select slug into org_slug from public.organizations where id = org_id;

  return upper(org_slug) || '-' || to_char(now(), 'YYYY') || '-' || lpad(n::text, 5, '0');
end;
$$;

revoke all on function generate_memo_number(uuid) from public, anon;
grant execute on function generate_memo_number(uuid) to authenticated;

-- Phase-3 visibility: author sees their own memos; org_admin sees the whole org.
-- PRD §2.5 item 7 / §14 widens regular-user visibility to "authored or was a
-- workflow participant" once workflow_steps exists (Phase 4) — this policy
-- will be extended then, noted in STATUS.md so it isn't forgotten.
create policy "memos_select_own_or_admin" on memos
  for select using (
    organization_id = private.current_organization_id()
    and (author_id = auth.uid() or private.current_role() = 'org_admin')
  );

create policy "memos_insert_own" on memos
  for insert with check (
    organization_id = private.current_organization_id()
    and author_id = auth.uid()
  );

-- Only the author may edit/delete, and only while still a draft (PRD §6.2).
create policy "memos_update_own_draft" on memos
  for update using (
    organization_id = private.current_organization_id()
    and author_id = auth.uid()
    and status = 'draft'
  );

create policy "memos_delete_own_draft" on memos
  for delete using (
    organization_id = private.current_organization_id()
    and author_id = auth.uid()
    and status = 'draft'
  );

-- Attachments: no organization_id column (per DATABASE.md's schema for this
-- table) — tenant isolation is enforced transitively via memo_id -> memos.
create table attachments (
  id uuid primary key default gen_random_uuid(),
  memo_id uuid not null references memos(id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  file_size bigint not null,
  mime_type text not null,
  uploaded_by uuid not null references profiles(id) on delete restrict,
  uploaded_at timestamptz not null default now()
);

create index attachments_memo_id_idx on attachments(memo_id);

alter table attachments enable row level security;

create policy "attachments_select_via_memo" on attachments
  for select using (
    exists (
      select 1 from memos m
      where m.id = attachments.memo_id
        and m.organization_id = private.current_organization_id()
        and (m.author_id = auth.uid() or private.current_role() = 'org_admin')
    )
  );

create policy "attachments_insert_via_memo_author" on attachments
  for insert with check (
    uploaded_by = auth.uid()
    and exists (
      select 1 from memos m
      where m.id = attachments.memo_id
        and m.organization_id = private.current_organization_id()
        and m.author_id = auth.uid()
        and m.status = 'draft'
    )
  );

create policy "attachments_delete_via_memo_author" on attachments
  for delete using (
    exists (
      select 1 from memos m
      where m.id = attachments.memo_id
        and m.organization_id = private.current_organization_id()
        and m.author_id = auth.uid()
        and m.status = 'draft'
    )
  );
