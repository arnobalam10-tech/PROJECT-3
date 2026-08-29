import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { logQueryError } from "@/lib/log-query-error";

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  submitted: "Submitted",
  pending_review: "Pending Review",
  pending_approval: "Pending Approval",
  changes_requested: "Changes Requested",
  rejected: "Rejected",
  approved: "Approved",
  cancelled: "Cancelled",
};

export default async function MyMemosPage() {
  const profile = await requireProfile();
  const supabase = await createClient();

  const { data: memos, error: memosError } = await supabase
    .from("memos")
    .select(
      "id, memo_number, subject, status, priority, submitted_at, updated_at, workflow_steps(assigned_user_id, status, profiles!workflow_steps_assigned_user_id_fkey(name))",
    )
    .eq("author_id", profile.id)
    .order("updated_at", { ascending: false });
  logQueryError("my-memos.memos", memosError);

  type Row = {
    id: string;
    memo_number: string;
    subject: string;
    status: string;
    priority: string;
    submitted_at: string | null;
    updated_at: string;
    workflow_steps: { assigned_user_id: string; status: string; profiles: { name: string } | null }[];
  };

  const rows = (memos ?? []) as unknown as Row[];

  return (
    <main className="mx-auto max-w-5xl">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-3xl headline">my memos</h1>
        <Link href="/memos/new" className="bg-ink px-4 py-2 text-sm font-medium text-surface">
          new memo
        </Link>
      </div>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-ink text-left text-xs uppercase tracking-wide text-muted">
            <th className="py-2">Number</th>
            <th className="py-2">Subject</th>
            <th className="py-2">Status</th>
            <th className="py-2">Current Participant</th>
            <th className="py-2">Priority</th>
            <th className="py-2">Submitted</th>
            <th className="py-2">Last Activity</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((m) => {
            // Derived from workflow_steps, not any stored "current step"
            // pointer — memos itself has no such column (see DATABASE.md:
            // "who currently holds this memo" is always a live query).
            const current = m.workflow_steps?.find((s) => s.status === "current");
            return (
              <tr key={m.id} className="border-b border-rule">
                <td className="py-3 font-mono text-xs">{m.memo_number}</td>
                <td className="py-3">
                  <Link href={`/memos/${m.id}`} className="font-medium underline">
                    {m.subject}
                  </Link>
                </td>
                <td className="py-3 text-xs font-medium uppercase tracking-wide">
                  {STATUS_LABELS[m.status] ?? m.status}
                </td>
                <td className="py-3">{current?.profiles?.name ?? "—"}</td>
                <td className="py-3 text-xs font-medium uppercase tracking-wide">
                  {m.priority === "urgent" ? <span className="text-accent">{m.priority}</span> : m.priority}
                </td>
                <td className="py-3 text-body">
                  {m.submitted_at ? new Date(m.submitted_at).toLocaleDateString() : "—"}
                </td>
                <td className="py-3 text-body">{new Date(m.updated_at).toLocaleString()}</td>
              </tr>
            );
          })}
          {rows.length === 0 && (
            <tr>
              <td colSpan={7} className="py-6 text-center text-muted">
                No memos yet — create your first draft.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </main>
  );
}
