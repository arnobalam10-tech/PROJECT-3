"use client";

import { useState } from "react";
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
      {versions.map((v) => (
        <li key={v.id} className="border border-ink">
          <button
            type="button"
            onClick={() => setOpenId(openId === v.id ? null : v.id)}
            className="flex w-full items-center justify-between px-3 py-2 text-left text-sm"
          >
            <span>
              Version {v.versionNumber} — {v.editorName} · {new Date(v.submittedAt).toLocaleString()}
            </span>
            <span className="text-xs font-medium uppercase tracking-wide underline">
              {openId === v.id ? "hide" : "view"}
            </span>
          </button>
          {openId === v.id && (
            <div className="border-t border-ink p-3">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">
                Subject at this version
              </p>
              <p className="mb-4 text-sm">{v.snapshot.subject}</p>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">
                Body at this version
              </p>
              <RichTextEditor content={v.snapshot.body} editable={false} />
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
