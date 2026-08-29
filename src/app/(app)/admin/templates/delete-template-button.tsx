"use client";

import { ConfirmActionButton } from "@/components/confirm-action-button";
import { deleteTemplate } from "./actions";

export function DeleteTemplateButton({ templateId }: { templateId: string }) {
  return (
    <ConfirmActionButton
      label="Delete"
      title="Delete this template?"
      description="This can't be undone. Memos already built from it are unaffected."
      confirmLabel="Delete"
      onConfirm={() => deleteTemplate(templateId)}
    />
  );
}
