# DATABASE.md — Schema & Tenant Isolation Design

Postgres on Supabase. This is a starting design, not gospel — Claude Code should refine it as
it builds, but must **update this file** whenever the actual schema diverges (this file must
stay accurate, the same way `STATUS.md` must).

Use Supabase MCP to create these via real migrations (`supabase/migrations/*.sql`), not just
ad hoc dashboard edits — migrations are part of the graded source-code submission.

## Tenant isolation pattern (apply to every table below marked "tenant-scoped")

1. `organization_id UUID NOT NULL REFERENCES organizations(id)` column.
2. RLS enabled, with a policy like:
   ```sql
   create policy "tenant_isolation_select" on <table>
     for select using (organization_id = (select organization_id from profiles where id = auth.uid()));
   ```
   Mirror for insert/update/delete, plus role-based restrictions where needed (e.g. only admins
   can write to `departments`).
3. Server-side re-verification of `organization_id` in the API route/server action on top of RLS.

## Core entities

**organizations** (global — not tenant-scoped, this IS the tenant)
`id, name, slug (unique), logo_url, contact_email, contact_phone, created_at, updated_at`

**profiles** (tenant-scoped; 1:1 with `auth.users`)
`id (= auth.users.id), organization_id, email, name, designation, department_id, role
(enum: org_admin | regular_user), status (enum: active | inactive), created_at, updated_at`

**departments** (tenant-scoped)
`id, organization_id, name, description, status (active|inactive), created_at, updated_at`

**memo_categories** (tenant-scoped)
`id, organization_id, name, description, is_active, created_at`

**workflow_templates** (tenant-scoped)
`id, organization_id, name, description, created_by, created_at`

**workflow_template_positions**
`id, template_id, position_order, position_label (e.g. "Department Head"), created_at`

**memos** (tenant-scoped)
`id, organization_id, memo_number (unique per org, auto-generated), subject, body (rich text /
html or jsonb), author_id, department_id, category_id, priority (normal|high|urgent),
status (draft|submitted|pending_review|pending_approval|changes_requested|rejected|approved|
cancelled), current_step_position (int, nullable), workflow_template_id (nullable, if built
from a template), created_at, updated_at, submitted_at, completed_at`

**memo_versions**
`id, memo_id, version_number, editor_id, content_snapshot (jsonb — subject/body/attachments at
that point), associated_submission_at, created_at`
— written on every resubmission after changes-requested; never overwrite prior rows.

**workflow_steps** (the sequential engine — one row per participant per memo)
`id, memo_id, position_order, assigned_user_id, status (pending|current|approved|rejected|
changes_requested|skipped), action_taken (approve|reject|comment|request_changes|forward,
nullable until acted on), comment, acted_at, created_at`
— `memos.current_step_position` should match the lowest `position_order` among steps not yet
resolved; enforce server-side that only the step whose `position_order` equals
`current_step_position` (and whose `assigned_user_id` matches the requester, or an active
delegate — see `delegations`) may be acted on.

**comments**
`id, memo_id, author_id, body, comment_type (general|approval|rejection|change_request),
created_at`
— immutable to ordinary users after creation (no update/delete policy for `regular_user` role).

**attachments**
`id, memo_id, storage_path (Supabase Storage path, private bucket), file_name, file_size,
mime_type, uploaded_by, uploaded_at`
— never expose `storage_path` directly to the client as a public URL; always mint a
short-lived signed URL server-side after an authorization check.

**delegations** (tenant-scoped)
`id, organization_id, delegating_user_id, delegate_user_id, start_date, end_date, reason,
status (active|expired|revoked), created_at`

**notifications** (tenant-scoped, per-user)
`id, organization_id, user_id, type (enum matching PRD §13 triggers), memo_id (nullable),
message, is_read, created_at`

**audit_log** (tenant-scoped, append-only — no update/delete policy at all, even for admins,
via the API; only a service-role backend process may write)
`id, organization_id, event_type, user_id, related_entity_type, related_entity_id,
description, created_at`

## Notes for Claude Code

- Use Postgres `enum` types (or check constraints) for role/status/priority/etc. rather than
  free-text, so invalid states are rejected at the DB level too.
- `memo_number` generation: use a per-org sequence or a formatted `ORG-YYYY-#####` pattern;
  decide and document the exact format in `STATUS.md` once implemented.
- Every `INSERT`/`UPDATE` that represents a workflow action should, in the same transaction,
  also write the corresponding `audit_log` row and any `notifications` rows — keep this
  consistent rather than scattering audit-writes ad hoc across the codebase (consider a
  Postgres function/trigger for this if it keeps the app code cleaner).
- Keep this file updated as the actual migrations evolve — if a column gets renamed or a table
  gets split, reflect it here in the same work session.
