# PRD — Inter-Office Memo Management System

**App name: Relay** — the memo moves like a baton through the chain of people who need to act
on it. Use this name consistently: page titles, the landing page, emails from Resend, the login
screen, favicon/wordmark treatment (see `DESIGN.md`).

**Course:** CSE226, Foundations of Vibe Coding, NSU, Summer 2026
**Type:** Solo submission
**Deadline:** Midnight, 29 August 2026
**Source spec:** `CSE226_Summer_26_Project-3.pdf` (all requirements below are derived from it;
this document translates that spec into a build-ready plan with concrete tech decisions)

This is the single source of truth for *what to build*. `CLAUDE.md` governs *how* to work.
`DATABASE.md` governs the schema. `DESIGN.md` governs the visual system.

---

## 1. Product Summary

A multi-tenant web application where organizations manage internal memos that move through a
defined, ordered, sequential approval/review workflow (e.g. Employee → Dept Head → Finance →
Director → CEO). Users create memos, submit them into a workflow, and each participant in turn
can approve, reject, comment, or request changes — with full history, notifications, search,
and reporting. Strict tenant isolation: organizations never see each other's data.

## 2. Confirmed Technical Decisions

| Area | Decision |
|---|---|
| Framework | Next.js 14+ (App Router), TypeScript |
| Database | Supabase (Postgres), managed via Supabase MCP so Claude can run migrations directly |
| Auth | Supabase Auth (email/password) |
| File storage | Supabase Storage, private buckets, signed URLs only |
| Styling | Tailwind CSS + Swiss/Basel design system (see `DESIGN.md`) |
| Email | Resend (transactional email for notifications) |
| PDF export | Server-side generation (`@react-pdf/renderer` or `pdf-lib` — pick one, log in STATUS.md) |
| Hosting | Vercel |
| Version control | GitHub, frequent atomic commits |
| Tenant isolation mechanism | `organization_id` on every tenant-scoped table + Postgres RLS + server-side authorization checks (belt and suspenders — see `CLAUDE.md` §4) |
| Scope | Full spec — every section below is in scope, not just a minimal subset. Cut nothing without flagging it in STATUS.md first. |

## 2.5 Instructor Clarifications (authoritative — override the original PDF spec text below wherever they conflict)

Other students asked the course instructor clarifying questions; his live answers refine and in
some cases change the written spec. Where anything below conflicts with earlier section text
in this document, **this section wins**. The relevant sections have also been rewritten to
match, but this list is kept as a single reference point.

1. **Multi-tenancy:** one shared database, organizations isolated purely at the data level
   (confirmed — no change to our design).
2. **Auth provider:** instructor's choice to make (confirmed Supabase Auth).
3. **SSO:** not required.
4. **Org onboarding:** should feel like signing up for an org-wide SaaS product (e.g. how a
   company signs up for a business email service) — a person signs up, an organization is
   created, that person becomes its first admin, and they invite the rest of the org. This is
   **self-serve public signup**, not an instructor/super-admin-provisioned flow. See §3.1
   (new).
5. **Workflow flexibility:** workflows are **not** a rigid, fixed sequence locked in at
   submission. Whoever currently holds the memo has discretion over what happens next — see
   the rewritten §7.
6. **Who can modify the remaining workflow:** anyone currently in the workflow (i.e. whoever
   the memo is currently with), not just the original author or an admin.
7. **Search/visibility scope for regular users:** a regular user may only search or see memos
   they **authored, or are/were a participant in**. This is narrower than "anything they're
   generally authorized to see" — see rewritten §14. Org admins retain the broader org-level
   memo visibility already granted to them in §5 of the base spec.
8. **Workflow step types:** do not build distinct "Reviewer" vs. "Approver" step types.
   Every step is fundamentally the same underlying thing — a person makes a decision and
   optionally comments; "even an approval is a comment, really." Keep the action vocabulary
   (approve / reject / comment / request changes / forward) but don't structurally differentiate
   step *roles*.
9. **Notifications:** in-app is the confirmed baseline requirement. Email (via Resend) remains
   in our scope as an enhancement on top of that baseline — the base spec explicitly allows
   email as an addition, so this isn't a conflict.
10. **Explicitly out of scope:** periodic DB backups/snapshots as an app feature (Supabase's own
    infra backups are sufficient — nothing to build), and API rate limiting/tiers. The
    instructor tried building both in similar contexts before and said they didn't produce the
    intended effect, so don't build custom versions of either.
