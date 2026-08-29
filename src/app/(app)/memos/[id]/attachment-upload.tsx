"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { uploadAttachment } from "../actions";
import { Button } from "@/components/ui/button";

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
      className="flex flex-wrap items-center gap-3"
    >
      <input
        type="file"
        name="file"
        required
        disabled={pending}
        className="text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-xs file:font-medium"
      />
      <Button type="submit" variant="outline" size="sm" disabled={pending}>
        {pending ? "Uploading…" : "Upload"}
      </Button>
      {error && <span className="text-sm text-destructive">{error}</span>}
    </form>
  );
}
