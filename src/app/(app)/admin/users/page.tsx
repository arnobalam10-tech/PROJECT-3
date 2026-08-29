import { requireOrgAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { logQueryError } from "@/lib/log-query-error";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { initials } from "@/components/memo-badges";
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
    <div className="mx-auto max-w-6xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
        <p className="mt-1 text-sm text-muted-foreground">Everyone in your organization.</p>
      </div>

      <div className="mb-6">
        <InviteUserForm departments={departments ?? []} />
      </div>

      <div className="rounded-xl border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Designation</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Role / Department</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(users ?? []).map((u) => (
                <TableRow key={u.id}>
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <Avatar className="h-8 w-8 shrink-0">
                        <AvatarFallback className="text-xs">{initials(u.name)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="truncate font-medium">{u.name}</p>
                        <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                    {u.designation ?? "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={u.status === "active" ? "default" : "secondary"} className={u.status === "active" ? "bg-lime/40 text-[#3f5200] hover:bg-lime/40" : ""}>
                      {u.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <UserRowControls
                      userId={u.id}
                      role={u.role}
                      status={u.status}
                      departmentId={u.department_id}
                      departments={departments ?? []}
                      isSelf={u.id === admin.id}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
