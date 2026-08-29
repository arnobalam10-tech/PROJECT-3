"use server";

import { revalidatePath } from "next/cache";
import { requireOrgAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { toSafeErrorMessage } from "@/lib/safe-error-message";

export type InviteUserState = { error: string | null; success: string | null };

export async function inviteUser(
  _prevState: InviteUserState,
  formData: FormData,
): Promise<InviteUserState> {
  const admin = await requireOrgAdmin();

  const email = String(formData.get("email") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const designation = String(formData.get("designation") ?? "").trim();
  const departmentId = String(formData.get("department_id") ?? "").trim() || null;
  const role = String(formData.get("role") ?? "regular_user");

  if (!email || !name) {
    return { error: "Name and email are required.", success: null };
  }
  if (role !== "org_admin" && role !== "regular_user") {
    return { error: "Invalid role.", success: null };
  }

  const supabase = await createClient();

  // If a department was chosen, verify it actually belongs to the admin's own org
  // before trusting it — never trust a client-supplied foreign key as-is.
  if (departmentId) {
    const { data: dept } = await supabase
      .from("departments")
      .select("id")
      .eq("id", departmentId)
      .eq("organization_id", admin.organization_id)
      .maybeSingle();
    if (!dept) {
      return { error: "Invalid department.", success: null };
    }
  }

  let adminClient;
  try {
    adminClient = createAdminClient();
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Server misconfiguration.", success: null };
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const { data: invited, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(
    email,
    { redirectTo: `${appUrl}/auth/callback` },
  );

  if (inviteError || !invited.user) {
    return {
      error: inviteError?.message ?? "Could not invite this user.",
      success: null,
    };
  }

  const { error: profileError } = await adminClient.from("profiles").insert({
    id: invited.user.id,
    organization_id: admin.organization_id, // server-derived, never from client input
    email,
    name,
    designation: designation || null,
    department_id: departmentId,
    role,
    status: "active",
  });

  if (profileError) {
    // Roll back the orphaned auth user so a failed invite doesn't leave a
    // dangling account with no profile.
    await adminClient.auth.admin.deleteUser(invited.user.id);
    return { error: toSafeErrorMessage(profileError, "inviteUser.profile"), success: null };
  }

  revalidatePath("/admin/users");
  return { error: null, success: `Invited ${email}.` };
}

export async function updateUserRole(userId: string, role: string) {
  const admin = await requireOrgAdmin();
  if (role !== "org_admin" && role !== "regular_user") return;
  if (userId === admin.id) return; // can't change your own role — avoid self-lockout

  const supabase = await createClient();
  const { data: target } = await supabase
    .from("profiles")
    .select("id, organization_id")
    .eq("id", userId)
    .maybeSingle();

  if (!target || target.organization_id !== admin.organization_id) {
    throw new Error("User not found.");
  }

  await supabase.from("profiles").update({ role }).eq("id", userId);
  revalidatePath("/admin/users");
}

export async function updateUserDepartment(userId: string, departmentId: string) {
  const admin = await requireOrgAdmin();
  const supabase = await createClient();

  const { data: target } = await supabase
    .from("profiles")
    .select("id, organization_id")
    .eq("id", userId)
    .maybeSingle();

  if (!target || target.organization_id !== admin.organization_id) {
    throw new Error("User not found.");
  }

  const value = departmentId || null;
  if (value) {
    const { data: dept } = await supabase
      .from("departments")
      .select("id")
      .eq("id", value)
      .eq("organization_id", admin.organization_id)
      .maybeSingle();
    if (!dept) throw new Error("Invalid department.");
  }

  await supabase.from("profiles").update({ department_id: value }).eq("id", userId);
  revalidatePath("/admin/users");
}

export async function toggleUserStatus(userId: string) {
  const admin = await requireOrgAdmin();
  if (userId === admin.id) return; // can't deactivate yourself

  const supabase = await createClient();
  const { data: target } = await supabase
    .from("profiles")
    .select("id, organization_id, status")
    .eq("id", userId)
    .maybeSingle();

  if (!target || target.organization_id !== admin.organization_id) {
    throw new Error("User not found.");
  }

  await supabase
    .from("profiles")
    .update({ status: target.status === "active" ? "inactive" : "active" })
    .eq("id", userId);

  revalidatePath("/admin/users");
}
