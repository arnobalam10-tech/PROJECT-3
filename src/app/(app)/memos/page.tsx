import Link from "next/link";
import { Plus } from "lucide-react";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { logQueryError } from "@/lib/log-query-error";
import { buttonVariants } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge, PriorityBadge } from "@/components/memo-badges";

export default async function MyMemosPage() {
  const profile = await requireProfile();
  const supabase = await createClient();

  const { data: memos, error: memosError } = await supabase
    .from("memos")
    .select(
      "id, memo_number, subject, status, priority, submitted_at, updated_at, workflow_steps(assigned_user_id, status, profiles!workflow_steps_assigned_user_id_fkey(name))",
    )
    .eq("author_id", profile.id)
    .order("updated_at", { ascending: false });
  logQueryError("my-memos.memos", memosError);

  type Row = {
    id: string;
    memo_number: string;
    subject: string;
    status: string;
    priority: string;
    submitted_at: string | null;
    updated_at: string;
    workflow_steps: { assigned_user_id: string; status: string; profiles: { name: string } | null }[];
  };

  const rows = (memos ?? []) as unknown as Row[];

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">My Memos</h1>
          <p className="mt-1 text-sm text-muted-foreground">Everything you&apos;ve authored.</p>
        </div>
        <Link href="/memos/new" className={buttonVariants()}>
          <Plus className="h-4 w-4" />
          New memo
        </Link>
      </div>

      <div className="rounded-xl border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Memo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Current holder</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead className="text-right">Last activity</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((m) => {
                const current = m.workflow_steps?.find((s) => s.status === "current");
                return (
                  <TableRow key={m.id}>
                    <TableCell className="max-w-64">
                      <Link href={`/memos/${m.id}`} className="font-medium hover:underline">
                        {m.subject}
                      </Link>
                      <p className="text-xs text-muted-foreground">{m.memo_number}</p>
                    </TableCell>
                    <TableCell><StatusBadge status={m.status} /></TableCell>
                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                      {current?.profiles?.name ?? "—"}
                    </TableCell>
                    <TableCell><PriorityBadge priority={m.priority} /></TableCell>
                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                      {m.submitted_at ? new Date(m.submitted_at).toLocaleDateString() : "—"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-right text-sm text-muted-foreground">
                      {new Date(m.updated_at).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                );
              })}
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                    No memos yet — create your first draft.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
