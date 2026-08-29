import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { logQueryError } from "@/lib/log-query-error";
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

  const items = ((rows ?? []) as unknown as Delegation[]);
  const given = items.filter((d) => d.delegating_user_id === profile.id);
  const received = items.filter((d) => d.delegate_user_id === profile.id);

  function statusBadge(d: Delegation) {
    const s = effectiveStatus(d);
    const color = s === "active" ? "text-black" : s === "expired" ? "text-neutral-500" : "text-red-700";
    return <span className={`text-xs font-medium uppercase tracking-wide ${color}`}>{s}</span>;
  }

  return (
    <main className="mx-auto max-w-3xl">
      <h1 className="mb-8 text-3xl font-bold lowercase tracking-tight">delegations</h1>
      <NewDelegationForm members={members ?? []} />

      <section className="mb-10">
        <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-neutral-500">
          Delegations I&apos;ve given
        </h2>
        <ul className="flex flex-col gap-2">
          {given.map((d) => (
            <li key={d.id} className="flex items-center justify-between border border-black px-3 py-2 text-sm">
              <div>
                <p>
                  To <span className="font-medium">{d.delegate?.name ?? "—"}</span> ·{" "}
                  {d.start_date} to {d.end_date}
                </p>
                {d.reason && <p className="text-xs text-neutral-500">{d.reason}</p>}
              </div>
              <div className="flex items-center gap-3">
                {statusBadge(d)}
                {effectiveStatus(d) === "active" && <RevokeDelegationButton delegationId={d.id} />}
              </div>
            </li>
          ))}
          {given.length === 0 && <li className="py-3 text-sm text-neutral-500">None yet.</li>}
        </ul>
      </section>

      <section>
        <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-neutral-500">
          Delegated to me
        </h2>
        <ul className="flex flex-col gap-2">
          {received.map((d) => (
            <li key={d.id} className="flex items-center justify-between border border-black px-3 py-2 text-sm">
              <div>
                <p>
                  From <span className="font-medium">{d.delegator?.name ?? "—"}</span> ·{" "}
                  {d.start_date} to {d.end_date}
                </p>
                {d.reason && <p className="text-xs text-neutral-500">{d.reason}</p>}
              </div>
              {statusBadge(d)}
            </li>
          ))}
          {received.length === 0 && <li className="py-3 text-sm text-neutral-500">None yet.</li>}
        </ul>
      </section>
    </main>
  );
}
