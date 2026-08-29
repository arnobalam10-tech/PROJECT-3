import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { logQueryError } from "@/lib/log-query-error";
import { ProfileForm } from "./profile-form";

export default async function ProfilePage() {
  const profile = await requireProfile();
  const supabase = await createClient();

  const { data: department, error: departmentError } = profile.department_id
    ? await supabase.from("departments").select("name").eq("id", profile.department_id).maybeSingle()
    : { data: null, error: null };
  logQueryError("profile.department", departmentError);

  return (
    <main className="mx-auto max-w-2xl">
      <h1 className="headline mb-8 text-3xl">profile</h1>

      <div className="mb-10 grid grid-cols-1 gap-6 border-t border-ink pt-6 sm:grid-cols-2">
        <div>
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted">Email</p>
          <p>{profile.email}</p>
        </div>
        <div>
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted">Role</p>
          <p className="uppercase tracking-wide">{profile.role === "org_admin" ? "Admin" : "Regular user"}</p>
        </div>
        <div>
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted">Department</p>
          <p>{department?.name ?? "—"}</p>
        </div>
        <div>
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted">Status</p>
          <p className="uppercase tracking-wide">{profile.status}</p>
        </div>
      </div>

      <h2 className="mb-4 text-xs font-medium uppercase tracking-wide text-muted">Edit your details</h2>
      <ProfileForm name={profile.name} designation={profile.designation ?? ""} />
    </main>
  );
}
