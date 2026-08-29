"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { uploadAttachment } from "../actions";

export function AttachmentUpload({ memoId }: { memoId: string }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      ref={formRef}
      onSubmit={(e) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        setError(null);
        startTransition(async () => {
          try {
            await uploadAttachment(memoId, formData);
            formRef.current?.reset();
            router.refresh();
          } catch (err) {
            setError(err instanceof Error ? err.message : "Upload failed.");
          }
        });
      }}
      className="flex items-center gap-3"
    >
      <input type="file" name="file" required disabled={pending} className="text-sm" />
      <button
        type="submit"
        disabled={pending}
        className="border border-ink px-3 py-1.5 text-xs font-medium uppercase tracking-wide disabled:opacity-50"
      >
        {pending ? "uploading…" : "upload"}
      </button>
      {error && <span className="text-sm text-accent">{error}</span>}
    </form>
  );
}
