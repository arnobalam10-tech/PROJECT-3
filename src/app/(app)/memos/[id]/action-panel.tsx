"use client";

import { useActionState, useState } from "react";
import { approveMemo, declineMemo, rejectMemo, requestChangesMemo } from "./workflow-actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

type Member = { id: string; name: string };
type Mode = "approve" | "decline" | "reject" | "changes" | null;

const selectClasses =
  "h-9 rounded-lg border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export function ActionPanel({
  memoId,
  members,
  actingOnBehalfOf,
}: {
  memoId: string;
  members: Member[];
  actingOnBehalfOf?: string | null;
}) {
  const [mode, setMode] = useState<Mode>(null);

  return (
    <Card className="border-primary/30 bg-primary/[0.03]">
      <CardHeader>
        <CardTitle className="text-base">This memo requires your action</CardTitle>
      </CardHeader>
      <CardContent>
        {actingOnBehalfOf && (
          <p className="mb-4 rounded-lg bg-accent px-3 py-2 text-sm text-accent-foreground">
            You are acting as an active delegate for <strong>{actingOnBehalfOf}</strong>. This
            action will be recorded as taken by you on their behalf.
          </p>
        )}

        {mode === null && (
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setMode("approve")}>Approve</Button>
            <Button variant="outline" onClick={() => setMode("decline")}>
              Decline &amp; reroute
            </Button>
            <Button variant="outline" onClick={() => setMode("changes")}>
              Request changes
            </Button>
            <Button variant="destructive" onClick={() => setMode("reject")}>
              Reject
            </Button>
          </div>
        )}

        {mode === "approve" && <ApproveForm memoId={memoId} members={members} onCancel={() => setMode(null)} />}
        {mode === "decline" && <DeclineForm memoId={memoId} members={members} onCancel={() => setMode(null)} />}
        {mode === "reject" && <RejectForm memoId={memoId} onCancel={() => setMode(null)} />}
        {mode === "changes" && <ChangesForm memoId={memoId} onCancel={() => setMode(null)} />}
      </CardContent>
    </Card>
  );
}

function ApproveForm({ memoId, members, onCancel }: { memoId: string; members: Member[]; onCancel: () => void }) {
  const [state, formAction, pending] = useActionState(approveMemo, { error: null });
  const [forwardMode, setForwardMode] = useState<"next" | "new">("next");

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="memo_id" value={memoId} />
      <fieldset className="flex flex-col gap-2.5">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            checked={forwardMode === "next"}
            onChange={() => setForwardMode("next")}
            className="accent-primary"
          />
          Forward to the next person in the original chain (or complete it, if no one&apos;s left)
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            checked={forwardMode === "new"}
            onChange={() => setForwardMode("new")}
            className="accent-primary"
          />
          Forward to someone new, outside the original chain
        </label>
        {forwardMode === "new" && (
          <select name="forward_to_user_id" required className={selectClasses}>
            <option value="">Choose a person…</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        )}
      </fieldset>
      <div className="flex flex-col gap-2">
        <Label htmlFor="approve-comment">Comment (optional)</Label>
        <Textarea id="approve-comment" name="comment" rows={3} />
      </div>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Approving…" : "Confirm approve"}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  );
}

function DeclineForm({ memoId, members, onCancel }: { memoId: string; members: Member[]; onCancel: () => void }) {
  const [state, formAction, pending] = useActionState(declineMemo, { error: null });

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="memo_id" value={memoId} />
      <div className="flex flex-col gap-2">
        <Label htmlFor="new_holder_id">Reroute to</Label>
        <select id="new_holder_id" name="new_holder_id" required className={selectClasses}>
          <option value="">Choose a person…</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="decline-comment">Note (optional)</Label>
        <Textarea id="decline-comment" name="comment" rows={3} placeholder="E.g. why this isn't yours to review" />
      </div>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Rerouting…" : "Confirm decline & reroute"}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  );
}

function RejectForm({ memoId, onCancel }: { memoId: string; onCancel: () => void }) {
  const [state, formAction, pending] = useActionState(rejectMemo, { error: null });

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="memo_id" value={memoId} />
      <div className="flex flex-col gap-2">
        <Label htmlFor="reject-reason">Reason (required)</Label>
        <Textarea id="reject-reason" name="reason" required rows={3} />
      </div>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      <div className="flex gap-2">
        <Button type="submit" variant="destructive" disabled={pending}>
          {pending ? "Rejecting…" : "Confirm reject"}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  );
}

function ChangesForm({ memoId, onCancel }: { memoId: string; onCancel: () => void }) {
  const [state, formAction, pending] = useActionState(requestChangesMemo, { error: null });

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="memo_id" value={memoId} />
      <div className="flex flex-col gap-2">
        <Label htmlFor="changes-explanation">Explanation (required)</Label>
        <Textarea id="changes-explanation" name="explanation" required rows={3} />
      </div>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Sending…" : "Confirm request changes"}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  );
}
