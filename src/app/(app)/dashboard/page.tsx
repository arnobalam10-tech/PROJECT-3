import Link from "next/link";
import { Inbox, Send, CheckCircle2, AlertTriangle, Users, Building2, FileText, Clock } from "lucide-react";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { logQueryError } from "@/lib/log-query-error";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { STATUS_LABELS } from "@/components/memo-badges";

export default async function DashboardPage() {
  // TEMPORARY, for one controlled visual-verification round only -- proves
  // the loading.tsx Suspense boundary genuinely activates on the real
  // deployed app, not just "the code looks right" locally. Removed in the
  // immediate next commit.
  await new Promise((r) => setTimeout(r, 2500));
  const profile = await requireProfile();
  const supabase = await createClient();

  const { data: org, error: orgError } = await supabase
    .from("organizations")
    .select("name")
    .eq("id", profile.organization_id)
    .maybeSingle();
  logQueryError("dashboard.org", orgError);

  const [
    { data: inboxSteps, error: inboxStepsError },
    { data: myMemos, error: myMemosError },
    { data: recentNotifs, error: recentNotifsError },
  ] = await Promise.all([
    supabase
      .from("workflow_steps")
      .select("id, memos!inner(priority)")
      .eq("assigned_user_id", profile.id)
      .eq("status", "current"),
    supabase
      .from("memos")
      .select("id, subject, status, updated_at, completed_at")
      .eq("author_id", profile.id)
      .order("updated_at", { ascending: false }),
    supabase
      .from("notifications")
      .select("id, type, message, created_at, memo_id")
      .eq("user_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);
  logQueryError("dashboard.inboxSteps", inboxStepsError);
  logQueryError("dashboard.myMemos", myMemosError);
  logQueryError("dashboard.recentNotifs", recentNotifsError);

  const inboxCount = inboxSteps?.length ?? 0;
  const urgentInboxCount = (inboxSteps ?? []).filter(
    (s) => (s.memos as unknown as { priority: string })?.priority === "urgent",
  ).length;
  const submittedCount = (myMemos ?? []).filter((m) => m.status !== "draft").length;
  const recentlyCompleted = (myMemos ?? [])
    .filter((m) => m.completed_at)
    .sort((a, b) => new Date(b.completed_at!).getTime() - new Date(a.completed_at!).getTime())
    .slice(0, 5);
  const myStatusCounts = new Map<string, number>();
  for (const m of myMemos ?? []) {
    myStatusCounts.set(m.status, (myStatusCounts.get(m.status) ?? 0) + 1);
  }

  let adminStats: {
    userCount: number;
    activeUserCount: number;
    departmentCount: number;
    memoCount: number;
    pendingCount: number;
    completedCount: number;
    rejectedCount: number;
    recentActivity: { event_type: string; description: string | null; created_at: string }[];
  } | null = null;

  if (profile.role === "org_admin") {
    const [
      { count: userCount, error: userCountError },
      { count: activeUserCount, error: activeUserCountError },
      { count: departmentCount, error: departmentCountError },
      { data: orgMemos, error: orgMemosError },
      { data: activity, error: activityError },
    ] = await Promise.all([
      supabase.from("profiles").select("id", { count: "exact", head: true }).eq("organization_id", profile.organization_id),
      supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", profile.organization_id)
        .eq("status", "active"),
      supabase.from("departments").select("id", { count: "exact", head: true }).eq("organization_id", profile.organization_id),
      supabase.from("memos").select("id, status").eq("organization_id", profile.organization_id),
      supabase
        .from("audit_log")
        .select("event_type, description, created_at")
        .eq("organization_id", profile.organization_id)
        .order("created_at", { ascending: false })
        .limit(8),
    ]);
    logQueryError("dashboard.admin.userCount", userCountError);
    logQueryError("dashboard.admin.activeUserCount", activeUserCountError);
    logQueryError("dashboard.admin.departmentCount", departmentCountError);
    logQueryError("dashboard.admin.orgMemos", orgMemosError);
    logQueryError("dashboard.admin.activity", activityError);

    const rows = orgMemos ?? [];
    adminStats = {
      userCount: userCount ?? 0,
      activeUserCount: activeUserCount ?? 0,
      departmentCount: departmentCount ?? 0,
      memoCount: rows.length,
      pendingCount: rows.filter((m) => m.status === "submitted" || m.status === "changes_requested").length,
      completedCount: rows.filter((m) => m.status === "approved").length,
      rejectedCount: rows.filter((m) => m.status === "rejected").length,
      recentActivity: activity ?? [],
    };
  }

  const maxStatusCount = Math.max(1, ...[...myStatusCounts.values()]);

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Good to see you, {profile.name.split(" ")[0]}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {org?.name} · {profile.role === "org_admin" ? "Admin" : "Member"}
        </p>
      </div>

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Awaiting your action" value={inboxCount} icon={Inbox} href="/inbox" />
        <StatCard
          label="Urgent, awaiting you"
          value={urgentInboxCount}
          icon={AlertTriangle}
          tone="warn"
          href="/inbox?priority=urgent"
        />
        <StatCard label="Submitted by you" value={submittedCount} icon={Send} href="/memos" />
        <StatCard label="Completed (yours)" value={recentlyCompleted.length} icon={CheckCircle2} href="/completed" />
      </div>

      <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Your memos by status</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {[...myStatusCounts.entries()].map(([status, count]) => (
              <div key={status} className="flex items-center gap-3 text-sm">
                <span className="w-32 shrink-0 truncate text-muted-foreground">
                  {STATUS_LABELS[status] ?? status}
                </span>
                <div className="h-2.5 flex-1 rounded-full bg-secondary">
                  <div
                    className="h-2.5 rounded-full bg-primary"
                    style={{ width: `${(count / maxStatusCount) * 100}%` }}
                  />
                </div>
                <span className="w-6 shrink-0 text-right font-medium">{count}</span>
              </div>
            ))}
            {myStatusCounts.size === 0 && <p className="text-sm text-muted-foreground">No memos yet.</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent activity</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col divide-y">
            {(recentNotifs ?? []).map((n) => (
              <div key={n.id} className="py-2.5 first:pt-0 last:pb-0">
                {n.memo_id ? (
                  <Link href={`/memos/${n.memo_id}`} className="text-sm hover:underline">
                    {n.message}
                  </Link>
                ) : (
                  <p className="text-sm">{n.message}</p>
                )}
                <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  {new Date(n.created_at).toLocaleString()}
                </p>
              </div>
            ))}
            {(recentNotifs ?? []).length === 0 && <p className="text-sm text-muted-foreground">Nothing yet.</p>}
          </CardContent>
        </Card>
      </div>

      {adminStats && (
        <>
          <h2 className="mb-3 text-sm font-medium text-muted-foreground">Organization</h2>
          <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Users" value={adminStats.userCount} icon={Users} href="/admin/users" />
            <StatCard label="Active users" value={adminStats.activeUserCount} icon={Users} href="/admin/users" />
            <StatCard label="Departments" value={adminStats.departmentCount} icon={Building2} href="/admin/departments" />
            <StatCard label="Total memos" value={adminStats.memoCount} icon={FileText} href="/admin/reports" />
            <StatCard label="Pending workflows" value={adminStats.pendingCount} icon={Clock} href="/admin/reports" />
            <StatCard label="Completed" value={adminStats.completedCount} icon={CheckCircle2} href="/completed" />
            <StatCard label="Rejected" value={adminStats.rejectedCount} icon={AlertTriangle} href="/admin/reports" />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recent system activity</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col divide-y">
              {adminStats.recentActivity.map((a, i) => (
                <div key={i} className="py-2.5 first:pt-0 last:pb-0">
                  <p className="text-sm">
                    <span className="font-medium capitalize">{a.event_type.replace(/_/g, " ")}</span>
                    {a.description ? ` — ${a.description}` : ""}
                  </p>
                  <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {new Date(a.created_at).toLocaleString()}
                  </p>
                </div>
              ))}
              {adminStats.recentActivity.length === 0 && (
                <p className="text-sm text-muted-foreground">Nothing yet.</p>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  tone,
  href,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  tone?: "warn";
  href: string;
}) {
  return (
    <Link href={href}>
      <Card className="transition-shadow hover:shadow-md">
        <CardContent className="flex items-start justify-between">
          <div className="min-w-0">
            <p className="truncate text-sm text-muted-foreground">{label}</p>
            <p className="mt-1 text-2xl font-semibold">{value.toLocaleString()}</p>
          </div>
          <div
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
              tone === "warn" ? "bg-rose-100 text-rose-700" : "bg-primary/10 text-primary"
            }`}
          >
            <Icon className="h-4 w-4" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
