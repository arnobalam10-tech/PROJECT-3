"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Paperclip, Download, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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

function AttachmentRow({
  memoId,
  attachment: a,
  editable,
}: {
  memoId: string;
  attachment: Attachment;
  editable: boolean;
}) {
  const router = useRouter();
  const [downloading, startDownload] = useTransition();
  const [deleting, startDelete] = useTransition();

  return (
    <li className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
      <div className="flex min-w-0 items-center gap-2.5">
        <Paperclip className="h-4 w-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{a.file_name}</p>
          <p className="text-xs text-muted-foreground">
            {formatBytes(a.file_size)} · {new Date(a.uploaded_at).toLocaleString()}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          disabled={downloading || deleting}
          aria-label={downloading ? `Downloading ${a.file_name}` : `Download ${a.file_name}`}
          onClick={() =>
            startDownload(async () => {
              const url = await getAttachmentSignedUrl(a.id);
              window.open(url, "_blank", "noopener,noreferrer");
            })
          }
        >
          {downloading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
        </Button>
        {editable && (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            disabled={downloading || deleting}
            aria-label={deleting ? `Removing ${a.file_name}` : `Remove ${a.file_name}`}
            onClick={() =>
              startDelete(async () => {
                await deleteAttachment(memoId, a.id);
                router.refresh();
              })
            }
          >
            {deleting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-destructive" />
            ) : (
              <X className="h-3.5 w-3.5 text-destructive" />
            )}
          </Button>
        )}
      </div>
    </li>
  );
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
  if (attachments.length === 0) {
    return <p className="text-sm text-muted-foreground">No attachments.</p>;
  }

  return (
    <ul className="flex flex-col divide-y">
      {attachments.map((a) => (
        <AttachmentRow key={a.id} memoId={memoId} attachment={a} editable={editable} />
      ))}
    </ul>
  );
}
