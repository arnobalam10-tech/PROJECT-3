"use client";

import { useActionState, useState } from "react";
import { submitMemo } from "./workflow-actions";

type Member = { id: string; name: string };

export function SubmitPanel({ memoId, members }: { memoId: string; members: Member[] }) {
  const [state, formAction, pending] = useActionState(submitMemo, { error: null });
  const [chain, setChain] = useState<Member[]>([]);
  const [pick, setPick] = useState("");

  const available = members.filter((m) => !chain.some((c) => c.id === m.id));

  function addToChain() {
    const member = available.find((m) => m.id === pick);
    if (!member) return;
    setChain((c) => [...c, member]);
    setPick("");
  }

  function removeFromChain(id: string) {
    setChain((c) => c.filter((m) => m.id !== id));
  }

  return (
    <section className="mt-10 border border-black p-4">
      <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-neutral-500">
        Submit for approval
      </h2>
      <p className="mb-4 text-sm text-neutral-600">
        Choose an ordered chain of participants. This is a starting point — whoever holds the
        memo can still forward it to someone new, reroute it, or adjust who comes next.
      </p>

      <ol className="mb-4 flex flex-col gap-2">
        {chain.map((m, i) => (
          <li key={m.id} className="flex items-center justify-between border border-black px-3 py-2 text-sm">
            <span>
              {i + 1}. {m.name}
            </span>
            <button
              type="button"
              onClick={() => removeFromChain(m.id)}
              className="text-xs font-medium uppercase tracking-wide text-red-700 underline"
            >
              remove
            </button>
          </li>
        ))}
        {chain.length === 0 && <li className="text-sm text-neutral-500">No participants added yet.</li>}
      </ol>

      <div className="mb-4 flex gap-2">
        <select
          value={pick}
          onChange={(e) => setPick(e.target.value)}
          className="flex-1 border border-black bg-white px-3 py-2 text-sm"
        >
          <option value="">Add a participant…</option>
          {available.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={addToChain}
          disabled={!pick}
          className="border border-black px-3 py-2 text-sm font-medium disabled:opacity-50"
        >
          add
        </button>
      </div>

      <form action={formAction}>
        <input type="hidden" name="memo_id" value={memoId} />
        {chain.map((m) => (
          <input key={m.id} type="hidden" name="participant_id" value={m.id} />
        ))}
        {state.error && <p className="mb-3 text-sm text-red-700">{state.error}</p>}
        <button
          type="submit"
          disabled={pending || chain.length === 0}
          className="bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {pending ? "submitting…" : "submit memo"}
        </button>
      </form>
    </section>
  );
}
