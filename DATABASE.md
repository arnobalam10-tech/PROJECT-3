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
     for select using (organization_id = private.current_organization_id());
   ```
   Mirror for insert/update/delete, plus role-based restrictions where needed (e.g. only admins
   can write to `departments`, via `private.current_role() = 'org_admin'`).
3. Server-side re-verification of `organization_id` in the API route/server action on top of RLS.

   **Do NOT write the naive version of this** —
   `organization_id = (select organization_id from profiles where id = auth.uid())` — on ANY
   table, including `profiles` itself. That subquery targets `profiles`, which is itself
   RLS-protected by this exact same policy pattern, so the subquery can never resolve (it has no
   way to "see" its own row without already knowing the answer). The practical effect: **every
   user is silently locked out of reading even their own profile row**, which cascades into every
   other table's policy too, since they all resolve a user's org via a `profiles` lookup. This
   was actually built this way in the first migration and caused a real, fully-reproduced bug —
   an infinite `/login` ↔ `/dashboard` redirect loop — before being caught and fixed (see
   "Migrations applied so far" below, and `STATUS.md`'s Known Bugs/Decisions history). Always
   resolve the caller's own org/role via the `private.current_organization_id()` /
   `private.current_role()` SECURITY DEFINER functions below instead — they bypass RLS for that
   one narrow, safe lookup (the standard Postgres/Supabase pattern for exactly this recursion
   problem), and are only usable *from inside* a policy or function (granted to `authenticated`
   for policy evaluation, not exposed via PostgREST since they live in the `private` schema).

   ```sql
   create schema if not exists private;

   create function private.current_organization_id() returns uuid
   language sql security definer stable set search_path = '' as $$
     select organization_id from public.profiles where id = auth.uid();
   $$;

   create function private.current_role() returns user_role
   language sql security definer stable set search_path = '' as $$
     select role from public.profiles where id = auth.uid();
   $$;

   grant execute on function private.current_organization_id() to authenticated;
   grant execute on function private.current_role() to authenticated;
   ```

   `profiles`' own `id = auth.uid()` policies (e.g. "update your own profile") are fine as-is —
   there's no self-referential subquery there, just a direct comparison.

## Core entities

**organizations** (global — not tenant-scoped, this IS the tenant)
`id, name, slug (unique), logo_url, contact_email, contact_phone, created_by (the founding
admin's profile id, set once at self-serve signup — see PRD.md §3.1), created_at, updated_at`

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
html or jsonb), body_text (plain-text mirror of body's content, trigger-maintained — see
migration 020, exists purely so search can `ilike` it; `body` itself has no ilike operator since
it's jsonb), author_id, department_id, category_id, priority (normal|high|urgent),
status (draft|submitted|pending_review|pending_approval|changes_requested|rejected|approved|
cancelled), workflow_template_id (nullable, if built from a template), created_at, updated_at,
submitted_at, completed_at`
— note there is deliberately no fixed `current_step_position` integer: "who currently holds
this memo" is derived by querying `workflow_steps` for the row with `status = current` (there
should be exactly one at a time while the memo is in flight), since the chain itself is mutable
per the dynamic routing model in `PRD.md` §7.

**memo_versions**
`id, memo_id, version_number, editor_id, content_snapshot (jsonb — subject/body/attachments at
that point), associated_submission_at, created_at`
— written on every resubmission after changes-requested; never overwrite prior rows.

**workflow_steps** (dynamic routing engine — see `PRD.md` §7 for the behavioral model. This is
**not** a rigid pre-computed array; it's a mutable queue that whoever currently holds the memo
can edit.)

`id, memo_id, sequence_order, assigned_user_id, status (queued|current|approved|rejected|
changes_requested|declined|skipped), action_taken (approve|reject|comment|request_changes|
forward|decline, nullable until acted on), comment, is_original (bool — was this participant
part of the chain as it stood at submission, or inserted later), added_by (nullable — who
inserted this participant if not original), acted_at, created_at, updated_at`

Behavior:
- On submission, rows are created for the initial suggested chain with `status = queued`
  (first one immediately flips to `current`).
- **Only the `current` row's `assigned_user_id`** (or an active delegate — see `delegations`)
  may act, enforced server-side. This part stays strict — the flexibility is in *what happens
  next*, not in *who may act right now*.
- When the current holder acts:
  - **Approve → forward to next in original chain:** current row → `approved`; the next
    `queued` row (by `sequence_order`) → `current`.
  - **Approve → forward to someone new:** current row → `approved`; insert a new `queued` row
    for the new person with `is_original = false`, `added_by = <acting user>`, positioned
    immediately next in `sequence_order`; that row → `current`. The acting user (or the new
    holder, per §7.1) may also delete/reorder any *still-`queued`* rows that come after — never
    rows that are already `approved`/`rejected`/historical.
  - **Decline & reroute:** current row → `declined`; insert/select a new `current` row for the
    chosen person the same way, without setting `action_taken = approve` and without implying
    approval.
  - **Reject:** current row → `rejected`; memo status → Rejected; all remaining `queued` rows →
    `skipped`. Workflow ends.
  - **Request Changes:** current row → `changes_requested`; memo status → Changes Requested;
    a new `memo_versions` row is prepared for the author's edit. On resubmission, a new
    `current` row is created for the author (or whoever should act next per §7.1) — no special
    "resume vs. restart" flag needed, since routing is decided fresh each time per the general
    model.
  - **No one left `queued` after an approval:** memo status → Approved/Completed.
- Never delete or mutate a row once it's left `queued` status (i.e. once it's `current` or
  resolved) — that's the permanent, honest audit trail. Only `queued` (not-yet-reached) rows
  are ever editable/removable, and only by the current holder (or an admin, if you decide to
  allow that — log the decision in `STATUS.md` if so, since the instructor's answer specified
  "anyone in the workflow," not admins specifically).

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

## Migrations applied so far

See `supabase/migrations/` for the actual SQL (kept in sync with what's live in the Supabase
project). As of this note:

1. `20260829040558_001_organizations_and_profiles` — `organizations`, `profiles`, enums, RLS,
   `create_organization_with_admin()` bootstrap RPC.
2. `20260829040613_002_restrict_create_org_function` — lock the bootstrap RPC's EXECUTE grant to
   `authenticated` only.
3. `20260829041842_003_departments` — `departments` table + RLS, backfills the deferred
   `profiles.department_id` FK.
4. `20260829042610_004_fix_rls_self_reference` — introduces `private.current_organization_id()` /
   `private.current_role()`, rewrites every policy that used to self-reference `profiles`. **Bug
   fix**, see the warning under "Tenant isolation pattern" above.
5. `20260829042744_005_fix_helper_function_grants` — the first attempt at #4 also revoked
   `authenticated`'s own EXECUTE on those two helper functions, which broke RLS evaluation
   entirely (nobody could read anything). This migration re-grants EXECUTE to `authenticated`.
   **Also a bug fix** — caught via a direct SQL repro using `set_config('request.jwt.claims', ...)`
   to simulate an authenticated request outside the browser.
6. `20260829045117_006_organizations_created_by` — adds `organizations.created_by` (per the
   self-serve onboarding model in `PRD.md` §3.1) and updates the bootstrap RPC to set it. The FK
   can't be satisfied at the `organizations` INSERT itself (the profile row doesn't exist yet at
   that point), so the RPC does insert org → insert profile → backfill `created_by` in one
   transaction rather than using a deferred constraint.
7. `20260829045358_007_memo_categories` — `memo_categories` table + RLS; updates the bootstrap RPC
   to seed the default 7 categories (PRD §6.1) into every new org.
8. `20260829045423_008_memos_core` — `memos`, `memo_priority`/`memo_status` enums,
   `memo_number_counters` + `generate_memo_number()` (atomic per-org counter via
   `insert ... on conflict do update`, format `<ORGSLUG>-<YYYY>-#####`), `attachments`. Phase-3
   RLS on `memos` is intentionally narrower than the final PRD §14 rule — see the note in that
   migration and in `STATUS.md`; it widens once `workflow_steps` exists in Phase 4.
9. `20260829045438_009_attachments_storage_bucket` — private `attachments` Storage bucket +
   `storage.objects` policies keyed on the memo the object's folder-path segment belongs to.
10. `20260829045457_010_memo_number_counters_rls` — `memo_number_counters` had no RLS enabled at
    all (flagged as an ERROR by Supabase's advisor). Fixed by enabling RLS with zero policies —
    the table is only ever touched by the SECURITY DEFINER `generate_memo_number()`, so this
    correctly blocks all direct client access while leaving that function working.
11. `20260829062148_011_workflow_steps` — `workflow_steps` table (dynamic routing engine, PRD
    §7). `sequence_order` is `double precision`, not `int` as loosely implied by the original
    schema note — chosen so inserting a participant between two existing steps never requires
    renumbering the rest of the queue (bisect the gap instead). Exactly one `current` row per
    memo enforced by a **partial unique index scoped to `memo_id`**
    (`unique (memo_id) where status = 'current'`) — confirmed explicitly with the user before
    creating it that this is per-memo, not a global singleton. No INSERT/UPDATE/DELETE policy at
    all on this table — every mutation goes through the SECURITY DEFINER functions in migration
    013, never direct client writes. Introduces `private.is_workflow_participant()` as a
    SECURITY DEFINER helper for the same reason as `private.current_organization_id()` — a plain
    subquery on `workflow_steps` from within its own SELECT policy reproduces the exact
    self-referential-RLS bug from migration 004 (no non-recursive base case for a plain
    participant, only for the author/admin branches).
12. `20260829062227_012_comments_audit_notifications` — `comments`, `audit_log`, `notifications`
    tables. `audit_log`/`notifications` have no client-facing INSERT policy at all — only written
    via `private.log_audit_event()` / `private.notify_user()`, SECURITY DEFINER helpers callable
    only from other SECURITY DEFINER functions (not granted to `authenticated` — unlike
    `is_workflow_participant()`, which legitimately needs to run during RLS evaluation as the
    client role). `comments` allows direct client INSERT, but only for `comment_type = 'general'`
    (enforced by the `with_check` clause, not just app discipline) — typed comments
    (approval/rejection/change_request) only come from the workflow-action functions. An
    `AFTER INSERT` trigger on `comments` (`private.comments_after_insert()`, itself SECURITY
    DEFINER so it can write to `audit_log`/`notifications` despite running off a plain client
    INSERT) covers PRD §21/§13's "comment"/"comment added" audit and notification requirements
    for the direct-insert path.
13. `20260829062352_013_workflow_action_functions` — the six SECURITY DEFINER action functions:
    `submit_memo`, `workflow_approve` (handles both "forward to next in chain" and "forward to
    someone new" via an optional `p_forward_to_user_id`, and completion when nothing is left),
    `workflow_decline_reroute`, `workflow_reject`, `workflow_request_changes`, `resubmit_memo`.
    Shared `private.assert_current_holder()` locks (`for update`) and returns the current row,
    raising unless the caller is its `assigned_user_id` — delegation (PRD §19) isn't wired in yet
    since the `delegations` table doesn't exist until Phase 8; marked with an explicit
    `TODO(Phase 8)` in the function body. **Two real bugs found only by actually running a test
    script against these functions** (not by review) — see #15/#16 below.
14. `20260829062406_014_widen_memo_and_attachment_visibility` — widens the Phase-3 `memos` SELECT
    policy (author-or-admin-only) to also include anyone who `is_workflow_participant()`, per PRD
    §14/§2.5 item 7. Same widening applied to `attachments`' table policy and the
    `storage.objects` bucket policy, since PRD §12 says attachment access follows the memo's own
    permissions. Also widens the author's UPDATE policy to allow edits while
    `status = 'changes_requested'`, not just `'draft'` (needed for the resubmission flow — the
    author edits content, then calls `resubmit_memo()`).
15. `20260829063000_015_016_fix_submit_memo` — two bug fixes to `submit_memo`, both caught by
    the workflow-engine test script actually calling it (see `STATUS.md` for the full pass/fail
    writeup), not by code review: (1) a `CASE` expression choosing `'current'`/`'queued'`
    resolved to `text`, which didn't implicitly cast against the `workflow_step_status` column
    type inside a function body the way a bare string literal would; (2) the first attempted fix
    used an explicit `::workflow_step_status` cast, which *also* failed — with `search_path = ''`
    (deliberate, to prevent search-path hijacking in a SECURITY DEFINER function), an unqualified
    type name in a cast can't resolve any more than an unqualified table name can. Needed
    `::public.workflow_step_status`.
16. `20260829063100_017_memo_versions` — `memo_versions` had been documented in this file since
    Phase 1 but **was never actually created** — Phase 3's migration built
    `memo_categories`/`memos`/`attachments` but missed it. Only surfaced when `submit_memo` tried
    to write to it during the real test run and failed with "relation does not exist." A concrete
    example of why the "actually run it" standard in `STATUS.md` matters more than reviewing the
    SQL by eye.
17. `20260829070000_018_memo_last_activity_triggers` — `private.touch_memo_updated_at()` +
    triggers on `workflow_steps`/`comments` (AFTER INSERT/UPDATE) that bump `memos.updated_at`.
    Needed for PRD §9's "My Memos" `last activity date` column to be meaningful — without this,
    `memos.updated_at` only reflected direct edits to the memo row itself, not workflow actions or
    comments, both of which are obviously "activity."
18. `20260829071500_019_workflow_assignment_notifications` — **bug fix**, found by systematically
    auditing Phase 4's existing notification writes against all 8 of PRD §13's trigger types
    rather than assuming coverage (see `STATUS.md` Phase 6 for the full audit table).
    `submit_memo` only ever notified the *first* participant ("user assigned to a workflow" +
    "memo requires action" bundled together); participants 2..N in the initial chain got **no**
    notification at all until it became their turn. Fixed by having `submit_memo` send
    `workflow_assignment` to every participant in the chain, and `workflow_approve`
    (forward-to-someone-new branch) / `workflow_decline_reroute` also send `workflow_assignment`
    (not just `memo_requires_action`) when adding someone who wasn't previously on the workflow.
19. `20260829074500_020_memo_body_text_search` — **bug fix**, found only by actually running a
    search against real data (Phase 7), not by review. `memos.body` is `jsonb` (Tiptap document
    format); Postgres has no `ilike` operator for `jsonb`, so filtering search against `body`
    directly threw a type error on every single search request — silently, since the search page
    wasn't checking the query's `error` field, so it looked identical to "no matches" for *every*
    search, not just ones touching body content. Fixed by adding `memos.body_text`, a plain-text
    mirror of `body`'s content (every `"text"` node extracted via `jsonb_path_query_array(..,
    '$.**.text')`), kept in sync by a `BEFORE INSERT OR UPDATE OF body` trigger — same pattern as
    migration 018's last-activity triggers. Search now filters `body_text`, and the search page
    now logs (rather than silently swallows) any future query error.

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
