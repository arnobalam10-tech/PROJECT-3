-- PRD §14 / §2.5 item 7: a regular user sees memos they authored OR were/are
-- a workflow participant on, not just authored (Phase 3's policy was
-- deliberately narrower since workflow_steps didn't exist yet).
drop policy "memos_select_own_or_admin" on memos;

create policy "memos_select_authorized" on memos
  for select using (
    organization_id = private.current_organization_id()
    and (
      author_id = auth.uid()
      or private.current_role() = 'org_admin'
      or private.is_workflow_participant(id)
    )
  );

-- Author may edit while draft OR while changes_requested (resubmission
-- flow edits the memo content before calling resubmit_memo()).
drop policy "memos_update_own_draft" on memos;

create policy "memos_update_own_editable" on memos
  for update using (
    organization_id = private.current_organization_id()
    and author_id = auth.uid()
    and status in ('draft', 'changes_requested')
  );

-- Attachments: widen to match the same authorized-viewer set as memos.
drop policy "attachments_select_via_memo" on attachments;

create policy "attachments_select_via_memo" on attachments
  for select using (
    exists (
      select 1 from memos m
      where m.id = attachments.memo_id
        and m.organization_id = private.current_organization_id()
        and (
          m.author_id = auth.uid()
          or private.current_role() = 'org_admin'
          or private.is_workflow_participant(m.id)
        )
    )
  );

-- Storage bucket policy: same widening for consistency (PRD §12 — access
-- follows the memo's own permissions).
drop policy "attachments_bucket_select" on storage.objects;

create policy "attachments_bucket_select" on storage.objects
  for select using (
    bucket_id = 'attachments'
    and exists (
      select 1 from memos m
      where m.id::text = (storage.foldername(name))[1]
        and m.organization_id = private.current_organization_id()
        and (
          m.author_id = auth.uid()
          or private.current_role() = 'org_admin'
          or private.is_workflow_participant(m.id)
        )
    )
  );
