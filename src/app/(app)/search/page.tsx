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

type SearchParams = {
  q?: string;
  author?: string;
  department?: string;
  category?: string;
  status?: string;
  priority?: string;
  from?: string;
  to?: string;
};

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const profile = await requireProfile();
  const supabase = await createClient();
  const params = await searchParams;

  const [{ data: departments }, { data: categories }, { data: members }] = await Promise.all([
    supabase.from("departments").select("id, name").eq("organization_id", profile.organization_id).order("name"),
    supabase.from("memo_categories").select("id, name").eq("organization_id", profile.organization_id).order("name"),
    supabase.from("profiles").select("id, name").eq("organization_id", profile.organization_id).order("name"),
  ]);

  const hasAnyFilter = Object.values(params).some((v) => v && v.length > 0);

  let results: Array<{
    id: string;
    memo_number: string;
    subject: string;
    status: string;
    priority: string;
    submitted_at: string | null;
    author_id: string;
    profiles: { name: string } | null;
    departments: { name: string } | null;
  }> = [];

  if (hasAnyFilter) {
    // No new authorization logic here on purpose — this is the exact same
    // memos_select_authorized RLS policy (author/admin/participant, scoped
    // to organization_id) already exhaustively tested in Phase 5. Search is
    // just filters layered on top of an already-scoped table; it cannot
    // surface a row direct navigation wouldn't already allow, and it can
    // never cross organization_id regardless of what filters are supplied.
    let query = supabase
      .from("memos")
      .select(
        "id, memo_number, subject, status, priority, submitted_at, author_id, profiles!memos_author_id_fkey(name), departments(name)",
      );

    if (params.q) {
      const q = params.q.replace(/[%_]/g, "\\$&");
      // body is jsonb (Tiptap doc format) — Postgres has no ilike operator
      // for jsonb, so this filters against body_text, a trigger-maintained
      // plain-text mirror of body's content (see migration 020). Filtering
      // against `body` directly throws a Postgres type error that silently
      // degraded every search to "no matches" — caught only by testing
      // against real data.
      query = query.or(`memo_number.ilike.%${q}%,subject.ilike.%${q}%,body_text.ilike.%${q}%`);
    }
    if (params.author) query = query.eq("author_id", params.author);
    if (params.department) query = query.eq("department_id", params.department);
    if (params.category) query = query.eq("category_id", params.category);
    if (params.status) query = query.eq("status", params.status);
    if (params.priority) query = query.eq("priority", params.priority);
    if (params.from) query = query.gte("submitted_at", params.from);
    if (params.to) query = query.lte("submitted_at", `${params.to}T23:59:59`);

    const { data, error } = await query.order("submitted_at", { ascending: false }).limit(100);
    if (error) {
      // Never swallow this silently — a query error here previously looked
      // identical to "no matches" and hid a real bug (see migration 020).
      console.error("[search] query failed:", error);
    }
    results = (data ?? []) as unknown as typeof results;
  }

  return (
    <main className="mx-auto max-w-5xl">
      <h1 className="mb-8 text-3xl font-bold lowercase tracking-tight">search</h1>

      <form className="mb-8 grid grid-cols-1 gap-3 border border-black p-4 text-sm sm:grid-cols-3">
        <label className="flex flex-col gap-1 sm:col-span-3">
          <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">
            Memo number, subject, or body
          </span>
          <input
            type="text"
            name="q"
            defaultValue={params.q}
            className="border border-black px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">Author</span>
          <select name="author" defaultValue={params.author ?? ""} className="border border-black bg-white px-3 py-2">
            <option value="">Any</option>
            {(members ?? []).map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">Department</span>
          <select name="department" defaultValue={params.department ?? ""} className="border border-black bg-white px-3 py-2">
            <option value="">Any</option>
            {(departments ?? []).map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">Category</span>
          <select name="category" defaultValue={params.category ?? ""} className="border border-black bg-white px-3 py-2">
            <option value="">Any</option>
            {(categories ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">Status</span>
          <select name="status" defaultValue={params.status ?? ""} className="border border-black bg-white px-3 py-2">
            <option value="">Any</option>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">Priority</span>
          <select name="priority" defaultValue={params.priority ?? ""} className="border border-black bg-white px-3 py-2">
            <option value="">Any</option>
            <option value="normal">Normal</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">Submitted from</span>
          <input type="date" name="from" defaultValue={params.from} className="border border-black px-3 py-2" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">Submitted to</span>
          <input type="date" name="to" defaultValue={params.to} className="border border-black px-3 py-2" />
        </label>
        <div className="flex items-end">
          <button type="submit" className="w-full bg-black px-4 py-2 font-medium text-white">
            search
          </button>
        </div>
      </form>

      {hasAnyFilter ? (
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-black text-left text-xs uppercase tracking-wide text-neutral-500">
              <th className="py-2">Number</th>
              <th className="py-2">Subject</th>
              <th className="py-2">Author</th>
              <th className="py-2">Department</th>
              <th className="py-2">Status</th>
              <th className="py-2">Priority</th>
              <th className="py-2">Submitted</th>
            </tr>
          </thead>
          <tbody>
            {results.map((m) => (
              <tr key={m.id} className="border-b border-neutral-300">
                <td className="py-3 font-mono text-xs">{m.memo_number}</td>
                <td className="py-3">
                  <Link href={`/memos/${m.id}`} className="font-medium underline">
                    {m.subject}
                  </Link>
                </td>
                <td className="py-3">{m.profiles?.name ?? "—"}</td>
                <td className="py-3">{m.departments?.name ?? "—"}</td>
                <td className="py-3 text-xs font-medium uppercase tracking-wide">
                  {STATUS_LABELS[m.status] ?? m.status}
                </td>
                <td className="py-3 text-xs font-medium uppercase tracking-wide">
                  {m.priority === "urgent" ? <span className="text-red-700">{m.priority}</span> : m.priority}
                </td>
                <td className="py-3 text-neutral-600">
                  {m.submitted_at ? new Date(m.submitted_at).toLocaleDateString() : "—"}
                </td>
              </tr>
            ))}
            {results.length === 0 && (
              <tr>
                <td colSpan={7} className="py-6 text-center text-neutral-500">
                  No matches.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      ) : (
        <p className="text-sm text-neutral-500">Enter at least one filter to search.</p>
      )}
    </main>
  );
}
