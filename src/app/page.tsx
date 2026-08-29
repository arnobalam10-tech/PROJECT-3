import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-6">
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-500">
        CSE226 — Foundations of Vibe Coding
      </p>
      <h1 className="mb-6 text-4xl font-bold lowercase tracking-tight">
        inter-office memo management
      </h1>
      <p className="mb-8 max-w-lg text-neutral-600">
        A multi-tenant memo workflow system: create memos, route them through a sequential
        approval chain, and track every decision from draft to completion.
      </p>
      <div className="flex gap-4">
        <Link href="/login" className="bg-black px-4 py-2 font-medium text-white">
          sign in
        </Link>
        <Link href="/signup" className="border border-black px-4 py-2 font-medium">
          create an organization
        </Link>
      </div>
    </main>
  );
}
