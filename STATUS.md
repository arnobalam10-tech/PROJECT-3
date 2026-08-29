# STATUS.md — Living Project Status

**This file must be updated after every meaningful unit of work.** See `CLAUDE.md` §2 for the
rules. It is the source of truth for "what's the current state of the project" — more reliable
than memory of prior sessions. Be precise and honest; "mostly done" is not an acceptable status.

Last updated: 2026-08-29 (Phase 1 build session)
Updated by: Claude Code

---

## Current Phase

Phase 1 (Foundation) — core plumbing built and verified locally. GitHub repo + Vercel deploy not
done yet (next steps).

## Done ✅

- Next.js 16 (App Router, TypeScript, Tailwind) scaffolded at repo root.
- Supabase project created: `nsu-memo-system` (ref `gzevdosekfffippelxmi`, region ap-northeast-1,
  free tier, $0/month).
- Base schema migration applied (`supabase/migrations/20260829040558_001_organizations_and_profiles.sql`):
  - `organizations` table (global tenant root).
  - `profiles` table (tenant-scoped, 1:1 with `auth.users`), enums `user_role`, `user_status`.
  - RLS enabled on both tables: org-scoped select, self/admin update policies.
  - `create_organization_with_admin()` — SECURITY DEFINER RPC that atomically creates an org +
    its first `org_admin` profile for the calling authenticated user (used by the signup/onboarding
    flow, since a brand-new user has no `organization_id` yet for RLS to key off of).
  - Second migration locks that RPC's EXECUTE grant down to the `authenticated` role only (removed
    from `anon`/`public`) — confirmed clean via `get_advisors` (security): no warnings remain.
- Supabase client helpers: `src/lib/supabase/client.ts` (browser), `src/lib/supabase/server.ts`
  (server components/actions), `src/lib/supabase/middleware.ts` + `src/proxy.ts` (session refresh
  + route protection — Next.js 16 renamed the `middleware.ts` convention to `proxy.ts`; migrated).
- Auth pages/flows, all tested manually against the real dev server + real Supabase project:
  - `/` — public landing page.
  - `/signup` — org name + admin name/designation + email/password → `supabase.auth.signUp()`
    with pending-org fields stashed in `user_metadata`. If Supabase returns a session immediately
    (email confirmation disabled), calls the RPC and redirects to `/dashboard` right away.
    Otherwise shows a "check your email" message.
  - `/auth/callback` — exchanges the confirmation-link code for a session, then (if the user has
    no profile yet) reads the pending-org fields from `user_metadata` and calls the same RPC. This
    path is implemented but **not yet click-tested** (see Known Bugs/Limitations below).
  - `/login` — email/password sign-in via `supabase.auth.signInWithPassword()`. Verified: wrong
    password shows a generic "Invalid email or password" error (no info leak, satisfies PRD §24.13).
  - `/dashboard` — protected placeholder page; reads the caller's own profile + org name (RLS-scoped
    query) and shows a sign-out button.
  - Route protection verified: unauthenticated request to `/dashboard` redirects to `/login`
    (tested directly in-browser, not just by reading the code).
- `npm run build` passes clean (no TS errors, no warnings) with Turbopack.
- `.env.example` created and kept in sync with `.env.local`; `.gitignore` updated to ignore all
  `.env*` **except** `.env.example` (default Next.js `.gitignore` would have excluded the example
  file too — fixed).
- Local git repo initialized (not yet pushed — GitHub repo not created yet).

## In Progress 🚧

- GitHub repo (private, per user decision) — not yet created.
- Vercel project — not yet connected. No deployed URL yet.

## Not Started Yet

- [ ] Phase 2 — Orgs, users, departments, roles (admin user management, department CRUD,
      role-gated nav/server checks — org creation itself is done, admin management of *other*
      users is not)
- [ ] Phase 3 — Memo core (creation, drafts, categories, attachments)
- [ ] Phase 4 — Workflow engine
- [ ] Phase 5 — Inbox/Outbox/Details/Timeline
- [ ] Phase 6 — Notifications (in-app + Resend email)
- [ ] Phase 7 — Search, dashboard, reporting
- [ ] Phase 8 — Templates, delegation, versioning, audit log
- [ ] Phase 9 — PDF export
- [ ] Phase 10 — Design pass (Swiss system applied consistently)
- [ ] Phase 11 — Seed data + full demo scenario walkthrough
- [ ] Phase 12 — Security review pass (PRD §24 checklist, verified item by item)
- [ ] Phase 13 — Documentation + submission packaging

