-- Bug fix: every existing policy that checked organization_id/role via a
-- subquery on `profiles` itself (e.g. `organization_id = (select organization_id
-- from profiles where id = auth.uid())`) is self-referential: that subquery is
-- ALSO gated by profiles' own RLS, which can never resolve without already
-- knowing the answer. Net effect: nobody could read even their own profile row.
-- Fix: read the caller's own organization_id/role via a SECURITY DEFINER
-- function (owned by postgres, bypasses RLS for this one narrow, safe lookup),
-- and reference that from every policy instead.

create schema if not exists private;

create function private.current_organization_id() returns uuid
language sql
security definer
stable
set search_path = ''
as $$
  select organization_id from public.profiles where id = auth.uid();
$$;

create function private.current_role() returns user_role
language sql
security definer
stable
set search_path = ''
as $$
  select role from public.profiles where id = auth.uid();
$$;

revoke all on function private.current_organization_id() from public, anon, authenticated;
revoke all on function private.current_role() from public, anon, authenticated;

-- organizations
drop policy "organizations_select_own" on organizations;
drop policy "organizations_update_own_admin" on organizations;

create policy "organizations_select_own" on organizations
  for select using (id = private.current_organization_id());

create policy "organizations_update_own_admin" on organizations
  for update using (
    id = private.current_organization_id()
    and private.current_role() = 'org_admin'
  );

-- profiles
drop policy "profiles_select_same_org" on profiles;
drop policy "profiles_update_same_org_admin" on profiles;

create policy "profiles_select_same_org" on profiles
  for select using (organization_id = private.current_organization_id());

create policy "profiles_update_same_org_admin" on profiles
  for update using (
    organization_id = private.current_organization_id()
    and private.current_role() = 'org_admin'
  );

-- profiles_update_self (id = auth.uid()) is unaffected — no self-reference there.

-- departments
drop policy "departments_select_same_org" on departments;
drop policy "departments_insert_same_org_admin" on departments;
drop policy "departments_update_same_org_admin" on departments;

create policy "departments_select_same_org" on departments
  for select using (organization_id = private.current_organization_id());

create policy "departments_insert_same_org_admin" on departments
  for insert with check (
    organization_id = private.current_organization_id()
    and private.current_role() = 'org_admin'
  );

create policy "departments_update_same_org_admin" on departments
  for update using (
    organization_id = private.current_organization_id()
    and private.current_role() = 'org_admin'
  );
