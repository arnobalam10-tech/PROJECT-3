"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { RichTextEditor } from "@/components/rich-text-editor";

type Version = {
  id: string;
  versionNumber: number;
  editorName: string;
  submittedAt: string;
  snapshot: { subject: string; body: Record<string, unknown> };
};

export function VersionHistory({ versions }: { versions: Version[] }) {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <ul className="flex flex-col gap-2">
      {versions.map((v) => {
        const open = openId === v.id;
        return (
          <li key={v.id} className="rounded-lg border">
            <button
              type="button"
              onClick={() => setOpenId(open ? null : v.id)}
              className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-sm"
            >
              <span className="min-w-0 truncate">
                Version {v.versionNumber} — {v.editorName} · {new Date(v.submittedAt).toLocaleString()}
              </span>
              <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
            </button>
            {open && (
              <div className="border-t p-3">
                <p className="mb-1 text-xs font-medium text-muted-foreground">Subject at this version</p>
                <p className="mb-4 text-sm">{v.snapshot.subject}</p>
                <p className="mb-1 text-xs font-medium text-muted-foreground">Body at this version</p>
                <RichTextEditor content={v.snapshot.body} editable={false} />
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
