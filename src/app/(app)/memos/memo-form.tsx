"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { RichTextEditor } from "@/components/rich-text-editor";
import { createDraft, updateDraft, type MemoFormState } from "./actions";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

type Option = { id: string; name: string };

const selectClasses =
  "h-9 rounded-lg border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

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
    <Card className="mb-6">
      <CardContent>
        <form
          action={formAction}
          onSubmit={() => {
            if (mode === "edit") {
              setTimeout(() => router.refresh(), 300);
            }
          }}
          className="flex flex-col gap-4"
        >
          <input type="hidden" name="body" value={JSON.stringify(body)} />

          <div className="flex flex-col gap-2">
            <Label htmlFor="subject">Subject</Label>
            <Input id="subject" type="text" name="subject" required defaultValue={memo?.subject} />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="department_id">Department</Label>
              <select id="department_id" name="department_id" defaultValue={memo?.department_id ?? ""} className={selectClasses}>
                <option value="">—</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="category_id">Category</Label>
              <select id="category_id" name="category_id" defaultValue={memo?.category_id ?? ""} className={selectClasses}>
                <option value="">—</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="priority">Priority</Label>
              <select id="priority" name="priority" defaultValue={memo?.priority ?? "normal"} className={selectClasses}>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label>Body</Label>
            <RichTextEditor content={body} onChange={setBody} />
          </div>

          {state.error && <p className="text-sm text-destructive">{state.error}</p>}

          <div>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : mode === "create" ? "Create draft" : "Save draft"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
