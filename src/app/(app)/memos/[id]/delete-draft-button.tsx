"use client";

import { useState, useTransition } from "react";
import { deleteDraft } from "../actions";

export function DeleteDraftButton({ memoId }: { memoId: string }) {
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs uppercase tracking-wide text-muted">Delete this draft?</span>
        <button
          type="button"
          disabled={pending}
          onClick={() => startTransition(() => deleteDraft(memoId))}
          className="border border-accent px-3 py-1.5 text-xs font-medium uppercase tracking-wide text-accent disabled:opacity-50"
        >
          {pending ? "deleting…" : "confirm delete"}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="border border-ink px-3 py-1.5 text-xs font-medium uppercase tracking-wide"
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
      className="border border-ink px-3 py-1.5 text-xs font-medium uppercase tracking-wide text-accent"
    >
      delete draft
    </button>
  );
}
