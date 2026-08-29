import { requireProfile } from "@/lib/auth";

export default async function InboxPage() {
  await requireProfile();
  return (
    <main className="mx-auto max-w-3xl">
      <h1 className="mb-4 text-3xl font-bold lowercase tracking-tight">inbox</h1>
      <p className="text-sm text-neutral-600">
        Coming in Phase 5 — memos awaiting your action will show up here.
      </p>
    </main>
  );
}
