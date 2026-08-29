# Relay

Multi-tenant memo workflow app for CSE226 (Foundations of Vibe Coding, NSU). See `PRD.md`,
`DATABASE.md`, `DESIGN.md`, and `STATUS.md` in this repo for the full requirements, schema, design
system, and current build status. See `docs/PROJECT-DOCUMENTATION.md` for the standalone
submission write-up (architecture, security, vibe-coding process, known limitations).

**Live app:** https://relay-cyan-alpha.vercel.app/

**Demo credentials** (all accounts share the password `RelayDemo2026!`) — two separate
organizations, to demonstrate tenant isolation:

| Organization | Name | Email | Role |
|---|---|---|---|
| Northbridge Logistics | Maya Rodriguez | `maya.admin@relaydemo.local` | Org admin |
| Northbridge Logistics | Priya Nair | `priya@relaydemo.local` | Regular user |
| Northbridge Logistics | Miguel Torres | `miguel@relaydemo.local` | Regular user |
| Northbridge Logistics | Sarah Chen | `sarah@relaydemo.local` | Regular user |
| Northbridge Logistics | David Okafor | `david@relaydemo.local` | Regular user |
| Fenwick & Vale Partners | Elena Fenwick | `elena.admin@relaydemo.local` | Org admin |
| Fenwick & Vale Partners | Tom Baxter | `tom@relaydemo.local` | Regular user |

Full demo-scenario walkthrough evidence is in `STATUS.md`'s Phase 11 section.

## Tech stack

Next.js 16 (App Router) + TypeScript, Supabase (Postgres + Auth + Storage), Tailwind CSS, Resend
(email), Vercel (hosting). See `CLAUDE.md` §3 for the full decision table.

## Local setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env.local` and fill in real values (Supabase project URL/publishable
   key, Resend API key):

   ```bash
   cp .env.example .env.local
   ```

3. Run the dev server:

   ```bash
   npm run dev
   ```

   The app runs at http://localhost:3000.

## Database

Schema and RLS policies live in `supabase/migrations/*.sql`, applied via the Supabase MCP
connection (see `DATABASE.md` for the full tenant-isolation pattern). To apply them to a fresh
Supabase project with the Supabase CLI:

```bash
supabase link --project-ref <your-project-ref>
supabase db push
```

## Build

```bash
npm run build
npm run start
```
