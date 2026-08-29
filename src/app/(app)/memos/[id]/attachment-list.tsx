"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { deleteAttachment, getAttachmentSignedUrl } from "../actions";

type Attachment = {
  id: string;
  file_name: string;
  file_size: number;
  uploaded_at: string;
};

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function AttachmentList({
  memoId,
  attachments,
  editable,
}: {
  memoId: string;
  attachments: Attachment[];
  editable: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (attachments.length === 0) {
    return <p className="text-sm text-muted">No attachments.</p>;
  }

  return (
    <ul className="flex flex-col gap-2 text-sm">
      {attachments.map((a) => (
        <li key={a.id} className="flex items-center justify-between border-b border-rule py-2">
          <div>
            <span className="font-medium">{a.file_name}</span>{" "}
            <span className="text-xs text-muted">
              {formatBytes(a.file_size)} · {new Date(a.uploaded_at).toLocaleString()}
            </span>
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const url = await getAttachmentSignedUrl(a.id);
                  window.open(url, "_blank", "noopener,noreferrer");
                })
              }
              className="text-xs font-medium uppercase tracking-wide underline"
            >
              download
            </button>
            {editable && (
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    await deleteAttachment(memoId, a.id);
                    router.refresh();
                  })
                }
                className="text-xs font-medium uppercase tracking-wide text-accent underline"
              >
                remove
              </button>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
