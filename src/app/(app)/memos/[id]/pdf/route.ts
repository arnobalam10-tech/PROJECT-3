import { NextResponse, type NextRequest } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { logQueryError } from "@/lib/log-query-error";
import { MemoDocument, type MemoPdfData } from "@/lib/pdf/memo-document";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const profile = await requireProfile();
  const supabase = await createClient();

  // RLS (memos_select_authorized) already scopes this to author/admin/
  // participant within the caller's own org — the same authorization the
  // memo detail page relies on. Re-checked explicitly below anyway (never
  // rely on RLS alone as the sole line of defense — CLAUDE.md §4).
  const { data: memo, error: memoError } = await supabase
    .from("memos")
    .select(
      "id, organization_id, memo_number, subject, body, status, priority, created_at, submitted_at, completed_at, author_id, profiles!memos_author_id_fkey(name, email), departments(name), memo_categories(name), organizations(name)",
    )
    .eq("id", id)
    .maybeSingle();
  logQueryError("memo-pdf.memo", memoError);

  if (!memo || memo.organization_id !== profile.organization_id) {
    return NextResponse.json({ error: "Memo not found." }, { status: 404 });
  }

  const [
    { data: attachments, error: attachmentsError },
    { data: steps, error: stepsError },
    { data: comments, error: commentsError },
  ] = await Promise.all([
    supabase.from("attachments").select("file_name, file_size").eq("memo_id", id).order("uploaded_at"),
    supabase
      .from("workflow_steps")
      .select(
        "sequence_order, status, action_taken, comment, acted_at, is_original, profiles!workflow_steps_assigned_user_id_fkey(name), acted_by_profile:profiles!workflow_steps_acted_by_fkey(name)",
      )
      .eq("memo_id", id)
      .order("sequence_order"),
    supabase
      .from("comments")
      .select(
        "comment_type, body, created_at, profiles!comments_author_id_fkey(name), on_behalf_of:profiles!comments_on_behalf_of_user_id_fkey(name)",
      )
      .eq("memo_id", id)
      .order("created_at"),
  ]);
  logQueryError("memo-pdf.attachments", attachmentsError);
  logQueryError("memo-pdf.steps", stepsError);
  logQueryError("memo-pdf.comments", commentsError);

  const data: MemoPdfData = {
    organizationName: (memo.organizations as unknown as { name: string } | null)?.name ?? "—",
    memoNumber: memo.memo_number,
    subject: memo.subject,
    body: memo.body as Record<string, unknown>,
    status: memo.status,
    priority: memo.priority,
    authorName: (memo.profiles as unknown as { name: string; email: string } | null)?.name ?? "—",
    authorEmail: (memo.profiles as unknown as { name: string; email: string } | null)?.email ?? "—",
    departmentName: (memo.departments as unknown as { name: string } | null)?.name ?? null,
    categoryName: (memo.memo_categories as unknown as { name: string } | null)?.name ?? null,
    createdAt: memo.created_at,
    submittedAt: memo.submitted_at,
    completedAt: memo.completed_at,
    attachments: (attachments ?? []).map((a) => ({ fileName: a.file_name, fileSize: a.file_size })),
    workflowSteps: (steps ?? []).map((s) => ({
      holderName: (s.profiles as unknown as { name: string } | null)?.name ?? "—",
      isOriginal: s.is_original,
      status: s.status,
      actionTaken: s.action_taken,
      comment: s.comment,
      actedAt: s.acted_at,
      actedByName: (s.acted_by_profile as unknown as { name: string } | null)?.name ?? null,
    })),
    comments: (comments ?? []).map((c) => ({
      authorName: (c.profiles as unknown as { name: string } | null)?.name ?? "—",
      onBehalfOfName: (c.on_behalf_of as unknown as { name: string } | null)?.name ?? null,
      commentType: c.comment_type,
      body: c.body,
      createdAt: c.created_at,
    })),
    exportedByName: profile.name,
  };

  const buffer = await renderToBuffer(MemoDocument(data));
  const body = new Uint8Array(buffer);

  return new NextResponse(body, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${memo.memo_number}.pdf"`,
      "Content-Length": String(body.length),
    },
  });
}
