import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { logQueryError } from "@/lib/log-query-error";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge, PriorityBadge } from "@/components/memo-badges";

export default async function CompletedPage() {
  await requireProfile();
  const supabase = await createClient();

  // RLS (memos_select_authorized) already scopes this to memos the caller
  // authored, was ever a workflow participant on, or — if org_admin — any
  // memo in the org. No extra filtering needed for authorization; the
  // .in() below only narrows to terminal statuses.
  const { data: memos, error: memosError } = await supabase
    .from("memos")
    .select(
      "id, memo_number, subject, status, priority, author_id, completed_at, profiles!memos_author_id_fkey(name)",
    )
    .in("status", ["approved", "rejected", "cancelled"])
    .order("completed_at", { ascending: false });
  logQueryError("completed.memos", memosError);

  type Row = {
    id: string;
    memo_number: string;
    subject: string;
    status: string;
    priority: string;
    completed_at: string | null;
    profiles: { name: string } | null;
  };

  const rows = (memos ?? []) as unknown as Row[];

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Completed</h1>
        <p className="mt-1 text-sm text-muted-foreground">Memos that have reached a final outcome.</p>
      </div>

      <div className="rounded-xl border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Memo</TableHead>
                <TableHead>Author</TableHead>
                <TableHead>Outcome</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead className="text-right">Completed</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="max-w-64">
                    <Link href={`/memos/${m.id}`} className="font-medium hover:underline">
                      {m.subject}
                    </Link>
                    <p className="text-xs text-muted-foreground">{m.memo_number}</p>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                    {m.profiles?.name ?? "—"}
                  </TableCell>
                  <TableCell><StatusBadge status={m.status} /></TableCell>
                  <TableCell><PriorityBadge priority={m.priority} /></TableCell>
                  <TableCell className="whitespace-nowrap text-right text-sm text-muted-foreground">
                    {m.completed_at ? new Date(m.completed_at).toLocaleString() : "—"}
                  </TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                    No completed workflows yet.
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
