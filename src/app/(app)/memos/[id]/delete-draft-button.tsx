"use client";

import { ConfirmActionButton } from "@/components/confirm-action-button";
import { deleteDraft } from "../actions";

export function DeleteDraftButton({ memoId }: { memoId: string }) {
  return (
    <ConfirmActionButton
      label="Delete draft"
      title="Delete this draft?"
      description="This permanently deletes the draft and any attached files. This can't be undone."
      confirmLabel="Delete"
      onConfirm={() => deleteDraft(memoId)}
    />
  );
}
