import { requireOrgAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { logQueryError } from "@/lib/log-query-error";
import { NewTemplateForm } from "./new-template-form";
import { DeleteTemplateButton } from "./delete-template-button";

export default async function TemplatesPage() {
  const admin = await requireOrgAdmin();
  const supabase = await createClient();

  const { data: templates, error: templatesError } = await supabase
    .from("workflow_templates")
    .select("id, name, description, workflow_template_positions(id, position_order, position_label)")
    .eq("organization_id", admin.organization_id)
    .order("name");
  logQueryError("admin.templates", templatesError);

  return (
    <main className="mx-auto max-w-3xl">
      <h1 className="mb-8 text-3xl headline">workflow templates</h1>
      <p className="mb-6 text-sm text-body">
        Reusable ordered position sequences (PRD §18). A template only supplies the initial
        suggested chain — whoever holds a memo built from one can still deviate from it, same as
        any custom workflow.
      </p>
      <NewTemplateForm />

      <ul className="flex flex-col gap-4">
        {(templates ?? []).map((t) => {
          const positions = (t.workflow_template_positions as unknown as {
            id: string;
            position_order: number;
            position_label: string;
          }[]).slice().sort((a, b) => a.position_order - b.position_order);
          return (
            <li key={t.id} className="border border-ink p-4">
              <div className="mb-2 flex items-start justify-between">
                <div>
                  <p className="font-medium">{t.name}</p>
                  {t.description && <p className="text-sm text-body">{t.description}</p>}
                </div>
                <DeleteTemplateButton templateId={t.id} />
              </div>
              <ol className="flex flex-wrap gap-2 text-xs">
                {positions.map((p, i) => (
                  <li key={p.id} className="border border-rule px-2 py-1">
                    {i + 1}. {p.position_label}
                  </li>
                ))}
              </ol>
            </li>
          );
        })}
        {(templates ?? []).length === 0 && (
          <li className="py-6 text-center text-sm text-muted">No templates yet.</li>
        )}
      </ul>
    </main>
  );
}
