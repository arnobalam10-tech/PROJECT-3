"use client";

import { useActionState, useRef, useEffect } from "react";
import { createDelegation } from "./actions";

type Member = { id: string; name: string };

export function NewDelegationForm({ members }: { members: Member[] }) {
  const [state, formAction, pending] = useActionState(createDelegation, { error: null });
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!pending && !state.error) {
      formRef.current?.reset();
    }
  }, [pending, state.error]);

  return (
    <form ref={formRef} action={formAction} className="mb-8 flex flex-col gap-3 border border-ink p-4">
      <p className="text-sm text-body">
        Designate another org member to act on your behalf for a date range. Any action they take
        while it&apos;s their turn will be recorded as acted by them on your behalf — never
        silently attributed to just one of you.
      </p>
      <div className="flex flex-wrap gap-3">
        <label className="flex flex-1 min-w-[10rem] flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wide text-muted">Delegate to</span>
          <select name="delegate_user_id" required className="border border-ink bg-surface px-3 py-2 text-sm">
            <option value="">Choose a person…</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wide text-muted">Start date</span>
          <input type="date" name="start_date" required className="border border-ink px-3 py-2 text-sm" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wide text-muted">End date</span>
          <input type="date" name="end_date" required className="border border-ink px-3 py-2 text-sm" />
        </label>
      </div>
      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium uppercase tracking-wide text-muted">
          Reason (optional)
        </span>
        <input type="text" name="reason" className="border border-ink px-3 py-2 text-sm" />
      </label>
      {state.error && <p className="text-sm text-accent">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="self-start bg-ink px-4 py-2 text-sm font-medium text-surface disabled:opacity-50"
      >
        {pending ? "creating…" : "create delegation"}
      </button>
    </form>
  );
}
