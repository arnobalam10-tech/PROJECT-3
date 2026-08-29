"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB, per PRD §12
const BLOCKED_EXTENSIONS = [
  ".exe", ".bat", ".cmd", ".sh", ".msi", ".com", ".scr", ".ps1", ".js", ".jar", ".app",
];

export type MemoFormState = { error: string | null; memoId: string | null };

function parseMemoForm(formData: FormData) {
  const subject = String(formData.get("subject") ?? "").trim();
  const bodyRaw = String(formData.get("body") ?? "{}");
  const departmentId = String(formData.get("department_id") ?? "").trim() || null;
  const categoryId = String(formData.get("category_id") ?? "").trim() || null;
  const priority = String(formData.get("priority") ?? "normal");

  let body: Record<string, unknown> = {};
  try {
    body = JSON.parse(bodyRaw);
  } catch {
    body = {};
  }

  return { subject, body, departmentId, categoryId, priority };
}

async function assertOwnedDraft(
  supabase: Awaited<ReturnType<typeof createClient>>,
  memoId: string,
  userId: string,
) {
  const { data: memo } = await supabase
    .from("memos")
    .select("id, author_id, status")
    .eq("id", memoId)
    .maybeSingle();

  if (!memo || memo.author_id !== userId || memo.status !== "draft") {
    throw new Error("Memo not found or not editable.");
  }
  return memo;
}

export async function createDraft(
  _prevState: MemoFormState,
  formData: FormData,
): Promise<MemoFormState> {
  const profile = await requireProfile();
  const { subject, body, departmentId, categoryId, priority } = parseMemoForm(formData);

  if (!subject) {
    return { error: "Subject is required.", memoId: null };
  }
  if (priority !== "normal" && priority !== "high" && priority !== "urgent") {
    return { error: "Invalid priority.", memoId: null };
  }

  const supabase = await createClient();

  // Verify department/category actually belong to this org before trusting them.
  if (departmentId) {
    const { data } = await supabase
      .from("departments")
      .select("id")
      .eq("id", departmentId)
      .eq("organization_id", profile.organization_id)
      .maybeSingle();
    if (!data) return { error: "Invalid department.", memoId: null };
  }
  if (categoryId) {
    const { data } = await supabase
      .from("memo_categories")
      .select("id")
      .eq("id", categoryId)
      .eq("organization_id", profile.organization_id)
      .maybeSingle();
    if (!data) return { error: "Invalid category.", memoId: null };
  }

  const { data: memoNumber, error: numberError } = await supabase.rpc("generate_memo_number", {
    org_id: profile.organization_id,
  });
  if (numberError || !memoNumber) {
    return { error: "Could not generate a memo number.", memoId: null };
  }

  const { data: memo, error } = await supabase
    .from("memos")
    .insert({
      organization_id: profile.organization_id,
      memo_number: memoNumber,
      subject,
      body,
      author_id: profile.id,
      department_id: departmentId,
      category_id: categoryId,
      priority,
      status: "draft",
    })
    .select("id")
    .single();

  if (error || !memo) {
    return { error: error?.message ?? "Could not create memo.", memoId: null };
  }

  revalidatePath("/memos");
  redirect(`/memos/${memo.id}`);
}

export async function updateDraft(
  memoId: string,
  _prevState: MemoFormState,
  formData: FormData,
): Promise<MemoFormState> {
  const profile = await requireProfile();
  const { subject, body, departmentId, categoryId, priority } = parseMemoForm(formData);

  if (!subject) {
    return { error: "Subject is required.", memoId };
  }

  const supabase = await createClient();
  await assertOwnedDraft(supabase, memoId, profile.id);

  if (departmentId) {
    const { data } = await supabase
      .from("departments")
      .select("id")
      .eq("id", departmentId)
      .eq("organization_id", profile.organization_id)
      .maybeSingle();
    if (!data) return { error: "Invalid department.", memoId };
  }
  if (categoryId) {
    const { data } = await supabase
      .from("memo_categories")
      .select("id")
      .eq("id", categoryId)
      .eq("organization_id", profile.organization_id)
      .maybeSingle();
    if (!data) return { error: "Invalid category.", memoId };
  }

  const { error } = await supabase
    .from("memos")
    .update({ subject, body, department_id: departmentId, category_id: categoryId, priority })
    .eq("id", memoId);

  if (error) {
    return { error: error.message, memoId };
  }

  revalidatePath(`/memos/${memoId}`);
  revalidatePath("/memos");
  return { error: null, memoId };
}

