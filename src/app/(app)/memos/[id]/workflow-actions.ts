"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { sendEmailsForNewNotifications } from "@/lib/notifications";

export type ActionState = { error: string | null };

// Best-effort: read whatever notifications the RPC just created (Phase 4
// owns that decision entirely) and email them. Never lets an email failure
// fail the underlying workflow action.
async function dispatchEmails(memoId: string, sinceIso: string) {
  try {
    await sendEmailsForNewNotifications(memoId, sinceIso);
  } catch (e) {
    console.error("Failed to dispatch notification emails", e);
  }
}

export async function submitMemo(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireProfile();
  const memoId = String(formData.get("memo_id"));
  const participantIds = formData.getAll("participant_id").map(String).filter(Boolean);

  if (participantIds.length === 0) {
    return { error: "Add at least one participant before submitting." };
  }

  const sinceIso = new Date().toISOString();
  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_memo", {
    p_memo_id: memoId,
    p_participant_ids: participantIds,
  });

  if (error) return { error: error.message };
  await dispatchEmails(memoId, sinceIso);

  revalidatePath(`/memos/${memoId}`);
  revalidatePath("/memos");
  revalidatePath("/inbox");
  return { error: null };
}

export async function approveMemo(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireProfile();
  const memoId = String(formData.get("memo_id"));
  const comment = String(formData.get("comment") ?? "").trim() || null;
  const forwardTo = String(formData.get("forward_to_user_id") ?? "").trim() || null;

  const sinceIso = new Date().toISOString();
  const supabase = await createClient();
  const { error } = await supabase.rpc("workflow_approve", {
    p_memo_id: memoId,
    p_comment: comment,
    p_forward_to_user_id: forwardTo,
  });

  if (error) return { error: error.message };
  await dispatchEmails(memoId, sinceIso);

  revalidatePath(`/memos/${memoId}`);
  revalidatePath("/inbox");
  revalidatePath("/memos");
  return { error: null };
}

export async function declineMemo(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireProfile();
  const memoId = String(formData.get("memo_id"));
  const newHolderId = String(formData.get("new_holder_id") ?? "").trim();
  const comment = String(formData.get("comment") ?? "").trim() || null;

  if (!newHolderId) {
    return { error: "Choose who this should be rerouted to." };
  }

  const sinceIso = new Date().toISOString();
  const supabase = await createClient();
  const { error } = await supabase.rpc("workflow_decline_reroute", {
    p_memo_id: memoId,
    p_new_holder_id: newHolderId,
    p_comment: comment,
  });

  if (error) return { error: error.message };
  await dispatchEmails(memoId, sinceIso);

  revalidatePath(`/memos/${memoId}`);
  revalidatePath("/inbox");
  revalidatePath("/memos");
  return { error: null };
}

export async function rejectMemo(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireProfile();
  const memoId = String(formData.get("memo_id"));
  const reason = String(formData.get("reason") ?? "").trim();

  if (!reason) {
    return { error: "A reason is required to reject a memo." };
  }

  const sinceIso = new Date().toISOString();
  const supabase = await createClient();
  const { error } = await supabase.rpc("workflow_reject", {
    p_memo_id: memoId,
    p_reason: reason,
  });

  if (error) return { error: error.message };
  await dispatchEmails(memoId, sinceIso);

  revalidatePath(`/memos/${memoId}`);
  revalidatePath("/inbox");
  revalidatePath("/memos");
  return { error: null };
}

export async function requestChangesMemo(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireProfile();
  const memoId = String(formData.get("memo_id"));
  const explanation = String(formData.get("explanation") ?? "").trim();

  if (!explanation) {
    return { error: "An explanation is required to request changes." };
  }

  const sinceIso = new Date().toISOString();
  const supabase = await createClient();
  const { error } = await supabase.rpc("workflow_request_changes", {
    p_memo_id: memoId,
    p_explanation: explanation,
  });

  if (error) return { error: error.message };
  await dispatchEmails(memoId, sinceIso);

  revalidatePath(`/memos/${memoId}`);
  revalidatePath("/inbox");
  revalidatePath("/memos");
  return { error: null };
}

export async function resubmitMemo(memoId: string) {
  await requireProfile();
  const sinceIso = new Date().toISOString();
  const supabase = await createClient();
  const { error } = await supabase.rpc("resubmit_memo", { p_memo_id: memoId });
  if (error) throw new Error(error.message);
  await dispatchEmails(memoId, sinceIso);

  revalidatePath(`/memos/${memoId}`);
  revalidatePath("/inbox");
  revalidatePath("/memos");
}

export async function addGeneralComment(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const profile = await requireProfile();
  const memoId = String(formData.get("memo_id"));
  const body = String(formData.get("body") ?? "").trim();

  if (!body) return { error: "Comment cannot be empty." };

  const sinceIso = new Date().toISOString();
  const supabase = await createClient();
  const { error } = await supabase.from("comments").insert({
    memo_id: memoId,
    author_id: profile.id,
    body,
    comment_type: "general",
  });

  if (error) return { error: error.message };
  await dispatchEmails(memoId, sinceIso);

  revalidatePath(`/memos/${memoId}`);
  return { error: null };
}
