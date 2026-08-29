-- Self-caught: migration 024 added a 3rd parameter to submit_memo via
-- CREATE OR REPLACE, but a different argument LIST creates a new overload
-- in Postgres rather than replacing the function — it does not remove the
-- original 2-arg submit_memo(uuid, uuid[]). Left as-is, a 2-arg client call
-- would have resolved to the STALE old-body overload (missing
-- workflow_template_id support, but functionally still "correct" otherwise
-- since it's migration 019's body) rather than the new one, and having two
-- separate functions with the same name drifting independently is exactly
-- the accidental-overload trap this session already flagged and avoided for
-- private.log_audit_event() in migration 023 — missed here by not applying
-- the same discipline. Drop the stale 2-arg overload; the 3-arg version
-- (p_workflow_template_id defaulting to null) already serves any 2-arg
-- positional call correctly.
drop function submit_memo(uuid, uuid[]);

revoke all on function submit_memo(uuid, uuid[], uuid) from public, anon;
grant execute on function submit_memo(uuid, uuid[], uuid) to authenticated;
