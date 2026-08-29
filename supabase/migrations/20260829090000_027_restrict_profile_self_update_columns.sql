-- Phase 12 security fix: profiles_update_self (migration 001) had no `with check`
-- restricting which columns a self-update may touch. RLS `with_check`/`using` operate
-- on row-level predicates only, not column diffs, so it cannot express "only name/
-- designation may change" on its own. A column-level GRANT restriction was
-- considered and rejected: `admin/users/actions.ts` updates role/department_id/status
-- on OTHER users' rows through the same RLS-gated `authenticated` client (see
-- profiles_update_same_org_admin policy), so revoking column grants from
-- `authenticated` broadly would break that legitimate admin path too. A trigger
-- that distinguishes "is this row the caller's own row" is the correct fix, since
-- it can allow admins to update other people's role/department_id/status while
-- still blocking a user from doing that to themselves via a direct API call that
-- bypasses this app's UI/server actions entirely.
create or replace function private.enforce_profile_self_update_columns()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.id = auth.uid() then
    if new.organization_id is distinct from old.organization_id
       or new.role is distinct from old.role
       or new.status is distinct from old.status
       or new.department_id is distinct from old.department_id
       or new.email is distinct from old.email
    then
      raise exception 'self-service profile updates may only change name and designation';
    end if;
  end if;
  return new;
end;
$$;

create trigger profiles_enforce_self_update_columns
  before update on public.profiles
  for each row
  execute function private.enforce_profile_self_update_columns();
