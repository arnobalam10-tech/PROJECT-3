"use client";

import { useActionState, useRef, useEffect, useState } from "react";
import { X } from "lucide-react";
import { createTemplate } from "./actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export function NewTemplateForm() {
  const [state, formAction, pending] = useActionState(createTemplate, { error: null });
  const formRef = useRef<HTMLFormElement>(null);
  const [positions, setPositions] = useState<string[]>([""]);

  // Reset `positions` (React state) during render when a new `state` object
  // arrives from a successful submission, rather than in an effect —
  // react-hooks flags calling a state setter synchronously inside an effect
  // body. This is React's documented "adjusting state when a prop changes"
  // pattern: compare against the previously-seen state by reference and
  // update during render itself. The imperative form.reset() (not React
  // state) stays in an effect below, where DOM side effects belong.
  const [lastHandledState, setLastHandledState] = useState(state);
  if (state !== lastHandledState) {
    setLastHandledState(state);
    if (!state.error) {
      setPositions([""]);
    }
  }

  useEffect(() => {
    if (!pending && !state.error) {
      formRef.current?.reset();
    }
  }, [pending, state.error]);

  function updatePosition(i: number, value: string) {
    setPositions((p) => p.map((v, idx) => (idx === i ? value : v)));
  }

  function addPosition() {
    setPositions((p) => [...p, ""]);
  }

  function removePosition(i: number) {
    setPositions((p) => p.filter((_, idx) => idx !== i));
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">New template</CardTitle>
      </CardHeader>
      <CardContent>
        <form ref={formRef} action={formAction} className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-3">
            <div className="flex flex-1 min-w-48 flex-col gap-2">
              <Label htmlFor="template-name">Name</Label>
              <Input id="template-name" type="text" name="name" required />
            </div>
            <div className="flex flex-1 min-w-48 flex-col gap-2">
              <Label htmlFor="template-description">Description</Label>
              <Input id="template-description" type="text" name="description" />
            </div>
          </div>

          <div>
            <Label className="mb-2 block">
              Ordered positions (e.g. &quot;Employee&quot;, &quot;Dept Head&quot;, &quot;Finance&quot;)
            </Label>
            <div className="flex flex-col gap-2">
              {positions.map((value, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="w-5 text-sm text-muted-foreground">{i + 1}.</span>
                  <Input
                    type="text"
                    name="position_label"
                    value={value}
                    onChange={(e) => updatePosition(i, e.target.value)}
                    placeholder="Position label"
                    className="flex-1"
                  />
                  {positions.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => removePosition(i)}
                      aria-label="Remove position"
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
            <Button type="button" variant="outline" size="sm" onClick={addPosition} className="mt-2">
              Add position
            </Button>
          </div>

          {state.error && <p className="text-sm text-destructive">{state.error}</p>}
          <Button type="submit" disabled={pending} className="self-start">
            {pending ? "Creating…" : "Create template"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
