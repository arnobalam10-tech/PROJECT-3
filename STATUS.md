# STATUS.md — Living Project Status

**This file must be updated after every meaningful unit of work.** See `CLAUDE.md` §2 for the
rules. It is the source of truth for "what's the current state of the project" — more reliable
than memory of prior sessions. Be precise and honest; "mostly done" is not an acceptable status.

Last updated: 2026-08-29 (Phase 2 checks + Phase 3 build session)
Updated by: Claude Code

---

## Current Phase

Phase 3 (Memo core) — draft CRUD, categories, priorities, and attachments built and verified
locally and (partially) in production. Deployed and live on Vercel.

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

## In Progress 🚧

- **Attachment upload/download — not yet exercised through the browser UI.** The Browser-pane
  automation tool available in this session has no file-picker/file-input capability, and the
  `claude-in-chrome` tool (which does support file uploads) reported "not connected" when tried.
  What *is* verified: the private bucket exists, `storage.objects` RLS policies apply cleanly with
  no advisor warnings, and the upload/download/delete server actions mirror the same
  ownership-check pattern already proven correct elsewhere (`assertOwnedDraft`, signed URLs scoped
  per-request). Still, this is a real gap — **next session (or the user, right now) should
  actually upload and download a file through the UI** before Phase 3 is called fully done.
- **Invite-user with the service-role key** — the key was added by the user this session, but the
  invite flow hasn't been re-tested since (last confirmed behavior was the clean-failure path
  before the key existed). Worth a quick real test soon.
- ~~Vercel deploy currently reflects the Phase 2 commit~~ **Confirmed redeployed and live**
  (`5fcd743`) — checked directly against production after pushing: landing page shows Relay
  branding/copy, nav shows the "relay" wordmark, and `/memos/new` renders correctly (Tiptap editor,
  department/category dropdowns populated from real data) — Vercel's GitHub auto-deploy is
  confirmed working, took roughly 2-3 minutes after push.

## Not Started Yet

- [ ] **Landing page (PRD §25)** — explicitly flagged by the user to track "before final polish."
      Current `/` has Relay branding and correct copy but is plain Tailwind, not the full
      Swiss/Basel hero treatment (large black band, giant lowercase wordmark, single red accent,
      dropping into the 3-column grid below the fold) the PRD calls for. Placing this inside
      **Phase 10 (Design pass)** rather than as a one-off now, per PRD §26's explicit instruction
      that the design pass should be "one dedicated sweep... so it's actually consistent" — but
      calling it out by name here so it isn't quietly forgotten inside that broader phase.
- [ ] Phase 4 — Workflow engine. **Must be built against the new dynamic, holder-controlled
      routing model in `PRD.md` §7 and the redesigned `workflow_steps` table in `DATABASE.md`**
      (queued/current/approved/rejected/changes_requested/declined/skipped, `is_original`/
      `added_by` for tracking deviations from the suggested chain) — there is no old
      fixed-sequence version deployed yet, so there's nothing to migrate away from. Also needs:
      widening the Phase-3 `memos` SELECT policy to match PRD §14 (regular users see memos they
      authored **or were/are a participant in**, not just authored — this was deliberately scoped
      down for Phase 3 since `workflow_steps` didn't exist yet).
- [ ] Phase 5 — Inbox/Outbox/Details/Timeline
- [ ] Phase 6 — Notifications (in-app + Resend email) — also add "Relay" branding to the email
      templates once built (PRD's naming instruction covers "emails from Resend" explicitly).
- [ ] Phase 7 — Search, dashboard, reporting (regular-user search/visibility scope per PRD §2.5
      item 7 / §14 — narrower than org-wide, ties into the same `workflow_steps`-based visibility
      widening as Phase 4)
- [ ] Phase 8 — Templates, delegation, versioning, audit log
- [ ] Phase 9 — PDF export
- [ ] Phase 10 — Design pass (Swiss system applied consistently, **including the landing page
      rebuild flagged above**)
- [ ] Phase 11 — Seed data + full demo scenario walkthrough
- [ ] Phase 12 — Security review pass
- [ ] Phase 13 — Documentation + submission packaging

## Known Bugs / Issues

- **[FIXED, prior session] Self-referential RLS policy** — see `DATABASE.md`'s "Tenant isolation
  pattern" section for the full writeup; this is now the canonical documented pattern
  (`private.current_organization_id()` / `private.current_role()`).
- **[FIXED, this session] `window.confirm()` on delete-draft** — see Phase 3 notes above.
- Attachment upload/download UI path not yet click-tested (see In Progress).
- `/signup` → email-confirmation-link → `/auth/callback` path still not click-tested with a real
  email (unchanged from last session — still low-risk, same reasoning as before: the RPC it calls
  has been directly exercised and re-verified multiple times since).
- Test artifacts in the `nsu-memo-system` Supabase project needing cleanup before Phase 11 seed
  data: `kamrulshamim65+demoadmin@gmail.com` (org admin, org "Acme Corp Demo"), one `departments`
  row ("Finance"), one `memos` row ("Q3 Budget Approval Request" — kept deliberately as a
  rich-text/attachments demo of Phase 3 working; the throwaway "Test Delete Memo" row was deleted
  as part of testing the delete flow).
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
- Resend: still not configured.
- Last migration applied: `20260829045457_010_memo_number_counters_rls`.
- New Storage bucket: `attachments` (private).

## Demo / Seed Data Notes

Not built yet (Phase 11). See Known Bugs above for the current list of incidental test artifacts
that need cleanup or intentional replacement first.

## Reminders for later

- [ ] Export the full Claude Code session/prompt history before final submission.
- [ ] Confirm `.env.example` is fully in sync (now includes `SUPABASE_SERVICE_ROLE_KEY`).
- [ ] Write the separate project documentation file (PRD §28.B).
- [ ] Click-test the real email-confirmation link end-to-end.
- [ ] Click-test attachment upload/download through the actual browser UI.
- [ ] Re-test invite-user now that the service role key is configured.
- [ ] Enable "Leaked Password Protection" in the Supabase Auth dashboard before Phase 12.
- [ ] Confirm the Vercel redeploy picked up this session's push and matches local `main`.
