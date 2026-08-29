"use client";

import { useActionState, useRef, useEffect } from "react";
import { createDelegation } from "./actions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

type Member = { id: string; name: string };

const selectClasses =
  "h-9 rounded-lg border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export function NewDelegationForm({ members }: { members: Member[] }) {
  const [state, formAction, pending] = useActionState(createDelegation, { error: null });
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!pending && !state.error) {
      formRef.current?.reset();
    }
  }, [pending, state.error]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">New delegation</CardTitle>
        <CardDescription>
          Any action your delegate takes will be recorded as taken by them, on your behalf —
          never attributed to just one of you.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form ref={formRef} action={formAction} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="delegate_user_id">Delegate to</Label>
              <select id="delegate_user_id" name="delegate_user_id" required className={selectClasses}>
                <option value="">Choose a person…</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="start_date">Start date</Label>
              <Input id="start_date" type="date" name="start_date" required />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="end_date">End date</Label>
              <Input id="end_date" type="date" name="end_date" required />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="reason">Reason (optional)</Label>
            <Input id="reason" type="text" name="reason" />
          </div>
          {state.error && <p className="text-sm text-destructive">{state.error}</p>}
          <Button type="submit" disabled={pending} className="self-start">
            {pending ? "Creating…" : "Create delegation"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
