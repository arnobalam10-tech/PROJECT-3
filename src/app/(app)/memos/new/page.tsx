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
    <main className="mx-auto max-w-3xl">
      <h1 className="mb-8 text-3xl font-bold lowercase tracking-tight">new memo</h1>
      <MemoForm mode="create" departments={departments ?? []} categories={categories ?? []} />
    </main>
  );
}
