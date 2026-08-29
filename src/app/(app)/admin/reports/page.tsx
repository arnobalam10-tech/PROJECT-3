import { requireOrgAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { logQueryError } from "@/lib/log-query-error";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { STATUS_LABELS } from "@/components/memo-badges";

type SearchParams = { from?: string; to?: string; department?: string; category?: string; status?: string };

const selectClasses =
  "h-9 rounded-lg border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

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
    <div className="mx-auto max-w-6xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
        <p className="mt-1 text-sm text-muted-foreground">Org-wide memo activity.</p>
      </div>

      <Card className="mb-6">
        <CardContent>
          <form className="grid grid-cols-2 gap-4 sm:grid-cols-5">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">From</span>
              <Input type="date" name="from" defaultValue={params.from} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">To</span>
              <Input type="date" name="to" defaultValue={params.to} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">Department</span>
              <select name="department" defaultValue={params.department ?? ""} className={selectClasses}>
                <option value="">Any</option>
                {(departments ?? []).map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">Category</span>
              <select name="category" defaultValue={params.category ?? ""} className={selectClasses}>
                <option value="">Any</option>
                {(categories ?? []).map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">Status</span>
              <select name="status" defaultValue={params.status ?? ""} className={selectClasses}>
                <option value="">Any</option>
                {Object.entries(STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>
            <div className="col-span-2 sm:col-span-5">
              <Button type="submit">Apply filters</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <StatTile label="Total memos" value={rows.length} />
        <StatTile label="Urgent" value={urgentCount} accent />
        <StatTile label="Pending" value={pendingApprovalCount} />
        <StatTile label="Rejected" value={rejectedCount} />
        <StatTile label="Change requests" value={changeRequestCount} />
        <StatTile label="Avg. completion" value={avgCompletionHours !== null ? formatDuration(avgCompletionHours) : "—"} isText />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <BreakdownCard title="By status" data={byStatus} labelize={(k) => STATUS_LABELS[k] ?? k} />
        <BreakdownCard title="By department" data={byDepartment} />
        <BreakdownCard title="By category" data={byCategory} />
      </div>
    </div>
  );
}

function StatTile({ label, value, accent, isText }: { label: string; value: number | string; accent?: boolean; isText?: boolean }) {
  return (
    <Card>
      <CardContent>
        <p className="truncate text-xs text-muted-foreground">{label}</p>
        <p className={`mt-1 text-2xl font-semibold ${accent ? "text-primary" : ""}`}>
          {isText ? value : value.toLocaleString()}
        </p>
      </CardContent>
    </Card>
  );
}

function BreakdownCard({
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
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {entries.map(([key, count]) => (
          <div key={key} className="flex items-center gap-3 text-sm">
            <span className="w-28 shrink-0 truncate text-muted-foreground">{labelize ? labelize(key) : key}</span>
            <div className="h-2.5 flex-1 rounded-full bg-secondary">
              <div
                className="h-2.5 rounded-full bg-primary"
                style={{ width: `${(count / max) * 100}%` }}
              />
            </div>
            <span className="w-6 shrink-0 text-right font-medium">{count}</span>
          </div>
        ))}
        {entries.length === 0 && <p className="text-sm text-muted-foreground">No data.</p>}
      </CardContent>
    </Card>
  );
}
