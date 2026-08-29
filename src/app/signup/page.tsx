"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signup } from "./actions";

export default function SignupPage() {
  const [state, formAction, pending] = useActionState(signup, {
    error: null,
    info: null,
  });

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b-[3px] border-ink px-6 py-4">
        <Link href="/" className="headline text-lg">
          relay
        </Link>
      </header>
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-16">
        <h1 className="headline mb-2 text-4xl">create your organization</h1>
        <p className="mb-8 text-sm text-body">
          This creates a new organization and signs you in as its admin.
        </p>
        <form action={formAction} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium uppercase tracking-wide text-muted">
              Organization name
            </span>
            <input
              type="text"
              name="org_name"
              required
              className="border border-ink bg-surface px-3 py-2 outline-none focus:outline-2 focus:outline-ink"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium uppercase tracking-wide text-muted">
              Your name
            </span>
            <input
              type="text"
              name="admin_name"
              required
              className="border border-ink bg-surface px-3 py-2 outline-none focus:outline-2 focus:outline-ink"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium uppercase tracking-wide text-muted">
              Designation (optional)
            </span>
            <input
              type="text"
              name="designation"
              className="border border-ink bg-surface px-3 py-2 outline-none focus:outline-2 focus:outline-ink"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium uppercase tracking-wide text-muted">Email</span>
            <input
              type="email"
              name="email"
              required
              className="border border-ink bg-surface px-3 py-2 outline-none focus:outline-2 focus:outline-ink"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium uppercase tracking-wide text-muted">
              Password
            </span>
            <input
              type="password"
              name="password"
              required
              minLength={8}
              className="border border-ink bg-surface px-3 py-2 outline-none focus:outline-2 focus:outline-ink"
            />
          </label>
          {state.error && <p className="text-sm text-accent">{state.error}</p>}
          {state.info && <p className="text-sm text-body">{state.info}</p>}
          <button
            type="submit"
            disabled={pending}
            className="mt-2 bg-ink px-4 py-2 text-sm font-medium uppercase tracking-wide text-surface disabled:opacity-50"
          >
            {pending ? "creating…" : "create organization"}
          </button>
        </form>
        <p className="mt-6 text-sm text-body">
          Already have an account?{" "}
          <Link href="/login" className="underline">
            Sign in
          </Link>
        </p>
      </main>
    </div>
  );
}
