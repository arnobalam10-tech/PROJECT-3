"use client";

import { useActionState, useRef } from "react";
import { addGeneralComment } from "./workflow-actions";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

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
      className="flex flex-col gap-2"
    >
      <input type="hidden" name="memo_id" value={memoId} />
      <Textarea name="body" placeholder="Add a comment" rows={2} />
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      <div>
        <Button type="submit" variant="outline" size="sm" disabled={pending}>
          {pending ? "Posting…" : "Post comment"}
        </Button>
      </div>
    </form>
  );
}
