-- No policies defined on purpose: this table is only ever touched by
-- generate_memo_number(), a SECURITY DEFINER function that bypasses RLS.
-- Enabling RLS with zero policies means no role (including authenticated)
-- can read/write it directly via PostgREST.
alter table memo_number_counters enable row level security;
