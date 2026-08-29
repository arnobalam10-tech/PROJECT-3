"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

// A real modal confirmation (not window.confirm(), which browser automation
// tools can't interact with) for any destructive action across the app —
// delete draft, delete template, revoke delegation, etc.
export function ConfirmActionButton({
  label,
  title,
  description,
  confirmLabel = "Confirm",
  variant = "destructive",
  triggerVariant = "outline",
  triggerSize = "sm",
  onConfirm,
}: {
  label: string;
  title: string;
  description: string;
  confirmLabel?: string;
  variant?: "destructive" | "default";
  triggerVariant?: "outline" | "ghost" | "destructive";
  triggerSize?: "sm" | "default";
  onConfirm: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger
        render={<Button variant={triggerVariant} size={triggerSize} className="text-destructive hover:text-destructive" />}
      >
        {label}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant={variant === "destructive" ? "destructive" : "default"}
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                await onConfirm();
                setOpen(false);
                router.refresh();
              })
            }
          >
            {pending ? "Working…" : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