11. **Not directly answered — treat as out of scope unless you hear otherwise:** MFA, an
    admin "login as another user" support tool, API keys for external integrations, a
    platform-wide super-admin role that manages all organizations, org-level data
    export/import/full-delete tooling, and a formal soft-delete-vs-hard-delete policy beyond
    what's already implied (deactivate, don't delete, for departments/users; never overwrite
    memo history). If time allows near the end and these come up again, ask before building.

## 3. Multi-Tenant Organization Management

Each organization has: name, a unique identifier/slug, logo/profile image, contact info,
departments, users, and organization-specific configuration (e.g. its own memo categories).

Org admins can: create/manage departments, add or invite users, activate/deactivate users,
assign users to departments, assign roles, update org info.

**Hard rule:** no query, page, API route, storage bucket path, or search result may ever expose
one organization's data to a user in another organization. This must be true even under direct
URL manipulation or API calls, not just through the normal UI flow.

### 3.1 Organization Onboarding (self-serve)

Modeled on signing up for an org-wide SaaS product (e.g. a business email service):
- A public "create your organization" signup flow — no invite or platform admin required to
  start it.
- The person signing up provides: their own name/email/password, and the new organization's
  name (slug can be derived or chosen).
- On successful signup: create the `organizations` row, create the signer's `profiles` row with
  `role = org_admin`, and log them in.
- That admin then invites/adds the rest of their org's users from the admin interface (§5's
  existing admin capabilities already cover this — invite, activate/deactivate, assign roles).
- No platform-wide super-admin is required to provision orgs — see §2.5 item 11.

Org-level data export/import/full-delete tooling is out of scope (§2.5 item 11) — don't build
UI for it. Deactivating a user or department must still never delete their historical memo
data, per §16/§21.

## 4. Authentication

- Log in / log out, change password, reset forgotten password (via Supabase Auth flows +
  Resend for the reset email).
- View/update profile: name, email, designation, department, role, account status.
- Secure sessions; protected routes redirect unauthenticated users to login; protected API
  routes/server actions reject unauthenticated requests server-side (never rely on client
  routing alone).

## 5. Roles & Permissions

**Organization Administrator** — manage org info, users, departments, activate/deactivate
users, view org-level stats and memo info, manage memo categories, manage workflow templates.

**Regular User** — create memos, save drafts, submit memos, view memos they're authorized to
access, participate in assigned workflows, comment on assigned memos, approve/reject when it's
their turn, view their own memo history, manage their own profile.

**Enforcement rule:** every permission check happens server-side (API route / server action /
RLS policy). A hidden button is never sufficient authorization — assume a malicious user is
calling the API directly with dev tools.

## 6. Memo Management

### 6.1 Creation
Fields: auto-generated memo/reference number, subject/title, body (basic rich text — bold,
italic, lists, links at minimum), author, department, category, priority (Normal / High /
Urgent), created timestamp, attachments, workflow participants.

Memo categories are org-defined (seed with: Administrative, Financial, Procurement, HR,
Academic, Technical, General — editable per org).

