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
    <form ref={formRef} action={formAction} className="mb-8 flex flex-col gap-3 border border-black p-4">
      <p className="text-sm text-neutral-600">
        Designate another org member to act on your behalf for a date range. Any action they take
        while it&apos;s their turn will be recorded as acted by them on your behalf — never
        silently attributed to just one of you.
      </p>
      <div className="flex flex-wrap gap-3">
        <label className="flex flex-1 min-w-[10rem] flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">Delegate to</span>
          <select name="delegate_user_id" required className="border border-black bg-white px-3 py-2 text-sm">
            <option value="">Choose a person…</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">Start date</span>
          <input type="date" name="start_date" required className="border border-black px-3 py-2 text-sm" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">End date</span>
          <input type="date" name="end_date" required className="border border-black px-3 py-2 text-sm" />
        </label>
      </div>
      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">
          Reason (optional)
        </span>
        <input type="text" name="reason" className="border border-black px-3 py-2 text-sm" />
      </label>
      {state.error && <p className="text-sm text-red-700">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="self-start bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {pending ? "creating…" : "create delegation"}
      </button>
    </form>
  );
}
