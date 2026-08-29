-- Enums
create type user_role as enum ('org_admin', 'regular_user');
create type user_status as enum ('active', 'inactive');

-- organizations: global, not tenant-scoped (this IS the tenant)
create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  logo_url text,
  contact_email text,
  contact_phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- profiles: tenant-scoped, 1:1 with auth.users
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  organization_id uuid not null references organizations(id) on delete restrict,
  email text not null,
  name text not null,
  designation text,
  department_id uuid, -- FK added in a later migration once departments exists
  role user_role not null default 'regular_user',
  status user_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index profiles_organization_id_idx on profiles(organization_id);

alter table organizations enable row level security;
alter table profiles enable row level security;

-- organizations: a user may only see their own org
create policy "organizations_select_own" on organizations
  for select using (
    id = (select organization_id from profiles where id = auth.uid())
  );

-- organizations: only org_admins may update their own org
create policy "organizations_update_own_admin" on organizations
  for update using (
    id = (select organization_id from profiles where id = auth.uid())
    and (select role from profiles where id = auth.uid()) = 'org_admin'
  );

-- profiles: a user may see all profiles within their own org
create policy "profiles_select_same_org" on profiles
  for select using (
    organization_id = (select organization_id from profiles where id = auth.uid())
  );

-- profiles: a user may update their own profile
create policy "profiles_update_self" on profiles
  for update using (id = auth.uid());

-- profiles: org_admins may update any profile within their own org
create policy "profiles_update_same_org_admin" on profiles
  for update using (
    organization_id = (select organization_id from profiles where id = auth.uid())
    and (select role from profiles where id = auth.uid()) = 'org_admin'
  );

-- updated_at maintenance
create function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql security invoker set search_path = '';

create trigger organizations_set_updated_at
  before update on organizations
  for each row execute function set_updated_at();

create trigger profiles_set_updated_at
  before update on profiles
  for each row execute function set_updated_at();

-- Atomically create a new organization plus its first org_admin profile
-- for the currently authenticated user. Runs as SECURITY DEFINER because
-- the caller has no profile (and thus no organization_id) yet, so the
-- normal RLS policies above cannot apply to this bootstrap step.
create function create_organization_with_admin(
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

  return new_org_id;
end;
$$;
