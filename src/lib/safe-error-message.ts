/**
 * A Supabase/Postgres error's `.message` is safe to show a user only when it
 * came from this app's own deliberate `raise exception '...'` inside a
 * SECURITY DEFINER function -- Postgres assigns those SQLSTATE P0001 by
 * default. Every other error class (RLS `with_check` denial, a unique/FK
 * constraint violation, etc.) carries its own SQLSTATE and its message
 * verbatim includes internal schema detail -- table names, constraint names
 * -- that PRD §24 item 13 says must never reach the client. Confirmed by
 * direct testing (Phase 12): a raw RLS violation returns code 42501 with
 * `new row violates row-level security policy for table "memos"`; a unique
 * violation returns code 23505 naming the actual constraint
 * (`memos_organization_id_memo_number_key`). Neither should be shown as-is.
 */
export function toSafeErrorMessage(
  error: { message: string; code?: string } | null,
  context: string,
): string {
  if (!error) return "";
  if (error.code === "P0001") return error.message;
  console.error(`[${context}] unexpected DB error:`, error);
  return "Something went wrong. Please try again.";
}
