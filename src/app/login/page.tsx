"use client";

import { useActionState } from "react";
import Link from "next/link";
import { login } from "./actions";

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(login, { error: null });

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <Link href="/" className="mb-8 block text-sm font-bold lowercase tracking-tight">
        relay
      </Link>
      <h1 className="mb-8 text-3xl font-bold lowercase tracking-tight">sign in</h1>
      <form action={formAction} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">
            Email
          </span>
          <input
            type="email"
            name="email"
            required
            className="border border-black px-3 py-2 outline-none focus:outline-2 focus:outline-black"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">
            Password
          </span>
          <input
            type="password"
            name="password"
            required
            className="border border-black px-3 py-2 outline-none focus:outline-2 focus:outline-black"
          />
        </label>
        {state.error && <p className="text-sm text-red-700">{state.error}</p>}
        <button
          type="submit"
          disabled={pending}
          className="mt-2 bg-black px-4 py-2 font-medium text-white disabled:opacity-50"
        >
          {pending ? "signing in…" : "sign in"}
        </button>
      </form>
      <p className="mt-6 text-sm text-neutral-600">
        No organization yet?{" "}
        <Link href="/signup" className="underline">
          Create one
        </Link>
      </p>
    </main>
  );
}
