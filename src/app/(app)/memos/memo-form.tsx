"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { RichTextEditor } from "@/components/rich-text-editor";
import { createDraft, updateDraft, type MemoFormState } from "./actions";

type Option = { id: string; name: string };

export function MemoForm({
  mode,
  memo,
  departments,
  categories,
}: {
  mode: "create" | "edit";
  memo?: {
    id: string;
    subject: string;
    body: Record<string, unknown>;
    department_id: string | null;
    category_id: string | null;
    priority: string;
  };
  departments: Option[];
  categories: Option[];
}) {
  const router = useRouter();
  const action = mode === "create" ? createDraft : updateDraft.bind(null, memo!.id);
  const [state, formAction, pending] = useActionState<MemoFormState, FormData>(action, {
    error: null,
    memoId: memo?.id ?? null,
  });
  const [body, setBody] = useState<Record<string, unknown>>(memo?.body ?? {});

  return (
    <form
      action={formAction}
      onSubmit={() => {
        if (mode === "edit") {
          // give the success path a moment then refresh server data
          setTimeout(() => router.refresh(), 300);
        }
      }}
      className="flex flex-col gap-4"
    >
      <input type="hidden" name="body" value={JSON.stringify(body)} />

      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">
          Subject
        </span>
        <input
          type="text"
          name="subject"
          required
          defaultValue={memo?.subject}
          className="border border-black px-3 py-2 outline-none focus:outline-2 focus:outline-black"
        />
      </label>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">
            Department
          </span>
          <select
            name="department_id"
            defaultValue={memo?.department_id ?? ""}
            className="border border-black bg-white px-3 py-2"
          >
            <option value="">—</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">
            Category
          </span>
          <select
            name="category_id"
            defaultValue={memo?.category_id ?? ""}
            className="border border-black bg-white px-3 py-2"
          >
            <option value="">—</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">
            Priority
          </span>
          <select
            name="priority"
            defaultValue={memo?.priority ?? "normal"}
            className="border border-black bg-white px-3 py-2"
          >
            <option value="normal">Normal</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
        </label>
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">Body</span>
        <RichTextEditor content={body} onChange={setBody} />
      </div>

      {state.error && <p className="text-sm text-red-700">{state.error}</p>}

      <div>
        <button
          type="submit"
          disabled={pending}
          className="bg-black px-4 py-2 font-medium text-white disabled:opacity-50"
        >
          {pending ? "saving…" : mode === "create" ? "create draft" : "save draft"}
        </button>
      </div>
    </form>
  );
}
