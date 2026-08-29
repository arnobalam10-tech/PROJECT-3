# STATUS.md — Living Project Status

**This file must be updated after every meaningful unit of work.** See `CLAUDE.md` §2 for the
rules. It is the source of truth for "what's the current state of the project" — more reliable
than memory of prior sessions. Be precise and honest; "mostly done" is not an acceptable status.

Last updated: 2026-08-29 (Phase 1 + Phase 2 build session)
Updated by: Claude Code

---

## Current Phase

Phase 2 (Orgs, users, departments, roles) — core admin functionality built and verified locally
against the real dev server + real Supabase project. GitHub repo created and pushed. Vercel
deploy handed off to the user (see In Progress).

## Done ✅

**Phase 1 — Foundation**
- Next.js 16 (App Router, TypeScript, Tailwind) scaffolded at repo root.
- Supabase project created: `nsu-memo-system` (ref `gzevdosekfffippelxmi`, region ap-northeast-1,
  free tier, $0/month).
- Supabase client helpers (`src/lib/supabase/{client,server,middleware}.ts`), session-refresh +
  route-protection proxy (`src/proxy.ts` — Next 16 renamed `middleware.ts` → `proxy.ts`, migrated).
- Auth pages: `/` (landing), `/signup` (org bootstrap), `/login`, `/auth/callback`
  (email-confirmation-link handler), `/dashboard`.
- GitHub repo created by the user: https://github.com/arnobalam10-tech/PROJECT-3 (private).
  First commit pushed (`da6406a`).
- `npm run build` passes clean, no TS errors.

**Phase 2 — Orgs, users, departments, roles**
- `requireProfile()` / `requireOrgAdmin()` auth helpers (`src/lib/auth.ts`) — every admin page and
  every mutating server action calls one of these; RLS is never the only line of defense (per
  `CLAUDE.md` §4).
- Shared authenticated app shell: `src/app/(app)/layout.tsx` — role-gated nav (Users/Departments
  links only render for `org_admin`), sign-out. `/dashboard`, `/inbox` (placeholder), `/memos`
  (placeholder), `/admin/departments`, `/admin/users` all live under this route group.
- **Departments** (`/admin/departments`): create, list, activate/deactivate. Every mutation
  derives `organization_id` from the server-side admin profile, never from client input; every
  mutation re-verifies the target row's `organization_id` matches the caller's org before writing
  (belt-and-suspenders on top of RLS).
- **Users** (`/admin/users`): list org members; invite new users (via Supabase Auth Admin API —
  see Decisions Log for why this needs the service-role key); change role/department/active
  status per user. Self-lockout guards: an admin can't change their own role or deactivate
  themselves (controls are disabled in the UI *and* the server actions no-op/reject it — not just
  hidden buttons).
- Migrations 3–5 (see `DATABASE.md` "Migrations applied so far" for full detail):
  - `003_departments` — `departments` table + RLS, backfills deferred `profiles.department_id` FK.
  - `004_fix_rls_self_reference` / `005_fix_helper_function_grants` — **real bug, found and fixed
    this session**, see Known Bugs/Issues below. This is now the documented canonical pattern in
    `DATABASE.md`.
- `src/lib/supabase/admin.ts` — service-role client, used only by the invite-user server action,
  never imported anywhere client-reachable.
- Manually tested end-to-end in the real browser against the real dev server + real Supabase
  project (not just read the code and assumed): dashboard render, department create, department
  deactivate/reactivate (confirmed via DB round-trip, not just UI optimism), user invite
  (confirmed it fails cleanly with an actionable error when `SUPABASE_SERVICE_ROLE_KEY` is unset,
  rather than crashing or leaking a stack trace — satisfies PRD §24.13 as a side effect).
- `npm run build` passes clean after all Phase 2 additions.

## In Progress 🚧

- **Vercel deploy** — handed off to the user (no `vercel`/`gh` CLI available in this environment,
  and account login is inherently interactive). User is deploying via vercel.com/new import of
  the GitHub repo. Not yet confirmed live; no deployed URL recorded yet. **Next session: ask the
  user for the URL, or check if it's already been done, before starting Phase 3.**
- **`SUPABASE_SERVICE_ROLE_KEY`** — required for the invite-user feature to actually work (beyond
  failing cleanly, which is already verified). Deliberately not set by Claude Code — this key
  must never pass through the chat transcript, since that transcript is itself part of the graded
  submission (see `CLAUDE.md` §1). The user needs to add it directly to `.env.local` and to
  Vercel's server env vars themselves, from Supabase dashboard → Project Settings → API →
  service_role secret. **Not yet done as of this note** — invite-user is untested beyond the
  clean-failure path.

