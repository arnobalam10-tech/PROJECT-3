"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { resubmitMemo } from "./workflow-actions";
import { Button } from "@/components/ui/button";

export function ResubmitButton({ memoId }: { memoId: string }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <Button
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await resubmitMemo(memoId);
          router.refresh();
        })
      }
    >
      {pending ? "Resubmitting…" : "Resubmit"}
    </Button>
  );
}
