create type department_status as enum ('active', 'inactive');

create table departments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  description text,
  status department_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, name)
);

create index departments_organization_id_idx on departments(organization_id);

alter table departments enable row level security;

create policy "departments_select_same_org" on departments
  for select using (
    organization_id = (select organization_id from profiles where id = auth.uid())
  );

create policy "departments_insert_same_org_admin" on departments
  for insert with check (
    organization_id = (select organization_id from profiles where id = auth.uid())
    and (select role from profiles where id = auth.uid()) = 'org_admin'
  );

create policy "departments_update_same_org_admin" on departments
  for update using (
    organization_id = (select organization_id from profiles where id = auth.uid())
    and (select role from profiles where id = auth.uid()) = 'org_admin'
  );

create trigger departments_set_updated_at
  before update on departments
  for each row execute function set_updated_at();

-- now that departments exists, wire up the deferred FK on profiles
alter table profiles
  add constraint profiles_department_id_fkey
  foreign key (department_id) references departments(id) on delete set null;