## Not Started Yet

- [ ] Phase 3 — Memo core (creation, drafts, categories, attachments)
- [ ] Phase 4 — Workflow engine
- [ ] Phase 5 — Inbox/Outbox/Details/Timeline
- [ ] Phase 6 — Notifications (in-app + Resend email)
- [ ] Phase 7 — Search, dashboard, reporting
- [ ] Phase 8 — Templates, delegation, versioning, audit log
- [ ] Phase 9 — PDF export
- [ ] Phase 10 — Design pass (Swiss system applied consistently — Phase 1/2 UI is intentionally
      plain Tailwind, per PRD §26's "working end-to-end, even if unstyled" instruction; do the
      real Swiss/Basel pass as one dedicated sweep once more pages exist, not ad hoc per page)
- [ ] Phase 11 — Seed data + full demo scenario walkthrough
- [ ] Phase 12 — Security review pass (PRD §24 checklist, verified item by item)
- [ ] Phase 13 — Documentation + submission packaging

## Known Bugs / Issues

- **[FIXED, this session] Self-referential RLS policy locked every user out of their own profile
  row.** The original `profiles_select_same_org` policy (and every other tenant-isolation policy
  copied from the same pattern) checked
  `organization_id = (select organization_id from profiles where id = auth.uid())` — but that
  subquery targets `profiles`, which is *itself* governed by this same policy, so it can never
  resolve without already knowing the answer it's trying to compute. Net effect: nobody, including
  a user reading their own row, could ever pass this check. Symptom: an infinite `/login` ↔
  `/dashboard` redirect loop (middleware sees a valid session and redirects `/login` → `/dashboard`;
  `requireProfile()` on `/dashboard` can't find a profile via the broken RLS and redirects back to
  `/login`). Root-caused by directly reproducing the exact query via SQL with
  `set_config('request.jwt.claims', ...)` to simulate an authenticated request outside the
  browser, which isolated the problem to RLS rather than app logic. Fixed in migration
  `004_fix_rls_self_reference` by introducing `private.current_organization_id()` /
  `private.current_role()` — SECURITY DEFINER functions that resolve the caller's own org/role by
  bypassing RLS for that one narrow lookup — and rewriting every policy to use them.
  **A second bug was introduced by the first fix**: the migration also revoked `EXECUTE` on those
  two helper functions from `authenticated`, which broke RLS evaluation entirely (a policy can't
  call a function it has no permission to call, regardless of SECURITY DEFINER — that setting only
  governs what happens *inside* the function once it's legitimately called). Fixed in
  `005_fix_helper_function_grants`. Both fixes verified via direct SQL repro *and* a full
  browser-driven walkthrough afterward. Full detail and the corrected canonical pattern are now in
  `DATABASE.md`.
- The `/signup` → email-confirmation-link → `/auth/callback` → org-creation path is implemented
  but still has **not** been click-tested with a real confirmation email link (would require
  actually clicking a link delivered to a real inbox). What *has* been verified, thoroughly: the
  `signUp()` → "check your email" state, and — critically — the exact same
  `create_organization_with_admin` RPC call the callback route makes, exercised directly via SQL
  with a simulated authenticated session (this is how the RLS bug above was root-caused and
  re-verified after the fix). Risk is low since the callback route is a thin wrapper around a
  code path that's now been exercised directly, but a real click-through is still worth doing
  before Phase 1/2 are considered fully closed.
- Invite-user (`/admin/users`) is wired up correctly and fails cleanly without
  `SUPABASE_SERVICE_ROLE_KEY`, but has not been tested with the key actually present — see In
  Progress above.
- Two test accounts now exist in the `nsu-memo-system` Supabase project from manual testing this
  session, both should be deleted/repurposed before Phase 11 seed data is built:
  - `kamrulshamim65+demoadmin@gmail.com` — org `Acme Corp Demo`, role `org_admin`. Used to
    verify dashboard/admin flows end-to-end.
  - One `departments` row (`Finance`) under that same org.
- Tables (departments, users) don't scroll/wrap gracefully on narrow viewports yet — expected,
  this is exactly the kind of polish Phase 10's dedicated design pass is for for, not a Phase 2
  concern.

## Decisions Log

- **PDF export library:** not yet chosen (Phase 9 work) — `@react-pdf/renderer` was installed
  alongside `@supabase/supabase-js`/`@supabase/ssr`/`resend` in the initial dependency pass since
  PRD leaves the choice open; final choice will be confirmed when Phase 9 is actually built.
- **Auth onboarding shape:** PRD describes org admins as the ones who "add or invite users" (§3),
  implying self-service signup isn't really in scope beyond the *first* admin of a *new*
  organization. Built `/signup` as exactly that: creates one new org + its first `org_admin` in
  one step via a SECURITY DEFINER RPC (`create_organization_with_admin`). All *subsequent* users
  in an org are created by that org's admin via `/admin/users` invite, not public self-signup —
  matches the PRD's role description and avoids an open public signup surface for arbitrary org
  membership.
- **Next.js middleware → proxy rename:** Next.js 16 deprecated the `middleware.ts` file convention
  in favor of `proxy.ts`. Migrated immediately since the deprecation warning showed up in the
  very first build.
- **Service role key usage:** used *only* for the admin invite-user server action
  (`src/lib/supabase/admin.ts`), never for anything else — org bootstrap deliberately still goes
  through the SECURITY DEFINER RPC instead, so the app's privileged-write surface is as small as
  possible. The key itself is never handled through chat (see In Progress above) — the user adds
  it directly to `.env.local`/Vercel themselves.
- **Invite flow uses Supabase Auth Admin API (`inviteUserByEmail`), not a temp-password flow:**
  matches PRD §3's "add or invite users" wording, and lets the invited user set their own password
  via the email link rather than an admin choosing one for them (better security posture, and
  avoids needing to share a temp password out-of-band).
- **Private helper-function schema:** `private.current_organization_id()` /
  `private.current_role()` live in a dedicated `private` Postgres schema rather than `public`,
  specifically so they're structurally unreachable via PostgREST's `/rest/v1/rpc/...` regardless
  of grants (defense in depth on top of the grants themselves — see the RLS bug writeup above and
  `DATABASE.md`).

## Environment / Infra Notes

- Supabase project: `nsu-memo-system`, ref `gzevdosekfffippelxmi`, org `qzonwgownzpeuawfddcx`,
  region `ap-northeast-1`, plan free ($0/month), status ACTIVE_HEALTHY.
- Vercel project: not yet connected (see In Progress).
- GitHub repo: https://github.com/arnobalam10-tech/PROJECT-3 (private). First commit `da6406a`
  pushed to `main`.
- Resend: not yet configured (`RESEND_API_KEY` blank in `.env.local`).
- `SUPABASE_SERVICE_ROLE_KEY`: not yet set anywhere (see In Progress — needs the user to add it).
- Last migration applied: `20260829042744_005_fix_helper_function_grants`.
- Supabase Auth advisor notes (`get_advisors`, security): one remaining WARN,
  "Leaked Password Protection Disabled" — a HaveIBeenPwned check that Supabase can enable, but
  isn't exposed via the MCP tools available in this session (it's an Auth-service setting, not a
  SQL-editable one). Flagging for the user to toggle in the Supabase dashboard
  (Authentication → Policies) before the Phase 12 security review, or that phase should catch it
  as an open item if not done by then.

## Demo / Seed Data Notes

Not built yet (Phase 11). Two incidental test artifacts exist from manual Phase 1/2 testing — see
Known Bugs above; both need cleanup before real seed data lands.

## Reminders for later

- [ ] Export the full Claude Code session/prompt history before final submission — cannot be
      reconstructed after the fact.
- [ ] Confirm `.env.example` is fully in sync with actual required env vars.
- [ ] Write the separate project documentation file (PRD §28.B) — this is distinct from these
      working docs.
- [ ] Click-test the real email-confirmation link end-to-end (see Known Bugs above).
- [ ] Add `SUPABASE_SERVICE_ROLE_KEY` to `.env.local` and Vercel (user action — see In Progress),
      then actually test an invite end-to-end.
- [ ] Delete/repurpose the two test artifacts (`kamrulshamim65+demoadmin@gmail.com`, `Finance`
      dept under `Acme Corp Demo`) before Phase 11 seed data is built.
- [ ] Enable "Leaked Password Protection" in the Supabase Auth dashboard before Phase 12.
- [ ] Confirm the Vercel deploy is live and get the URL into this file.
