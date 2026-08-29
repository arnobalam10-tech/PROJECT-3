"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type ActionState = { error: string | null };

export async function createDelegation(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireProfile();
  const delegateUserId = String(formData.get("delegate_user_id") ?? "").trim();
  const startDate = String(formData.get("start_date") ?? "").trim();
  const endDate = String(formData.get("end_date") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim() || null;

  if (!delegateUserId || !startDate || !endDate) {
    return { error: "Choose a delegate and a date range." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_delegation", {
    p_delegate_user_id: delegateUserId,
    p_start_date: startDate,
    p_end_date: endDate,
    p_reason: reason,
  });

  if (error) return { error: error.message };

  revalidatePath("/delegations");
  return { error: null };
}

export async function revokeDelegation(delegationId: string) {
  await requireProfile();
  const supabase = await createClient();
  const { error } = await supabase.rpc("revoke_delegation", { p_delegation_id: delegationId });
  if (error) throw new Error(error.message);
  revalidatePath("/delegations");
}
