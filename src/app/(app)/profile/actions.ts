"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { toSafeErrorMessage } from "@/lib/safe-error-message";

export async function updateProfile(_prevState: { error: string | null }, formData: FormData) {
  const profile = await requireProfile();
  const name = String(formData.get("name") ?? "").trim();
  const designation = String(formData.get("designation") ?? "").trim();

  if (!name) {
    return { error: "Name is required." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ name, designation: designation || null })
    .eq("id", profile.id);

  if (error) return { error: toSafeErrorMessage(error, "updateProfile") };

  revalidatePath("/profile");
  revalidatePath("/dashboard");
  return { error: null };
}

export type ChangePasswordState = { error: string | null; success: string | null };

export async function changePassword(
  _prevState: ChangePasswordState,
  formData: FormData,
): Promise<ChangePasswordState> {
  const profile = await requireProfile();
  const currentPassword = String(formData.get("current_password") ?? "");
  const newPassword = String(formData.get("new_password") ?? "");
  const confirmPassword = String(formData.get("confirm_password") ?? "");

  if (!currentPassword || !newPassword || !confirmPassword) {
    return { error: "All fields are required.", success: null };
  }
  if (newPassword.length < 8) {
    return { error: "New password must be at least 8 characters.", success: null };
  }
  if (newPassword !== confirmPassword) {
    return { error: "New passwords do not match.", success: null };
  }
  if (newPassword === currentPassword) {
    return { error: "New password must be different from your current password.", success: null };
  }

  const supabase = await createClient();

  // Require the current password before allowing a change -- an already
  // authenticated session alone is not enough friction for this. Supabase's
  // client SDK has no standalone "verify this password without starting a
  // new session" call, so re-running signInWithPassword with the current
  // password is the correct way to confirm the caller still knows it; on
  // success this just refreshes this same user's session tokens, it doesn't
  // create a separate session.
  const { error: reauthError } = await supabase.auth.signInWithPassword({
    email: profile.email,
    password: currentPassword,
  });
  if (reauthError) {
    return { error: "Current password is incorrect.", success: null };
  }

  // A GoTrue (Supabase Auth) error, not a Postgres one -- already a safe,
  // curated message by Supabase's own design (e.g. "New password should be
  // different from the old password"), same as signup's auth.signUp error.
  const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
  if (updateError) {
    return { error: updateError.message, success: null };
  }

  return { error: null, success: "Password updated." };
}
