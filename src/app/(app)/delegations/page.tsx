import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { logQueryError } from "@/lib/log-query-error";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { NewDelegationForm } from "./new-delegation-form";
import { RevokeDelegationButton } from "./revoke-delegation-button";

type Delegation = {
  id: string;
  delegating_user_id: string;
  delegate_user_id: string;
  start_date: string;
  end_date: string;
  reason: string | null;
  status: "active" | "expired" | "revoked";
  created_at: string;
  delegator: { name: string } | null;
  delegate: { name: string } | null;
};

// The stored `status` column only ever holds 'active' or 'revoked' (see
// migration 022/DATABASE.md) — 'expired' is computed here at read time from
// end_date, not trusted from the column, since nothing ever writes it.
function effectiveStatus(d: { status: string; end_date: string }): "active" | "expired" | "revoked" {
  if (d.status === "revoked") return "revoked";
  const today = new Date().toISOString().slice(0, 10);
  if (d.end_date < today) return "expired";
  return "active";
}

export default async function DelegationsPage() {
  const profile = await requireProfile();
  const supabase = await createClient();

  const { data: members, error: membersError } = await supabase
    .from("profiles")
    .select("id, name")
    .eq("organization_id", profile.organization_id)
    .eq("status", "active")
    .neq("id", profile.id)
    .order("name");
  logQueryError("delegations.members", membersError);

  const { data: rows, error: rowsError } = await supabase
    .from("delegations")
    .select(
      "id, delegating_user_id, delegate_user_id, start_date, end_date, reason, status, created_at, delegator:profiles!delegations_delegating_user_id_fkey(name), delegate:profiles!delegations_delegate_user_id_fkey(name)",
    )
    .or(`delegating_user_id.eq.${profile.id},delegate_user_id.eq.${profile.id}`)
    .order("created_at", { ascending: false });
  logQueryError("delegations.own", rowsError);

  const items = (rows ?? []) as unknown as Delegation[];
  const given = items.filter((d) => d.delegating_user_id === profile.id);
  const received = items.filter((d) => d.delegate_user_id === profile.id);

  function StatusPill({ d }: { d: Delegation }) {
    const s = effectiveStatus(d);
    if (s === "active") return <Badge className="bg-lime/40 text-[#3f5200] hover:bg-lime/40">Active</Badge>;
    if (s === "expired") return <Badge variant="secondary">Expired</Badge>;
    return <Badge variant="secondary">Revoked</Badge>;
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Delegations</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Let someone act on your behalf for a date range — every action they take is recorded as
          theirs, on your behalf.
        </p>
      </div>

      <div className="mb-8">
        <NewDelegationForm members={members ?? []} />
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Delegations I&apos;ve given</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col divide-y">
          {given.map((d) => (
            <div key={d.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
              <div className="min-w-0">
                <p className="text-sm">
                  To <span className="font-medium">{d.delegate?.name ?? "—"}</span> · {d.start_date} to{" "}
                  {d.end_date}
                </p>
                {d.reason && <p className="text-xs text-muted-foreground">{d.reason}</p>}
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <StatusPill d={d} />
                {effectiveStatus(d) === "active" && <RevokeDelegationButton delegationId={d.id} />}
              </div>
            </div>
          ))}
          {given.length === 0 && <p className="py-3 text-sm text-muted-foreground">None yet.</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Delegated to me</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col divide-y">
          {received.map((d) => (
            <div key={d.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
              <div className="min-w-0">
                <p className="text-sm">
                  From <span className="font-medium">{d.delegator?.name ?? "—"}</span> · {d.start_date} to{" "}
                  {d.end_date}
                </p>
                {d.reason && <p className="text-xs text-muted-foreground">{d.reason}</p>}
              </div>
              <StatusPill d={d} />
            </div>
          ))}
          {received.length === 0 && <p className="py-3 text-sm text-muted-foreground">None yet.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
