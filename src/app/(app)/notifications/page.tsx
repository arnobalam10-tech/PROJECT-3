import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { logQueryError } from "@/lib/log-query-error";
import { SubmitButton } from "@/components/submit-button";
import { MarkReadButton } from "./mark-read-button";
import { markAllNotificationsRead } from "./actions";

const TYPE_LABELS: Record<string, string> = {
  memo_requires_action: "Action required",
  workflow_assignment: "Assigned to workflow",
  memo_rejected: "Rejected",
  changes_requested: "Changes requested",
  comment_added: "Comment",
  memo_resubmitted: "Resubmitted",
  workflow_completed: "Workflow completed",
  delegation_assigned: "Delegation assigned",
};

export default async function NotificationsPage() {
  const profile = await requireProfile();
  const supabase = await createClient();

  const { data: notifications, error: notificationsError } = await supabase
    .from("notifications")
    .select("id, type, message, memo_id, is_read, created_at")
    .eq("user_id", profile.id)
    .order("created_at", { ascending: false });
  logQueryError("notifications.notifications", notificationsError);

  const items = notifications ?? [];
  const unreadCount = items.filter((n) => !n.is_read).length;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Notifications</h1>
          <p className="mt-1 text-sm text-muted-foreground">Everything that&apos;s happened on your memos.</p>
        </div>
        {unreadCount > 0 && (
          <form action={markAllNotificationsRead}>
            <SubmitButton variant="outline" size="sm" pendingText="Marking…">
              Mark all read
            </SubmitButton>
          </form>
        )}
      </div>

      <div className="rounded-xl border bg-card shadow-sm">
        <div className="flex flex-col divide-y">
          {items.map((n) => (
            <div key={n.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                  {!n.is_read && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />}
                  {TYPE_LABELS[n.type] ?? n.type} · {new Date(n.created_at).toLocaleString()}
                </p>
                <p className={`mt-1 text-sm ${n.is_read ? "text-muted-foreground" : "text-foreground"}`}>
                  {n.memo_id ? (
                    <Link href={`/memos/${n.memo_id}`} className="hover:underline">
                      {n.message}
                    </Link>
                  ) : (
                    n.message
                  )}
                </p>
              </div>
              {!n.is_read && <MarkReadButton notificationId={n.id} />}
            </div>
          ))}
          {items.length === 0 && (
            <p className="py-10 text-center text-sm text-muted-foreground">No notifications yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
