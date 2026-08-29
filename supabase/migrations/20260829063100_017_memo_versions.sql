-- Documented in DATABASE.md since Phase 1 but never actually created —
-- Phase 3's migration built memo_categories/memos/attachments but missed
-- this one. Caught only now because submit_memo actually tried to write to
-- it during a real test run, not by code review. Required for PRD §20
-- (memo versioning) and referenced by submit_memo/resubmit_memo.
create table memo_versions (
  id uuid primary key default gen_random_uuid(),
  memo_id uuid not null references memos(id) on delete cascade,
  version_number int not null,
  editor_id uuid not null references profiles(id) on delete restrict,
  content_snapshot jsonb not null,
  associated_submission_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (memo_id, version_number)
);

create index memo_versions_memo_id_idx on memo_versions(memo_id);

alter table memo_versions enable row level security;

-- Same authorized-viewer set as the memo itself — versions are part of its
-- history, per PRD §20 ("prior versions remain viewable to authorized
-- users").
create policy "memo_versions_select_authorized" on memo_versions
  for select using (
    exists (
      select 1 from memos m
      where m.id = memo_versions.memo_id
        and m.organization_id = private.current_organization_id()
        and (
          m.author_id = auth.uid()
          or private.current_role() = 'org_admin'
          or private.is_workflow_participant(m.id)
        )
    )
  );
-- No insert/update/delete policy for clients — only written by the
-- SECURITY DEFINER submit_memo()/resubmit_memo() functions, and per PRD §20
-- ("never silently overwrite... each resubmission is a new version") they
-- must never be mutated once written, which this enforces by simply having
-- no UPDATE/DELETE policy at all.
