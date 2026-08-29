-- Bug fix (Phase 7 search): `body` is jsonb (Tiptap document format), and
-- Postgres has no `ilike` operator for jsonb — `body ilike '%x%'` throws
-- `operator does not exist: jsonb ~~* unknown`. Supabase's PostgREST client
-- doesn't surface that as a thrown JS error either (data comes back null,
-- error populated, and the search page wasn't checking `error` at all), so
-- it silently degraded to "no matches" for every search query, not just
-- ones touching body content — caught only by actually running a search
-- against real data, not by reviewing the query.
--
-- Fix: maintain a plain-text mirror of body's searchable content
-- (extracting every "text" node from the Tiptap doc via jsonpath) in a
-- trigger-synced column, same pattern as migration 018's last-activity
-- triggers. Search filters against this column instead of `body` directly.
create function private.extract_memo_body_text(p_body jsonb) returns text
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    (
      select string_agg(elem #>> '{}', ' ')
      from jsonb_array_elements(jsonb_path_query_array(p_body, '$.**.text')) as elem
    ),
    ''
  );
$$;

alter table memos add column body_text text not null default '';

update memos set body_text = private.extract_memo_body_text(body);

create function private.sync_memo_body_text() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.body_text := private.extract_memo_body_text(new.body);
  return new;
end;
$$;

create trigger memos_sync_body_text
  before insert or update of body on memos
  for each row execute function private.sync_memo_body_text();
