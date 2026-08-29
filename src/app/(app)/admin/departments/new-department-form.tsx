"use client";

import { useActionState, useRef, useEffect } from "react";
import { createDepartment } from "./actions";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export function NewDepartmentForm() {
  const [state, formAction, pending] = useActionState(createDepartment, { error: null });
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!pending && !state.error) {
      formRef.current?.reset();
    }
  }, [pending, state.error]);

  return (
    <Card>
      <CardContent>
        <form ref={formRef} action={formAction} className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="dept-name">Name</Label>
            <Input id="dept-name" type="text" name="name" required className="w-48" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="dept-description">Description</Label>
            <Input id="dept-description" type="text" name="description" className="w-64" />
          </div>
          <Button type="submit" disabled={pending}>
            {pending ? "Adding…" : "Add department"}
          </Button>
          {state.error && <p className="w-full text-sm text-destructive">{state.error}</p>}
        </form>
      </CardContent>
    </Card>
  );
}
