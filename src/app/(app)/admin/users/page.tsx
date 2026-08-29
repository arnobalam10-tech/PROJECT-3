import { requireOrgAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { logQueryError } from "@/lib/log-query-error";
import { InviteUserForm } from "./invite-user-form";
import { UserRowControls } from "./user-row-controls";

export default async function UsersPage() {
  const admin = await requireOrgAdmin();
  const supabase = await createClient();

  const [
    { data: users, error: usersError },
    { data: departments, error: departmentsError },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, name, email, designation, role, status, department_id, departments(name)")
      .eq("organization_id", admin.organization_id)
      .order("name"),
    supabase
      .from("departments")
      .select("id, name")
      .eq("organization_id", admin.organization_id)
      .eq("status", "active")
      .order("name"),
  ]);
  logQueryError("admin.users", usersError);
  logQueryError("admin.users.departments", departmentsError);

  return (
    <main className="mx-auto max-w-5xl">
      <h1 className="mb-8 text-3xl headline">users</h1>
      <InviteUserForm departments={departments ?? []} />
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-ink text-left text-xs uppercase tracking-wide text-muted">
            <th className="py-2">Name</th>
            <th className="py-2">Email</th>
            <th className="py-2">Designation</th>
            <th className="py-2">Status</th>
            <th className="py-2">Role / Department</th>
          </tr>
        </thead>
        <tbody>
          {(users ?? []).map((u) => (
            <tr key={u.id} className="border-b border-rule align-middle">
              <td className="py-3 font-medium">{u.name}</td>
              <td className="py-3 text-body">{u.email}</td>
              <td className="py-3 text-body">{u.designation ?? "—"}</td>
              <td className="py-3">
                <span
                  className={`text-xs font-medium uppercase tracking-wide ${
                    u.status === "active" ? "text-ink" : "text-muted"
                  }`}
                >
                  {u.status}
                </span>
              </td>
              <td className="py-3">
                <UserRowControls
                  userId={u.id}
                  role={u.role}
                  status={u.status}
                  departmentId={u.department_id}
                  departments={departments ?? []}
                  isSelf={u.id === admin.id}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
