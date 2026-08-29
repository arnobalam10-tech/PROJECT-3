"use client";

import { useActionState, useRef } from "react";
import { addGeneralComment } from "./workflow-actions";

export function CommentBox({ memoId }: { memoId: string }) {
  const [state, formAction, pending] = useActionState(addGeneralComment, { error: null });
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={formRef}
      action={async (fd) => {
        await formAction(fd);
        formRef.current?.reset();
      }}
      className="mt-4 flex flex-col gap-2"
    >
      <input type="hidden" name="memo_id" value={memoId} />
      <textarea
        name="body"
        placeholder="Add a comment"
        rows={2}
        className="border border-black px-3 py-2 text-sm"
      />
      {state.error && <p className="text-sm text-red-700">{state.error}</p>}
      <div>
        <button
          type="submit"
          disabled={pending}
          className="border border-black px-3 py-1.5 text-xs font-medium uppercase tracking-wide disabled:opacity-50"
        >
          {pending ? "posting…" : "post comment"}
        </button>
      </div>
    </form>
  );
}
