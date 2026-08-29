"use client";

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { deleteTemplate } from "./actions";

export function DeleteTemplateButton({ templateId }: { templateId: string }) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="text-xs font-medium uppercase tracking-wide text-red-700 underline"
      >
        delete
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
            await deleteTemplate(templateId);
            router.refresh();
          })
        }
        className="font-medium uppercase tracking-wide text-red-700 underline disabled:opacity-50"
      >
        confirm delete
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
