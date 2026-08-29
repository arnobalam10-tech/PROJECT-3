"use client";

import { useActionState, useState } from "react";
import { approveMemo, declineMemo, rejectMemo, requestChangesMemo } from "./workflow-actions";

type Member = { id: string; name: string };
type Mode = "approve" | "decline" | "reject" | "changes" | null;

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
    <section className="mt-10 border-[3px] border-ink p-4">
      <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-muted">
        This memo requires your action
      </h2>
      {actingOnBehalfOf && (
        <p className="mb-3 border border-ink bg-background px-3 py-2 text-sm">
          You are acting as an active delegate for <strong>{actingOnBehalfOf}</strong>. This
          action will be recorded as taken by you on their behalf.
        </p>
      )}

      {mode === null && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setMode("approve")}
            className="bg-ink px-4 py-2 text-sm font-medium text-surface"
          >
            approve
          </button>
          <button
            type="button"
            onClick={() => setMode("decline")}
            className="border border-ink px-4 py-2 text-sm font-medium"
          >
            decline &amp; reroute
          </button>
          <button
            type="button"
            onClick={() => setMode("changes")}
            className="border border-ink px-4 py-2 text-sm font-medium"
          >
            request changes
          </button>
          <button
            type="button"
            onClick={() => setMode("reject")}
            className="border border-ink px-4 py-2 text-sm font-medium text-accent"
          >
            reject
          </button>
        </div>
      )}

      {mode === "approve" && <ApproveForm memoId={memoId} members={members} onCancel={() => setMode(null)} />}
      {mode === "decline" && <DeclineForm memoId={memoId} members={members} onCancel={() => setMode(null)} />}
      {mode === "reject" && <RejectForm memoId={memoId} onCancel={() => setMode(null)} />}
      {mode === "changes" && <ChangesForm memoId={memoId} onCancel={() => setMode(null)} />}
    </section>
  );
}

function ApproveForm({ memoId, members, onCancel }: { memoId: string; members: Member[]; onCancel: () => void }) {
  const [state, formAction, pending] = useActionState(approveMemo, { error: null });
  const [forwardMode, setForwardMode] = useState<"next" | "new">("next");

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="memo_id" value={memoId} />
      <fieldset className="flex flex-col gap-2">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            checked={forwardMode === "next"}
            onChange={() => setForwardMode("next")}
          />
          Forward to the next person in the original chain (or complete it, if no one&apos;s left)
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            checked={forwardMode === "new"}
            onChange={() => setForwardMode("new")}
          />
          Forward to someone new, outside the original chain
        </label>
        {forwardMode === "new" && (
          <select
            name="forward_to_user_id"
            required
            className="border border-ink bg-surface px-3 py-2 text-sm"
          >
            <option value="">Choose a person…</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        )}
      </fieldset>
      <textarea
        name="comment"
        placeholder="Optional comment"
        className="border border-ink px-3 py-2 text-sm"
        rows={3}
      />
      {state.error && <p className="text-sm text-accent">{state.error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={pending} className="bg-ink px-4 py-2 text-sm font-medium text-surface disabled:opacity-50">
          {pending ? "approving…" : "confirm approve"}
        </button>
        <button type="button" onClick={onCancel} className="border border-ink px-4 py-2 text-sm font-medium">
          cancel
        </button>
      </div>
    </form>
  );
}

function DeclineForm({ memoId, members, onCancel }: { memoId: string; members: Member[]; onCancel: () => void }) {
  const [state, formAction, pending] = useActionState(declineMemo, { error: null });

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="memo_id" value={memoId} />
      <label className="flex flex-col gap-1 text-sm">
        Reroute to
        <select name="new_holder_id" required className="border border-ink bg-surface px-3 py-2">
          <option value="">Choose a person…</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </label>
      <textarea
        name="comment"
        placeholder="Optional note (e.g. why this isn't yours to review)"
        className="border border-ink px-3 py-2 text-sm"
        rows={3}
      />
      {state.error && <p className="text-sm text-accent">{state.error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={pending} className="bg-ink px-4 py-2 text-sm font-medium text-surface disabled:opacity-50">
          {pending ? "rerouting…" : "confirm decline & reroute"}
        </button>
        <button type="button" onClick={onCancel} className="border border-ink px-4 py-2 text-sm font-medium">
          cancel
        </button>
      </div>
    </form>
  );
}

function RejectForm({ memoId, onCancel }: { memoId: string; onCancel: () => void }) {
  const [state, formAction, pending] = useActionState(rejectMemo, { error: null });

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="memo_id" value={memoId} />
      <textarea
        name="reason"
        required
        placeholder="Reason (required)"
        className="border border-ink px-3 py-2 text-sm"
        rows={3}
      />
      {state.error && <p className="text-sm text-accent">{state.error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={pending} className="border border-accent px-4 py-2 text-sm font-medium text-accent disabled:opacity-50">
          {pending ? "rejecting…" : "confirm reject"}
        </button>
        <button type="button" onClick={onCancel} className="border border-ink px-4 py-2 text-sm font-medium">
          cancel
        </button>
      </div>
    </form>
  );
}

function ChangesForm({ memoId, onCancel }: { memoId: string; onCancel: () => void }) {
  const [state, formAction, pending] = useActionState(requestChangesMemo, { error: null });

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="memo_id" value={memoId} />
      <textarea
        name="explanation"
        required
        placeholder="Explanation (required)"
        className="border border-ink px-3 py-2 text-sm"
        rows={3}
      />
      {state.error && <p className="text-sm text-accent">{state.error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={pending} className="bg-ink px-4 py-2 text-sm font-medium text-surface disabled:opacity-50">
          {pending ? "sending…" : "confirm request changes"}
        </button>
        <button type="button" onClick={onCancel} className="border border-ink px-4 py-2 text-sm font-medium">
          cancel
        </button>
      </div>
    </form>
  );
}
