import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { logQueryError } from "@/lib/log-query-error";
import { MemoForm } from "../memo-form";

export default async function NewMemoPage() {
  const profile = await requireProfile();
  const supabase = await createClient();

  const [
    { data: departments, error: departmentsError },
    { data: categories, error: categoriesError },
  ] = await Promise.all([
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
  ]);
  logQueryError("memos.new.departments", departmentsError);
  logQueryError("memos.new.categories", categoriesError);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">New memo</h1>
        <p className="mt-1 text-sm text-muted-foreground">Draft it now, submit it when you&apos;re ready.</p>
      </div>
      <MemoForm mode="create" departments={departments ?? []} categories={categories ?? []} />
    </div>
  );
}
