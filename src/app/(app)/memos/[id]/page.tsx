import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { logQueryError } from "@/lib/log-query-error";
import { RichTextEditor } from "@/components/rich-text-editor";
import { MemoForm } from "../memo-form";
import { AttachmentUpload } from "./attachment-upload";
import { AttachmentList } from "./attachment-list";
import { DeleteDraftButton } from "./delete-draft-button";
import { SubmitPanel } from "./submit-panel";
import { ActionPanel } from "./action-panel";
import { ResubmitButton } from "./resubmit-button";
import { CommentBox } from "./comment-box";
import { VersionHistory } from "./version-history";

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  submitted: "Submitted",
  pending_review: "Pending Review",
  pending_approval: "Pending Approval",
  changes_requested: "Changes Requested",
  rejected: "Rejected",
  approved: "Approved",
  cancelled: "Cancelled",
};

type TimelineEntry = {
  kind: "step" | "comment";
  at: string;
  actorName: string;
  onBehalfOfName: string | null;
  label: string;
  body: string | null;
};

export default async function MemoDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await requireProfile();
  const supabase = await createClient();

  const { data: memo, error: memoError } = await supabase
    .from("memos")
    .select(
      "id, memo_number, subject, body, status, priority, department_id, category_id, author_id, created_at, updated_at, profiles!memos_author_id_fkey(name)",
    )
    .eq("id", id)
    .maybeSingle();
  logQueryError("memo-detail.memo", memoError);

  if (!memo) {
    notFound();
  }

  const isDraftEditable = memo.author_id === profile.id && memo.status === "draft";
  const isChangesRequestedEditable = memo.author_id === profile.id && memo.status === "changes_requested";
  const isEditable = isDraftEditable || isChangesRequestedEditable;
  const authorName = (memo.profiles as unknown as { name: string } | null)?.name;

  const [
    { data: departments, error: departmentsError },
    { data: categories, error: categoriesError },
    { data: attachments, error: attachmentsError },
    { data: members, error: membersError },
    { data: steps, error: stepsError },
    { data: comments, error: commentsError },
    { data: versions, error: versionsError },
    { data: templates, error: templatesError },
  ] = await Promise.all([
      supabase.from("departments").select("id, name").eq("organization_id", profile.organization_id).eq("status", "active").order("name"),
      supabase.from("memo_categories").select("id, name").eq("organization_id", profile.organization_id).eq("is_active", true).order("name"),
      supabase.from("attachments").select("id, file_name, file_size, uploaded_at").eq("memo_id", id).order("uploaded_at"),
      supabase.from("profiles").select("id, name").eq("organization_id", profile.organization_id).eq("status", "active").order("name"),
      supabase
        .from("workflow_steps")
        .select(
          "id, sequence_order, assigned_user_id, status, action_taken, comment, is_original, added_by, acted_at, acted_by, profiles!workflow_steps_assigned_user_id_fkey(name), acted_by_profile:profiles!workflow_steps_acted_by_fkey(name)",
        )
        .eq("memo_id", id)
        .order("sequence_order"),
      supabase
        .from("comments")
        .select(
          "id, body, comment_type, created_at, on_behalf_of_user_id, profiles!comments_author_id_fkey(name), on_behalf_of:profiles!comments_on_behalf_of_user_id_fkey(name)",
        )
        .eq("memo_id", id)
        .order("created_at"),
      supabase
        .from("memo_versions")
        .select("id, version_number, editor_id, content_snapshot, associated_submission_at, profiles!memo_versions_editor_id_fkey(name)")
        .eq("memo_id", id)
        .order("version_number"),
      supabase
        .from("workflow_templates")
        .select("id, name, workflow_template_positions(id, position_order, position_label)")
        .eq("organization_id", profile.organization_id)
        .order("name"),
    ]);
  logQueryError("memo-detail.departments", departmentsError);
  logQueryError("memo-detail.categories", categoriesError);
  logQueryError("memo-detail.attachments", attachmentsError);
  logQueryError("memo-detail.members", membersError);
  logQueryError("memo-detail.steps", stepsError);
  logQueryError("memo-detail.comments", commentsError);
  logQueryError("memo-detail.versions", versionsError);
  logQueryError("memo-detail.templates", templatesError);

  const currentStep = (steps ?? []).find((s) => s.status === "current");
  const isDirectHolder = currentStep?.assigned_user_id === profile.id;

  // Delegation (PRD §19): the current holder's active delegate may also act.
  // Only queried when there's an actual current step and the caller isn't
  // already the direct holder — no need to check delegation for a memo with
  // no one currently holding it, or when the caller already qualifies.
  let delegatingHolderName: string | null = null;
  if (currentStep && !isDirectHolder) {
    const { data: activeDelegation, error: delegationError } = await supabase
      .from("delegations")
      .select("id, delegating_user_id, delegator:profiles!delegations_delegating_user_id_fkey(name)")
      .eq("delegating_user_id", currentStep.assigned_user_id)
      .eq("delegate_user_id", profile.id)
      .eq("status", "active")
      .lte("start_date", new Date().toISOString().slice(0, 10))
      .gte("end_date", new Date().toISOString().slice(0, 10))
      .maybeSingle();
    logQueryError("memo-detail.activeDelegation", delegationError);
    if (activeDelegation) {
      delegatingHolderName = (activeDelegation.delegator as unknown as { name: string } | null)?.name ?? "the current holder";
    }
  }
  const isCurrentHolder = isDirectHolder || delegatingHolderName !== null;

  const hasBeenSubmitted = (steps ?? []).length > 0;
  const otherMembers = members ?? []; // any active org member is eligible, including self

  const timeline: TimelineEntry[] = [
    // Step entries show only the action + who/when. The actual comment
    // text (reason/explanation/note) is carried by the corresponding
    // `comments` row below instead — the RPCs write both, and showing the
    // same text under both entries would just duplicate it in the UI.
    ...(steps ?? [])
      .filter((s) => s.acted_at)
      .map((s) => {
        const holderName = (s.profiles as unknown as { name: string } | null)?.name ?? "—";
        const actedByName = (s.acted_by_profile as unknown as { name: string } | null)?.name ?? null;
        const delegated = actedByName && actedByName !== holderName;
        return {
          kind: "step" as const,
          at: s.acted_at as string,
          actorName: delegated ? actedByName! : holderName,
          onBehalfOfName: delegated ? holderName : null,
          label:
            s.action_taken === "approve"
              ? "Approved"
              : s.action_taken === "reject"
                ? "Rejected"
                : s.action_taken === "request_changes"
                  ? "Requested changes"
                  : s.action_taken === "decline"
                    ? "Declined & rerouted"
                    : (s.action_taken ?? "Acted"),
          body: null,
        };
      }),
    ...(comments ?? []).map((c) => ({
      kind: "comment" as const,
      at: c.created_at,
      actorName: (c.profiles as unknown as { name: string } | null)?.name ?? "—",
      onBehalfOfName: (c.on_behalf_of as unknown as { name: string } | null)?.name ?? null,
      label:
        c.comment_type === "general"
          ? "Comment"
          : c.comment_type === "approval"
            ? "Approval comment"
            : c.comment_type === "rejection"
              ? "Rejection reason"
              : "Change request",
      body: c.body,
    })),
  ].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

  return (
    <main className="mx-auto max-w-3xl">
      <div className="mb-8 flex items-start justify-between">
        <div>
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-neutral-500">
            {memo.memo_number} · by {authorName ?? "—"} ·{" "}
            <span className={memo.priority === "urgent" ? "text-red-700" : ""}>
              {STATUS_LABELS[memo.status] ?? memo.status}
            </span>
          </p>
          <h1 className="text-3xl font-bold lowercase tracking-tight">{memo.subject}</h1>
        </div>
        {isDraftEditable && <DeleteDraftButton memoId={memo.id} />}
      </div>

      {isEditable ? (
        <>
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
          {isChangesRequestedEditable && (
            <div className="mt-4">
              <ResubmitButton memoId={memo.id} />
            </div>
          )}
        </>
      ) : (
        <div className="mb-8">
          <RichTextEditor content={memo.body as Record<string, unknown>} editable={false} />
        </div>
      )}

      <section className="mt-10">
        <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-neutral-500">
          Attachments
        </h2>
        <AttachmentList memoId={memo.id} attachments={attachments ?? []} editable={isDraftEditable} />
        {isDraftEditable && (
          <div className="mt-3">
            <AttachmentUpload memoId={memo.id} />
          </div>
        )}
      </section>

      {isDraftEditable && !hasBeenSubmitted && (
        <SubmitPanel
          memoId={memo.id}
          members={otherMembers}
          templates={(templates ?? []).map((t) => ({
            id: t.id,
            name: t.name,
            positions: (t.workflow_template_positions as unknown as { id: string; position_order: number; position_label: string }[])
              .slice()
              .sort((a, b) => a.position_order - b.position_order),
          }))}
        />
      )}

      {isCurrentHolder && (
        <ActionPanel memoId={memo.id} members={otherMembers} actingOnBehalfOf={delegatingHolderName} />
      )}

      {hasBeenSubmitted && (
        <section className="mt-10">
          <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-neutral-500">
            Workflow
          </h2>
          <ol className="flex flex-col gap-2 text-sm">
            {(steps ?? []).map((s) => (
              <li key={s.id} className="flex items-center justify-between border-b border-neutral-300 py-2">
                <span>
                  {(s.profiles as unknown as { name: string } | null)?.name ?? "—"}
                  {!s.is_original && <span className="ml-2 text-xs text-neutral-500">(added)</span>}
                </span>
                <span
                  className={`text-xs font-medium uppercase tracking-wide ${
                    s.status === "current" ? "text-red-700" : s.status === "queued" ? "text-neutral-500" : "text-black"
                  }`}
                >
                  {s.status.replace("_", " ")}
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {(versions ?? []).length > 0 && (
        <section className="mt-10">
          <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-neutral-500">
            Version History
          </h2>
          <VersionHistory
            versions={(versions ?? []).map((v) => ({
              id: v.id,
              versionNumber: v.version_number,
              editorName: (v.profiles as unknown as { name: string } | null)?.name ?? "—",
              submittedAt: v.associated_submission_at,
              snapshot: v.content_snapshot as { subject: string; body: Record<string, unknown> },
            }))}
          />
        </section>
      )}

      <section className="mt-10">
        <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-neutral-500">
          Timeline
        </h2>
        <ol className="flex flex-col gap-3 text-sm">
          {timeline.map((t, i) => (
            <li key={i} className="border-l-2 border-black pl-3">
              <p className="text-xs uppercase tracking-wide text-neutral-500">
                {t.actorName} · {t.label} · {new Date(t.at).toLocaleString()}
                {t.onBehalfOfName && (
                  <span className="normal-case"> (on behalf of {t.onBehalfOfName})</span>
                )}
              </p>
              {t.body && <p className="mt-1">{t.body}</p>}
            </li>
          ))}
          {timeline.length === 0 && <li className="text-neutral-500">No activity yet.</li>}
        </ol>
        <CommentBox memoId={memo.id} />
      </section>
    </main>
  );
}
