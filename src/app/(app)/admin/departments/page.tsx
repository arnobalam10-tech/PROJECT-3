import { requireOrgAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { NewDepartmentForm } from "./new-department-form";
import { toggleDepartmentStatus } from "./actions";

export default async function DepartmentsPage() {
  const admin = await requireOrgAdmin();
  const supabase = await createClient();

  const { data: departments } = await supabase
    .from("departments")
    .select("id, name, description, status")
    .eq("organization_id", admin.organization_id)
    .order("name");

  return (
    <main className="mx-auto max-w-3xl">
      <h1 className="mb-8 text-3xl font-bold lowercase tracking-tight">departments</h1>
      <NewDepartmentForm />
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-black text-left text-xs uppercase tracking-wide text-neutral-500">
            <th className="py-2">Name</th>
            <th className="py-2">Description</th>
            <th className="py-2">Status</th>
            <th className="py-2"></th>
          </tr>
        </thead>
        <tbody>
          {(departments ?? []).map((d) => (
            <tr key={d.id} className="border-b border-neutral-300">
              <td className="py-3 font-medium">{d.name}</td>
              <td className="py-3 text-neutral-600">{d.description ?? "—"}</td>
              <td className="py-3">
                <span
                  className={`text-xs font-medium uppercase tracking-wide ${
                    d.status === "active" ? "text-black" : "text-neutral-500"
                  }`}
                >
                  {d.status}
                </span>
              </td>
              <td className="py-3 text-right">
                <form action={toggleDepartmentStatus.bind(null, d.id)}>
                  <button
                    type="submit"
                    className="border border-black px-3 py-1 text-xs font-medium uppercase tracking-wide"
                  >
                    {d.status === "active" ? "deactivate" : "activate"}
                  </button>
                </form>
              </td>
            </tr>
          ))}
          {(departments ?? []).length === 0 && (
            <tr>
              <td colSpan={4} className="py-6 text-center text-neutral-500">
                No departments yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </main>
  );
}
