"use client";

import { useActionState } from "react";
import { updateProfile } from "./actions";

export function ProfileForm({ name, designation }: { name: string; designation: string }) {
  const [state, formAction, pending] = useActionState(updateProfile, { error: null });

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium uppercase tracking-wide text-muted">Name</span>
        <input
          type="text"
          name="name"
          defaultValue={name}
          required
          className="border border-ink bg-surface px-3 py-2 outline-none focus:outline-2 focus:outline-ink"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium uppercase tracking-wide text-muted">Designation</span>
        <input
          type="text"
          name="designation"
          defaultValue={designation}
          className="border border-ink bg-surface px-3 py-2 outline-none focus:outline-2 focus:outline-ink"
        />
      </label>
      {state.error && <p className="text-sm text-accent">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="mt-2 self-start bg-ink px-4 py-2 text-sm font-medium uppercase tracking-wide text-surface disabled:opacity-50"
      >
        {pending ? "saving…" : "save changes"}
      </button>
    </form>
  );
}
