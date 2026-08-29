"use client";

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { revokeDelegation } from "./actions";

export function RevokeDelegationButton({ delegationId }: { delegationId: string }) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="text-xs font-medium uppercase tracking-wide text-accent underline"
      >
        revoke
      </button>
    );
  }

  return (
    <span className="flex items-center gap-2 text-xs">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            await revokeDelegation(delegationId);
            router.refresh();
          })
        }
        className="font-medium uppercase tracking-wide text-accent underline disabled:opacity-50"
      >
        confirm revoke
      </button>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        className="font-medium uppercase tracking-wide underline"
      >
        cancel
      </button>
    </span>
  );
}
