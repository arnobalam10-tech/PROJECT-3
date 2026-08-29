"use client";

import { useActionState, useRef, useEffect, useState } from "react";
import { createTemplate } from "./actions";

export function NewTemplateForm() {
  const [state, formAction, pending] = useActionState(createTemplate, { error: null });
  const formRef = useRef<HTMLFormElement>(null);
  const [positions, setPositions] = useState<string[]>([""]);

  // Reset `positions` (React state) during render when a new `state` object
  // arrives from a successful submission, rather than in an effect —
  // react-hooks flags calling a state setter synchronously inside an effect
  // body (see git history for the lint error this replaced). This is React's
  // documented "adjusting state when a prop changes" pattern: compare
  // against the previously-seen state by reference and update during render
  // itself. The imperative form.reset() (not React state) stays in an
  // effect below, where DOM side effects belong.
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
    <form ref={formRef} action={formAction} className="mb-8 flex flex-col gap-3 border border-black p-4">
      <div className="flex flex-wrap gap-3">
        <label className="flex flex-1 min-w-[12rem] flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">Name</span>
          <input type="text" name="name" required className="border border-black px-3 py-2" />
        </label>
        <label className="flex flex-1 min-w-[12rem] flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">
            Description
          </span>
          <input type="text" name="description" className="border border-black px-3 py-2" />
        </label>
      </div>

      <div>
        <span className="mb-2 block text-xs font-medium uppercase tracking-wide text-neutral-500">
          Ordered positions (e.g. &quot;Employee&quot;, &quot;Dept Head&quot;, &quot;Finance&quot;)
        </span>
        <div className="flex flex-col gap-2">
          {positions.map((value, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="w-5 text-sm text-neutral-500">{i + 1}.</span>
              <input
                type="text"
                name="position_label"
                value={value}
                onChange={(e) => updatePosition(i, e.target.value)}
                placeholder="Position label"
                className="flex-1 border border-black px-3 py-2 text-sm"
              />
              {positions.length > 1 && (
                <button
                  type="button"
                  onClick={() => removePosition(i)}
                  className="text-xs font-medium uppercase tracking-wide text-red-700 underline"
                >
                  remove
                </button>
              )}
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={addPosition}
          className="mt-2 border border-black px-3 py-1.5 text-xs font-medium uppercase tracking-wide"
        >
          add position
        </button>
      </div>

      {state.error && <p className="text-sm text-red-700">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="self-start bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {pending ? "creating…" : "create template"}
      </button>
    </form>
  );
}
