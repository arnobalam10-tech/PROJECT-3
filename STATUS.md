# STATUS.md — Living Project Status

**This file must be updated after every meaningful unit of work.** See `CLAUDE.md` §2 for the
rules. It is the source of truth for "what's the current state of the project" — more reliable
than memory of prior sessions. Be precise and honest; "mostly done" is not an acceptable status.

Last updated: 2026-08-29 (Phase 10 session)
Updated by: Claude Code

---

## Current Phase

Phase 10 (Design pass — Swiss/Basel system per `DESIGN.md`) — done, **pending the user's own visual
review of the live Vercel deploy before Phase 11**, per their explicit request for this phase
specifically (not just a status report). See "Phase 10" section below for the page-by-page
done/rough breakdown they asked for.

## Done ✅

**Phase 1 — Foundation.** Next.js 16 + Supabase (Auth/Postgres/RLS) + Tailwind, GitHub repo
(https://github.com/arnobalam10-tech/PROJECT-3, private), Vercel deploy live at
**https://relay-cyan-alpha.vercel.app/** (confirmed working end-to-end in production this
session — landing page, login, and a real authenticated dashboard load all verified live, not
just locally).

**Phase 2 — Orgs, users, departments, roles.** Department CRUD, admin user management
(invite/role/department/status), role-gated nav, `requireProfile()`/`requireOrgAdmin()` used
everywhere. `SUPABASE_SERVICE_ROLE_KEY` added by the user directly to `.env.local` and Vercel
(never passed through chat) — invite-user is now expected to actually work, not just fail
cleanly, though it hasn't been re-tested since the key was added (see In Progress).

**Post-Phase-2 checks requested by the user, both done:**
1. **Rebrand to "Relay"** applied everywhere generic: `<title>`/meta description
   (`src/app/layout.tsx`), landing page headline + copy (`src/app/page.tsx`), a small "relay"
   wordmark added to `/login`, `/signup`, and the authenticated app shell's nav
   (`src/app/(app)/layout.tsx` — it had no brand element at all before), and `README.md`'s title.
   The full Swiss/Basel landing-page treatment from PRD §25 is intentionally **not** done yet —
   see "Landing page (PRD §25)" in Not Started Yet below.
2. **Org onboarding vs. PRD §3.1 — confirmed matching, no changes needed.** Re-read §3.1
   line-by-line against `/signup` (`src/app/signup/actions.ts` + the `create_organization_with_admin`
   RPC): self-serve public signup, signer provides their own name/email/password + the org name,
   slug is derived (not chosen — §3.1 allows either), `organizations` + `profiles`
   (`role = org_admin`) are created together, no invite or platform-admin step required. This was
   already built this way in Phase 1/2 before the instructor clarification existed in the docs —
   it happened to already match. Confirmed by re-reading the code, not just by memory.

