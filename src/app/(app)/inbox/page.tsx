import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { logQueryError } from "@/lib/log-query-error";

type SortKey = "submitted_at" | "priority" | "age";

function formatAge(sinceIso: string) {
  const ms = Date.now() - new Date(sinceIso).getTime();
  const hours = Math.floor(ms / (1000 * 60 * 60));
  if (hours < 1) return "< 1h";
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string; dir?: string; priority?: string; department?: string }>;
}) {
  const profile = await requireProfile();
  const supabase = await createClient();
  const params = await searchParams;

  const sort: SortKey = (params.sort as SortKey) ?? "age";
  const dir: "asc" | "desc" = params.dir === "desc" ? "desc" : "asc";

  const { data: departments, error: departmentsError } = await supabase
    .from("departments")
    .select("id, name")
    .eq("organization_id", profile.organization_id)
    .order("name");
  logQueryError("inbox.departments", departmentsError);

  let query = supabase
    .from("workflow_steps")
    .select(
      "id, updated_at, memos!inner(id, memo_number, subject, priority, status, submitted_at, department_id, author_id, profiles!memos_author_id_fkey(name), departments(name))",
    )
    .eq("assigned_user_id", profile.id)
    .eq("status", "current");

  if (params.priority) {
    query = query.eq("memos.priority", params.priority);
  }
  if (params.department) {
    query = query.eq("memos.department_id", params.department);
  }

  const { data: rows, error: rowsError } = await query;
  logQueryError("inbox.workflow_steps", rowsError);

  type Row = {
    id: string;
    updated_at: string;
    memos: {
      id: string;
      memo_number: string;
      subject: string;
      priority: string;
      status: string;
      submitted_at: string | null;
      author_id: string;
      profiles: { name: string } | null;
      departments: { name: string } | null;
    };
  };

  const items = ((rows ?? []) as unknown as Row[]).slice();
  items.sort((a, b) => {
    let cmp = 0;
    if (sort === "priority") {
      const order = { urgent: 2, high: 1, normal: 0 };
      cmp = (order[a.memos.priority as keyof typeof order] ?? 0) - (order[b.memos.priority as keyof typeof order] ?? 0);
    } else if (sort === "submitted_at") {
      cmp = new Date(a.memos.submitted_at ?? 0).getTime() - new Date(b.memos.submitted_at ?? 0).getTime();
    } else {
      cmp = new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime();
    }
    return dir === "asc" ? cmp : -cmp;
  });

  function sortLink(key: SortKey, label: string) {
    const nextDir = sort === key && dir === "asc" ? "desc" : "asc";
    const qp = new URLSearchParams();
    qp.set("sort", key);
    qp.set("dir", nextDir);
    if (params.priority) qp.set("priority", params.priority);
    if (params.department) qp.set("department", params.department);
    return (
      <Link href={`/inbox?${qp.toString()}`} className="hover:underline">
        {label}
        {sort === key ? (dir === "asc" ? " ↑" : " ↓") : ""}
      </Link>
    );
  }

  return (
    <main className="mx-auto max-w-5xl">
      <h1 className="mb-8 text-3xl font-bold lowercase tracking-tight">inbox</h1>

      <form className="mb-6 flex flex-wrap gap-3 text-sm" action="/inbox">
        <select name="priority" defaultValue={params.priority ?? ""} className="border border-black bg-white px-3 py-2">
          <option value="">All priorities</option>
          <option value="normal">Normal</option>
          <option value="high">High</option>
          <option value="urgent">Urgent</option>
        </select>
        <select name="department" defaultValue={params.department ?? ""} className="border border-black bg-white px-3 py-2">
          <option value="">All departments</option>
          {(departments ?? []).map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
        <button type="submit" className="border border-black px-3 py-2 font-medium">
          filter
        </button>
      </form>

      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-black text-left text-xs uppercase tracking-wide text-neutral-500">
            <th className="py-2">Number</th>
            <th className="py-2">Subject</th>
            <th className="py-2">Sender</th>
            <th className="py-2">Department</th>
            <th className="py-2">{sortLink("priority", "Priority")}</th>
            <th className="py-2">Status</th>
            <th className="py-2">{sortLink("submitted_at", "Submitted")}</th>
            <th className="py-2">Required Action</th>
            <th className="py-2">{sortLink("age", "Age")}</th>
          </tr>
        </thead>
        <tbody>
          {items.map((row) => (
            <tr key={row.id} className="border-b border-neutral-300">
              <td className="py-3 font-mono text-xs">{row.memos.memo_number}</td>
              <td className="py-3">
                <Link href={`/memos/${row.memos.id}`} className="font-medium underline">
                  {row.memos.subject}
                </Link>
              </td>
              <td className="py-3">{row.memos.profiles?.name ?? "—"}</td>
              <td className="py-3">{row.memos.departments?.name ?? "—"}</td>
              <td className="py-3 text-xs font-medium uppercase tracking-wide">
                {row.memos.priority === "urgent" ? (
                  <span className="text-red-700">{row.memos.priority}</span>
                ) : (
                  row.memos.priority
                )}
              </td>
              <td className="py-3 text-xs font-medium uppercase tracking-wide">{row.memos.status}</td>
              <td className="py-3 text-neutral-600">
                {row.memos.submitted_at ? new Date(row.memos.submitted_at).toLocaleDateString() : "—"}
              </td>
              <td className="py-3 text-xs font-medium uppercase tracking-wide text-red-700">Review &amp; decide</td>
              <td className="py-3 text-neutral-600">{formatAge(row.updated_at)}</td>
            </tr>
          ))}
          {items.length === 0 && (
            <tr>
              <td colSpan={9} className="py-6 text-center text-neutral-500">
                Nothing awaiting your action.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </main>
  );
}
