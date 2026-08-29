alter table organizations
  add column created_by uuid references profiles(id) on delete set null;

-- Rewrite the bootstrap RPC to set it. FK can't be satisfied at the organizations
-- INSERT (the profile doesn't exist yet), so: insert org -> insert profile -> backfill.
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

  return new_org_id;
end;
$$;

revoke execute on function create_organization_with_admin(text, text, text, text) from public, anon;
grant execute on function create_organization_with_admin(text, text, text, text) to authenticated;