### 6.2 Drafts
Create / edit / delete / submit a draft. Only the author can edit their draft. A draft never
enters the workflow until explicitly submitted. Submission is a recorded event (timestamped,
becomes part of the memo's timeline).

## 7. Memo Workflow (core system functionality)

**Read §2.5 items 5, 6, 8 first — this section implements those clarifications, and is
dynamic rather than a rigid fixed chain.**

### 7.1 How routing works

- The author starts a memo with an **initial suggested chain** of participants, in order
  (built freely, or from a template — see §18). This is the starting point, not an immutable
  contract.
- At any moment, exactly one person **currently holds** the memo (starts as the first
  participant once submitted). Only the current holder may act on it — enforce this
  server-side, never just by hiding buttons.
- **Whoever currently holds the memo has full discretion over what happens next.** When it
  lands with them, they can:
  1. **Approve and forward to the next person in the original chain** (the default, expected
     path).
  2. **Approve and forward to someone not in the original chain.** That new person then has
     the same discretion — they can continue on to the next original participant, add new
     people to what remains of the chain, or remove people from what remains of the chain.
  3. **Decline and reroute** — pass the memo to a different person without approving or
     rejecting its content (e.g. "this isn't mine to approve, X should look at this instead").
  4. **Reject** — terminates the workflow entirely. Status → Rejected. Requires a reason.
  5. **Request Changes** — returns the memo to the author for edits. Requires an explanation.
     A new version is created on resubmission (§20); the memo re-enters the queue with the
     author as a transient holder who then forwards it onward again using the same discretion
     above (there is no separate "restart from step 1" vs. "resume" rule to configure — it
     falls out naturally from the general model, since the author, like anyone else who holds
     the memo, decides where it goes next on resubmission).
  6. **Comment** without changing who holds the memo, where that's useful mid-review.
- Every one of these is, underneath, the same basic primitive: a decision + an optional/required
  comment + (for forwarding/approving) a choice of who's next. Don't build distinct structural
  "step types" (e.g. Reviewer vs. Approver) — see §2.5 item 8.
- Every action is recorded permanently in memo history with: user, action, timestamp, comment,
  and — when routing changed from the original plan — a note of that change (who was added,
  removed, or substituted, and by whom), so the timeline stays honest about deviations from the
  original suggested chain.

### 7.2 Completion

When a holder approves and there is no one left in the remaining chain to forward to, the memo
is marked **Approved/Completed**. Record the final approver, final timestamp, and complete
history. Completed memos become read-only to ordinary users except via the versioning mechanism
(§20).

### 7.3 Reject vs. Request Changes vs. Decline — keep these distinct

Even though routing is flexible, these three remain semantically different and the UI/data
model must not blur them:
- **Reject** — terminates the workflow outright (status → Rejected). Required reason.
- **Request Changes** — sends it back to the author for edits; workflow continues afterward,
  doesn't end. Required explanation.
- **Decline & reroute** — the holder isn't rejecting the *content*, just redirecting who should
  look at it. Doesn't terminate anything and doesn't imply anything negative about the memo.

## 8. Memo Status

Minimum statuses: Draft, Submitted, Pending Review, Pending Approval, Changes Requested,
Rejected, Approved, Cancelled. Current status and current responsible participant + required
action must always be clearly visible on the memo.

## 9. Inbox / Outbox / Completed

- **Inbox:** memos requiring the current user's action now. Columns: memo number, subject,
  sender, department, priority, current status, date submitted, required action, age/time
  pending. Filterable and sortable.
- **My Memos (Sent):** memos the user created/submitted. Columns: memo number, subject, status,
  current participant, priority, submission date, last activity date.
- **Completed:** completed workflows the user is authorized to view.

## 10. Memo Details & Timeline

Full memo view: number, subject, author, department, category, priority, body, attachments,
current status, current participant, full workflow sequence, comments, activity history.
Chronological timeline showing user, action, timestamp, and relevant comment for every event
(created, submitted, approved, forwarded, changes requested, resubmitted, etc.).

## 11. Comments

Fields: author, text, timestamp. Chronological display. Ordinary users cannot silently edit or
delete historical workflow comments (immutable audit trail). Distinguish visually/structurally
between: general comments, approval comments, rejection reasons, change-request comments.

## 12. Attachments

Upload / download, with filename, size, uploader, upload timestamp displayed. Enforce
reasonable file-size and file-type restrictions (e.g. max 10MB, block executables). Access
follows the memo's own permissions — a user must never reach an attachment by guessing or
manipulating a URL; use Supabase Storage signed URLs scoped to authorized requests only.

## 13. Notifications

In-app notification center (required) **plus email via Resend** (confirmed scope). Trigger on:
memo requires action, memo approved, memo rejected, changes requested, comment added, memo
resubmitted, workflow completed, user assigned to a workflow. Users can see which notifications
are unread.

## 14. Search & Filtering

Search within the user's own org, by: memo number, subject, body, author, department, category,
status, priority, date range.

**Visibility scope (per §2.5 item 7):**
- A **regular user** can only search/see memos they **authored, or are/were a workflow
  participant on** (past or present holder — not just the current one). This applies to search
  results, direct navigation, and any other memo listing a regular user encounters — it's the
  general memo-visibility rule, not just a search-specific restriction.
- An **org admin** retains the broader org-level memo visibility already granted in §5 (base
  spec) — they can see organization-level memo information generally, not just their own
  authored/participated memos.
- Search results must never leak across tenants, under any circumstance — apply this filter
  identically at the database level (RLS) and in the API layer, not just in the UI.

## 15. Dashboard

**Regular user:** memos awaiting action, memos submitted, recently completed, pending
approvals, pending reviews, urgent memos, recent activity, counts by status.

**Org admin, additionally:** user count, active user count, department count, memo count,
pending/completed/rejected workflow counts, recent system activity.

## 16. Departments

Fields: name, description, status. Admins: create, rename, deactivate, assign users.
Deactivating a department must never delete historical memo data tied to it.

## 17. Memo Categories

Org-defined, each with name, description, active/inactive status. Used for organizing/filtering.

## 18. Workflow Templates

Reusable named templates defining an ordered sequence of positions (not specific users), e.g.:
- **Purchase Request:** Employee → Dept Head → Finance → Director
- **Leave Request:** Employee → Line Manager → HR
- **Procurement Request:** Requester → Dept Head → Procurement → Finance → Director

When creating a memo, the author can pick a template and assign actual users to its positions,
or define a fully custom one-off workflow. Per §7.1, a template only supplies the **initial
suggested chain** — it is a convenient starting point, not a locked contract. Whoever ends up
holding the memo can still deviate from it (forward to someone new, add/remove remaining
participants) exactly as described in §7.1, the same as a fully custom workflow.

## 19. Delegation

A user can designate another authorized user to act on their behalf for a date range, with an
optional reason. Delegation record: delegating user, delegate, start date, end date, reason,
status. Any action a delegate performs must clearly show both "acted by [delegate] on behalf of
[delegating user]" in the timeline — never silently attributed to just one of them.

## 20. Memo Versioning

When a memo is sent back for changes, keep a version history: version number, editor,
modification timestamp, content snapshot, associated submission. Never silently overwrite a
submitted memo's historical version — each resubmission is a new version, and prior versions
remain viewable to authorized users.

## 21. Audit Log

System-wide, immutable-to-ordinary-users log of: login, logout, user creation,
activation/deactivation, memo creation/modification/submission, workflow assignment, comment,
approval, rejection, change request, resubmission, attachment upload/deletion, workflow
completion. Each record: event type, user, organization, timestamp, related entity,
description.

## 22. Reporting

Admin-facing stats: memos by status, by department, by category, urgent-memo count, average
workflow completion time, pending-approval count, rejected count, change-request count.
Filterable by date range, department, category, status.

## 23. PDF Export

Authorized users can export a memo as PDF containing: org info, memo number, subject, author,
department, date, body, attachment references, workflow participants, approval history,
comments, and a clear final status indicator (approved / rejected / in progress).

## 24. Security Requirements (checklist — verify each explicitly before calling the project done)

1. All protected users/operations authenticated.
2. All protected operations authorized server-side.
3. Tenant isolation strictly enforced (RLS + server checks, everywhere).
4. No cross-org data access, under any circumstance including direct API/URL manipulation.
5. No unauthorized memo access.
6. No unauthorized/out-of-order workflow actions.
7. Passwords hashed appropriately (handled by Supabase Auth — verify config, don't roll your own).
8. Auth credentials and session data protected.
9. All user input validated (both client-side UX and server-side enforcement).
10. Protection against common web vulnerabilities (XSS, CSRF, SQLi — parameterized
    queries/ORM throughout, sanitize rich-text input before storage/render).
11. Uploaded files validated (type + size) server-side, not just in the file picker.
12. No unauthorized access to uploaded attachments (signed URLs, scoped and short-lived).
13. Error messages never leak stack traces, internal paths, or query details to the client.
14. HTTPS everywhere in production (Vercel default — verify no mixed content).
15. Injection-safe DB access (Supabase client / parameterized queries, never string-concatenated SQL).

## 25. User Interface Requirements

**Public landing page (before login):** this is Relay's front door and the first thing anyone
sees, including whoever grades this — it should be polished, not an afterthought. Contents:
a clear headline explaining what Relay does (in one sentence a non-technical person would
understand — e.g. the "digital version of a paper memo routed for signatures" framing), a short
explanation of how the workflow works (can reuse the sequential-example style from the base
spec), a "Sign in" action, and a "Create your organization" signup action (§3.1). Apply the
full Swiss/Basel treatment here deliberately — this page carries the most "design" weight of
any page in the app, per `DESIGN.md`'s section-break guidance (large black band, giant
lowercase wordmark, single red accent) for the hero, dropping into the normal 3-column grid
system below the fold for the explanatory content.

Pages required: landing page, login, dashboard, inbox, my memos, memo creation, memo details,
workflow interface, notifications, search/filter, user profile, admin interface, organization
signup. Responsive (desktop + mobile). Current workflow state and the required action must be
visually obvious at a glance — this is a design requirement, not just a functional one; see
`DESIGN.md` for exactly how status/urgency should read visually within the Swiss design system
(e.g. status as uppercase tracked-out metadata labels, the single red accent reserved for the
item requiring the user's action right now).

## 26. Build Phases

Work through these in order. Don't start a later phase until the current one's core function
is working end-to-end (even if unstyled) — polish and stretch features come after core function,
not before.

1. **Foundation** — Next.js scaffold, Supabase project connected via MCP, base schema +
   RLS migrations (see `DATABASE.md`), Supabase Auth wired up, `.env.example`, GitHub repo
   initialized, Vercel project connected, "hello world" deploy working end-to-end.
2. **Orgs, users, departments, roles** — org creation/onboarding, admin user management,
   department CRUD, role-gated navigation and server-side permission checks.
3. **Memo core** — memo creation form (rich text), draft save/edit/delete, categories,
   priorities, attachments (upload/download via Supabase Storage with signed URLs).
4. **Workflow engine** — sequential participant assignment, per-step actions
   (approve/reject/comment/request changes), strict ordering enforcement, status transitions,
   completion, rejection vs. request-changes branching, full timeline recording.
5. **Inbox/Outbox/Details** — inbox, my memos, completed list, memo details page with timeline
   and comments, all filter/sort as specified.
6. **Notifications** — in-app center + Resend email integration for all listed trigger events.
7. **Search, dashboard, reporting** — cross-field search respecting authorization, user and
   admin dashboards, admin reporting views.
8. **Templates, delegation, versioning, audit log** — workflow templates, delegation, memo
   versioning on change requests, system-wide audit log.
9. **PDF export.**
10. **Design pass** — apply `DESIGN.md` Swiss system consistently across every page built so
    far (do this as a dedicated pass, not ad hoc per page, so it's actually consistent).
11. **Seed data + demo walkthrough** — build the seed script covering the full demonstration
    scenario in §27 below, and manually walk through it end-to-end on the deployed app.
12. **Security review pass** — go through §24's checklist explicitly, item by item, and verify
    each one against the actual running app (including attempted cross-tenant access, direct
    API calls bypassing the UI, and out-of-order workflow actions).
13. **Documentation + submission packaging** — see §28.

## 27. Demonstration Scenario (must work on the deployed app)

1. Create an organization.
2. Create multiple users in that org, across roles/departments.
3. Create a memo.
4. Define a sequential workflow with multiple participants.
5. Submit the memo.
6. Log in as the first participant; comment/approve/reject/request changes.
7. Show the memo moving to the next participant.
8. Show the complete workflow history/timeline.
9. Show final approval or rejection.
10. Show notifications firing.
11. Show search and filtering.
12. Show admin functionality.
13. Show that a user from a **different** organization cannot access this memo (attempt it and
    show the denial — this should be part of the demo, not just claimed).

Seed data should make this scenario reproducible without manual setup during grading.

## 28. Submission Checklist (final packaging — do not skip any line)

- [ ] **A. Deployed application** — public Vercel URL, verified working at submission time.
- [ ] **B. Project documentation** — a standalone document (not this repo's working docs)
      covering: system overview; which requirements were implemented; tech stack; architecture
      (with diagram: frontend / backend / DB / auth / file storage / external services);
      database design + multi-tenancy explanation; workflow design explanation; security
      (auth, authorization, tenant isolation, file security, password security); vibe-coding
      process (tools used, how requirements were communicated, how output was evaluated, how
      errors were found/fixed, how compliance with requirements was verified); known
      limitations; links to the live system, source ZIP, and AI history.
- [ ] **C. Source code** — ZIP (or GitHub link, per course allowance) with complete source,
      DB schema/migrations, config files, seed data, dependency manifests, `.env.example`,
      install/build/run instructions — everything needed for another developer to run it,
      excluding real secrets.
- [ ] **D. AI prompt/response history** — the complete, unedited Claude Code session export,
      chronological, not a summary. Redact any credential accidentally pasted into chat, noting
      the redaction, but keep everything else including failed attempts and debugging.
- [ ] **E. Demonstration credentials** — at least one org admin login and enough regular-user
      logins across the workflow chain used in the demo scenario (§27), for at least two
      separate organizations (to demonstrate isolation).

Remember near the end of the project: export the Claude Code session transcript before closing
out — this can't be reconstructed after the fact.
