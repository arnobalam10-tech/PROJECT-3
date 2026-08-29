revoke execute on function create_organization_with_admin(text, text, text, text) from public;
revoke execute on function create_organization_with_admin(text, text, text, text) from anon;
grant execute on function create_organization_with_admin(text, text, text, text) to authenticated;
