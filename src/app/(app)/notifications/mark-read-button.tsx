"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { markNotificationRead } from "./actions";

export function MarkReadButton({ notificationId }: { notificationId: string }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      disabled={pending}
      className="shrink-0"
      onClick={() =>
        startTransition(async () => {
          await markNotificationRead(notificationId);
          router.refresh();
        })
      }
    >
      Mark read
    </Button>
  );
}
