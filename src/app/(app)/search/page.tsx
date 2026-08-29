import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { logQueryError } from "@/lib/log-query-error";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { STATUS_LABELS, StatusBadge, PriorityBadge } from "@/components/memo-badges";

const fieldClasses =
  "h-9 w-full rounded-lg border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

type SearchParams = {
  q?: string;
  author?: string;
  department?: string;
  category?: string;
  status?: string;
  priority?: string;
  from?: string;
  to?: string;
};

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const profile = await requireProfile();
  const supabase = await createClient();
  const params = await searchParams;

  const [
    { data: departments, error: departmentsError },
    { data: categories, error: categoriesError },
    { data: members, error: membersError },
  ] = await Promise.all([
    supabase.from("departments").select("id, name").eq("organization_id", profile.organization_id).order("name"),
    supabase.from("memo_categories").select("id, name").eq("organization_id", profile.organization_id).order("name"),
    supabase.from("profiles").select("id, name").eq("organization_id", profile.organization_id).order("name"),
  ]);
  logQueryError("search.departments", departmentsError);
  logQueryError("search.categories", categoriesError);
  logQueryError("search.members", membersError);

  const hasAnyFilter = Object.values(params).some((v) => v && v.length > 0);

  let results: Array<{
    id: string;
    memo_number: string;
    subject: string;
    status: string;
    priority: string;
    submitted_at: string | null;
    author_id: string;
    profiles: { name: string } | null;
    departments: { name: string } | null;
  }> = [];

  if (hasAnyFilter) {
    let query = supabase
      .from("memos")
      .select(
        "id, memo_number, subject, status, priority, submitted_at, author_id, profiles!memos_author_id_fkey(name), departments(name)",
      );

    if (params.q) {
      const q = params.q.replace(/[%_]/g, "\\$&");
      query = query.or(`memo_number.ilike.%${q}%,subject.ilike.%${q}%,body_text.ilike.%${q}%`);
    }
    if (params.author) query = query.eq("author_id", params.author);
    if (params.department) query = query.eq("department_id", params.department);
    if (params.category) query = query.eq("category_id", params.category);
    if (params.status) query = query.eq("status", params.status);
    if (params.priority) query = query.eq("priority", params.priority);
    if (params.from) query = query.gte("submitted_at", params.from);
    if (params.to) query = query.lte("submitted_at", `${params.to}T23:59:59`);

    const { data, error } = await query.order("submitted_at", { ascending: false }).limit(100);
    if (error) {
      console.error("[search] query failed:", error);
    }
    results = (data ?? []) as unknown as typeof results;
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Search</h1>
        <p className="mt-1 text-sm text-muted-foreground">Find any memo you&apos;re authorized to see.</p>
      </div>

      <Card className="mb-6">
        <CardContent>
          <form className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <label className="flex flex-col gap-1.5 sm:col-span-3">
              <span className="text-xs font-medium text-muted-foreground">Memo number, subject, or body</span>
              <Input type="text" name="q" defaultValue={params.q} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">Author</span>
              <select name="author" defaultValue={params.author ?? ""} className={fieldClasses}>
                <option value="">Any</option>
                {(members ?? []).map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">Department</span>
              <select name="department" defaultValue={params.department ?? ""} className={fieldClasses}>
                <option value="">Any</option>
                {(departments ?? []).map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">Category</span>
              <select name="category" defaultValue={params.category ?? ""} className={fieldClasses}>
                <option value="">Any</option>
                {(categories ?? []).map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">Status</span>
              <select name="status" defaultValue={params.status ?? ""} className={fieldClasses}>
                <option value="">Any</option>
                {Object.entries(STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">Priority</span>
              <select name="priority" defaultValue={params.priority ?? ""} className={fieldClasses}>
                <option value="">Any</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">Submitted from</span>
              <Input type="date" name="from" defaultValue={params.from} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">Submitted to</span>
              <Input type="date" name="to" defaultValue={params.to} />
            </label>
            <div className="flex items-end">
              <Button type="submit" className="w-full">Search</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {hasAnyFilter ? (
        <div className="rounded-xl border bg-card shadow-sm">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Memo</TableHead>
                  <TableHead>Author</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead className="text-right">Submitted</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.map((m) => (
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
                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                      {m.departments?.name ?? "—"}
                    </TableCell>
                    <TableCell><StatusBadge status={m.status} /></TableCell>
                    <TableCell><PriorityBadge priority={m.priority} /></TableCell>
                    <TableCell className="whitespace-nowrap text-right text-sm text-muted-foreground">
                      {m.submitted_at ? new Date(m.submitted_at).toLocaleDateString() : "—"}
                    </TableCell>
                  </TableRow>
                ))}
                {results.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                      No matches.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Enter at least one filter to search.</p>
      )}
    </div>
  );
}
