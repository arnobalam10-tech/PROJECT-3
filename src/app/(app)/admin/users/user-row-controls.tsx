"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { updateUserRole, updateUserDepartment, toggleUserStatus } from "./actions";

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
    <div className="flex items-center gap-2">
      <select
        defaultValue={role}
        disabled={isSelf || pending}
        onChange={(e) =>
          startTransition(async () => {
            await updateUserRole(userId, e.target.value);
            router.refresh();
          })
        }
        className="border border-black bg-white px-2 py-1 text-xs disabled:opacity-50"
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
        className="border border-black bg-white px-2 py-1 text-xs"
      >
        <option value="">— no department —</option>
        {departments.map((d) => (
          <option key={d.id} value={d.id}>
            {d.name}
          </option>
        ))}
      </select>
      <button
        type="button"
        disabled={isSelf || pending}
        onClick={() =>
          startTransition(async () => {
            await toggleUserStatus(userId);
            router.refresh();
          })
        }
        className="border border-black px-3 py-1 text-xs font-medium uppercase tracking-wide disabled:opacity-50"
      >
        {status === "active" ? "deactivate" : "activate"}
      </button>
    </div>
  );
}
