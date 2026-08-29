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
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
      <h1 className="mb-2 text-3xl font-bold lowercase tracking-tight">create your organization</h1>
      <p className="mb-8 text-sm text-neutral-600">
        This creates a new organization and signs you in as its admin.
      </p>
      <form action={formAction} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">
            Organization name
          </span>
          <input
            type="text"
            name="org_name"
            required
            className="border border-black px-3 py-2 outline-none focus:outline-2 focus:outline-black"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">
            Your name
          </span>
          <input
            type="text"
            name="admin_name"
            required
            className="border border-black px-3 py-2 outline-none focus:outline-2 focus:outline-black"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">
            Designation (optional)
          </span>
          <input
            type="text"
            name="designation"
            className="border border-black px-3 py-2 outline-none focus:outline-2 focus:outline-black"
          />
        </label>
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
            minLength={8}
            className="border border-black px-3 py-2 outline-none focus:outline-2 focus:outline-black"
          />
        </label>
        {state.error && <p className="text-sm text-red-700">{state.error}</p>}
        {state.info && <p className="text-sm text-neutral-700">{state.info}</p>}
        <button
          type="submit"
          disabled={pending}
          className="mt-2 bg-black px-4 py-2 font-medium text-white disabled:opacity-50"
        >
          {pending ? "creating…" : "create organization"}
        </button>
      </form>
      <p className="mt-6 text-sm text-neutral-600">
        Already have an account?{" "}
        <Link href="/login" className="underline">
          Sign in
        </Link>
      </p>
    </main>
  );
}