export async function deleteDraft(memoId: string) {
  const profile = await requireProfile();
  const supabase = await createClient();
  await assertOwnedDraft(supabase, memoId, profile.id);

  // Best-effort cleanup of any uploaded files for this draft.
  const { data: files } = await supabase.from("attachments").select("storage_path").eq("memo_id", memoId);
  if (files?.length) {
    await supabase.storage.from("attachments").remove(files.map((f) => f.storage_path));
  }

  await supabase.from("memos").delete().eq("id", memoId);
  revalidatePath("/memos");
  redirect("/memos");
}

export async function uploadAttachment(memoId: string, formData: FormData) {
  const profile = await requireProfile();
  const supabase = await createClient();
  await assertOwnedDraft(supabase, memoId, profile.id);

  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) {
    throw new Error("No file provided.");
  }
  if (file.size > MAX_FILE_SIZE) {
    throw new Error("File exceeds the 10MB limit.");
  }
  const lowerName = file.name.toLowerCase();
  if (BLOCKED_EXTENSIONS.some((ext) => lowerName.endsWith(ext))) {
    throw new Error("This file type isn't allowed.");
  }

  const storagePath = `${memoId}/${crypto.randomUUID()}-${file.name}`;
  const { error: uploadError } = await supabase.storage
    .from("attachments")
    .upload(storagePath, file, { contentType: file.type || "application/octet-stream" });

  if (uploadError) {
    throw new Error(uploadError.message);
  }

  const { error: rowError } = await supabase.from("attachments").insert({
    memo_id: memoId,
    storage_path: storagePath,
    file_name: file.name,
    file_size: file.size,
    mime_type: file.type || "application/octet-stream",
    uploaded_by: profile.id,
  });

  if (rowError) {
    await supabase.storage.from("attachments").remove([storagePath]);
    throw new Error(rowError.message);
  }

  revalidatePath(`/memos/${memoId}`);
}

export async function deleteAttachment(memoId: string, attachmentId: string) {
  const profile = await requireProfile();
  const supabase = await createClient();
  await assertOwnedDraft(supabase, memoId, profile.id);

  const { data: attachment } = await supabase
    .from("attachments")
    .select("id, storage_path, memo_id")
    .eq("id", attachmentId)
    .maybeSingle();

  if (!attachment || attachment.memo_id !== memoId) {
    throw new Error("Attachment not found.");
  }

  await supabase.storage.from("attachments").remove([attachment.storage_path]);
  await supabase.from("attachments").delete().eq("id", attachmentId);
  revalidatePath(`/memos/${memoId}`);
}

export async function getAttachmentSignedUrl(attachmentId: string): Promise<string> {
  await requireProfile();
  const supabase = await createClient();

  // RLS on `attachments` already scopes this to memos the caller may access
  // (author, or org_admin in the same org) — a foreign attachment id simply
  // won't be found.
  const { data: attachment } = await supabase
    .from("attachments")
    .select("storage_path")
    .eq("id", attachmentId)
    .maybeSingle();

  if (!attachment) {
    throw new Error("Attachment not found.");
  }

  const { data, error } = await supabase.storage
    .from("attachments")
    .createSignedUrl(attachment.storage_path, 60);

  if (error || !data) {
    throw new Error("Could not create a download link.");
  }

  return data.signedUrl;
}
