import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logout } from "./actions";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("name, role, status, organizations(name)")
    .eq("id", user.id)
    .maybeSingle();

  const orgName = (profile?.organizations as unknown as { name: string } | null)?.name;

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <div className="mb-8 flex items-center justify-between border-b-[3px] border-black pb-4">
        <h1 className="text-3xl font-bold lowercase tracking-tight">dashboard</h1>
        <form action={logout}>
          <button
            type="submit"
            className="border border-black px-3 py-1.5 text-xs font-medium uppercase tracking-wide"
          >
            sign out
          </button>
        </form>
      </div>

      {profile ? (
        <dl className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="uppercase tracking-wide text-neutral-500">Name</dt>
            <dd className="mt-1">{profile.name}</dd>
          </div>
          <div>
            <dt className="uppercase tracking-wide text-neutral-500">Organization</dt>
            <dd className="mt-1">{orgName ?? "—"}</dd>
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
      ) : (
        <p className="text-sm text-neutral-600">
          Your account has no profile yet. If you just signed up, confirm your email to finish
          setting up your organization.
        </p>
      )}
    </main>
  );
}