**Reconciled `DATABASE.md` after the instructor-clarification rewrite.** The user's edit to
`DATABASE.md` (applying `PRD.md` §2.5's instructor clarifications) was based on an earlier version
of the file than the one this session had already corrected — it silently reverted the
"Tenant isolation pattern" section back to the broken self-referential-subquery example, and
dropped the "Migrations applied so far" log entirely. **Flagged to the user rather than silently
overwritten** (per this session's own operating instructions): re-applied the `private` schema
fix and rebuilt the migrations log on top of the new instructor-driven content, so both are now
present and accurate. See `DATABASE.md` for the merged result.

**`organizations.created_by`** — added (migration 006) per the schema shown in the updated
`DATABASE.md`; bootstrap RPC updated to set it (insert org → insert profile → backfill, since the
FK can't be satisfied before the profile row exists).

**Phase 3 — Memo core:**
- `memo_categories` table + RLS; bootstrap RPC now seeds the 7 default categories (PRD §6.1:
  Administrative, Financial, Procurement, HR, Academic, Technical, General) into every new org.
  Backfilled onto the existing test org too.
- `memos` table (no `current_step_position` — matches the new dynamic-routing schema in
  `DATABASE.md`, which derives "who currently holds this" from `workflow_steps` once that exists
  in Phase 4), `memo_priority`/`memo_status` enums, atomic per-org `memo_number` generation
  (`generate_memo_number()`, format `<ORGSLUG>-<YYYY>-#####`, uses
  `insert ... on conflict do update` on a dedicated counter table for correctness under
  concurrency — no lost/duplicate numbers even if two users submit at once).
- `attachments` table + private `attachments` Storage bucket + `storage.objects` RLS policies
  keyed off the memo the file belongs to (path = `<memo_id>/<uuid>-<filename>`). No public URLs;
  downloads go through a server action that mints a 60-second signed URL after an authorization
  check.
- Memo creation/edit form (`/memos/new`, `/memos/[id]`) with a Tiptap rich-text editor (bold,
  italic, bullet/numbered lists, links — matches PRD §6.1's "basic rich text" minimum), subject,
  department/category/priority selects (validated server-side against the caller's own org, not
  trusted from the client). Draft-only for now — no Submit button yet, since submission requires
  an initial participant chain, which is Phase 4 territory (see Decisions Log).
- Draft edit/delete restricted to the author while `status = 'draft'`, enforced in both RLS and
  the server actions (`assertOwnedDraft()`), matching PRD §6.2.
- File upload: 10MB max, blocklist on common executable extensions, both enforced server-side
  (PRD §12, §24.11) — not just via the file picker's `accept` attribute.
- `/memos` ("My Memos") now lists the real data instead of the Phase-1 placeholder.
- **Manually tested end-to-end in the real browser against the real dev server + real Supabase
  project**: created a memo, applied bold formatting, saved, navigated away and back (confirmed
  the formatting persisted correctly in the DB and re-rendered — this surfaced and ruled out what
  first looked like a rendering bug but was actually just Tiptap's client hydration timing, not a
  real defect), verified the memo-number counter incremented correctly across two memos, and
  fully exercised delete (see the delete-button bug/fix below).
- **Bug found and fixed this session:** the delete-draft button used the browser's native
  `window.confirm()`. Browser automation tools can't interact with native JS confirm dialogs, so
  this was untestable by anything other than a human clicking it — and it also doesn't fit the
  Swiss/Basel design system (an unstyled native browser popup). Replaced with an in-app two-step
  confirm (`src/app/(app)/memos/[id]/delete-draft-button.tsx`: click "delete draft" → button
  becomes "confirm delete" / "cancel"). Re-tested after the fix: works correctly, verified the row
  was actually gone from the DB afterward, not just that the UI navigated away.

**Phase 4 — Workflow engine (dynamic, holder-controlled routing per PRD §7 / §2.5 items 5, 6, 8).**

Before writing any schema, re-read `PRD.md` §7 and `DATABASE.md`'s `workflow_steps` design in
full and stated the plan back to the user for confirmation (per their explicit request) — this
caught one real design gap before it became code: the planned `workflow_steps` SELECT policy
(visible to author/admin/*any participant*) would have used a subquery on `workflow_steps` from
within its own policy to check participation, reproducing the exact self-referential-RLS bug from
migration 004 in a new table. Fixed before writing it by introducing
`private.is_workflow_participant()`, the same SECURITY DEFINER pattern as
`private.current_organization_id()`.

Schema (migrations 011–017, `private.` helpers, six SECURITY DEFINER action functions — full
detail in `DATABASE.md`'s migrations log):
- `workflow_steps` — mutable per-memo queue (`queued`/`current`/`approved`/`rejected`/
  `changes_requested`/`declined`/`skipped`). `sequence_order` is `double precision` so inserting
  someone mid-chain never requires renumbering. Exactly one `current` row **per memo** (partial
  unique index `unique (memo_id) where status = 'current'` — **explicitly confirmed with the user
  before creating it** that this is per-memo scoped, not a global lock across every memo in the
  system). No client-facing INSERT/UPDATE/DELETE policy at all — every mutation goes through the
  action functions below.
- `comments`, `audit_log`, `notifications`, `memo_versions` — `audit_log`/`notifications` have no
  client INSERT policy at all (only the trusted `private.log_audit_event()`/`private.notify_user()`
  helpers can write them); `comments` allows direct client insert only for `comment_type='general'`
  (enforced by the RLS `with_check`, not just app discipline) — an `AFTER INSERT` trigger on
  `comments` auto-writes the matching `audit_log`/`notifications` rows for that path.
- Six SECURITY DEFINER functions: `submit_memo`, `workflow_approve` (forward-to-next-in-chain,
  forward-to-someone-new, or completion — one function, driven by an optional
  `p_forward_to_user_id`), `workflow_decline_reroute`, `workflow_reject`, `workflow_request_changes`,
  `resubmit_memo`. Every one starts by locking (`for update`) and checking the current-holder row
  via a shared `private.assert_current_holder()` helper — delegation (PRD §19) isn't wired in yet
  since `delegations` doesn't exist until Phase 8; marked with an explicit `TODO(Phase 8)` in the
  function body rather than silently omitted.
- Widened the Phase-3 `memos`/`attachments`/storage-bucket SELECT policies to include workflow
  participants, not just author/admin, per PRD §14 / §2.5 item 7 — this was flagged as a to-do in
  the last session's STATUS.md and is now done.

**Two confirmations made explicitly before building, per the user's request:**
1. The partial unique index is `unique (memo_id) where status = 'current'` — per-memo, not a
   global singleton. Stated back to the user before creating it.
2. Decline & reroute uses the *same* remaining-chain-stays-queued behavior as
   approve-forward-to-someone-new (confirmed with the user rather than assumed) — verified by
   test, not just by reading the migration back.

**Rigorous testing — two rounds of ephemeral Node scripts** (real `@supabase/supabase-js` client,
real HTTP calls, real signed-in users — Carol/Dave/Erin/Bob created as real `auth.users` rows
with real bcrypt password hashes via `pgcrypto`, not password-less stand-ins, specifically so they
could sign in through the actual API rather than only via SQL simulation). **73/73 checks passed**
across both rounds; all test data and both scripts deleted afterward. Full result, condensed:
- **Non-holder cannot act, server-side**: a queued (not-yet-current) participant, the memo's own
  author (when not the current holder), and a user in a *different organization entirely* were
  all denied when calling the RPC directly — proven by checking the actual error returned, not by
  observing a hidden button. Confirmed zero side effects: `workflow_steps` state was
  byte-identical before and after all four denied attempts.
- **Cross-org**: the different-org user couldn't even `SELECT` the memo or its `workflow_steps`
  rows (RLS), and separately couldn't call the action RPC (the function's own holder check, since
  `assert_current_holder` is itself SECURITY DEFINER and bypasses RLS internally — meaning it must
  do its *own* authorization check, which it does).
- **Forward outside the original chain**: approving with a forward-to-someone-new target actually
  worked (new `current` row created, `is_original=false`, `added_by` set correctly, positioned
  between the two existing `sequence_order` values) — **and** the untouched original participants'
  `queued` rows were verified byte-identical before/after (same id, status, timestamps).
- **Immutability**: after *further* unrelated actions happened later in the same memo's life, the
  earlier resolved row was re-checked and was still byte-identical to its state immediately after
  resolution — not just "didn't happen to change," genuinely re-verified after more history
  accumulated.
- **Reject vs. request-changes vs. decline, on three separate memos**: reject is terminal
  (remaining `queued` rows → `skipped`, memo → `rejected` with `completed_at` set) and refuses to
  run without a reason; request-changes is *not* terminal (remaining `queued` rows stay `queued`,
  `completed_at` stays null) and refuses to run without an explanation; decline resolves to
  `declined` (neither `approved` nor `rejected`) and doesn't change the memo's status at all. All
  three produce genuinely distinct database states, not just distinct button labels.
- **Resubmission**: after request-changes, the author edited the memo and called `resubmit_memo`
  — verified a second `memo_versions` row was created, a new transient `current` row appeared for
  the author, and then the author's own `workflow_approve` call (the *same* primitive anyone else
  uses, no special "resume" function) correctly picked up the **original, still-queued** row left
  over from before the changes were requested — proving the "no special resume logic" claim in
  §7.1 item 5 for real, not just by inspection.
- **audit_log/notifications proof for every action** (per the user's explicit ask — a claim isn't
  evidence): after each of submit/approve(×2 forms)/decline/reject/request-changes/resubmit,
  queried `audit_log` directly and confirmed a row with the correct `event_type` and `user_id`,
  and queried `notifications` for the expected recipient/type. Not inferred from
  `workflow_steps` state — checked directly.

**Two real bugs found by actually running the test script (not by reviewing the SQL) — both
fixed and documented in `DATABASE.md`:**
- `submit_memo`'s `CASE ... 'current'/'queued' ... END` expression resolved to `text`, which
  didn't implicitly cast against the `workflow_step_status` enum column inside a function body.
- The fix's explicit `::workflow_step_status` cast *also* failed, because with `search_path = ''`
  (deliberate hardening against search-path hijacking in a SECURITY DEFINER function), an
  unqualified type name in a cast can't resolve any more than an unqualified table name can —
  needed `::public.workflow_step_status`.
- Separately: `memo_versions` had been *documented* in `DATABASE.md` since Phase 1 but was
  **never actually created** — Phase 3's migration built the other three tables and missed it.
  Only surfaced when `submit_memo` tried to write to it during the real test run and got
  "relation does not exist." Created in migration 017.

**UI built and manually verified end-to-end in the real browser** (not just the engine via
script): memo creation → submit panel (ordered participant picker) → submit → sign in as the
participant → action panel appears (approve/decline/reject/request-changes) → approve with
forward-to-someone-new → timeline updates correctly → sign in as the new holder → approve with
nothing left → memo reaches `Approved`, action panel disappears. **One real UI bug found and
fixed during this walkthrough**: the timeline showed the same comment text twice (once from the
`workflow_steps.comment` field, once from the separate `comments` row the RPC also writes) —
fixed by having step-timeline entries show only the action label, letting the `comments` entries
own the actual text.

**Phase 5 — Inbox / My Memos / Completed (PRD §9).**

- **`/inbox`**: memos where the caller is the *current* holder (`workflow_steps.status='current'`
  for their own `assigned_user_id`) — not merely a participant, and not everything they're
  authorized to see. Columns per spec: number, subject, sender, department, priority, status,
  submitted date, required action, age. "Required action" is a single constant label
  ("Review & decide") for every row rather than a differentiated per-step label — deliberate,
  matching §2.5 item 8's collapse of the Reviewer/Approver step-type distinction; inventing a
  differentiated label here would quietly reintroduce the thing that clarification removed.
  Filterable by priority/department, sortable by priority/submitted/age (click column headers,
  plain query-string state, no client JS framework needed for it).
- **`/memos` ("My Memos")**: added the two columns PRD §9 requires that Phase 3's version didn't
  have yet — *current participant* and *last activity date* — both derived live from
  `workflow_steps`/`memos.updated_at` via the query itself, not stored anywhere. New migration
  018 makes `memos.updated_at` actually move when a `workflow_steps` row changes or a comment is
  added (it previously only moved on a direct edit to the memo row), so "last activity" means
  what it says.
- **`/completed`** (new route + nav link): memos with a terminal status the caller is authorized
  to view. Authorization is 100% delegated to the existing `memos_select_authorized` RLS policy
  from Phase 4 (author/admin/participant) — the page itself only adds the terminal-status filter,
  it does not layer on any extra visibility logic of its own.

**Rigor requested by the user for this phase specifically: prove the visibility boundary at the
edges, not just that the lists render.** Two things done, in this order:

1. **Schema-level proof `current_step_position` really is gone and never came back**: queried
   `information_schema.columns` for `memos` directly — 14 columns, no such field, confirming
   "who currently holds this" is derived purely from `workflow_steps` everywhere (the `My Memos`
   query does a live join + client-side `.find(s => s.status === 'current')`, not a lookup against
   any stored pointer).
2. **Ephemeral script test, 15/15 checks passed**, using three real signed-in users
   (Dave = original chain participant, Frank = added mid-chain via forward-to-someone-new i.e.
   *not* in the original suggested chain, Grace = zero involvement ever) against a real submitted
   memo:
   - **Before** Frank was ever added: confirmed by direct query he could not see the memo at all,
     and did not appear as a current holder.
   - Dave approved, forwarding to Frank (outside the original chain) — **after**, Frank could now
     see the memo and correctly appeared as current holder in an Inbox-shaped query.
   - Grace could not see the memo at any point before this — confirmed again after Frank was
     added, in case adding someone else accidentally widened visibility for everyone.
   - Drove the memo to completion (Frank approved with nothing left queued).
   - **The specific case the user asked to nail down**: with the memo now `approved` (completed),
     re-queried as Grace — still could not see it, either via a direct `memos` `SELECT` or via a
     query shaped exactly like the `/completed` page's own query. Being uninvolved doesn't expire
     or get overridden just because a workflow finished.
   - Frank and Dave, both *resolved* (non-current) participants, correctly *do* see the completed
     memo in the same Completed-shaped query.
   - Re-ran the "My Memos current-participant" query shape before and after completion: before,
     it correctly resolved to Frank (`status='current'`); after, no row has `status='current'` at
     all and the derived value is correctly absent — not stale, not defaulting back to someone
     earlier in the chain.
   - All test data (memo, 3 users) and the script deleted immediately after.
3. **UI walkthrough** (as the user said was sufficient for the rendering-only part, on top of the
   script-based authorization proof above): created and submitted a real memo, confirmed it
   rendered correctly in `/inbox` with all required columns and working filters; approved it;
   confirmed it moved correctly into `/completed` with the right outcome/priority/completed-at.
   Test memo deleted afterward.

**Phase 6 — Notifications (PRD §13).**

**Step 1: audited whether Phase 4 already covers all 8 trigger types, rather than assuming it —
the user specifically warned this was a place a duplicate write-path could sneak in.** Grepped
every `notify_user` call site across the Phase 4 migrations and built the mapping explicitly:

| PRD §13 trigger | Notification `type` | Where it's written | Status before this session |
|---|---|---|---|
| memo requires action | `memo_requires_action` | submit/approve/decline | ✅ covered |
| memo approved | *(see note)* | — | ✅ same instant as workflow completed, see below |
| memo rejected | `memo_rejected` | reject | ✅ covered |
| changes requested | `changes_requested` | request_changes | ✅ covered |
| comment added | `comment_added` | comments AFTER INSERT trigger | ✅ covered |
| memo resubmitted | `memo_resubmitted` | resubmit | ✅ covered |
| workflow completed | `workflow_completed` | approve (nothing left queued) | ✅ covered |
| **user assigned to a workflow** | *(none existed)* | — | ❌ **real gap** |

- **"memo approved" vs. "workflow completed" — checked whether these are actually distinct
  events rather than assuming they're the same:** in this data model, `memos.status` only ever
  becomes `'approved'` at the exact instant the workflow completes (no partial-approval state
  exists). Confirmed by re-reading `workflow_approve`'s completion branch: both the status update
  and the notification happen in the same code path, atomically. Sending two notifications for
  the same instant would be pure duplication with no product value, so one `workflow_completed`
  notification (worded to say "was approved") covers both PRD bullets — a deliberate decision,
  not an oversight.
- **Real gap found: "user assigned to a workflow" only ever fired for the *first* participant**
  (bundled into the same call as `memo_requires_action` at submission). Participants 2..N in the
  initial chain got no notification at all until it became their turn — meaning someone third in
  a five-person chain wouldn't know they were even on the workflow until everyone ahead of them
  acted. **Fixed** in migration 019: `submit_memo` now sends `workflow_assignment` to every
  participant in the initial chain; `workflow_approve` (forward-to-someone-new) and
  `workflow_decline_reroute` also send `workflow_assignment` (in addition to
  `memo_requires_action`) when adding someone who wasn't previously on the workflow at all.
  Re-ran a full regression after this change (see below) — the underlying Phase 4 state machine
  was untouched, only additional `notify_user` calls were added, and nothing broke.

**Step 2: built the surfacing layer, deliberately as a pure consumer of what Phase 4 already
writes** — confirming no duplicate "who gets notified" logic exists anywhere else in the codebase:
- `/notifications` — in-app center, own-notifications-only (see boundary testing below), mark
  one/all read.
- Unread-count badge in the app shell nav, computed with a `head: true, count: 'exact'` query
  (no row fetch needed just for the badge).
- `src/lib/notifications.ts` — `sendEmailsForNewNotifications(memoId, sinceIso)`. Each workflow
  server action captures a timestamp immediately before calling its RPC, and after the RPC
  succeeds, this function reads whatever `notifications` rows were created for that memo since
  that timestamp (via the service-role client, since `notifications` RLS is strictly
  own-rows-only — see below) and emails each recipient through Resend. **This function makes zero
  decisions about who should be notified** — it only reads rows that `private.notify_user()`
  (Phase 4) already decided to create. Wired into all six workflow server actions plus the
  general-comment action, all best-effort (a Resend/network failure is caught and logged, never
  allowed to fail the underlying workflow action itself).

**Rigor requested by the user, both addressed:**

**1. Notification tenant/authorization boundaries — 11/11 checks passed**, ephemeral script, real
signed-in users (Dave = sole participant, Eve = same-org zero-involvement user), real HTTP:
- Confirmed the `workflow_assignment` gap fix works: Dave received both `workflow_assignment` and
  `memo_requires_action` notifications at submission (he's the only, and thus first, participant).
- **Eve (same org, zero involvement) could not see Dave's notification** — neither by direct id
  lookup nor by querying for the memo_id at all.
- **Even Alice, an org_admin in the same org, could not see Dave's notification.** This was
  deliberately checked rather than assumed, since `memos` *does* have an admin-broadening RLS
  clause and it would have been an easy mistake to accidentally carry that pattern over to
  `notifications` — confirmed no such policy exists there; a user's notifications are visible
  to nobody but that user, full stop.
- Confirmed the RLS `UPDATE` policy on `notifications`, not just an app-level check: Eve's attempt
  to mark Dave's notification read returned no error (an `UPDATE ... WHERE` matching zero rows
  isn't an error) but genuinely changed nothing — re-checked as Dave immediately after and his
  notification was still unread.
- **Notification memo-link boundary**: Dave (valid participant) could open the memo a notification
  linked to; Eve, given the exact same memo id a notification would have pointed to, still could
  not — confirming Phase 5's memo-visibility RLS applies identically regardless of how someone
  arrived at that id (typed URL, clicked a notification, doesn't matter).
- All test users/data and the script deleted after.

**2. Resend email — initially built correctly but unverified; now genuinely verified against real
delivery, in a follow-up round after the user added real credentials:**
- Re-checked `.env.local` directly (not trusting the user's word, per their own explicit
  instruction) before proceeding — first re-check still showed `SUPABASE_SERVICE_ROLE_KEY`
  absent and Resend keys blank; the user then confirmed they'd forgotten to actually save the
  file. Re-checked again afterward: all three (`SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`,
  `RESEND_FROM_EMAIL`) present with plausible lengths.
- Restarted the dev server (env vars are read at process start), then triggered two separate
  real notification-worthy actions through the actual browser UI (not a script calling the RPC
  directly): submit → reject, and a fresh submit.
- **First real attempt surfaced a genuine constraint, not a bug**: Resend rejected every send
  with `403 validation_error` — *"You can only send testing emails to your own email address
  (arnob.alam10@gmail.com). To send emails to other recipients, please verify a domain."* This
  Resend account has no verified sending domain yet, so in its current sandbox mode it can only
  deliver to the account owner's own registered address. Confirmed the app handled this
  correctly regardless: the error was caught and logged (`[notifications] Resend send failed: ...`
  with the full Resend error), the primary workflow action (reject, submit) completed
  successfully both times, and nothing crashed — the same graceful-failure discipline as the
  earlier "not configured" case, now proven against a *real* API rejection too.
- To get a genuine delivered result without an account-level Resend change, temporarily pointed
  one test participant's notification-recipient email (`profiles.email` only — never touched
  their login credentials in `auth.users`) at the Resend account's own verified address, then
  triggered a fresh submission naming them a participant.
- **Queried the Resend API directly for the resulting message IDs** (`resend.emails.get(id)` —
  the same underlying data the dashboard's activity log reads) rather than trusting the `200` from
  the send call:
  ```
  id=134c3e86-... { subject: "Relay — Action required", last_event: "delivered", to: [...] }
  id=8f900a13-... { subject: "Relay — You were added to a workflow", last_event: "delivered", to: [...] }
  ```
  Both show `last_event: "delivered"` — genuine confirmed delivery, not just acceptance — with
  the recipient and subject line matching the triggering event type exactly
  (`memo_requires_action` → "Action required", `workflow_assignment` → "You were added to a
  workflow"), confirming content matches the event, not just that *an* email went out.
- Reverted the temporary profile-email change and deleted all test data/scripts immediately after.

**Real constraint this surfaced, worth flagging clearly for submission/demo planning:** this
Resend account currently sends from `onboarding@resend.dev` (Resend's shared sandbox address) and
has **no verified sending domain**. As configured right now, it can only successfully email the
account owner's own registered address — every other recipient will 403 (gracefully, but still
undelivered). **Before the demo scenario (PRD §27) or grading, a domain needs to be verified at
resend.com/domains and `RESEND_FROM_EMAIL` updated to use it**, or notification emails to any
seed-data user other than the account owner will silently (well — loggedly) fail to send. Adding
this as an explicit Reminders item below so it isn't missed near the deadline.

**Also resolved this round:**
- `SUPABASE_SERVICE_ROLE_KEY` — confirmed present in `.env.local` now (re-verified directly, not
  taken on trust). Invite-user is now expected to actually work; still not re-tested end-to-end
  (see Reminders).
- **Vercel's env vars still could not be checked from this session** — no Vercel CLI/API access
  exists here. The user said the values are "in .env.local and Vercel" — the `.env.local` half is
  now independently confirmed; the Vercel half still can't be verified by me and needs the user's
  own check of the dashboard.

**Phase 7 — Search, dashboard, reporting (PRD §14/§15/§22).**

- **`/search`** — filters exactly matching PRD §14: memo number, subject, body, author,
  department, category, status, priority, date range. **Deliberately built with no new
  authorization logic** — it's the same `memos_select_authorized` RLS policy (author/admin/
  participant, scoped to `organization_id`) already exhaustively tested in Phase 5, with filters
  layered on top. Confirmed this with a quick targeted script (4/4 checks) rather than assuming
  it: a same-org, zero-involvement user searching with filters that *exactly* match a memo
  (precise subject substring, matching priority) still gets zero rows, because search can't
  surface anything direct navigation wouldn't already allow.
- **`/dashboard`** — expanded well beyond the Phase 1 placeholder to match PRD §15. Regular-user
  section: awaiting-your-action count (derived from `workflow_steps`, not any stored pointer),
  submitted-by-you count, your-memos-by-status breakdown, recent activity (your own
  notifications — regular users have no `audit_log` access, so this is the closest real,
  RLS-visible proxy for "recent activity concerning you"). Admin section (additional, per PRD):
  user/active-user/department/memo counts, pending/completed/rejected workflow counts, recent
  *system* activity (real `audit_log` rows, admin-only per its RLS).
- **`/admin/reports`** — admin-only, filterable by date range/department/category/status per PRD
  §22. Stats: totals, urgent count, pending count, rejected count, current change-request count,
  average workflow completion time (`completed_at - submitted_at`, averaged), plus by-status/
  by-department/by-category breakdowns.
- **Two ambiguous PRD mappings, decided and logged rather than stalled on or silently guessed:**
  - PRD §15 lists "pending approvals" and "pending reviews" as separate regular-user dashboard
    stats — leftover naming from the base spec's Reviewer/Approver step-type distinction, which
    §2.5 item 8 explicitly collapsed. Rather than invent a fake distinction, both collapse into
    the single "awaiting your action" tile plus the "your memos by status" breakdown underneath
    it, which together cover the same real information honestly.
  - The regular-user dashboard's "Completed (yours)" tile counts anything with `completed_at`
    set (approved *or* rejected — consistent with `/completed`'s own definition from Phase 5).
    The admin section's "Completed" stat counts `status = 'approved'` specifically, with
    "Rejected" broken out as its own separate stat — because PRD §15 lists "completed" and
    "rejected" as two distinct *admin* stats side by side, so admins specifically need them split.
    Both are internally consistent with their own immediate context; noted here so the difference
    reads as intentional, not sloppy.
- **Verified all of it against a real, known dataset** (4 memos: one approved, one rejected —
  urgent priority, Technical category — one submitted-and-in-flight, one still a draft), not just
  that the pages render. Every dashboard tile, every reports stat, and a reports filter
  (`?status=approved` narrowing 4 memos down to exactly the 1 approved one) were checked by hand
  against what should have been true given exactly what was created, action by action.

**Real bug found and fixed — caught only by actually searching, not by reading the query:**
`memos.body` is `jsonb` (Tiptap's document format). Postgres has no `ilike` operator for `jsonb`
— filtering search against `body` directly throws `operator does not exist: jsonb ~~* unknown`.
Supabase's client doesn't turn that into a thrown JS exception either; it comes back as
`{ data: null, error: {...} }`, and the search page's `const { data } = await query` wasn't
checking `error` at all — so a search for "urgent" against a memo literally titled *"Urgent
Server Downtime Report"* returned "No matches," indistinguishable from an honest empty result.
This wasn't a body-search-only bug — because the filter is one combined `.or()` clause, the
`body` type error failed the *entire* query, breaking subject and memo-number search too, for
every single search request. Fixed properly (migration 020): added `memos.body_text`, a
trigger-maintained plain-text mirror of `body`'s content (every `"text"` node extracted via
`jsonb_path_query_array(body, '$.**.text')`, synced on every insert/update of `body`, same
pattern as migration 018's last-activity triggers), and search now filters that column instead.
Also fixed the root enabling cause, not just the symptom: the search page now logs any query
error instead of silently treating it as zero results. Re-verified after the fix: searching
"urgent" now correctly finds the memo by subject, **and** searching a deliberately planted
nonsense string that existed only in one memo's body content (nowhere in its subject or number)
correctly found that memo and no others — proving body-content search, the actual original
target of this feature, genuinely works now, not just that the error went away.

**Post-Phase-7 audit: is the search bug's failure shape isolated, or systemic?** The user asked
specifically — don't assume it was a one-off, check every list/dashboard page for the same
pattern (a Supabase query destructures `data` without `error`; a query failure then renders
identically to an honest empty/zero result). **It was not isolated.** Grepped every
`const { data... } = await` and `Promise.all([...])` call site under `src/app` — **every single
list/dashboard/detail page had this gap**, not just search: `/inbox`, `/memos` (My Memos),
`/completed`, `/dashboard` (9 separate query sites — the most exposed page, since a silently
failed admin stats query would show *wrong counts*, not just an empty list), `/admin/reports`,
`/notifications`, `/admin/departments`, `/admin/users`, `/memos/[id]` (7 query sites — the memo
detail/timeline page), `/memos/new`, and `/search`'s own supporting dropdown queries (the main
results query was already fixed as part of the Phase 7 bug fix, but the department/category/
author dropdown queries on that same page still weren't checked).

Fixed identically everywhere — no case-by-case judgment calls, since the risk and the fix are the
same regardless of which page: added `src/lib/log-query-error.ts` (a 5-line shared
`logQueryError(context, error)` helper) and called it after every read query across all 11 files
above (~30 individual query sites). This doesn't change what renders when there's *no* error —
every page's behavior with healthy queries is byte-for-byte the same as before — it only makes a
*future* query failure visible in the server logs instead of silently indistinguishable from a
real empty state, exactly the class of bug that let the search issue hide.

**Verified this didn't introduce a regression**, not just that it compiles: full `next build` +
`eslint` clean, then a live regression pass through every touched page against real data
(dashboard, inbox, my memos, completed, admin departments, admin users, notifications, search,
memos/new, and a memo detail page covering all 7 of its query sites) — confirmed each still
renders exactly as before, and confirmed via the dev server logs that zero `[... query failed]`
entries fired during normal use (i.e., this audit didn't uncover a *second* live bug hiding
behind the same pattern — the search jsonb/ilike issue was the only query that was actually
broken; every other query site was healthy, just unguarded against a *future* failure).

**Worth pulling into the final project documentation's vibe-coding section (PRD §28.B / this
project's "how were errors identified and corrected" writeup):** this audit is a good concrete
example of an isolated bug (search's jsonb/ilike error) turning into a full systemic sweep and
fix across the codebase, rather than a one-line patch. See also the Phase 8 section below for a
second, more pointed example — a regression *introduced and caught within the same session*.

**Correction, found mid-Phase-8 while touching the nav shell for unrelated reasons:** the audit
above missed two call sites that share the exact same shape — `src/app/(app)/layout.tsx`'s
unread-notification-count badge query, and `src/lib/notifications.ts`'s
`sendEmailsForNewNotifications` read of newly-created `notifications` rows. Both destructured
`data`/`count` without `error`, meaning a failure there would have shown "no unread" or silently
sent zero emails — indistinguishable from the honest zero case, the identical failure shape the
audit above was supposed to have found everywhere. Fixed the same way (`logQueryError`) as part
of Phase 8's own work rather than treating the earlier audit as closed and separate. The prior
audit's claim of being exhaustive was **not fully accurate** — 13 files/~32 sites in total, not
11/~30 — corrected here rather than left standing.

## Phase 8 — Templates, delegation, versioning, audit log (PRD §18/§19/§20/§21).

**Schema — migrations 021–026** (full detail in `DATABASE.md`'s migrations log):
- `workflow_templates` + `workflow_template_positions` (§18) — plain RLS-gated CRUD (org_admin
  writes, any org member reads), unlike the workflow engine tables — there's no derived-state
  logic to centralize here, just ownership + org scoping, same class as `departments`.
- `delegations` (§19) + `create_delegation()`/`revoke_delegation()` SECURITY DEFINER functions.
  SELECT-only RLS (delegator, delegate, or org admin); every write goes through the two functions
  so same-org/active-target/not-self/date-range validation and "only the delegator may revoke
  their own delegation" live in exactly one place, not duplicated between RLS and app code.
- Resolved the `TODO(Phase 8)` left in `private.assert_current_holder()` since Phase 4: it now
  also accepts an active delegate, checked by **date range directly against `delegations.start_date`/
  `end_date`, not the stored `status` column** — a delegation past its `end_date` is unusable the
  instant that happens, without needing a scheduled job to flip a status label first. Added
  `workflow_steps.acted_by` and `comments`/`audit_log`.`on_behalf_of_user_id` so an action taken
  by a delegate is recorded as **both** who actually acted and who they acted for — never
  collapsed into just one, per §19's explicit requirement.
- `memos.workflow_template_id` — **a second "documented since Phase 1 but never actually
  migrated" gap**, same class as the `memo_versions` miss caught in Phase 4. Caught this time by
  checking `information_schema.columns` directly rather than trusting `DATABASE.md`, before
  wiring `workflow_templates` into `submit_memo`. Fixed in migration 024.

**A regression introduced and caught within this same session — documented in full rather than
quietly folded away, since the transcript is graded on process:**

Migration 023 rewrote `workflow_approve`/`workflow_decline_reroute` to add delegate attribution,
but was written from the *remembered* migration-013 function bodies instead of their actual
*live* versions — silently undoing migration 019's Phase 6 bug fix (every participant added
mid-chain gets a `workflow_assignment` notification, not just the ones added at initial
submission). This wasn't caught by build/lint (both stayed clean — the code was syntactically and
type-correct, just behaviorally incomplete) or by the delegation test script's early passes,
since that failure mode only shows up as a *missing* notification, not an error.

**Caught by discipline, not luck**: before writing migration 024 (adding `p_workflow_template_id`
to `submit_memo`), the live function body was pulled via
`pg_get_functiondef('public.submit_memo(...)'::regprocedure)` to diff against rather than trusted
from memory — a habit picked up specifically *because* of the regression above, which was itself
caught the same way one function later: after applying migration 024, re-querying
`pg_get_functiondef()` for `workflow_approve`/`workflow_decline_reroute` showed the
`workflow_assignment` calls were missing. Fixed in migration 025, restoring exactly those
`notify_user` calls on top of the new `acted_by`/`on_behalf_of_user_id` attribution — both are
kept, neither regresses the other.

**A second, related self-caught bug**: migration 024's `CREATE OR REPLACE function submit_memo(...)`
added a third parameter, which in Postgres creates a *new overloaded function* rather than
replacing the original — it does not remove `submit_memo(uuid, uuid[])`. This is the exact
overload trap already flagged and deliberately avoided for `private.log_audit_event()` earlier in
migration 023 (handled there by `DROP FUNCTION` + recreate) — missed here by not applying the
same discipline consistently. A 2-arg client call would have silently resolved to the *stale*
old-body overload. Caught by querying `pg_proc`/`regprocedure` for `submit_memo` and finding two
rows instead of one. Fixed in migration 026 (drop the stale overload, re-grant `EXECUTE` on the
survivor). A full sweep afterward (`select proname, count(*) from pg_proc ... group by proname`
across every function touched this session) confirmed exactly one version of each.

**UI built**:
- `/admin/templates` — org_admin CRUD (name, description, ordered position labels; delete with
  in-app two-step confirm, no native `confirm()`, consistent with the standing decision from
  Phase 3).
- `/delegations` — self-service: create a delegation (delegate, date range, optional reason),
  see delegations given and received, revoke (two-step confirm) a delegation you created.
  Effective status (`active`/`expired`/`revoked`) is **computed at read time** from `end_date`,
  not trusted from the stored column — see the schema note above.
- `/admin/audit-log` — admin-only viewer, filterable by event type/user/date range, capped at 200
  rows with an explicit "narrow the filters to see more" note rather than a silent truncation.
- Memo submit panel (`submit-panel.tsx`): optional "start from a template" picker — choosing a
  template shows its ordered positions, each with a person-assignment dropdown; applying it
  replaces the chain being built. Any manual add/remove afterward clears the "built from this
  template" tag so `memos.workflow_template_id` only gets set when the submitted chain still
  genuinely matches what the template produced.
- Memo detail page: a "Version History" section (RLS already permitted this from Phase 4's
  `memo_versions` policy — only the UI was missing) listing every version with a per-row
  expand/collapse showing that version's subject + body snapshot. The action panel now shows an
  explicit "You are acting as an active delegate for X" banner whenever the caller qualifies via
  delegation rather than being the direct holder; the timeline shows step/comment entries as
  "acted by [delegate] · [action] (on behalf of [holder])" whenever those differ, never silently
  attributing to just one.
- Inbox widened to also show memos delegated to the caller (in addition to their own), each row
  marked "(as delegate for X)" — otherwise a delegate would have no way to discover what's
  delegated to them without knowing the memo id in advance.

**Rigor requested by the user, all three addressed with script/query-based proof, not just a UI
walkthrough** (ephemeral Node script, real signed-in HTTP sessions — a fresh throwaway org + 4
real users created via the same bcrypt/`pgcrypto` + `auth.identities` pattern documented since
Phase 4 — all test data and the script deleted immediately after each run):

**1. Delegation — 39/39 checks passed** (first pass surfaced 5 failures that were **test-isolation
bugs, not app bugs** — see below):
- No delegation exists → delegate denied acting on the holder's memo.
- Active delegation created → delegate **can** act; verified directly against the DB (not
  inferred): `workflow_steps.assigned_user_id` stays the holder (their position in the chain is
  unchanged) while `acted_by` is the delegate; the resulting `comments` row has `author_id` =
  delegate and `on_behalf_of_user_id` = holder; the resulting `audit_log` rows have `user_id` =
  delegate and `on_behalf_of_user_id` = holder. Both people, never just one.
- Revoked delegation → delegate denied; confirmed the denied attempt left `workflow_steps`
  byte-identical (still `current`, `acted_by` still null) — zero side effects, not just a rejected
  API call.
- A delegation that hasn't started yet (`start_date` tomorrow) → delegate denied.
- A delegation whose `end_date` has already passed, **with its `status` column still reading
  `active`** (seeded directly to isolate this from `create_delegation`'s own creation-time
  validation, which refuses to create an already-expired one) → delegate still denied, proving
  enforcement checks the actual date range and doesn't trust the stored label.
- A non-delegator (uninvolved third party) cannot revoke someone else's delegation.
- **First run's failures, fully explained and re-verified clean, not just dismissed**: three
  "should be denied" checks unexpectedly passed on the first run. Root cause: an earlier active
  delegation between the same holder/delegate pair (created for a different check) was never
  revoked before later checks ran, and — correctly — any one valid delegation is sufficient
  authorization regardless of others, so it silently kept authorizing every later attempt too.
  This was a test-isolation bug (overlapping delegations between the same pair, no cleanup
  between sections), not an authorization bug — confirmed by querying the `delegations` table
  directly and seeing the un-revoked row, then fixing the test's isolation and re-running for a
  clean 39/39. Also confirms this session did not just declare success on faith — a real
  discrepancy was investigated to its actual root cause before being written off.
- End-to-end UI confirmation on top of the script proof (not required by the user, done anyway
  since it's the same rigor standard as prior phases): signed in as the delegate in a real
  browser, saw the "acting as an active delegate for X" banner, approved, and the timeline
  rendered "UI Test Admin · Approved · (on behalf of UI Test User Two)" exactly as designed —
  and confirmed the banner correctly disappeared on Admin's *next* turn, once Admin became the
  *direct* holder rather than a delegate.

**2. Versioning — resubmission creates a new row; a prior version is genuinely viewable by an
authorized participant, not just present in the DB**:
- After `request_changes` → author edits → `resubmit_memo`: exactly 2 `memo_versions` rows exist
  (not 1 overwritten), with version 1 holding the original subject and version 2 the revised one.
- **The specific thing the user asked to confirm**: an authorized participant (a workflow
  participant, not the author) reading version 1 — the *non-latest* one — through the normal
  RLS-gated client succeeded and returned the original content, proving it's actually viewable by
  someone with legitimate reason to see it, not merely that the row exists via a service-role
  query.
- A zero-involvement outsider in the same org querying the same version got 0 rows (RLS-filtered,
  not an error) — versions inherit the memo's own visibility boundary, not org-wide readability.
- Exercised the resubmission routing model for real in the process: since the memo's only
  original participant had already resolved to `changes_requested` (terminal, not `queued`),
  resubmission does **not** automatically return to them — confirmed the transient
  author-as-holder had to explicitly forward back via `p_forward_to_user_id`, matching §7.1's "no
  special resume logic" exactly as documented, not just as claimed.

**3. Audit log — write-only from the app's perspective, confirmed for org_admin specifically
(the highest-privilege role short of service-role) and for a regular user**:
- org_admin's `UPDATE`/`DELETE` attempts against a real `audit_log` row both matched **zero
  rows** (no policy exists for either operation at all, so PostgREST/RLS silently filters to
  nothing rather than raising — checked the actual row count returned, not just the absence of an
  error, since a no-op success and a real denial can look identical from the error field alone).
  Verified the row's `description` was byte-identical afterward via a direct service-role read.
- A regular user's `UPDATE` attempt also matched zero rows, for completeness.

**Decisions made this phase, logged per `CLAUDE.md` §7:**
- **Delegation is scoped to `assert_current_holder`-gated actions only** (approve/decline/reject/
  request-changes) — `submit_memo`/`resubmit_memo` stay author-only, not delegate-aware. §19
  frames delegation as "act on their behalf" generically, but §7.1's "current holder" is the
  concrete gate the codebase already enforces everywhere else; extending delegation to
  author-only actions (submitting a brand-new draft, resubmitting one's own memo) wasn't asked
  for and would need its own authorization story (can a delegate submit memos as if they were the
  delegator, under the delegator's name?) that §19 doesn't specify. Left out rather than guessed.
- **`delegations.status` only ever transitions `active -> revoked`; `'expired'` is never written**
  by any function, though it stays in the enum for documentation. Enforcement checks the actual
  `start_date`/`end_date` range directly, so nothing is gained by a scheduled job flipping a
  status label — the app computes an "expired" *display* label at read time instead. Chosen to
  avoid introducing `pg_cron` or any scheduled task for something the date-range check already
  handles correctly without one.
- **Only the delegator may revoke their own delegation** — not an org_admin override. §19 doesn't
  mention admin revocation, and it wasn't asked for; admins get read visibility into all of an
  org's delegations (for oversight) but not a revoke button. If this needs to change later
  (e.g. someone leaves the org and their delegations should be forcibly cut), treat it as a scope
  question to confirm, not an implementation detail to just add.
- **Workflow templates are plain RLS-gated CRUD**, not routed through SECURITY DEFINER functions
  like the workflow engine tables — there's no derived/authorization-sensitive state here (unlike
  "who currently holds this memo"), just ownership and org scoping, so the extra indirection
  wasn't warranted.

## Phase 9 — PDF export (PRD §23).

**Library choice, per `CLAUDE.md`'s "pick one, record the choice" instruction**: `@react-pdf/renderer`
was already present in `package.json` (installed in an earlier session, apparently in anticipation
of this phase, but never actually used anywhere — confirmed via a full-codebase grep before relying
on it). Chosen over `pdf-lib` because it composes a document declaratively as
React/JSX (`Document`/`Page`/`View`/`Text`, Yoga-flexbox layout) rather than imperative
coordinate-based drawing, which matches this codebase's existing React-heavy style and made a
structured, multi-section document (org info, meta grid, body, attachments, workflow history,
comments) straightforward to lay out correctly on the first pass.

**Built**:
- `src/lib/pdf/tiptap-to-pdf.tsx` — walks the same Tiptap JSON stored in `memos.body` into
  `@react-pdf` elements. Deliberately does **not** reuse `body_text` (the Phase 7 search-only
  plain-text mirror, which flattens all `"text"` nodes with no paragraph/list structure) — the
  export needs to look like the actual memo, not a search index, so it walks `body` directly:
  paragraphs, `bulletList`/`orderedList` with real bullet/number markers, bold/italic marks, and a
  fallback that flattens any node type not reachable through the editor's toolbar (so nothing
  from a hypothetical API-inserted node silently disappears).
- `src/lib/pdf/memo-document.tsx` — the actual document layout: org name, memo number, subject, a
  status badge (mapped from the full `memo_status` enum down to a human label — §23 names
  "approved / rejected / in progress" as the three canonical buckets, but the app has more granular
  in-flight statuses; all of `submitted`/`pending_review`/`pending_approval`/`changes_requested`
  collapse to "In Progress" rather than inventing a 4th bucket, `changes_requested` gets a
  sub-label appended since that's a meaningfully different in-progress state), author + email,
  department, category, priority, created/submitted/completed dates, body, attachments (file name
  + size only — no signed URLs or file content embedded, matching §23's "attachment references"
  wording and never exposing storage paths per `CLAUDE.md`'s attachment rule), workflow
  participants with approval history (holder, resolution status, action taken, timestamp, comment,
  and delegate dual-attribution — "acted by X on behalf of Y" — reusing Phase 8's
  `acted_by`/`on_behalf_of_user_id` columns), and comments (author, on-behalf-of, type, timestamp,
  body). Colors follow `DESIGN.md`'s palette: near-black ink, muted gray for meta text, the single
  red accent reserved for Rejected status specifically (same convention already used for urgent
  priority elsewhere in the app) — not a full Phase-10 design pass, just enough to not clash with
  it later.
- `src/app/(app)/memos/[id]/pdf/route.ts` — a GET Route Handler (Next 16 App Router, same pattern
  as the existing `auth/callback/route.ts`) that fetches the memo via the caller's own
  RLS-scoped client (same authorization the memo detail page already relies on), **re-checks
  `memo.organization_id === profile.organization_id` explicitly** rather than trusting RLS alone
  (`CLAUDE.md` §4), fetches attachments/workflow_steps/comments, assembles the data, renders via
  `renderToBuffer`, and returns it with `Content-Disposition: attachment` so it downloads as
  `<memo_number>.pdf`.
- An "export pdf" link on the memo detail page header, next to delete-draft, visible to anyone who
  can view the page at all — §23 doesn't restrict export more narrowly than view access, and
  nothing in this codebase's authorization model draws that distinction elsewhere either.

**A "package I assumed vs. package that's actually there" moment, corrected in Phase 10**: while
inspecting `package.json` at the start of this phase, a debug `console.log` briefly made it look
like a *different*, unrelated package (`react-pdf`, a PDF *viewer* wrapper around PDF.js — easy to
confuse by name with `@react-pdf/renderer`, a PDF *generator*) might have been installed instead
of the right one. Re-checked directly with `Object.keys(require('@react-pdf/renderer'))` against
the actual installed package before writing any code — it was the correct one all along; the
mix-up was in my own mislabeled console output, not in the dependency tree.

**However, the write-up above then made an unverified claim that turned out to be false**: it said
`react-pdf` was "genuinely unused dead weight sitting in `package.json`" — but that was never
actually re-checked against `package.json` itself, only inferred from the confused debug output.
When Phase 10 came to remove it (per the user's request, acting in good faith on that claim),
`npm uninstall react-pdf` correctly did nothing, and `grep -i react-pdf package.json` confirmed
why: **there never was a separate `react-pdf` entry** — only `@react-pdf/renderer`, which is the
correct package and is in active use. Corrected here rather than left standing, since a claim I
made turned out to be wrong and the user acted on it — worth being explicit about rather than
quietly fixing the sentence.

**Verified with real content, not just that the route returns 200 — the same lesson the search
bug (Phase 7) and the two Phase 8 regressions taught this session: check the actual output, not
just its status code:**
- A real memo was built through the actual UI with a rich body (a bulleted list containing bold
  and bold+italic text — the genuine Tiptap JSON that came out of real toolbar clicks, not
  hand-crafted test fixtures), a real attachment row, submitted with two participants, approved
  with a comment, plus a separate general comment.
- **Raw substring search on the downloaded PDF bytes found nothing** — not because the content was
  missing, but because `@react-pdf/renderer`'s content streams are `FlateDecode`-compressed, so a
  naive "does the buffer contain this string" check is a false negative, not proof of a bug. Caught
  before drawing the wrong conclusion by cross-checking with a proper parser instead of trusting
  the naive check.
- **Definitive verification**: fetched the real PDF via an authenticated browser session, decoded
  it, and extracted its actual text with a PDF parser (`pdf-parse`, installed with `--no-save` and
  uninstalled again immediately after — confirmed via `git status` that `package.json`/
  `package-lock.json` were untouched, so nothing about this graded repo's dependency tree changed
  for the sake of testing). Every field was present and correct: org name, memo number, subject,
  "IN PROGRESS" status, author name + email, department, category, priority, all three dates, the
  bulleted bold/italic body text exactly as stored, the attachment's name **and size**
  ("budget-sheet.xlsx 44.2 KB" — this had looked *missing* in an earlier screenshot purely because
  it was too small to read at that zoom level, not because it was actually absent; the text
  extraction resolved the ambiguity definitively rather than leaving it as an assumption), the
  full workflow history with the approval comment attributed correctly, and both comments with
  correct type/author/timestamp.
- **Authorization boundary, proven the same way as every prior phase's authorization claims** —
  three real signed-in sessions against the same draft memo (author never submitted it, so no
  workflow participants exist yet — the strictest case, since visibility can only come from
  author/admin, not participation): a same-org user with zero involvement got **404**; a user in a
  completely different organization got **404**; the actual author/org_admin got **200** with a
  real PDF. Confirms the export endpoint doesn't accidentally widen access beyond what the memo
  detail page itself already allows.
- All test orgs/users/memos (including the one seeded with a raw attachment row rather than a real
  upload — upload/download itself was already exhaustively verified via script in Phase 3's
  follow-up verification, 17/17 checks, so this phase only needed to prove the PDF route's own
  *listing* logic, not re-prove storage works) were deleted immediately after.

## Phase 10 — Design pass (`DESIGN.md`'s Swiss/Basel system, applied consistently).

**Foundation, since this cascades to every page:**
- `src/app/globals.css` — replaced the untouched Next.js scaffold (Geist font, plain white/black,
  a dark-mode media query the app never wanted) with `DESIGN.md`'s exact palette as Tailwind v4
  `@theme` tokens: `ink #111111`, `background #F4F1EA`, `surface #FFFFFF`, `accent #E32213`,
  `accent-tint #F9DCD8`, `body #4A463E`, `muted #8A867E`, `rule #DAD5C8`. A `.headline` utility
  class captures Archivo's negative-tracking poster-headline treatment (weight 700, `-0.03em`
  letter-spacing, 0.92 line-height, lowercase) in one place instead of repeating four utility
  classes on every `<h1>`.
- `src/app/layout.tsx` — swapped Geist for Archivo via `next/font/google`, applied
  `bg-background text-ink font-sans` at the body level so every page inherits the system by
  default rather than needing to opt in per-page.
- Bulk-swept every legacy Tailwind color class (`text-neutral-500`, `border-black`, `bg-black`,
  `text-red-700`, `bg-white`, `text-white`, `focus:outline-black`, the `font-bold lowercase
  tracking-tight` headline pattern, etc.) to the new named tokens across all ~35 page/component
  files with `sed`, then hand-reviewed every file the sweep touched — this was a mechanical
  1:1 rename (e.g. `border-black` → `border-ink`), not a design decision, so bulk-applying it
  was the right level of effort, not corner-cutting.

**The specific "Swiss vs. generic minimal" tells the user asked to check, addressed explicitly:**
- **3px black top bar**: already existed in the app shell from an earlier phase; confirmed still
  present after the sweep, plus added to `/login` and `/signup`, which previously had no shell at
  all (`DESIGN.md`: "3px solid black top bar across every page").
- **Archivo, lowercase, tight-tracked headlines**: the `.headline` class, applied to every page
  `<h1>` and the landing page's giant wordmark.
- **Hairline dividers instead of shadows/cards**: confirmed zero `rounded`/`shadow`/`gradient`
  classes anywhere in `src` (the app was already disciplined about this from earlier phases) —
  tables use `border-rule`/`border-ink` hairlines, no card wrappers, no zebra striping.
- **Status as uppercase tracked labels, not pills**: already the existing pattern; the real gap
  was the *color* discipline, not the shape — see the accent-audit finding below.
- **The single red accent, reserved for "needs this user's action now"**: audited every
  `text-accent`/`border-accent` occurrence across the app individually (not just renamed) and
  found — and fixed — **three real violations** where red was being used for something merely
  informational rather than actionable:
  1. `/completed`'s outcome column colored **Rejected** red. Per `DESIGN.md`: "muted gray for
     completed/inactive" — a completed memo needs nobody's action, regardless of outcome. Now
     muted gray, matching Approved/Cancelled.
  2. `/delegations`' status badge colored **Revoked** red. A delegation's status is purely
     historical information on that page; nothing there requires the viewer to act. Now
     near-black (active) / muted (expired or revoked) — no accent.
  3. The PDF export's `statusColor()` (built in Phase 9) colored **Rejected** red for the same
     reason as #1 — worse there, since **a static exported document has no "viewing user" whose
     turn it is at all**, so there was never a valid act-now referent to justify red anywhere in
     its status badge. Now: muted for any terminal status, near-black for in-progress, and the
     accent is reserved exclusively for Urgent priority (re-verified by regenerating a real PDF
     for a rejected+urgent memo after the fix — badge reads "REJECTED" in gray, "urgent" in red).
  Confirmed correct usage (left unchanged) in the process: inbox's urgent-priority tag and
  "Review & decide" required-action label, the memo detail page's urgent-priority tag, the
  workflow timeline's current-step marker, and every dashboard/reports stat tile's `accent` prop
  (only ever wired to "Urgent" counts — checked both call sites directly, not assumed).
  Also fixed a **related but distinct bug** found live in the browser, not by code review: the
  memo detail header colored the *status text* red whenever priority was urgent (a coupling that
  predates this phase), which reads as "the status itself is alarming" rather than "priority is
  urgent" — split into two independent signals (status text color reflects in-progress/terminal;
  a separate small "· urgent" tag carries the accent).
- **Timeline with square markers**: `DESIGN.md` names this specifically — "a vertical hairline
  rule with square black event markers; the current/pending step gets the red marker, completed
  steps get black, future steps get muted gray outline-only markers." The memo detail page's
  Workflow section previously had no markers at all (a plain bordered list). Rebuilt with actual
  square markers on a connecting hairline rule: red-filled for `current`, muted-outline for
  `queued`, solid black for every resolved status. Verified visually against a genuinely
  single-step case (red) and a genuinely resolved case (black) — see below. The chronological
  Timeline (mixed approvals + comments) got a lighter version of the same treatment (small solid
  dots, no red — it's a pure history log, nothing "current" about a past comment) for visual
  consistency with the section above it.
- **Charts**: `DESIGN.md`'s bar-chart rules ("solid black bars, 4px black baseline, no gridlines,
  plain numeral labels") weren't being applied anywhere — the by-status/department/category
  breakdowns on `/admin/reports` and the "your memos by status" breakdown on `/dashboard` were
  plain two-column number tables. Rebuilt both as horizontal bar charts matching the rule exactly;
  no red series on either, since none of these breakdowns represent an act-now signal (a
  department's memo count isn't something to act on).
- **Square corners, no gradients, no icon-library icons**: confirmed already true everywhere
  (`grep`-audited for `rounded`/`shadow`/`gradient` across all of `src`, zero hits beyond a code
  comment referencing the rule itself) — nothing to fix here, the app was already disciplined
  about this from earlier phases.

**A real gap found and closed, not just restyled**: `/profile` **did not exist anywhere in the
codebase** before this phase, despite being named as a required page in PRD §25 and a granted
permission in PRD §5 ("manage their own profile"). Built it now — view own email/role/department/
status, edit name and designation (the two fields a regular user should plausibly self-manage;
department/role/status stay admin-controlled per the existing admin/users flow) — since a design
pass has nothing to apply design *to* on a page that was never built, and leaving it silently
missing would have meant discovering the 404 during the user's own review rather than now. Server
action verified end-to-end, not just visually: edited the designation through the real form,
confirmed the new value persisted in the database directly, not just that the UI re-rendered.

**A pre-existing authorization gap noticed while building `/profile`, deliberately NOT fixed here
— flagged for Phase 12 instead**: `profiles`' `profiles_update_self` RLS policy (`for update
using (id = auth.uid())`, migration 001, Phase 1) has no `with check` restricting *which columns*
a self-update may touch. Postgres treats a missing `with check` as reusing `using`, which only
constrains `id` — meaning a regular user could, via a direct API call bypassing this app's UI
entirely, self-promote `role` from `regular_user` to `org_admin`, or reassign their own
`organization_id`/`department_id`/`status`. This is **not a regression introduced by this
phase** — it's predated every session since Phase 1, and building a UI for the (legitimate) name/
designation self-edit doesn't change the underlying RLS exposure at all, which was already
reachable via direct REST calls regardless of any UI. Not fixed now because: (1) it's a security
fix, not a design-pass task, and blurring that scope right as the user is about to review UI
carries its own risk; (2) Phase 12 ("Security review pass — go through §24's checklist explicitly")
is the designed home for exactly this class of finding. Added to the Phase 12 checklist explicitly
below so it isn't lost.

**Also corrected, not just newly discovered**: the Phase 9 write-up claimed `react-pdf` (a PDF
*viewer* library, confusingly similar in name to `@react-pdf/renderer`, the PDF *generator* this
app actually uses) was "unused dead weight" sitting in `package.json`. The user asked for it to be
removed as a small cleanup; `npm uninstall react-pdf` correctly did nothing, because **that claim
was never actually true** — `grep -i react-pdf package.json` confirms there is, and never was, a
separate `react-pdf` entry; only `@react-pdf/renderer` exists, and it's in active, correct use.
The original Phase 9 note was an unverified assumption stated as fact; corrected in place in that
section rather than left standing, since the user acted on it in good faith.

**Verified visually in the real browser, in an order matching the user's own list**, against a
fresh throwaway org with realistic mixed data (three named users, two departments, a submitted+
urgent memo, an approved memo, a rejected memo, a draft) — not just the design tokens compiling,
the actual rendered pages:

- Landing page — full hero (3px-metadata top row, giant lowercase "relay" wordmark at
  poster-scale, single red accent rule, black band), dropping into the 3-column "create / route /
  resolve" grid (reusing the PRD's own "Employee → Dept Head → Finance → Director" example
  verbatim, per §25's explicit instruction to reuse that style) below the fold, then a closing CTA
  band.
- Login — 3px bar + headline + token colors.
- Dashboard (regular-user and admin sections) — stat tiles (including the urgent-count tile
  correctly red, the rejected-count tile correctly *not* red), the new bar-chart breakdown, and a
  genuine hover-state bug caught live (StatTile's hover class was `hover:bg-background` sitting on
  a page already at `bg-background` — a no-op that had *never* visibly done anything since the
  page background was set; fixed by giving tiles an explicit white surface at rest and a
  black-invert hover, a real fix, not just a token rename).
- Inbox — confirmed the canonical DESIGN.md example directly: urgent priority and the "Review &
  decide" required-action label both red, "Submitted" status plain.
- Completed — confirmed Rejected renders muted, not red, after the fix.
- Memo detail — header (status/priority now split, both readable), body, attachments, action
  panel, the new square-marker Workflow timeline (checked both a red `current` single-step case
  and a black resolved case), the lighter-weight comment/approval Timeline, Version History.
  Also caught and fixed a **real navigation bug live**, not by reading code: the app-shell nav's
  active-link logic used a prefix match, so visiting a memo detail page reached from Inbox
  incorrectly bolded "My Memos" in the nav (since `/memos/[id]` starts with `/memos`) — switched
  to exact-path matching, which also correctly means `/memos/[id]` now highlights nothing (it's
  genuinely reachable from Inbox, Completed, or Search alike, so no single nav item owns it).
- Admin Reports — stat tiles + the new bar charts, confirmed via raw page text (not just the
  screenshot, which rendered "Draft" too small to read confidently) that a fourth breakdown row
  I initially misread as blank was in fact present and correct.
- Admin Users — table + invite form.
- Profile — both the view and the edit flow, including a real database round-trip.
- Search, Notifications — form and empty-state rendering.

**Swept and code-reviewed identically to the verified pages above (same mechanical token rename,
same class of component), but not independently re-screenshotted this round**: Signup, My Memos,
memo creation (`/memos/new`), Admin Departments, Admin Templates, Admin Audit Log, Delegations.
These were visually verified in earlier phases (7 and 8) before this pass existed, and this
phase's changes to them were a pure, low-risk 1:1 class substitution (e.g. `text-red-700` →
`text-accent` on an already-correct usage) rather than new logic — but flagged here explicitly
as "not re-looked-at this round" rather than silently implied as re-verified, since the user asked
for an honest done-vs-rough breakdown, not just a completion claim.

**PDF export's visual layout** — brought into the same palette (the Phase 9 red-for-Rejected bug
above was actually caught and fixed *here*, in Phase 10, while auditing accent usage app-wide, not
in Phase 9 itself). One deliberate, disclosed compromise: the PDF uses Helvetica, not an embedded
Archivo font — `@react-pdf/renderer` requires a real font file to be registered and embedded for
custom fonts, which would mean fetching/bundling a font file into a server route rather than using
`next/font`'s CSS mechanism, added complexity not clearly justified for a phase whose task list
called the PDF's layout "reasonably in scope," not a hard requirement. Colors, spacing, and the
accent-usage rule are all fully correct; only the literal typeface differs from the web app.

**Known rough edges, disclosed rather than left implicit:**
- Table column headers can visually crowd at narrow viewport widths (e.g. "Status" and "Role /
  Department" merging on `/admin/users` at ~730px) — a density/wrapping issue at one specific
  width, not a design-system violation (no shadows/pills/rounded corners involved); low priority.
- The admin nav section (5 extra links for org_admins) makes the top bar's `<nav>` genuinely long
  on narrow viewports. It wraps correctly and the hairline section divider is now hidden below
  `sm:` (fixed this phase — it looked orphaned mid-wrap before), but a true hamburger/collapsed
  nav for mobile would be a further, larger UI change beyond what `DESIGN.md` explicitly asks for;
  not built, since it's a new interaction pattern rather than applying the existing system.
- No individual page was tested at an exact 375px mobile viewport this round (the Browser pane
  itself renders at ~730-800px, below Tailwind's `md:` breakpoint, which did exercise the
  single-column mobile-first fallback path on every grid used — but that's not the same as
  confirming true small-phone width specifically). The responsive classes (`grid-cols-1
  sm:.../md:...`) are standard, low-risk Tailwind patterns, not custom breakpoint logic, so
  confidence is reasonably high without a dedicated mobile pass, but this wasn't independently
  re-verified at 375px specifically.

## In Progress 🚧

- **Verify domain at resend.com/domains and update `RESEND_FROM_EMAIL`** before the demo/grading
  — see "real constraint" note in Phase 6 above. Without this, only the Resend account owner's own
  email can receive notifications; every seed-data user's notification email will 403.
- **Invite-user with the service-role key** — the key was added by the user this session, but the
  invite flow hasn't been re-tested since (last confirmed behavior was the clean-failure path
  before the key existed). Worth a quick real test soon.
- ~~Vercel deploy currently reflects the Phase 2 commit~~ **Confirmed redeployed and live**
  (`5fcd743`) — checked directly against production after pushing: landing page shows Relay
  branding/copy, nav shows the "relay" wordmark, and `/memos/new` renders correctly (Tiptap editor,
  department/category dropdowns populated from real data) — Vercel's GitHub auto-deploy is
  confirmed working, took roughly 2-3 minutes after push.

## Follow-up verification (requested by the user — don't accept "probably fine" without proof)

**1. Rich-text persistence — re-verified with hard evidence, not just re-observed.**

The prior session's "hydration timing, not a bug" conclusion was correct, but hadn't actually been
proven — re-checked properly this time:

- **DB proof:** `select body from memos where memo_number = '...-00001'` returns
  `{"type":"doc","content":[{"type":"paragraph","content":[{"text":"Please review the attached
  budget breakdown for Q3.","type":"text","marks":[{"type":"bold"}]}]}]}` — the bold mark is
  genuinely persisted, not lost.
- **Dev-mode hard refresh:** navigating fresh to `/memos/[id]` on the local dev server and reading
  the page immediately (no wait) reproduces the blank-body symptom every time.
- **Critical check the prior session skipped:** dev-mode Fast Refresh/HMR could have been masking
  a real bug by triggering an unrelated re-render that only *looked* like the content "showing up
  eventually." So this was re-tested against the **production Vercel build** (no HMR, minified,
  the build that actually matters) instead of trusting the dev-mode observation:
  - Fresh hard navigation (`navigate` with `force: true`, bypassing cache) to the same memo on
    `https://relay-cyan-alpha.vercel.app/memos/b0741c33-...`, then an immediate
    `document.querySelector('.ProseMirror').innerHTML` check via injected JS —
    result: `<p><strong>Please review the attached budget breakdown for Q3.</strong></p>` — real
    `<strong>` markup, not just visually-bold text, present essentially immediately.
  - A second run added a polling loop (20ms intervals) timing exactly how long after script start
    it took for the bold content to appear: **0.1ms** — i.e. already present by the time the check
    could run at all.
  - **Conclusion, now with evidence behind it:** this was genuinely just local dev-mode hydration
    being slower than production (unminified React + more overhead), not a save-path bug and not
    an HMR artifact. Production shows no delay worth worrying about. No code change was needed —
    but this is now backed by a controlled production repro, not an assumption.

**2. Attachment upload/download/authorization — tested directly via script, not the browser UI**
(per the user's instruction that this is more rigorous than a file-picker click-through anyway).
Used the exact same `@supabase/supabase-js` calls the app's server actions make
(`storage.upload`, `.from('attachments').insert()`, `storage.createSignedUrl()`,
`storage.download()`), run from two ephemeral Node scripts against the real Supabase project (not
mocked), then deleted both scripts and all test data afterward. Full result: **17/17 checks
passed**:

- *As Alice (org admin, author, "Acme Corp Demo"):* signed in for real → uploaded a real file to
  the private `attachments` bucket → inserted the `attachments` row → **confirmed the stored row's
  `file_size` (79 bytes) matches the actual uploaded byte length exactly**, and `file_name`/
  `mime_type` match what was sent → minted a signed URL → fetched it over real HTTP → **downloaded
  content byte-for-byte identical to what was uploaded**.
- *As an anonymous, unauthenticated client:* direct `storage.download()` by the exact known path —
  **denied**. Attempting to even mint a signed URL for it — **denied**. (Denial reason surfaced as
  "permission denied for function current_organization_id" — expected: `anon` has no `EXECUTE`
  grant on the `private` helper functions at all, so the RLS policy can't even evaluate for that
  role. Fails closed, which is the correct behavior either way.)
- *As Bob, a real signed-up-and-confirmed user in a second, genuinely different organization
  ("Globex Test Org")* — confirmed via his own `profiles.organization_id`
  (`578be415-...` ≠ Alice's org `c88f45ed-...`) before trusting the rest of the test:
  - `select` on the `attachments` row by its known id — **0 rows returned** (RLS-filtered, not an
    error — matches the intended "just doesn't exist to you" behavior).
  - Direct `storage.download()` by the exact known path — **denied** ("Object not found" — the
    bucket correctly refuses to even confirm the object exists to an unauthorized caller, which is
    better than a generic "403 forbidden" that would leak existence).
  - `storage.createSignedUrl()` for that path — **denied**, same reason.
  - `select` on the memo itself by its known id — **0 rows returned**.

This directly demonstrates PRD §12 ("a user must never reach an attachment by guessing or
manipulating a URL") and §27 demo-scenario item 13 (cross-org denial) both hold, at the API level,
independent of anything the UI does or doesn't render — a stronger guarantee than a UI
click-through would have provided, since it proves the server/DB layer enforces this on its own.

All test data (the test attachment row, the uploaded test object, Bob's user/profile/org) was
deleted immediately after the run; both test scripts were deleted, not committed.

## Not Started Yet

- [ ] **Landing page (PRD §25)** — explicitly flagged by the user to track "before final polish."
      Current `/` has Relay branding and correct copy but is plain Tailwind, not the full
      Swiss/Basel hero treatment (large black band, giant lowercase wordmark, single red accent,
      dropping into the 3-column grid below the fold) the PRD calls for. Placing this inside
      **Phase 10 (Design pass)** rather than as a one-off now, per PRD §26's explicit instruction
      that the design pass should be "one dedicated sweep... so it's actually consistent" — but
      calling it out by name here so it isn't quietly forgotten inside that broader phase.
- [x] ~~Phase 4 — Workflow engine~~ **Done** — see Phase 4 section above.
- [x] ~~Phase 5 — Inbox/My Memos/Completed~~ **Done** — see Phase 5 section above. (Memo details +
      timeline were already built as part of Phase 4.)
- [x] ~~Phase 6 — Notifications~~ **Done**, including verified live email delivery — see Phase 6
      section above. (Sending domain still needs verification before demo/grading — flagged in
      Reminders — but the code path and delivery mechanics are confirmed working.)
- [x] ~~Phase 7 — Search, dashboard, reporting~~ **Done** — see Phase 7 section above. (regular-user search/visibility scope per PRD §2.5
      item 7 / §14 — narrower than org-wide, ties into the same `workflow_steps`-based visibility
      widening as Phase 4)
- [x] ~~Phase 8 — Templates, delegation, versioning, audit log~~ **Done** — see Phase 8 section
      above, including a self-caught-and-fixed regression documented in full.
- [x] ~~Phase 9 — PDF export~~ **Done** — see Phase 9 section above.
- [x] ~~Phase 10 — Design pass~~ **Done, pending the user's own visual review of the live deploy**
      (their explicit request for this phase specifically) — see Phase 10 section above for the
      full done/rough breakdown, including the landing page rebuild flagged since Phase 2.
- [ ] Phase 11 — Seed data + full demo scenario walkthrough
- [ ] Phase 12 — Security review pass — **now has a specific known item queued**: the
      `profiles_update_self` RLS policy (migration 001) lacks a `with check` restricting which
      columns a self-update may touch, meaning a regular user could self-promote `role` or
      reassign `organization_id`/`department_id`/`status` via a direct API call. Found in Phase
      10 while building `/profile`, deliberately not fixed there (security fix, not a design-pass
      task) — see that phase's section for the full reasoning. Fix: either a `with check` clause
      that also asserts the unchanged columns via a trigger comparison, or a column-level
      `GRANT UPDATE (name, designation)` for the self-service path specifically.
- [ ] Phase 13 — Documentation + submission packaging

## Known Bugs / Issues

- **[OPEN, found Phase 10, queued for Phase 12] `profiles_update_self` RLS policy has no column
  restriction** — a regular user can self-update any column on their own `profiles` row via a
  direct API call, including `role` (self-promotion to `org_admin`), `organization_id`, and
  `status`, since the policy's `using (id = auth.uid())` has no `with check` narrowing which
  fields may change. Pre-dates every phase since migration 001 (Phase 1); not a regression from
  building `/profile` in Phase 10, just newly noticed while doing so. See Phase 10's section and
  the Phase 12 checklist item above for the fix approach.
- **[FIXED, prior session] Self-referential RLS policy** — see `DATABASE.md`'s "Tenant isolation
  pattern" section for the full writeup; this is now the canonical documented pattern
  (`private.current_organization_id()` / `private.current_role()`).
- **[FIXED, this session] `window.confirm()` on delete-draft** — see Phase 3 notes above.
- **[VERIFIED, this session, via script rather than UI]** Attachment upload/download/
  authorization — see "Follow-up verification" section above for the full 17/17-check result.
  The one thing this doesn't cover is the literal `<input type="file">` → form-submit wiring in
  the browser (i.e. does clicking "choose file" and "upload" in the actual UI correctly call the
  same server action) — that's a standard, low-risk HTML pattern already used correctly elsewhere
  in this codebase, so not treated as an open item, but noted for completeness.
- **[VERIFIED, this session, with production evidence]** Rich-text save/render — see "Follow-up
  verification" above. Not a bug; production shows no meaningful delay.
- `/signup` → email-confirmation-link → `/auth/callback` path still not click-tested with a real
  email (unchanged from last session — still low-risk, same reasoning as before: the RPC it calls
  has been directly exercised and re-verified multiple times since).
- Test artifacts in the `nsu-memo-system` Supabase project needing cleanup before Phase 11 seed
  data: `kamrulshamim65+demoadmin@gmail.com` (org admin, org "Acme Corp Demo"), one `departments`
  row ("Finance"), one `memos` row ("Q3 Budget Approval Request" — kept deliberately as a
  rich-text/attachments demo of Phase 3 working; the throwaway "Test Delete Memo" row was deleted
  as part of testing the delete flow).
- Minor, non-blocking: the browser console shows `[tiptap warn]: Duplicate extension names
  found: ['link']` on every memo editor load — `StarterKit` already registers a Link extension
  internally and `RichTextEditor` also adds `@tiptap/extension-link` explicitly. Purely cosmetic
  (editor works correctly, extensively tested), noticed in this session's dev server logs while
  checking for unrelated errors. Worth a two-minute cleanup in the Phase 10 design pass or
  whenever next touching that component — not urgent enough to interrupt Phase 6 for.
- `memo_number` generation is per-org-counter-table based, not a true Postgres sequence — chosen
  for simplicity and because `on conflict do update` on a single-row-per-org table is already
  race-safe for this scale. Documented in `DATABASE.md`; revisit only if it becomes a real
  bottleneck (very unlikely for a course project's data volume).

## Decisions Log

*(Phase 1/2 entries unchanged, omitted here for length — see git history for the full prior log
if needed. New entries below.)*

- **DATABASE.md merge conflict, resolved by re-applying the RLS bugfix documentation on top of
  the user's instructor-clarification edit** rather than picking one version over the other — see
  "Done" above for detail. Flagged to the user in the same turn rather than silently choosing.
- **Phase 3 memo visibility RLS is intentionally narrower than the final PRD §14 rule**: regular
  users currently only see memos they authored (not yet "or participated in", since
  `workflow_steps` doesn't exist until Phase 4). This is a deliberate, temporary scope decision to
  keep Phase 3 buildable without jumping ahead into Phase 4's tables — tracked explicitly as a
  Phase 4 to-do rather than left ambiguous.
- **No Submit button in Phase 3.** PRD §26's Phase 3 bullet list ("memo creation form, draft
  save/edit/delete, categories, priorities, attachments") doesn't include submission, and
  submitting requires defining an initial participant chain — which needs `workflow_steps`
  (Phase 4). Building a submit button now would either need to be non-functional or would require
  jumping ahead into Phase 4's data model, both of which `CLAUDE.md` §5 says not to do.
- **`memos.status` stays `'submitted'` as the single "in flight" status throughout the workflow.**
  §8 lists `pending_review`/`pending_approval` as part of the minimum status set, and they remain
  in the enum, but nothing in the dynamic-routing model (§2.5 item 8 explicitly collapsed the
  Reviewer-vs-Approver step-type distinction) gives a principled way to pick between them at any
  given moment — inventing an arbitrary rule (e.g. "first step = review, later = approval") would
  contradict "every step is fundamentally the same underlying thing." Left unused rather than
  guessed at.
- **`audit_log`/`notifications` tables built now (Phase 4), not deferred to their nominal Build
  Phases (6/8).** `DATABASE.md`'s own instructions say workflow actions should write these
  consistently "rather than scattering audit-writes ad hoc across the codebase" — retrofitting
  them onto six already-built action functions later would be exactly the ad hoc pattern that
  line warns against. The *UI* for these (in-app notification center, admin audit log viewer)
  is still genuinely Phase 6/8 — only the data-layer writes happen now, which is a groundwork
  decision in the same spirit as `CLAUDE.md` §5's "write real seed data early" guidance, not scope
  creep into those phases' user-facing work.
- **Test users for Phase 4 verification were created with real bcrypt password hashes
  (`pgcrypto`'s `crypt()`/`gen_salt('bf')`), not passwordless stand-ins.** This was specifically so
  they could sign in through the actual Supabase Auth API and exercise the RPCs over real HTTP,
  matching the same rigor as the Phase 3 attachment tests, rather than only via SQL-level
  `request.jwt.claims` simulation. Manually inserting `auth.users` rows this way requires also
  inserting a matching `auth.identities` row and explicitly setting `confirmation_token`/
  `recovery_token`/etc. to `''` rather than leaving them `NULL` — GoTrue's Go driver can't scan a
  NULL into those columns and fails sign-in with an opaque "Database error querying schema" if
  they're left unset. Worth remembering if seed data (Phase 11) ever needs pre-confirmed accounts
  outside the normal `inviteUserByEmail` flow.
- **`window.confirm()` avoided going forward.** Beyond the delete-draft fix, any future
  destructive-action confirmation in this app should use the same in-app two-step pattern, not a
  native browser dialog — both for design-system consistency and because it's the only pattern
  browser-automation testing (used throughout this project's verification) can actually exercise.

## Environment / Infra Notes

- Supabase project: `nsu-memo-system`, ref `gzevdosekfffippelxmi`, region `ap-northeast-1`, free
  tier, ACTIVE_HEALTHY.
- Vercel: **https://relay-cyan-alpha.vercel.app/** — confirmed live and working, serving the
  latest commit (`5fcd743`): Relay branding, memo creation form with Tiptap all verified directly
  against production, not just locally.
- GitHub: https://github.com/arnobalam10-tech/PROJECT-3 (private).
- `SUPABASE_SERVICE_ROLE_KEY`: set by the user in `.env.local` and Vercel (confirmed by the user
  directly, never seen in chat). Not yet re-tested against the invite-user flow.
- Last migration applied: `20260829084000_026_drop_stale_submit_memo_overload` — Phase 9 (PDF
  export) needed no schema changes, pure application layer reading existing tables.
- PDF export uses `@react-pdf/renderer` (already in `package.json` from an earlier session, now
  actually wired up — see Phase 9). Runs server-side in the `/memos/[id]/pdf` Route Handler on
  Node runtime (default for Next.js route handlers — no `edge` runtime override needed or set).
- `SUPABASE_SERVICE_ROLE_KEY`: confirmed present in `.env.local` (independently re-verified, not
  taken on trust — see Phase 6). Not yet re-tested against invite-user specifically.
- `RESEND_API_KEY`/`RESEND_FROM_EMAIL`: confirmed present and working — real delivery verified
  (see Phase 6). `RESEND_FROM_EMAIL` is currently Resend's shared sandbox address
  (`onboarding@resend.dev`); no custom domain verified yet, which caps delivery to the Resend
  account owner's own email until that's done (see the flagged reminder above).
- Vercel env vars: **still not checked from this session** — no Vercel CLI/API access exists
  here. Needs the user's own confirmation via the dashboard.
- New Storage bucket: `attachments` (private).
- New tables this session: `workflow_steps`, `comments`, `audit_log`, `notifications`,
  `memo_versions`. New `private.` helper functions: `is_workflow_participant()`,
  `assert_current_holder()`, `log_audit_event()`, `notify_user()`. New client-callable RPCs:
  `submit_memo`, `workflow_approve`, `workflow_decline_reroute`, `workflow_reject`,
  `workflow_request_changes`, `resubmit_memo`.
- **New this Phase 8 session**: tables `workflow_templates`, `workflow_template_positions`,
  `delegations`. New columns: `memos.workflow_template_id`, `workflow_steps.acted_by`,
  `comments.on_behalf_of_user_id`, `audit_log.on_behalf_of_user_id`. New client-callable RPCs:
  `create_delegation`, `revoke_delegation`. `submit_memo` gained a 3rd optional parameter
  (`p_workflow_template_id`) — same RPC name, new signature, the old 2-arg overload was
  deliberately dropped (migration 026) rather than left to drift alongside the new one.

## Demo / Seed Data Notes

Not built yet (Phase 11). See Known Bugs above for the current list of incidental test artifacts
that need cleanup or intentional replacement first.

## Reminders for later

- [ ] Export the full Claude Code session/prompt history before final submission.
- [ ] Confirm `.env.example` is fully in sync (now includes `SUPABASE_SERVICE_ROLE_KEY`).
- [ ] Write the separate project documentation file (PRD §28.B).
- [ ] Click-test the real email-confirmation link end-to-end.
- [ ] Re-test invite-user now that `SUPABASE_SERVICE_ROLE_KEY` is confirmed present locally.
- [ ] **Verify a sending domain at resend.com/domains and update `RESEND_FROM_EMAIL`** — currently
      capped to emailing only the Resend account owner's own address (confirmed via a real 403
      from Resend). Do this before the demo scenario (PRD §27) or grading.
- [ ] Confirm `SUPABASE_SERVICE_ROLE_KEY`/`RESEND_API_KEY`/`RESEND_FROM_EMAIL` are set in Vercel's
      production env vars too, not just locally — this session has no way to check Vercel
      directly, the user needs to confirm via the dashboard.
- [ ] Enable "Leaked Password Protection" in the Supabase Auth dashboard before Phase 12.
- [ ] Confirm the Vercel redeploy picked up this session's push and matches local `main`.
