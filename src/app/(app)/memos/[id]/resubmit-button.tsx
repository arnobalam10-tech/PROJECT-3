"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { resubmitMemo } from "./workflow-actions";

export function ResubmitButton({ memoId }: { memoId: string }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await resubmitMemo(memoId);
          router.refresh();
        })
      }
      className="bg-ink px-4 py-2 text-sm font-medium text-surface disabled:opacity-50"
    >
      {pending ? "resubmitting…" : "resubmit"}
    </button>
  );
}