## Known Bugs / Issues

- The `/signup` → email-confirmation-link → `/auth/callback` → org-creation path is implemented
  but has **not** been exercised end-to-end (would require clicking a real confirmation email link,
  which wasn't done in this session). What *has* been verified: `signUp()` succeeds and correctly
  shows the "check your email" state when Supabase requires confirmation (default project setting).
  The callback route logic mirrors the already-tested direct-session path exactly (same RPC call),
  so risk is low, but this should be click-tested for real before Phase 1 is considered fully closed
  — either by clicking the real confirmation email, or by an admin disabling "Confirm email" in the
  Supabase Auth dashboard for faster local iteration (not done — would need to be a deliberate,
  confirmed decision since it changes account-security posture; see Decisions Log).
- Test signup was done with a real address (`kamrulshamim65+demoadmin@gmail.com`, using Gmail's
  `+` sub-addressing) because Supabase's email validator rejects `@example.com` addresses outright.
  This test account now exists in the `nsu-memo-system` Supabase project's `auth.users` table
  unconfirmed, with no profile/org yet. It should be deleted or repurposed before real seed data
  is built in Phase 11, so it doesn't show up as clutter in the grader's view of the project.

## Decisions Log

- **PDF export library:** not yet chosen (Phase 9 work) — `@react-pdf/renderer` was installed
  alongside `@supabase/supabase-js`/`@supabase/ssr`/`resend` in the initial dependency pass since
  PRD leaves the choice open; final choice will be confirmed when Phase 9 is actually built.
- **Auth onboarding shape:** PRD describes org admins as the ones who "add or invite users" (§3),
  implying self-service signup isn't really in scope beyond the *first* admin of a *new*
  organization. Built `/signup` as exactly that: creates one new org + its first `org_admin` in
  one step via a SECURITY DEFINER RPC (`create_organization_with_admin`), since a brand-new
  Supabase Auth user has no `organization_id` yet for normal RLS policies to key off. All
  *subsequent* users in an org will be created by that org's admin (Phase 2 admin panel), not via
  public self-signup — this matches the PRD's role description and avoids an open public signup
  surface for arbitrary org membership.
- **Next.js middleware → proxy rename:** Next.js 16 deprecated the `middleware.ts` file convention
  in favor of `proxy.ts` (same behavior, new file/export name). Migrated immediately since the
  deprecation warning showed up in the very first build; no functional difference, just avoids
  building on a convention already marked for removal.
- **Service role key:** deliberately not used anywhere in the app. Server-side privileged writes
  (org bootstrap) go through a SECURITY DEFINER Postgres function instead of a service-role
  Supabase client, so there's no service-role secret to protect in app code at all. The seed script
  (Phase 11) will likely need the service role key locally (for `auth.admin.createUser` with
  pre-confirmed demo accounts) — that's expected to stay a local-only secret, never committed, and
  is a good candidate to flag again explicitly right before Phase 11.

## Environment / Infra Notes

- Supabase project: `nsu-memo-system`, ref `gzevdosekfffippelxmi`, org `qzonwgownzpeuawfddcx`,
  region `ap-northeast-1`, plan free ($0/month), status ACTIVE_HEALTHY.
- Vercel project: not yet connected.
- GitHub repo: not yet created (user chose: new **private** repo, to be created after first local
  commit).
- Resend: not yet configured (`RESEND_API_KEY` blank in `.env.local`).
- Last migration applied: `20260829040613_002_restrict_create_org_function` (see
  `supabase/migrations/`).

## Demo / Seed Data Notes

Not built yet (Phase 11). One incidental unconfirmed test account exists in Supabase Auth from
manual Phase 1 testing — see Known Bugs above; needs cleanup before real seed data lands.

## Reminders for later

- [ ] Export the full Claude Code session/prompt history before final submission — cannot be
      reconstructed after the fact.
- [ ] Confirm `.env.example` is fully in sync with actual required env vars.
- [ ] Write the separate project documentation file (PRD §28.B) — this is distinct from these
      working docs.
- [ ] Click-test the real email-confirmation link end-to-end (see Known Bugs above).
- [ ] Delete/repurpose the `kamrulshamim65+demoadmin@gmail.com` test account before Phase 11 seed
      data is built.
