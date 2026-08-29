-- PRD §18: reusable named templates of ordered POSITIONS (not specific
-- users). The author picks a template at submission time and assigns real
-- users to each position; per §18 this is only the initial suggested chain
-- — same as any custom chain, whoever holds the memo can still deviate per
-- §7.1. So templates only ever feed into submit_memo's existing
-- p_participant_ids array client-side; no schema change to submit_memo
-- itself, no server-side concept of "this memo came from a template" beyond
-- the existing memos.workflow_template_id column.

create table workflow_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  description text,
  created_by uuid not null references profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (organization_id, name)
);

create table workflow_template_positions (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references workflow_templates(id) on delete cascade,
  position_order int not null,
  position_label text not null,
  created_at timestamptz not null default now(),
  unique (template_id, position_order)
);

create index workflow_template_positions_template_id_idx on workflow_template_positions(template_id);

alter table workflow_templates enable row level security;
alter table workflow_template_positions enable row level security;

-- Any org member may SELECT (they need the list to pick one at submission);
-- only org_admin may write, per PRD §5 ("manage workflow templates" is an
-- admin-only permission — regular users only ever consume templates).
create policy "workflow_templates_select_same_org" on workflow_templates
  for select using (organization_id = private.current_organization_id());

create policy "workflow_templates_insert_admin" on workflow_templates
  for insert with check (
    organization_id = private.current_organization_id()
    and private.current_role() = 'org_admin'
  );

create policy "workflow_templates_update_admin" on workflow_templates
  for update using (
    organization_id = private.current_organization_id()
    and private.current_role() = 'org_admin'
  );

create policy "workflow_templates_delete_admin" on workflow_templates
  for delete using (
    organization_id = private.current_organization_id()
    and private.current_role() = 'org_admin'
  );

-- workflow_template_positions has no organization_id of its own — scope via
-- its parent template, same pattern as workflow_template_positions being a
-- pure child table (like workflow_template_positions references
-- workflow_templates, not organizations directly).
create policy "workflow_template_positions_select_same_org" on workflow_template_positions
  for select using (
    exists (
      select 1 from workflow_templates t
      where t.id = workflow_template_positions.template_id
        and t.organization_id = private.current_organization_id()
    )
  );

create policy "workflow_template_positions_write_admin" on workflow_template_positions
  for all using (
    exists (
      select 1 from workflow_templates t
      where t.id = workflow_template_positions.template_id
        and t.organization_id = private.current_organization_id()
        and private.current_role() = 'org_admin'
    )
  )
  with check (
    exists (
      select 1 from workflow_templates t
      where t.id = workflow_template_positions.template_id
        and t.organization_id = private.current_organization_id()
        and private.current_role() = 'org_admin'
    )
  );
