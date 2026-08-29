import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type CurrentProfile = {
  id: string;
  organization_id: string;
  email: string;
  name: string;
  designation: string | null;
  department_id: string | null;
  role: "org_admin" | "regular_user";
  status: "active" | "inactive";
};

/**
 * Fetches the signed-in user's own profile (RLS-scoped: a user can only ever
 * read rows within their own organization_id, so this can never leak across
 * tenants). Redirects to /login if there's no session.
 */
export async function requireProfile(): Promise<CurrentProfile> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, organization_id, email, name, designation, department_id, role, status")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) {
    redirect("/login");
  }

  return profile as CurrentProfile;
}

/**
 * Same as requireProfile, but additionally requires org_admin. Every
 * admin-only page/server action must call this — never rely on hidden UI.
 */
export async function requireOrgAdmin(): Promise<CurrentProfile> {
  const profile = await requireProfile();
  if (profile.role !== "org_admin") {
    redirect("/dashboard");
  }
  return profile;
}
