"use server";

import { revalidatePath } from "next/cache";
import { requireOrgAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { toSafeErrorMessage } from "@/lib/safe-error-message";

export async function createDepartment(_prevState: { error: string | null }, formData: FormData) {
  const admin = await requireOrgAdmin();
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();

  if (!name) {
    return { error: "Department name is required." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("departments").insert({
    organization_id: admin.organization_id, // server-derived, never trust client input for this
    name,
    description: description || null,
  });

  if (error) {
    return { error: error.code === "23505" ? "A department with that name already exists." : toSafeErrorMessage(error, "createDepartment") };
  }

  revalidatePath("/admin/departments");
  return { error: null };
}

export async function toggleDepartmentStatus(departmentId: string) {
  const admin = await requireOrgAdmin();
  const supabase = await createClient();

  const { data: dept } = await supabase
    .from("departments")
    .select("id, organization_id, status")
    .eq("id", departmentId)
    .maybeSingle();

  if (!dept || dept.organization_id !== admin.organization_id) {
    throw new Error("Department not found.");
  }

  await supabase
    .from("departments")
    .update({ status: dept.status === "active" ? "inactive" : "active" })
    .eq("id", departmentId);

  revalidatePath("/admin/departments");
}

export async function updateDepartment(departmentId: string, formData: FormData) {
  const admin = await requireOrgAdmin();
  const supabase = await createClient();

  const { data: dept } = await supabase
    .from("departments")
    .select("id, organization_id")
    .eq("id", departmentId)
    .maybeSingle();

  if (!dept || dept.organization_id !== admin.organization_id) {
    throw new Error("Department not found.");
  }

  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  if (!name) return;

  await supabase
    .from("departments")
    .update({ name, description: description || null })
    .eq("id", departmentId);

  revalidatePath("/admin/departments");
}
