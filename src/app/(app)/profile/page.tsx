import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { logQueryError } from "@/lib/log-query-error";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { initials } from "@/components/memo-badges";
import { ProfileForm } from "./profile-form";

export default async function ProfilePage() {
  const profile = await requireProfile();
  const supabase = await createClient();

  const { data: department, error: departmentError } = profile.department_id
    ? await supabase.from("departments").select("name").eq("id", profile.department_id).maybeSingle()
    : { data: null, error: null };
  logQueryError("profile.department", departmentError);

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6 flex items-center gap-4">
        <Avatar className="h-14 w-14">
          <AvatarFallback className="bg-primary text-lg font-medium text-primary-foreground">
            {initials(profile.name)}
          </AvatarFallback>
        </Avatar>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{profile.name}</h1>
          <p className="text-sm text-muted-foreground">{profile.email}</p>
        </div>
      </div>

      <Card className="mb-6">
        <CardContent className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div>
            <p className="mb-1 text-xs font-medium text-muted-foreground">Role</p>
            <Badge variant={profile.role === "org_admin" ? "default" : "secondary"}>
              {profile.role === "org_admin" ? "Admin" : "Regular user"}
            </Badge>
          </div>
          <div>
            <p className="mb-1 text-xs font-medium text-muted-foreground">Status</p>
            <Badge className="bg-lime/40 text-[#3f5200] hover:bg-lime/40">{profile.status}</Badge>
          </div>
          <div>
            <p className="mb-1 text-xs font-medium text-muted-foreground">Department</p>
            <p className="text-sm">{department?.name ?? "—"}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Edit your details</CardTitle>
          <CardDescription>Department and role are managed by your organization&apos;s admin.</CardDescription>
        </CardHeader>
        <CardContent>
          <ProfileForm name={profile.name} designation={profile.designation ?? ""} />
        </CardContent>
      </Card>
    </div>
  );
}
