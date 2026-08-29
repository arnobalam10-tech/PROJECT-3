import { requireOrgAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { logQueryError } from "@/lib/log-query-error";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Departments</h1>
        <p className="mt-1 text-sm text-muted-foreground">Manage your organization&apos;s departments.</p>
      </div>

      <div className="mb-6">
        <NewDepartmentForm />
      </div>

      <div className="rounded-xl border bg-card shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(departments ?? []).map((d) => (
              <TableRow key={d.id}>
                <TableCell className="font-medium">{d.name}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{d.description ?? "—"}</TableCell>
                <TableCell>
                  <Badge variant={d.status === "active" ? "default" : "secondary"} className={d.status === "active" ? "bg-lime/40 text-[#3f5200] hover:bg-lime/40" : ""}>
                    {d.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <form action={toggleDepartmentStatus.bind(null, d.id)}>
                    <Button type="submit" variant="outline" size="sm">
                      {d.status === "active" ? "Deactivate" : "Activate"}
                    </Button>
                  </form>
                </TableCell>
              </TableRow>
            ))}
            {(departments ?? []).length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="py-10 text-center text-muted-foreground">
                  No departments yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
