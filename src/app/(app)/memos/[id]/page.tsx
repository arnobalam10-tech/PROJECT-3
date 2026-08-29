import { notFound } from "next/navigation";
import { Download } from "lucide-react";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { logQueryError } from "@/lib/log-query-error";
import { RichTextEditor } from "@/components/rich-text-editor";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { StatusBadge, PriorityBadge, initials } from "@/components/memo-badges";
import { MemoForm } from "../memo-form";
import { AttachmentUpload } from "./attachment-upload";
import { AttachmentList } from "./attachment-list";
import { DeleteDraftButton } from "./delete-draft-button";
import { SubmitPanel } from "./submit-panel";
import { ActionPanel } from "./action-panel";
import { ResubmitButton } from "./resubmit-button";
import { CommentBox } from "./comment-box";
import { VersionHistory } from "./version-history";

type TimelineEntry = {
  kind: "step" | "comment";
  at: string;
  actorName: string;
  onBehalfOfName: string | null;
  label: string;
  body: string | null;
};

const STEP_STATUS_CLASSES: Record<string, string> = {
  current: "bg-primary/10 text-primary",
  queued: "bg-secondary text-muted-foreground",
  approved: "bg-lime/40 text-[#3f5200]",
  rejected: "bg-secondary text-muted-foreground",
  changes_requested: "bg-amber-100 text-amber-800",
  declined: "bg-secondary text-muted-foreground",
  skipped: "bg-secondary text-muted-foreground",
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
  const authorName = (memo.profiles as unknown as { name: string } | null)?.name ?? "—";

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
  const otherMembers = members ?? [];

  const timeline: TimelineEntry[] = [
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
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>{memo.memo_number}</span>
            <span>·</span>
            <span>by {authorName}</span>
            <StatusBadge status={memo.status} />
            {memo.priority === "urgent" && <PriorityBadge priority="urgent" />}
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-balance">{memo.subject}</h1>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <a href={`/memos/${memo.id}/pdf`} className={buttonVariants({ variant: "outline", size: "sm" })}>
            <Download className="h-4 w-4" />
            Export
          </a>
          {isDraftEditable && <DeleteDraftButton memoId={memo.id} />}
        </div>
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
        <Card className="mb-6">
          <CardContent>
            <RichTextEditor content={memo.body as Record<string, unknown>} editable={false} />
          </CardContent>
        </Card>
      )}

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Attachments</CardTitle>
        </CardHeader>
        <CardContent>
          <AttachmentList memoId={memo.id} attachments={attachments ?? []} editable={isDraftEditable} />
          {isDraftEditable && (
            <div className="mt-3">
              <AttachmentUpload memoId={memo.id} />
            </div>
          )}
        </CardContent>
      </Card>

      {isDraftEditable && !hasBeenSubmitted && (
        <div className="mb-6">
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
        </div>
      )}

      {isCurrentHolder && (
        <div className="mb-6">
          <ActionPanel memoId={memo.id} members={otherMembers} actingOnBehalfOf={delegatingHolderName} />
        </div>
      )}

      {hasBeenSubmitted && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">Workflow</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col divide-y">
            {(steps ?? []).map((s) => {
              const name = (s.profiles as unknown as { name: string } | null)?.name ?? "—";
              return (
                <div key={s.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <Avatar className="h-7 w-7 shrink-0">
                      <AvatarFallback className="text-[10px]">{initials(name)}</AvatarFallback>
                    </Avatar>
                    <span className="truncate text-sm">
                      {name}
                      {!s.is_original && <span className="ml-1.5 text-xs text-muted-foreground">(added)</span>}
                    </span>
                  </div>
                  <Badge className={`shrink-0 ${STEP_STATUS_CLASSES[s.status] ?? ""}`}>
                    {s.status.replace("_", " ")}
                  </Badge>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {(versions ?? []).length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">Version history</CardTitle>
          </CardHeader>
          <CardContent>
            <VersionHistory
              versions={(versions ?? []).map((v) => ({
                id: v.id,
                versionNumber: v.version_number,
                editorName: (v.profiles as unknown as { name: string } | null)?.name ?? "—",
                submittedAt: v.associated_submission_at,
                snapshot: v.content_snapshot as { subject: string; body: Record<string, unknown> },
              }))}
            />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="flex flex-col text-sm">
            {timeline.map((t, i) => (
              <li key={i} className="relative flex gap-3 pb-4 last:pb-0">
                {i !== timeline.length - 1 && (
                  <span aria-hidden className="absolute left-[3px] top-3 bottom-0 w-px bg-border" />
                )}
                <span aria-hidden className="relative z-10 mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{t.actorName}</span> · {t.label} ·{" "}
                    {new Date(t.at).toLocaleString()}
                    {t.onBehalfOfName && <span> (on behalf of {t.onBehalfOfName})</span>}
                  </p>
                  {t.body && <p className="mt-1 text-sm">{t.body}</p>}
                </div>
              </li>
            ))}
            {timeline.length === 0 && <li className="text-sm text-muted-foreground">No activity yet.</li>}
          </ol>
          <div className="mt-4 border-t pt-4">
            <CommentBox memoId={memo.id} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
