import "server-only";
import { Resend } from "resend";
import { createAdminClient } from "./supabase/admin";

const TYPE_SUBJECTS: Record<string, string> = {
  memo_requires_action: "Action required",
  workflow_assignment: "You were added to a workflow",
  memo_rejected: "Memo rejected",
  changes_requested: "Changes requested",
  comment_added: "New comment",
  memo_resubmitted: "Memo resubmitted",
  workflow_completed: "Workflow completed",
};

export type EmailDispatchResult =
  | { sent: number; total: number; skipped?: undefined }
  | { sent: 0; total: 0; skipped: "resend_not_configured" | "service_role_not_configured" };

/**
 * Reads whatever notification rows the Phase 4 SECURITY DEFINER workflow
 * functions (or the comments-insert trigger) already created for this memo
 * since `sinceIso`, and emails each recipient. This deliberately does NOT
 * decide who gets notified — that decision is made exactly once, inside
 * those functions via `private.notify_user()`. This only consumes the
 * result, so there is a single source of truth for "who gets notified,"
 * not two.
 */
export async function sendEmailsForNewNotifications(
  memoId: string,
  sinceIso: string,
): Promise<EmailDispatchResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !fromEmail) {
    return { sent: 0, total: 0, skipped: "resend_not_configured" };
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    // notifications' RLS only lets a user read their own rows — reading
    // other recipients' rows to email them requires the service-role
    // client, same reasoning as the invite-user flow.
    return { sent: 0, total: 0, skipped: "service_role_not_configured" };
  }

  const { data: rows } = await admin
    .from("notifications")
    .select("id, type, message, memo_id, profiles!notifications_user_id_fkey(email, name)")
    .eq("memo_id", memoId)
    .gte("created_at", sinceIso);

  if (!rows?.length) {
    return { sent: 0, total: 0 };
  }

  const resend = new Resend(apiKey);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const outcomes = await Promise.allSettled(
    rows.map((row) => {
      const recipient = row.profiles as unknown as { email: string; name: string } | null;
      if (!recipient?.email) return Promise.resolve(null);
      return resend.emails.send({
        from: fromEmail,
        to: recipient.email,
        subject: `Relay — ${TYPE_SUBJECTS[row.type] ?? "Notification"}`,
        text: `Hi ${recipient.name ?? ""},\n\n${row.message}\n\nView it here: ${appUrl}/memos/${row.memo_id}`,
      });
    }),
  );

  const sent = outcomes.filter((o) => o.status === "fulfilled" && o.value !== null).length;
  return { sent, total: rows.length };
}
