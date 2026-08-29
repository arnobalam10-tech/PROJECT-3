import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role client for privileged, server-only operations (creating
 * auth.users rows for admin-invited members). Never imported from any
 * client component or route that isn't itself gated by an org_admin check —
 * this client bypasses RLS entirely, so every caller is responsible for its
 * own organization_id scoping.
 */
export function createAdminClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set. Admin-only actions (inviting users) require it — " +
        "add it to .env.local (and to your Vercel project's server env vars) from the Supabase " +
        "dashboard: Project Settings > API > service_role secret. Never expose this key to the " +
        "client or commit it.",
    );
  }
  return createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
