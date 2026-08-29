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
- [ ] Re-test invite-user now that the service role key is configured.
- [ ] Enable "Leaked Password Protection" in the Supabase Auth dashboard before Phase 12.
- [ ] Confirm the Vercel redeploy picked up this session's push and matches local `main`.
