import { requireOrgAdmin } from "@/lib/auth";
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

type SearchParams = { from?: string; to?: string; department?: string; category?: string; status?: string };

function formatDuration(hours: number) {
  if (hours < 24) return `${hours.toFixed(1)}h`;
  return `${(hours / 24).toFixed(1)}d`;
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const admin = await requireOrgAdmin();
  const supabase = await createClient();
  const params = await searchParams;

  const [
    { data: departments, error: departmentsError },
    { data: categories, error: categoriesError },
  ] = await Promise.all([
    supabase.from("departments").select("id, name").eq("organization_id", admin.organization_id).order("name"),
    supabase.from("memo_categories").select("id, name").eq("organization_id", admin.organization_id).order("name"),
  ]);
  logQueryError("reports.departments", departmentsError);
  logQueryError("reports.categories", categoriesError);
  const deptNameById = new Map((departments ?? []).map((d) => [d.id, d.name]));
  const catNameById = new Map((categories ?? []).map((c) => [c.id, c.name]));

  let query = supabase
    .from("memos")
    .select("id, status, priority, department_id, category_id, submitted_at, completed_at")
    .eq("organization_id", admin.organization_id);

  if (params.from) query = query.gte("submitted_at", params.from);
  if (params.to) query = query.lte("submitted_at", `${params.to}T23:59:59`);
  if (params.department) query = query.eq("department_id", params.department);
  if (params.category) query = query.eq("category_id", params.category);
  if (params.status) query = query.eq("status", params.status);

  const { data: memos, error: memosError } = await query;
  logQueryError("reports.memos", memosError);
  const rows = memos ?? [];

  const byStatus = new Map<string, number>();
  const byDepartment = new Map<string, number>();
  const byCategory = new Map<string, number>();
  let urgentCount = 0;
  let pendingApprovalCount = 0;
  let rejectedCount = 0;
  let changeRequestCount = 0;
  const completionHours: number[] = [];

  for (const m of rows) {
    byStatus.set(m.status, (byStatus.get(m.status) ?? 0) + 1);
    const deptLabel = m.department_id ? (deptNameById.get(m.department_id) ?? "—") : "—";
    byDepartment.set(deptLabel, (byDepartment.get(deptLabel) ?? 0) + 1);
    const catLabel = m.category_id ? (catNameById.get(m.category_id) ?? "—") : "—";
    byCategory.set(catLabel, (byCategory.get(catLabel) ?? 0) + 1);

    if (m.priority === "urgent") urgentCount++;
    if (m.status === "submitted" || m.status === "changes_requested") pendingApprovalCount++;
    if (m.status === "rejected") rejectedCount++;
    if (m.status === "changes_requested") changeRequestCount++;

    if (m.submitted_at && m.completed_at) {
      const hours = (new Date(m.completed_at).getTime() - new Date(m.submitted_at).getTime()) / 36e5;
      completionHours.push(hours);
    }
  }

  const avgCompletionHours =
    completionHours.length > 0 ? completionHours.reduce((a, b) => a + b, 0) / completionHours.length : null;

  return (
    <main className="mx-auto max-w-5xl">
      <h1 className="mb-8 text-3xl headline">reports</h1>

      <form className="mb-8 grid grid-cols-2 gap-3 border border-ink p-4 text-sm sm:grid-cols-5">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wide text-muted">From</span>
          <input type="date" name="from" defaultValue={params.from} className="border border-ink px-2 py-1.5" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wide text-muted">To</span>
          <input type="date" name="to" defaultValue={params.to} className="border border-ink px-2 py-1.5" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wide text-muted">Department</span>
          <select name="department" defaultValue={params.department ?? ""} className="border border-ink bg-surface px-2 py-1.5">
            <option value="">Any</option>
            {(departments ?? []).map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wide text-muted">Category</span>
          <select name="category" defaultValue={params.category ?? ""} className="border border-ink bg-surface px-2 py-1.5">
            <option value="">Any</option>
            {(categories ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wide text-muted">Status</span>
          <select name="status" defaultValue={params.status ?? ""} className="border border-ink bg-surface px-2 py-1.5">
            <option value="">Any</option>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <div className="col-span-2 sm:col-span-5">
          <button type="submit" className="bg-ink px-4 py-2 font-medium text-surface">
            apply filters
          </button>
        </div>
      </form>

      <div className="mb-10 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatTile label="Total memos" value={rows.length} />
        <StatTile label="Urgent" value={urgentCount} accent />
        <StatTile label="Pending (submitted/changes)" value={pendingApprovalCount} />
        <StatTile label="Rejected" value={rejectedCount} />
        <StatTile label="Change requests (current)" value={changeRequestCount} />
        <StatTile
          label="Avg. completion time"
          value={avgCompletionHours !== null ? formatDuration(avgCompletionHours) : "—"}
          isText
        />
      </div>

      <div className="grid grid-cols-1 gap-8 sm:grid-cols-3">
        <BreakdownTable title="By status" data={byStatus} labelize={(k) => STATUS_LABELS[k] ?? k} />
        <BreakdownTable title="By department" data={byDepartment} />
        <BreakdownTable title="By category" data={byCategory} />
      </div>
    </main>
  );
}

function StatTile({ label, value, accent, isText }: { label: string; value: number | string; accent?: boolean; isText?: boolean }) {
  return (
    <div className="border border-ink bg-surface p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
      <p className={`mt-1 text-3xl font-bold ${accent ? "text-accent" : ""}`}>
        {isText ? value : value.toLocaleString()}
      </p>
    </div>
  );
}

function BreakdownTable({
  title,
  data,
  labelize,
}: {
  title: string;
  data: Map<string, number>;
  labelize?: (key: string) => string;
}) {
  const entries = [...data.entries()].sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...entries.map(([, c]) => c));
  return (
    <div>
      <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-muted">{title}</h2>
      {/* Solid black bars, 4px black baseline, no gridlines, plain numeral
          labels — per DESIGN.md's chart rules. No accent here: none of
          these breakdowns represent an act-now signal, just a count. */}
      <div className="flex flex-col gap-2.5 border-t-4 border-ink pt-3">
        {entries.map(([key, count]) => (
          <div key={key} className="flex items-center gap-3 text-sm">
            <span className="w-28 shrink-0 truncate">{labelize ? labelize(key) : key}</span>
            <div className="h-3 flex-1 bg-rule/40">
              <div className="h-3 bg-ink" style={{ width: `${(count / max) * 100}%` }} />
            </div>
            <span className="w-6 shrink-0 text-right font-medium">{count}</span>
          </div>
        ))}
        {entries.length === 0 && <p className="text-sm text-muted">No data.</p>}
      </div>
    </div>
  );
}
