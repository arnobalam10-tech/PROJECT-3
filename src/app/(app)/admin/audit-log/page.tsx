import { requireOrgAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { logQueryError } from "@/lib/log-query-error";

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
    <main className="mx-auto max-w-5xl">
      <h1 className="mb-2 text-3xl font-bold lowercase tracking-tight">audit log</h1>
      <p className="mb-8 text-sm text-neutral-600">
        System-wide, append-only record (PRD §21). Nothing here can be edited or deleted through
        the app — by any role, including admins — see the security review notes in{" "}
        <code>STATUS.md</code> for how that was verified.
      </p>

      <form className="mb-6 flex flex-wrap gap-3 text-sm" action="/admin/audit-log">
        <select name="event_type" defaultValue={params.event_type ?? ""} className="border border-black bg-white px-3 py-2">
          <option value="">All event types</option>
          {Object.entries(EVENT_TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <select name="user" defaultValue={params.user ?? ""} className="border border-black bg-white px-3 py-2">
          <option value="">All users</option>
          {(members ?? []).map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
        <input type="date" name="from" defaultValue={params.from} className="border border-black px-3 py-2" />
        <input type="date" name="to" defaultValue={params.to} className="border border-black px-3 py-2" />
        <button type="submit" className="border border-black px-3 py-2 font-medium">
          filter
        </button>
      </form>

      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-black text-left text-xs uppercase tracking-wide text-neutral-500">
            <th className="py-2">When</th>
            <th className="py-2">Event</th>
            <th className="py-2">User</th>
            <th className="py-2">Description</th>
          </tr>
        </thead>
        <tbody>
          {items.map((row) => (
            <tr key={row.id} className="border-b border-neutral-300">
              <td className="py-3 text-neutral-600">{new Date(row.created_at).toLocaleString()}</td>
              <td className="py-3 text-xs font-medium uppercase tracking-wide">
                {EVENT_TYPE_LABELS[row.event_type] ?? row.event_type}
              </td>
              <td className="py-3">
                {row.user?.name ?? "—"}
                {row.on_behalf_of && (
                  <span className="ml-1 text-xs text-neutral-500">
                    (on behalf of {row.on_behalf_of.name})
                  </span>
                )}
              </td>
              <td className="py-3 text-neutral-600">{row.description ?? "—"}</td>
            </tr>
          ))}
          {items.length === 0 && (
            <tr>
              <td colSpan={4} className="py-6 text-center text-neutral-500">
                No matching events.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      {items.length === 200 && (
        <p className="mt-3 text-xs text-neutral-500">
          Showing the most recent 200 matching events — narrow the filters above to see more.
        </p>
      )}
    </main>
  );
}
