"use client";

import { useActionState, useRef, useEffect } from "react";
import { inviteUser } from "./actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

const selectClasses =
  "h-9 rounded-lg border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export function InviteUserForm({
  departments,
}: {
  departments: { id: string; name: string }[];
}) {
  const [state, formAction, pending] = useActionState(inviteUser, {
    error: null,
    success: null,
  });
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!pending && state.success) {
      formRef.current?.reset();
    }
  }, [pending, state.success]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Invite a user</CardTitle>
      </CardHeader>
      <CardContent>
        <form ref={formRef} action={formAction} className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="invite-name">Name</Label>
            <Input id="invite-name" type="text" name="name" required className="w-40" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="invite-email">Email</Label>
            <Input id="invite-email" type="email" name="email" required className="w-52" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="invite-designation">Designation</Label>
            <Input id="invite-designation" type="text" name="designation" className="w-40" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="invite-department">Department</Label>
            <select id="invite-department" name="department_id" className={selectClasses}>
              <option value="">—</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="invite-role">Role</Label>
            <select id="invite-role" name="role" defaultValue="regular_user" className={selectClasses}>
              <option value="regular_user">Regular user</option>
              <option value="org_admin">Org admin</option>
            </select>
          </div>
          <Button type="submit" disabled={pending}>
            {pending ? "Inviting…" : "Invite user"}
          </Button>
          {state.error && <p className="w-full text-sm text-destructive">{state.error}</p>}
          {state.success && <p className="w-full text-sm text-muted-foreground">{state.success}</p>}
        </form>
      </CardContent>
    </Card>
  );
}
