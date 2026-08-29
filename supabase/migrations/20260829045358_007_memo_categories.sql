create table memo_categories (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (organization_id, name)
);

create index memo_categories_organization_id_idx on memo_categories(organization_id);

alter table memo_categories enable row level security;

create policy "memo_categories_select_same_org" on memo_categories
  for select using (organization_id = private.current_organization_id());

create policy "memo_categories_insert_same_org_admin" on memo_categories
  for insert with check (
    organization_id = private.current_organization_id()
    and private.current_role() = 'org_admin'
  );

create policy "memo_categories_update_same_org_admin" on memo_categories
  for update using (
    organization_id = private.current_organization_id()
    and private.current_role() = 'org_admin'
  );

-- Seed the default category set (PRD §6.1) into every newly created organization.
create or replace function create_organization_with_admin(
  org_name text,
  org_slug text,
  admin_name text,
  admin_designation text default null
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_org_id uuid;
  caller_id uuid := auth.uid();
  caller_email text;
begin
  if caller_id is null then
    raise exception 'not authenticated';
  end if;

  if exists (select 1 from public.profiles where id = caller_id) then
    raise exception 'user already belongs to an organization';
  end if;

  select email into caller_email from auth.users where id = caller_id;

  insert into public.organizations (name, slug)
  values (org_name, org_slug)
  returning id into new_org_id;

  insert into public.profiles (id, organization_id, email, name, designation, role, status)
  values (caller_id, new_org_id, caller_email, admin_name, admin_designation, 'org_admin', 'active');

  update public.organizations set created_by = caller_id where id = new_org_id;

  insert into public.memo_categories (organization_id, name, description)
  values
    (new_org_id, 'Administrative', null),
    (new_org_id, 'Financial', null),
    (new_org_id, 'Procurement', null),
    (new_org_id, 'HR', null),
    (new_org_id, 'Academic', null),
    (new_org_id, 'Technical', null),
    (new_org_id, 'General', null);

  return new_org_id;
end;
$$;

revoke execute on function create_organization_with_admin(text, text, text, text) from public, anon;
grant execute on function create_organization_with_admin(text, text, text, text) to authenticated;
