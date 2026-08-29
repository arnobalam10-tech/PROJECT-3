import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { RichTextEditor } from "@/components/rich-text-editor";
import { MemoForm } from "../memo-form";
import { AttachmentUpload } from "./attachment-upload";
import { AttachmentList } from "./attachment-list";
import { DeleteDraftButton } from "./delete-draft-button";

export default async function MemoDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await requireProfile();
  const supabase = await createClient();

  const { data: memo } = await supabase
    .from("memos")
    .select(
      "id, memo_number, subject, body, status, priority, department_id, category_id, author_id, created_at, updated_at, profiles!memos_author_id_fkey(name)",
    )
    .eq("id", id)
    .maybeSingle();

  if (!memo) {
    notFound();
  }

  const isEditable = memo.author_id === profile.id && memo.status === "draft";

  const [{ data: departments }, { data: categories }, { data: attachments }] = await Promise.all([
    supabase
      .from("departments")
      .select("id, name")
      .eq("organization_id", profile.organization_id)
      .eq("status", "active")
      .order("name"),
    supabase
      .from("memo_categories")
      .select("id, name")
      .eq("organization_id", profile.organization_id)
      .eq("is_active", true)
      .order("name"),
    supabase
      .from("attachments")
      .select("id, file_name, file_size, uploaded_at")
      .eq("memo_id", id)
      .order("uploaded_at"),
  ]);

  const authorName = (memo.profiles as unknown as { name: string } | null)?.name;

  return (
    <main className="mx-auto max-w-3xl">
      <div className="mb-8 flex items-start justify-between">
        <div>
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-neutral-500">
            {memo.memo_number} · by {authorName ?? "—"}
          </p>
          <h1 className="text-3xl font-bold lowercase tracking-tight">{memo.subject}</h1>
        </div>
        {isEditable && <DeleteDraftButton memoId={memo.id} />}
      </div>

      {isEditable ? (
        <MemoForm
          mode="edit"
          memo={{
            id: memo.id,
            subject: memo.subject,
            body: memo.body as Record<string, unknown>,
            department_id: memo.department_id,
            category_id: memo.category_id,
            priority: memo.priority,
          }}
          departments={departments ?? []}
          categories={categories ?? []}
        />
      ) : (
        <div className="mb-8">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-500">
            Status: {memo.status}
          </p>
          <RichTextEditor content={memo.body as Record<string, unknown>} editable={false} />
        </div>
      )}

      <section className="mt-10">
        <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-neutral-500">
          Attachments
        </h2>
        <AttachmentList memoId={memo.id} attachments={attachments ?? []} editable={isEditable} />
        {isEditable && (
          <div className="mt-3">
            <AttachmentUpload memoId={memo.id} />
          </div>
        )}
      </section>
    </main>
  );
}
