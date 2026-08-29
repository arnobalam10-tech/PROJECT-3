import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { logQueryError } from "@/lib/log-query-error";

const STATUS_LABELS: Record<string, string> = {
  approved: "Approved",
  rejected: "Rejected",
  cancelled: "Cancelled",
};

export default async function CompletedPage() {
  await requireProfile();
  const supabase = await createClient();

  // RLS (memos_select_authorized) already scopes this to memos the caller
  // authored, was ever a workflow participant on, or — if org_admin — any
  // memo in the org. No extra filtering needed for authorization; the
  // .in() below only narrows to terminal statuses.
  const { data: memos, error: memosError } = await supabase
    .from("memos")
    .select(
      "id, memo_number, subject, status, priority, author_id, completed_at, profiles!memos_author_id_fkey(name)",
    )
    .in("status", ["approved", "rejected", "cancelled"])
    .order("completed_at", { ascending: false });
  logQueryError("completed.memos", memosError);

  type Row = {
    id: string;
    memo_number: string;
    subject: string;
    status: string;
    priority: string;
    completed_at: string | null;
    profiles: { name: string } | null;
  };

  const rows = (memos ?? []) as unknown as Row[];

  return (
    <main className="mx-auto max-w-5xl">
      <h1 className="headline mb-8 text-3xl">completed</h1>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-ink text-left text-xs uppercase tracking-wide text-muted">
            <th className="py-2">Number</th>
            <th className="py-2">Subject</th>
            <th className="py-2">Author</th>
            <th className="py-2">Outcome</th>
            <th className="py-2">Priority</th>
            <th className="py-2">Completed</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((m) => (
            <tr key={m.id} className="border-b border-rule">
              <td className="py-3 font-mono text-xs">{m.memo_number}</td>
              <td className="py-3">
                <Link href={`/memos/${m.id}`} className="font-medium underline">
                  {m.subject}
                </Link>
              </td>
              <td className="py-3">{m.profiles?.name ?? "—"}</td>
              {/* Terminal states are informational, not actionable — muted
                  gray per DESIGN.md, never the accent (that's reserved for
                  what still needs the viewer's action right now). */}
              <td className="py-3 text-xs font-medium uppercase tracking-wide text-muted">
                {STATUS_LABELS[m.status] ?? m.status}
              </td>
              <td
                className={`py-3 text-xs font-medium uppercase tracking-wide ${
                  m.priority === "urgent" ? "text-accent" : ""
                }`}
              >
                {m.priority}
              </td>
              <td className="py-3 text-body">
                {m.completed_at ? new Date(m.completed_at).toLocaleString() : "—"}
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={6} className="py-6 text-center text-muted">
                No completed workflows yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </main>
  );
}
