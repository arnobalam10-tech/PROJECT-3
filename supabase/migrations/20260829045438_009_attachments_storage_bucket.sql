insert into storage.buckets (id, name, public)
values ('attachments', 'attachments', false)
on conflict (id) do nothing;

-- Objects are stored at path `<memo_id>/<uuid>-<filename>`. Access follows the
-- same authorization as the `attachments` row for that memo (author, or an
-- org_admin in the same org) — never a public URL, always mediated through
-- these policies plus a short-lived signed URL minted server-side.
create policy "attachments_bucket_select" on storage.objects
  for select using (
    bucket_id = 'attachments'
    and exists (
      select 1 from memos m
      where m.id::text = (storage.foldername(name))[1]
        and m.organization_id = private.current_organization_id()
        and (m.author_id = auth.uid() or private.current_role() = 'org_admin')
    )
  );

create policy "attachments_bucket_insert" on storage.objects
  for insert with check (
    bucket_id = 'attachments'
    and exists (
      select 1 from memos m
      where m.id::text = (storage.foldername(name))[1]
        and m.organization_id = private.current_organization_id()
        and m.author_id = auth.uid()
        and m.status = 'draft'
    )
  );

create policy "attachments_bucket_delete" on storage.objects
  for delete using (
    bucket_id = 'attachments'
    and exists (
      select 1 from memos m
      where m.id::text = (storage.foldername(name))[1]
        and m.organization_id = private.current_organization_id()
        and m.author_id = auth.uid()
        and m.status = 'draft'
    )
  );
