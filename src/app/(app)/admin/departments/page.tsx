import { requireOrgAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { logQueryError } from "@/lib/log-query-error";
import { NewDepartmentForm } from "./new-department-form";
import { toggleDepartmentStatus } from "./actions";

export default async function DepartmentsPage() {
  const admin = await requireOrgAdmin();
  const supabase = await createClient();

  const { data: departments, error: departmentsError } = await supabase
    .from("departments")
    .select("id, name, description, status")
    .eq("organization_id", admin.organization_id)
    .order("name");
  logQueryError("admin.departments", departmentsError);

  return (
    <main className="mx-auto max-w-3xl">
      <h1 className="mb-8 text-3xl headline">departments</h1>
      <NewDepartmentForm />
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-ink text-left text-xs uppercase tracking-wide text-muted">
            <th className="py-2">Name</th>
            <th className="py-2">Description</th>
            <th className="py-2">Status</th>
            <th className="py-2"></th>
          </tr>
        </thead>
        <tbody>
          {(departments ?? []).map((d) => (
            <tr key={d.id} className="border-b border-rule">
              <td className="py-3 font-medium">{d.name}</td>
              <td className="py-3 text-body">{d.description ?? "—"}</td>
              <td className="py-3">
                <span
                  className={`text-xs font-medium uppercase tracking-wide ${
                    d.status === "active" ? "text-ink" : "text-muted"
                  }`}
                >
                  {d.status}
                </span>
              </td>
              <td className="py-3 text-right">
                <form action={toggleDepartmentStatus.bind(null, d.id)}>
                  <button
                    type="submit"
                    className="border border-ink px-3 py-1 text-xs font-medium uppercase tracking-wide"
                  >
                    {d.status === "active" ? "deactivate" : "activate"}
                  </button>
                </form>
              </td>
            </tr>
          ))}
          {(departments ?? []).length === 0 && (
            <tr>
              <td colSpan={4} className="py-6 text-center text-muted">
                No departments yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </main>
  );
}
