import { requireOrgAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { logQueryError } from "@/lib/log-query-error";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const EVENT_TYPE_LABELS: Record<string, string> = {
  memo_submission: "Memo submitted",
  approval: "Approved",
  decline: "Declined & rerouted",
  rejection: "Rejected",
  change_request: "Change requested",
  resubmission: "Resubmitted",
  workflow_completion: "Workflow completed",
  comment: "Comment added",
  delegation_created: "Delegation created",
  delegation_revoked: "Delegation revoked",
};

type SearchParams = { event_type?: string; user?: string; from?: string; to?: string };

type Row = {
  id: string;
  event_type: string;
  description: string | null;
  related_entity_type: string | null;
  related_entity_id: string | null;
  created_at: string;
  user: { name: string } | null;
  on_behalf_of: { name: string } | null;
};

const selectClasses =
  "h-9 rounded-lg border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const admin = await requireOrgAdmin();
  const supabase = await createClient();
  const params = await searchParams;

  const { data: members, error: membersError } = await supabase
    .from("profiles")
    .select("id, name")
    .eq("organization_id", admin.organization_id)
    .order("name");
  logQueryError("audit-log.members", membersError);

  let query = supabase
    .from("audit_log")
    .select(
      "id, event_type, description, related_entity_type, related_entity_id, created_at, user:profiles!audit_log_user_id_fkey(name), on_behalf_of:profiles!audit_log_on_behalf_of_user_id_fkey(name)",
    )
    .eq("organization_id", admin.organization_id)
    .order("created_at", { ascending: false })
    .limit(200);

  if (params.event_type) query = query.eq("event_type", params.event_type);
  if (params.user) query = query.eq("user_id", params.user);
  if (params.from) query = query.gte("created_at", params.from);
  if (params.to) query = query.lte("created_at", `${params.to}T23:59:59`);

  const { data: rows, error: rowsError } = await query;
  logQueryError("audit-log.rows", rowsError);

  const items = (rows ?? []) as unknown as Row[];

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Audit log</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          System-wide, append-only record. Nothing here can be edited or deleted through the app
          — by any role, including admins.
        </p>
      </div>

      <Card className="mb-6">
        <CardContent>
          <form className="flex flex-wrap gap-3" action="/admin/audit-log">
            <select name="event_type" defaultValue={params.event_type ?? ""} className={selectClasses}>
              <option value="">All event types</option>
              {Object.entries(EVENT_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            <select name="user" defaultValue={params.user ?? ""} className={selectClasses}>
              <option value="">All users</option>
              {(members ?? []).map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
            <Input type="date" name="from" defaultValue={params.from} className="w-40" />
            <Input type="date" name="to" defaultValue={params.to} className="w-40" />
            <Button type="submit" variant="outline">Filter</Button>
          </form>
        </CardContent>
      </Card>

      <div className="rounded-xl border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Event</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Description</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                    {new Date(row.created_at).toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{EVENT_TYPE_LABELS[row.event_type] ?? row.event_type}</Badge>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sm">
                    {row.user?.name ?? "—"}
                    {row.on_behalf_of && (
                      <span className="ml-1 text-xs text-muted-foreground">
                        (on behalf of {row.on_behalf_of.name})
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="max-w-96 text-sm text-muted-foreground">{row.description ?? "—"}</TableCell>
                </TableRow>
              ))}
              {items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="py-10 text-center text-muted-foreground">
                    No matching events.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
      {items.length === 200 && (
        <p className="mt-3 text-xs text-muted-foreground">
          Showing the most recent 200 matching events — narrow the filters above to see more.
        </p>
      )}
    </div>
  );
}
