import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { logQueryError } from "@/lib/log-query-error";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { PriorityBadge, initials } from "@/components/memo-badges";
import { SelectFilter } from "@/components/select-filter";

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

  const today = new Date().toISOString().slice(0, 10);
  const { data: activeDelegations, error: delegationsError } = await supabase
    .from("delegations")
    .select("delegating_user_id, delegator:profiles!delegations_delegating_user_id_fkey(name)")
    .eq("delegate_user_id", profile.id)
    .eq("status", "active")
    .lte("start_date", today)
    .gte("end_date", today);
  logQueryError("inbox.activeDelegations", delegationsError);

  const delegatorNameById = new Map<string, string>(
    (activeDelegations ?? []).map((d) => [
      d.delegating_user_id,
      (d.delegator as unknown as { name: string } | null)?.name ?? "—",
    ]),
  );
  const holderIds = [profile.id, ...delegatorNameById.keys()];

  let query = supabase
    .from("workflow_steps")
    .select(
      "id, updated_at, assigned_user_id, memos!inner(id, memo_number, subject, priority, status, submitted_at, department_id, author_id, profiles!memos_author_id_fkey(name), departments(name))",
    )
    .in("assigned_user_id", holderIds)
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
    assigned_user_id: string;
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
      <Link href={`/inbox?${qp.toString()}`} className="hover:text-foreground">
        {label}
        {sort === key ? (dir === "asc" ? " ↑" : " ↓") : ""}
      </Link>
    );
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Inbox</h1>
          <p className="mt-1 text-sm text-muted-foreground">Memos currently waiting on you.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <SelectFilter
            paramName="priority"
            placeholder="All priorities"
            options={[
              { value: "normal", label: "Normal" },
              { value: "high", label: "High" },
              { value: "urgent", label: "Urgent" },
            ]}
          />
          <SelectFilter
            paramName="department"
            placeholder="All departments"
            options={(departments ?? []).map((d) => ({ value: d.id, label: d.name }))}
          />
        </div>
      </div>

      <div className="rounded-xl border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Memo</TableHead>
                <TableHead>Sender</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>{sortLink("priority", "Priority")}</TableHead>
                <TableHead>{sortLink("submitted_at", "Submitted")}</TableHead>
                <TableHead>Required action</TableHead>
                <TableHead className="text-right">{sortLink("age", "Age")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="max-w-64">
                    <Link href={`/memos/${row.memos.id}`} className="font-medium hover:underline">
                      {row.memos.subject}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {row.memos.memo_number}
                      {row.assigned_user_id !== profile.id && (
                        <> · as delegate for {delegatorNameById.get(row.assigned_user_id) ?? "—"}</>
                      )}
                    </p>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Avatar className="h-6 w-6">
                        <AvatarFallback className="text-[10px]">
                          {initials(row.memos.profiles?.name ?? "—")}
                        </AvatarFallback>
                      </Avatar>
                      <span className="whitespace-nowrap text-sm">{row.memos.profiles?.name ?? "—"}</span>
                    </div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                    {row.memos.departments?.name ?? "—"}
                  </TableCell>
                  <TableCell><PriorityBadge priority={row.memos.priority} /></TableCell>
                  <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                    {row.memos.submitted_at ? new Date(row.memos.submitted_at).toLocaleDateString() : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge className="bg-primary/10 text-primary hover:bg-primary/10">Review &amp; decide</Badge>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-right text-sm text-muted-foreground">
                    {formatAge(row.updated_at)}
                  </TableCell>
                </TableRow>
              ))}
              {items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                    Nothing awaiting your action.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
