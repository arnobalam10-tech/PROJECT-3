"use client";

import { useActionState, useState } from "react";
import { submitMemo } from "./workflow-actions";

type Member = { id: string; name: string };
type TemplatePosition = { id: string; position_order: number; position_label: string };
type Template = { id: string; name: string; positions: TemplatePosition[] };

export function SubmitPanel({
  memoId,
  members,
  templates,
}: {
  memoId: string;
  members: Member[];
  templates: Template[];
}) {
  const [state, formAction, pending] = useActionState(submitMemo, { error: null });
  const [chain, setChain] = useState<Member[]>([]);
  const [pick, setPick] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [templateAssignments, setTemplateAssignments] = useState<Record<string, string>>({});
  // Tracks which template the current chain was built from, so the RPC can
  // record memos.workflow_template_id (PRD §18). Cleared on any manual
  // add/remove afterward — once the chain no longer matches the template
  // exactly, it's a custom chain again, not "built from this template".
  const [usedTemplateId, setUsedTemplateId] = useState<string | null>(null);

  const available = members.filter((m) => !chain.some((c) => c.id === m.id));
  const selectedTemplate = templates.find((t) => t.id === templateId) ?? null;

  function addToChain() {
    const member = available.find((m) => m.id === pick);
    if (!member) return;
    setChain((c) => [...c, member]);
    setPick("");
    setUsedTemplateId(null);
  }

  function removeFromChain(id: string) {
    setChain((c) => c.filter((m) => m.id !== id));
    setUsedTemplateId(null);
  }

  function pickTemplate(id: string) {
    setTemplateId(id);
    setTemplateAssignments({});
  }

  function applyTemplate() {
    if (!selectedTemplate) return;
    const assigned = selectedTemplate.positions
      .map((p) => templateAssignments[p.id])
      .filter(Boolean)
      .map((userId) => members.find((m) => m.id === userId))
      .filter((m): m is Member => !!m);
    setChain(assigned);
    setUsedTemplateId(selectedTemplate.id);
    setTemplateId("");
    setTemplateAssignments({});
  }

  const allPositionsAssigned =
    !!selectedTemplate && selectedTemplate.positions.every((p) => !!templateAssignments[p.id]);

  return (
    <section className="mt-10 border border-black p-4">
      <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-neutral-500">
        Submit for approval
      </h2>
      <p className="mb-4 text-sm text-neutral-600">
        Choose an ordered chain of participants. This is a starting point — whoever holds the
        memo can still forward it to someone new, reroute it, or adjust who comes next.
      </p>

      {templates.length > 0 && (
        <div className="mb-4 border border-neutral-400 p-3">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-500">
            Start from a template (PRD §18) — optional, replaces the chain below once applied
          </p>
          <select
            value={templateId}
            onChange={(e) => pickTemplate(e.target.value)}
            className="mb-2 w-full border border-black bg-white px-3 py-2 text-sm"
          >
            <option value="">Choose a template…</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          {selectedTemplate && (
            <div className="flex flex-col gap-2">
              {selectedTemplate.positions.map((p) => (
                <label key={p.id} className="flex items-center gap-2 text-sm">
                  <span className="w-32 shrink-0 text-xs uppercase tracking-wide text-neutral-500">
                    {p.position_label}
                  </span>
                  <select
                    value={templateAssignments[p.id] ?? ""}
                    onChange={(e) =>
                      setTemplateAssignments((a) => ({ ...a, [p.id]: e.target.value }))
                    }
                    className="flex-1 border border-black bg-white px-3 py-2"
                  >
                    <option value="">Assign a person…</option>
                    {members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
              <button
                type="button"
                onClick={applyTemplate}
                disabled={!allPositionsAssigned}
                className="mt-1 self-start border border-black px-3 py-1.5 text-xs font-medium uppercase tracking-wide disabled:opacity-50"
              >
                apply template
              </button>
            </div>
          )}
        </div>
      )}

      <ol className="mb-4 flex flex-col gap-2">
        {chain.map((m, i) => (
          <li key={m.id} className="flex items-center justify-between border border-black px-3 py-2 text-sm">
            <span>
              {i + 1}. {m.name}
            </span>
            <button
              type="button"
              onClick={() => removeFromChain(m.id)}
              className="text-xs font-medium uppercase tracking-wide text-red-700 underline"
            >
              remove
            </button>
          </li>
        ))}
        {chain.length === 0 && <li className="text-sm text-neutral-500">No participants added yet.</li>}
      </ol>

      <div className="mb-4 flex gap-2">
        <select
          value={pick}
          onChange={(e) => setPick(e.target.value)}
          className="flex-1 border border-black bg-white px-3 py-2 text-sm"
        >
          <option value="">Add a participant…</option>
          {available.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={addToChain}
          disabled={!pick}
          className="border border-black px-3 py-2 text-sm font-medium disabled:opacity-50"
        >
          add
        </button>
      </div>

      <form action={formAction}>
        <input type="hidden" name="memo_id" value={memoId} />
        {usedTemplateId && <input type="hidden" name="workflow_template_id" value={usedTemplateId} />}
        {chain.map((m) => (
          <input key={m.id} type="hidden" name="participant_id" value={m.id} />
        ))}
        {state.error && <p className="mb-3 text-sm text-red-700">{state.error}</p>}
        <button
          type="submit"
          disabled={pending || chain.length === 0}
          className="bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {pending ? "submitting…" : "submit memo"}
        </button>
      </form>
    </section>
  );
}
