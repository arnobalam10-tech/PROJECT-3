-- Bug fix: RLS policies evaluate as the `authenticated` role, so that role
-- needs EXECUTE on these helper functions to use them inside a policy
-- expression at all (SECURITY DEFINER only governs what happens *inside* the
-- function once called, not who is allowed to call it). The `private` schema
-- isn't exposed via PostgREST regardless of grants, so this doesn't open up
-- any new public RPC surface.
grant execute on function private.current_organization_id() to authenticated;
grant execute on function private.current_role() to authenticated;
