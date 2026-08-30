"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { updateUserRole, updateUserDepartment, toggleUserStatus } from "./actions";
import { Button } from "@/components/ui/button";

const selectClasses =
  "h-8 rounded-lg border border-input bg-transparent px-2 text-xs shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50";

type Props = {
  userId: string;
  role: string;
  status: string;
  departmentId: string | null;
  departments: { id: string; name: string }[];
  isSelf: boolean;
};

export function UserRowControls({ userId, role, status, departmentId, departments, isSelf }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        defaultValue={role}
        disabled={isSelf || pending}
        onChange={(e) =>
          startTransition(async () => {
            await updateUserRole(userId, e.target.value);
            router.refresh();
          })
        }
        className={selectClasses}
      >
        <option value="regular_user">Regular user</option>
        <option value="org_admin">Org admin</option>
      </select>
      <select
        defaultValue={departmentId ?? ""}
        disabled={pending}
        onChange={(e) =>
          startTransition(async () => {
            await updateUserDepartment(userId, e.target.value);
            router.refresh();
          })
        }
        className={selectClasses}
      >
        <option value="">— no department —</option>
        {departments.map((d) => (
          <option key={d.id} value={d.id}>{d.name}</option>
        ))}
      </select>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={isSelf || pending}
        onClick={() =>
          startTransition(async () => {
            await toggleUserStatus(userId);
            router.refresh();
          })
        }
      >
        {pending ? "Working…" : status === "active" ? "Deactivate" : "Activate"}
      </Button>
    </div>
  );
}
