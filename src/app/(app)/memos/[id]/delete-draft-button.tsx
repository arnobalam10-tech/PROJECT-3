"use client";

import { useState, useTransition } from "react";
import { deleteDraft } from "../actions";

export function DeleteDraftButton({ memoId }: { memoId: string }) {
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs uppercase tracking-wide text-neutral-500">Delete this draft?</span>
        <button
          type="button"
          disabled={pending}
          onClick={() => startTransition(() => deleteDraft(memoId))}
          className="border border-red-700 px-3 py-1.5 text-xs font-medium uppercase tracking-wide text-red-700 disabled:opacity-50"
        >
          {pending ? "deleting…" : "confirm delete"}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="border border-black px-3 py-1.5 text-xs font-medium uppercase tracking-wide"
        >
          cancel
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      className="border border-black px-3 py-1.5 text-xs font-medium uppercase tracking-wide text-red-700"
    >
      delete draft
    </button>
  );
}
