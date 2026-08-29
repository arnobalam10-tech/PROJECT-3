"use server";

import { revalidatePath } from "next/cache";
import { requireOrgAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { toSafeErrorMessage } from "@/lib/safe-error-message";

export async function createTemplate(_prevState: { error: string | null }, formData: FormData) {
  const admin = await requireOrgAdmin();
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const positionLabels = formData.getAll("position_label").map((v) => String(v).trim()).filter(Boolean);

  if (!name) {
    return { error: "Template name is required." };
  }
  if (positionLabels.length === 0) {
    return { error: "Add at least one position." };
  }

  const supabase = await createClient();
  const { data: template, error } = await supabase
    .from("workflow_templates")
    .insert({
      organization_id: admin.organization_id, // server-derived, never trust client input
      name,
      description: description || null,
      created_by: admin.id,
    })
    .select("id")
    .single();

  if (error) {
    return { error: error.code === "23505" ? "A template with that name already exists." : toSafeErrorMessage(error, "createTemplate") };
  }

  const { error: positionsError } = await supabase.from("workflow_template_positions").insert(
    positionLabels.map((label, i) => ({
      template_id: template.id,
      position_order: i + 1,
      position_label: label,
    })),
  );

  if (positionsError) {
    // Clean up the orphaned template rather than leaving a positions-less
    // template behind — this table has no ON CONFLICT/upsert path, so a
    // partial failure here needs explicit rollback, not just a returned error.
    await supabase.from("workflow_templates").delete().eq("id", template.id);
    return { error: toSafeErrorMessage(positionsError, "createTemplate.positions") };
  }

  revalidatePath("/admin/templates");
  return { error: null };
}

export async function deleteTemplate(templateId: string) {
  const admin = await requireOrgAdmin();
  const supabase = await createClient();

  const { data: template } = await supabase
    .from("workflow_templates")
    .select("id, organization_id")
    .eq("id", templateId)
    .maybeSingle();

  if (!template || template.organization_id !== admin.organization_id) {
    throw new Error("Template not found.");
  }

  await supabase.from("workflow_templates").delete().eq("id", templateId);
  revalidatePath("/admin/templates");
}
