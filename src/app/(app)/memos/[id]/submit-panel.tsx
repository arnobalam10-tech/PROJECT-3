"use client";

import { useActionState, useState } from "react";
import { X } from "lucide-react";
import { submitMemo } from "./workflow-actions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { initials } from "@/components/memo-badges";

type Member = { id: string; name: string };
type TemplatePosition = { id: string; position_order: number; position_label: string };
type Template = { id: string; name: string; positions: TemplatePosition[] };

const selectClasses =
  "h-9 rounded-lg border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

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
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Submit for approval</CardTitle>
        <CardDescription>
          Choose an ordered chain of participants. This is a starting point — whoever holds the
          memo can still forward it to someone new, reroute it, or adjust who comes next.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {templates.length > 0 && (
          <div className="rounded-lg border bg-muted/40 p-3">
            <p className="mb-2 text-xs font-medium text-muted-foreground">
              Start from a template — optional, replaces the chain below once applied
            </p>
            <select
              value={templateId}
              onChange={(e) => pickTemplate(e.target.value)}
              className={`mb-2 w-full ${selectClasses}`}
            >
              <option value="">Choose a template…</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            {selectedTemplate && (
              <div className="flex flex-col gap-2">
                {selectedTemplate.positions.map((p) => (
                  <label key={p.id} className="flex items-center gap-2 text-sm">
                    <span className="w-32 shrink-0 text-xs text-muted-foreground">{p.position_label}</span>
                    <select
                      value={templateAssignments[p.id] ?? ""}
                      onChange={(e) => setTemplateAssignments((a) => ({ ...a, [p.id]: e.target.value }))}
                      className={`flex-1 ${selectClasses}`}
                    >
                      <option value="">Assign a person…</option>
                      {members.map((m) => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                      ))}
                    </select>
                  </label>
                ))}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={applyTemplate}
                  disabled={!allPositionsAssigned}
                  className="mt-1 self-start"
                >
                  Apply template
                </Button>
              </div>
            )}
          </div>
        )}

        <ol className="flex flex-col gap-2">
          {chain.map((m, i) => (
            <li key={m.id} className="flex items-center justify-between gap-2 rounded-lg border bg-muted/30 px-3 py-2 text-sm">
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="text-xs font-medium text-muted-foreground">{i + 1}.</span>
                <Avatar className="h-6 w-6 shrink-0">
                  <AvatarFallback className="text-[10px]">{initials(m.name)}</AvatarFallback>
                </Avatar>
                <span className="truncate">{m.name}</span>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => removeFromChain(m.id)}
                aria-label={`Remove ${m.name}`}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </li>
          ))}
          {chain.length === 0 && <li className="text-sm text-muted-foreground">No participants added yet.</li>}
        </ol>

        <div className="flex gap-2">
          <select
            value={pick}
            onChange={(e) => setPick(e.target.value)}
            className={`flex-1 ${selectClasses}`}
          >
            <option value="">Add a participant…</option>
            {available.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
          <Button type="button" variant="outline" onClick={addToChain} disabled={!pick}>
            Add
          </Button>
        </div>

        <form action={formAction}>
          <input type="hidden" name="memo_id" value={memoId} />
          {usedTemplateId && <input type="hidden" name="workflow_template_id" value={usedTemplateId} />}
          {chain.map((m) => (
            <input key={m.id} type="hidden" name="participant_id" value={m.id} />
          ))}
          {state.error && <p className="mb-3 text-sm text-destructive">{state.error}</p>}
          <Button type="submit" disabled={pending || chain.length === 0}>
            {pending ? "Submitting…" : "Submit memo"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
