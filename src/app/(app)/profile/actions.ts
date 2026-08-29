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
