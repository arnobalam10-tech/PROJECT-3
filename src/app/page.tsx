import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-6">
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-500">
        CSE226 — Foundations of Vibe Coding
      </p>
      <h1 className="mb-6 text-6xl font-bold lowercase tracking-tight">relay</h1>
      <p className="mb-8 max-w-lg text-neutral-600">
        The digital version of a paper memo routed for signatures. Create a memo, send it through
        the people who need to act on it, and track every decision from draft to completion —
        no fixed chain of command required.
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
