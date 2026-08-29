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

export default async function DashboardPage() {
  const profile = await requireProfile();
  const supabase = await createClient();

  const { data: org, error: orgError } = await supabase
    .from("organizations")
    .select("name")
    .eq("id", profile.organization_id)
    .maybeSingle();
  logQueryError("dashboard.org", orgError);

  // ---- Regular-user data (also visible to admins about themselves) ----
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

  // ---- Admin-only org-wide data ----
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

  return (
    <main className="mx-auto max-w-5xl">
      <h1 className="mb-1 text-3xl headline">dashboard</h1>
      <p className="mb-8 text-sm text-body">
        {profile.name} · {org?.name} · {profile.role === "org_admin" ? "Admin" : "User"}
      </p>

      <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-muted">Your activity</h2>
      <div className="mb-10 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatTile label="Awaiting your action" value={inboxCount} href="/inbox" />
        <StatTile label="Urgent, awaiting you" value={urgentInboxCount} accent href="/inbox?priority=urgent" />
        <StatTile label="Submitted by you" value={submittedCount} href="/memos" />
        <StatTile label="Completed (yours)" value={recentlyCompleted.length} href="/completed" />
      </div>

      <div className="mb-10 grid grid-cols-1 gap-8 sm:grid-cols-2">
        <div>
          <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-muted">
            Your memos by status
          </h2>
          <div className="flex flex-col gap-2.5 border-t-4 border-ink pt-3">
            {(() => {
              const entries = [...myStatusCounts.entries()];
              const max = Math.max(1, ...entries.map(([, c]) => c));
              return entries.map(([status, count]) => (
                <div key={status} className="flex items-center gap-3 text-sm">
                  <span className="w-32 shrink-0 truncate">{STATUS_LABELS[status] ?? status}</span>
                  <div className="h-3 flex-1 bg-rule/40">
                    <div className="h-3 bg-ink" style={{ width: `${(count / max) * 100}%` }} />
                  </div>
                  <span className="w-6 shrink-0 text-right font-medium">{count}</span>
                </div>
              ));
            })()}
            {myStatusCounts.size === 0 && <p className="text-sm text-muted">No memos yet.</p>}
          </div>
        </div>

        <div>
          <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">
            Recent activity (your notifications)
          </h2>
          <ul className="flex flex-col gap-2 text-sm">
            {(recentNotifs ?? []).map((n) => (
              <li key={n.id} className="border-b border-rule py-2">
                {n.memo_id ? (
                  <Link href={`/memos/${n.memo_id}`} className="underline">
                    {n.message}
                  </Link>
                ) : (
                  n.message
                )}
                <p className="text-xs text-muted">{new Date(n.created_at).toLocaleString()}</p>
              </li>
            ))}
            {(recentNotifs ?? []).length === 0 && <li className="text-muted">Nothing yet.</li>}
          </ul>
        </div>
      </div>

      {adminStats && (
        <>
          <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-muted">
            Organization (admin)
          </h2>
          <div className="mb-10 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatTile label="Users" value={adminStats.userCount} href="/admin/users" />
            <StatTile label="Active users" value={adminStats.activeUserCount} href="/admin/users" />
            <StatTile label="Departments" value={adminStats.departmentCount} href="/admin/departments" />
            <StatTile label="Total memos" value={adminStats.memoCount} href="/admin/reports" />
            <StatTile label="Pending workflows" value={adminStats.pendingCount} href="/admin/reports" />
            <StatTile label="Completed" value={adminStats.completedCount} href="/completed" />
            <StatTile label="Rejected" value={adminStats.rejectedCount} href="/admin/reports" />
          </div>

          <div>
            <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">
              Recent system activity
            </h2>
            <ul className="flex flex-col gap-2 text-sm">
              {adminStats.recentActivity.map((a, i) => (
                <li key={i} className="border-b border-rule py-2">
                  <span className="text-xs font-medium uppercase tracking-wide text-muted">
                    {a.event_type}
                  </span>{" "}
                  · {a.description}
                  <p className="text-xs text-muted">{new Date(a.created_at).toLocaleString()}</p>
                </li>
              ))}
              {adminStats.recentActivity.length === 0 && <li className="text-muted">Nothing yet.</li>}
            </ul>
          </div>
        </>
      )}
    </main>
  );
}

function StatTile({ label, value, accent, href }: { label: string; value: number; accent?: boolean; href: string }) {
  return (
    <Link
      href={href}
      className="group block border border-ink bg-surface p-4 transition-colors hover:bg-ink"
    >
      <p className="text-xs font-medium uppercase tracking-wide text-muted group-hover:text-surface/70">
        {label}
      </p>
      <p
        className={`mt-1 text-3xl font-bold group-hover:text-surface ${accent ? "text-accent" : ""}`}
      >
        {value.toLocaleString()}
      </p>
    </Link>
  );
}
