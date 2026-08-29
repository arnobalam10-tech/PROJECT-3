"use client";

import { useActionState } from "react";
import Link from "next/link";
import { login } from "./actions";

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(login, { error: null });

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b-[3px] border-ink px-6 py-4">
        <Link href="/" className="headline text-lg">
          relay
        </Link>
      </header>
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-16">
        <h1 className="headline mb-8 text-4xl">sign in</h1>
        <form action={formAction} className="flex flex-col gap-4">
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
              className="border border-ink bg-surface px-3 py-2 outline-none focus:outline-2 focus:outline-ink"
            />
          </label>
          {state.error && <p className="text-sm text-accent">{state.error}</p>}
          <button
            type="submit"
            disabled={pending}
            className="mt-2 bg-ink px-4 py-2 text-sm font-medium uppercase tracking-wide text-surface disabled:opacity-50"
          >
            {pending ? "signing in…" : "sign in"}
          </button>
        </form>
        <p className="mt-6 text-sm text-body">
          No organization yet?{" "}
          <Link href="/signup" className="underline">
            Create one
          </Link>
        </p>
      </main>
    </div>
  );
}
