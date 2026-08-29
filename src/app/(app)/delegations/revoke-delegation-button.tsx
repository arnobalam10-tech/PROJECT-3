"use client";

import { ConfirmActionButton } from "@/components/confirm-action-button";
import { revokeDelegation } from "./actions";

export function RevokeDelegationButton({ delegationId }: { delegationId: string }) {
  return (
    <ConfirmActionButton
      label="Revoke"
      title="Revoke this delegation?"
      description="Your delegate will immediately lose the ability to act on your behalf. This can't be undone."
      confirmLabel="Revoke"
      onConfirm={() => revokeDelegation(delegationId)}
    />
  );
}
