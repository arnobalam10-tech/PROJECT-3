"use client";

import { useFormStatus } from "react-dom";
import { Button, buttonVariants } from "@/components/ui/button";
import type { VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";

// For a <form action={serverAction}> rendered straight from a Server
// Component, with no useActionState involved -- useFormStatus reads the
// nearest ancestor <form>'s pending state via context, so this only needs
// to be a client component itself, not the form around it.
export function SubmitButton({
  children,
  pendingText,
  ...props
}: ComponentProps<"button"> & VariantProps<typeof buttonVariants> & { pendingText?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || props.disabled} {...props}>
      {pending ? (pendingText ?? "Working…") : children}
    </Button>
  );
}
