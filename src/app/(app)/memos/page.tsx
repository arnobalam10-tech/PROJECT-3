import { requireProfile } from "@/lib/auth";

export default async function MyMemosPage() {
  await requireProfile();
  return (
    <main className="mx-auto max-w-3xl">
      <h1 className="mb-4 text-3xl font-bold lowercase tracking-tight">my memos</h1>
      <p className="text-sm text-neutral-600">
        Coming in Phase 3/5 — memos you've created or submitted will show up here.
      </p>
    </main>
  );
}
