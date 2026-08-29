import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

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

  const { data: memos } = await supabase
    .from("memos")
    .select("id, memo_number, subject, status, priority, created_at, updated_at")
    .eq("author_id", profile.id)
    .order("updated_at", { ascending: false });

  return (
    <main className="mx-auto max-w-4xl">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-3xl font-bold lowercase tracking-tight">my memos</h1>
        <Link href="/memos/new" className="bg-black px-4 py-2 text-sm font-medium text-white">
          new memo
        </Link>
      </div>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-black text-left text-xs uppercase tracking-wide text-neutral-500">
            <th className="py-2">Number</th>
            <th className="py-2">Subject</th>
            <th className="py-2">Status</th>
            <th className="py-2">Priority</th>
            <th className="py-2">Last activity</th>
          </tr>
        </thead>
        <tbody>
          {(memos ?? []).map((m) => (
            <tr key={m.id} className="border-b border-neutral-300">
              <td className="py-3 font-mono text-xs">{m.memo_number}</td>
              <td className="py-3">
                <Link href={`/memos/${m.id}`} className="font-medium underline">
                  {m.subject}
                </Link>
              </td>
              <td className="py-3 text-xs font-medium uppercase tracking-wide">
                {STATUS_LABELS[m.status] ?? m.status}
              </td>
              <td className="py-3 text-xs font-medium uppercase tracking-wide">
                {m.priority === "urgent" ? (
                  <span className="text-red-700">{m.priority}</span>
                ) : (
                  m.priority
                )}
              </td>
              <td className="py-3 text-neutral-600">
                {new Date(m.updated_at).toLocaleString()}
              </td>
            </tr>
          ))}
          {(memos ?? []).length === 0 && (
            <tr>
              <td colSpan={5} className="py-6 text-center text-neutral-500">
                No memos yet — create your first draft.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </main>
  );
}
