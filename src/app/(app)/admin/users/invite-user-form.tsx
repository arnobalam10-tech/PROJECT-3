"use client";

import { useActionState, useRef, useEffect } from "react";
import { inviteUser } from "./actions";

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
    <form ref={formRef} action={formAction} className="mb-10 flex flex-wrap items-end gap-3">
      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium uppercase tracking-wide text-muted">Name</span>
        <input
          type="text"
          name="name"
          required
          className="border border-ink px-3 py-2 outline-none focus:outline-2 focus:outline-ink"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium uppercase tracking-wide text-muted">Email</span>
        <input
          type="email"
          name="email"
          required
          className="border border-ink px-3 py-2 outline-none focus:outline-2 focus:outline-ink"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium uppercase tracking-wide text-muted">
          Designation
        </span>
        <input
          type="text"
          name="designation"
          className="border border-ink px-3 py-2 outline-none focus:outline-2 focus:outline-ink"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium uppercase tracking-wide text-muted">
          Department
        </span>
        <select
          name="department_id"
          className="border border-ink bg-surface px-3 py-2 outline-none focus:outline-2 focus:outline-ink"
        >
          <option value="">—</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium uppercase tracking-wide text-muted">Role</span>
        <select
          name="role"
          defaultValue="regular_user"
          className="border border-ink bg-surface px-3 py-2 outline-none focus:outline-2 focus:outline-ink"
        >
          <option value="regular_user">Regular user</option>
          <option value="org_admin">Org admin</option>
        </select>
      </label>
      <button
        type="submit"
        disabled={pending}
        className="bg-ink px-4 py-2 font-medium text-surface disabled:opacity-50"
      >
        {pending ? "inviting…" : "invite user"}
      </button>
      {state.error && <p className="w-full text-sm text-accent">{state.error}</p>}
      {state.success && <p className="w-full text-sm text-body">{state.success}</p>}
    </form>
  );
}
