import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
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
};

export default async function NotificationsPage() {
  const profile = await requireProfile();
  const supabase = await createClient();

  // RLS (notifications_select_own) already restricts this to the caller's
  // own rows — there is no organization- or admin-level broadening here,
  // unlike memos. A user's notifications are never visible to anyone else,
  // including another admin in the same org.
  const { data: notifications } = await supabase
    .from("notifications")
    .select("id, type, message, memo_id, is_read, created_at")
    .eq("user_id", profile.id)
    .order("created_at", { ascending: false });

  const items = notifications ?? [];
  const unreadCount = items.filter((n) => !n.is_read).length;

  return (
    <main className="mx-auto max-w-3xl">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-3xl font-bold lowercase tracking-tight">notifications</h1>
        {unreadCount > 0 && (
          <form action={markAllNotificationsRead}>
            <button
              type="submit"
              className="border border-black px-3 py-1.5 text-xs font-medium uppercase tracking-wide"
            >
              mark all read
            </button>
          </form>
        )}
      </div>

      <ul className="flex flex-col">
        {items.map((n) => (
          <li
            key={n.id}
            className={`flex items-center justify-between border-b border-neutral-300 py-3 text-sm ${
              n.is_read ? "text-neutral-500" : ""
            }`}
          >
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                {TYPE_LABELS[n.type] ?? n.type} · {new Date(n.created_at).toLocaleString()}
                {!n.is_read && <span className="ml-2 text-red-700">● unread</span>}
              </p>
              <p className="mt-1">
                {n.memo_id ? (
                  <Link href={`/memos/${n.memo_id}`} className="underline">
                    {n.message}
                  </Link>
                ) : (
                  n.message
                )}
              </p>
            </div>
            {!n.is_read && <MarkReadButton notificationId={n.id} />}
          </li>
        ))}
        {items.length === 0 && <li className="py-6 text-center text-neutral-500">No notifications yet.</li>}
      </ul>
    </main>
  );
}
