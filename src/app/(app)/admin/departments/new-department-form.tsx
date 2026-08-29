"use client";

import { useActionState, useRef, useEffect } from "react";
import { createDepartment } from "./actions";

export function NewDepartmentForm() {
  const [state, formAction, pending] = useActionState(createDepartment, { error: null });
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!pending && !state.error) {
      formRef.current?.reset();
    }
  }, [pending, state.error]);

  return (
    <form ref={formRef} action={formAction} className="mb-8 flex flex-wrap items-end gap-3">
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
        <span className="text-xs font-medium uppercase tracking-wide text-muted">
          Description
        </span>
        <input
          type="text"
          name="description"
          className="border border-ink px-3 py-2 outline-none focus:outline-2 focus:outline-ink"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="bg-ink px-4 py-2 font-medium text-surface disabled:opacity-50"
      >
        {pending ? "adding…" : "add department"}
      </button>
      {state.error && <p className="w-full text-sm text-accent">{state.error}</p>}
    </form>
  );
}
