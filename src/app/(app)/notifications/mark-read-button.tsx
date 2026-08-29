"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { markNotificationRead } from "./actions";

export function MarkReadButton({ notificationId }: { notificationId: string }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await markNotificationRead(notificationId);
          router.refresh();
        })
      }
      className="text-xs font-medium uppercase tracking-wide underline disabled:opacity-50"
    >
      mark read
    </button>
  );
}
