import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";

export default async function DashboardPage() {
  const profile = await requireProfile();
  const supabase = await createClient();

  const { data: org } = await supabase
    .from("organizations")
    .select("name")
    .eq("id", profile.organization_id)
    .maybeSingle();

  return (
    <main className="mx-auto max-w-3xl">
      <h1 className="mb-8 text-3xl font-bold lowercase tracking-tight">dashboard</h1>
      <dl className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <dt className="uppercase tracking-wide text-neutral-500">Name</dt>
          <dd className="mt-1">{profile.name}</dd>
        </div>
        <div>
          <dt className="uppercase tracking-wide text-neutral-500">Organization</dt>
          <dd className="mt-1">{org?.name ?? "—"}</dd>
        </div>
        <div>
          <dt className="uppercase tracking-wide text-neutral-500">Role</dt>
          <dd className="mt-1">{profile.role}</dd>
        </div>
        <div>
          <dt className="uppercase tracking-wide text-neutral-500">Status</dt>
          <dd className="mt-1">{profile.status}</dd>
        </div>
      </dl>
    </main>
  );
}
