# CLAUDE.md — Project Operating Instructions

This file is read automatically by Claude Code at the start of every session in this repo.
Follow it exactly. It governs *how* you work, not *what* to build — the "what" is in `PRD.md`,
`DATABASE.md`, and `DESIGN.md`.

## 0. Read order, every session

At the start of any session (new or resumed), read in this order before writing code:
1. `STATUS.md` — what's done, what's in progress, what's next, any open issues.
2. `PRD.md` — the full requirements. Re-check the relevant section for whatever you're about
   to build.
3. `DATABASE.md` — schema and RLS design, if the task touches data.
4. `DESIGN.md` — visual system, if the task touches UI.

Never assume you remember the state of the project from a prior session summary alone —
`STATUS.md` is the source of truth.

## 1. This is a graded course submission — treat it accordingly

This is CSE226 "Foundations of Vibe Coding" at North South University. The grader will read:
- The deployed app itself, testing beyond the happy path.
- The project documentation (architecture, DB design, security, vibe-coding process).
- The full source code.
- **The complete, unedited AI prompt/response history** — i.e., this conversation. Do not
  produce sloppy, throwaway, or embarrassing intermediate states if avoidable; do not fake
  competence — if something is genuinely uncertain, say so and work through it visibly, since
  the transcript itself is graded on process, not just outcome.
- Tenant isolation is explicitly called out in the spec as a "fundamental system requirement,"
  not a UI nicety. Never take a shortcut here even under time pressure.

## 2. STATUS.md is mandatory and must always be current

**After every meaningful unit of work (a feature, a bugfix, a schema change, a deploy step),
update `STATUS.md` before moving on.** This is not optional and not a "do it at the end" task.

`STATUS.md` must always answer, accurately, as of right now:
- What is fully working (and where — local only vs. deployed).
- What is in progress / partially working, and exactly what's left.
- What has not been started yet.
- Any known bugs or limitations.
- The last schema migration applied.
- Any decisions made that deviate from `PRD.md` or `DATABASE.md`, and why.

If a session ends, gets interrupted, or context resets, the next session must be able to pick
up correctly from `STATUS.md` alone. Stale or optimistic status entries ("mostly done") are
worse than no status entries — be precise and honest, including about things that are broken.

## 3. Tech stack (do not deviate without updating this file and STATUS.md)

- **Framework:** Next.js 14+ (App Router), TypeScript, React Server Components where sensible.
- **Database:** Supabase (Postgres). Use the Supabase MCP connection to run SQL/migrations
  directly rather than asking the user to paste SQL into the dashboard.
- **Auth:** Supabase Auth (email/password), with a `profiles` table extending `auth.users`.
- **File storage:** Supabase Storage, private buckets, access via signed URLs only — never
  public bucket URLs for attachments.
- **Styling:** Tailwind CSS, implementing the Swiss/Basel design system in `DESIGN.md` exactly
  — see that file before writing any UI component.
- **Email:** Resend, for the notification emails described in `PRD.md` §10.
- **PDF export:** server-side generation (e.g. `@react-pdf/renderer` or `pdf-lib`) — pick one,
  record the choice in `STATUS.md`.
- **Hosting:** Vercel (frontend + API routes / server actions).
- **Version control:** GitHub. Commit frequently with clear, atomic commit messages — the
  commit history is part of the "how it was built" story and may be reviewed.
- **Package manager:** npm (unless a strong reason to switch — record it if so).

## 4. Tenant isolation — non-negotiable pattern

Every tenant-scoped table gets:
1. An `organization_id` column (FK to `organizations`), NOT NULL.
2. A Postgres Row Level Security (RLS) policy that filters on `organization_id` matching the
   requesting user's org, enforced at the database level.
3. A server-side check in every API route / server action that also verifies the resource's
   `organization_id` matches the session user's org — do not rely on RLS alone as the only
   line of defense, and do not rely on hiding UI as any line of defense at all.

Every new table you add must be checked against this pattern before you consider the feature
done. If a table is genuinely global (not tenant-scoped — there should be very few of these),
say so explicitly in `DATABASE.md` and in `STATUS.md` rather than leaving it ambiguous.

## 5. Working style

- Build in the phase order given in `PRD.md` §"Build Phases" — don't jump ahead to polish or
  stretch features while a core phase is incomplete, since core functionality is what's graded
  most heavily.
- After each phase, do a quick self-check against the relevant PRD section's requirements
  before marking it done in `STATUS.md` — literally re-read the requirement bullets.
- Prefer server-side validation and authorization on every mutating action; never trust the
  client.
- Write real seed data (a demo org, several demo users across roles/departments, at least one
  in-progress multi-step workflow, one completed, one rejected) early — you'll need this for
  the demonstration scenario in `PRD.md` §28 and it's much easier to test against real data
  throughout than to bolt it on at the end.
- Keep an `.env.example` fully in sync with real env vars used, with placeholder values only.
- Do not commit secrets. If a secret is ever pasted into chat, treat it as compromised and tell
  the user to rotate it.

## 6. Deliverables this project must end with

See `PRD.md` §"Submission Checklist" for the full list. Keep these in mind throughout, not just
at the end:
- Deployed Vercel URL, functional.
- GitHub repo with complete source, migrations, seed data, `.env.example`, install/build/run
  instructions in `README.md`.
- Project documentation (separate from this repo's working docs) covering system overview,
  requirements implemented, tech stack, architecture, DB design, workflow design, security,
  vibe-coding process, known limitations.
- The AI prompt/response history export (this Claude Code conversation) — remind the user near
  the end of the project to export/save the session transcript; don't let this be forgotten.
- Demo credentials for at least one org admin and several regular users across the workflow
  chain.

## 7. When something in PRD.md is ambiguous

Make a reasonable decision, implement it, and record the decision and rationale in
`STATUS.md` under a "Decisions" section. Don't stall waiting for clarification on minor
implementation details — the deadline is real. Do ask the user directly if the ambiguity is
about scope (build vs. skip a whole feature) rather than implementation detail.
