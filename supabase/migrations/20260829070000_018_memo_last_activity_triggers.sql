-- PRD §9's "My Memos" list needs an accurate "last activity date" column.
-- memos.updated_at only reflects direct updates to the memos row itself
-- (status changes, edits) — it doesn't move when a workflow_steps row
-- changes (approve/decline/etc.) or a comment is added, even though both
-- are clearly "activity" on the memo. Rather than compute this via a join
-- everywhere it's needed, touch memos.updated_at from both tables so it
-- stays a reliable single source of truth for "last activity."
create function private.touch_memo_updated_at() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.memos set updated_at = now() where id = new.memo_id;
  return new;
end;
$$;

create trigger workflow_steps_touch_memo
  after insert or update on workflow_steps
  for each row execute function private.touch_memo_updated_at();

create trigger comments_touch_memo
  after insert on comments
  for each row execute function private.touch_memo_updated_at();
