"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { slugify } from "@/lib/slugify";
import { toSafeErrorMessage } from "@/lib/safe-error-message";

export type SignupState = { error: string | null; info: string | null };

export async function signup(
  _prevState: SignupState,
  formData: FormData,
): Promise<SignupState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const orgName = String(formData.get("org_name") ?? "").trim();
  const adminName = String(formData.get("admin_name") ?? "").trim();
  const designation = String(formData.get("designation") ?? "").trim();

  if (!email || !password || !orgName || !adminName) {
    return { error: "All fields except designation are required.", info: null };
  }
  if (password.length < 8) {
    return { error: "Password must be at least 8 characters.", info: null };
  }

  const orgSlug = `${slugify(orgName)}-${Math.random().toString(36).slice(2, 6)}`;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${appUrl}/auth/callback`,
      data: {
        pending_org_name: orgName,
        pending_org_slug: orgSlug,
        pending_admin_name: adminName,
        pending_admin_designation: designation || null,
      },
    },
  });

  if (error) {
    return { error: error.message, info: null };
  }

  // If email confirmation is disabled for this project, signUp already
  // returns an active session — finish org creation right away. If
  // confirmation is required, /auth/callback finishes it once the user
  // clicks the confirmation link.
  if (data.session) {
    const { error: rpcError } = await supabase.rpc("create_organization_with_admin", {
      org_name: orgName,
      org_slug: orgSlug,
      admin_name: adminName,
      admin_designation: designation || null,
    });
    if (rpcError) {
      return { error: toSafeErrorMessage(rpcError, "signup.create_organization_with_admin"), info: null };
    }
    redirect("/dashboard");
  }

  return {
    error: null,
    info: "Check your email to confirm your account — your organization will be created automatically once you confirm.",
  };
}
