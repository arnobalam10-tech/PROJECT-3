import { requireOrgAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { logQueryError } from "@/lib/log-query-error";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Workflow templates</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Reusable ordered position sequences. A template only supplies the initial suggested
          chain — whoever holds a memo built from one can still deviate from it.
        </p>
      </div>

      <div className="mb-6">
        <NewTemplateForm />
      </div>

      <div className="flex flex-col gap-4">
        {(templates ?? []).map((t) => {
          const positions = (t.workflow_template_positions as unknown as {
            id: string;
            position_order: number;
            position_label: string;
          }[]).slice().sort((a, b) => a.position_order - b.position_order);
          return (
            <Card key={t.id}>
              <CardContent>
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium">{t.name}</p>
                    {t.description && <p className="text-sm text-muted-foreground">{t.description}</p>}
                  </div>
                  <DeleteTemplateButton templateId={t.id} />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {positions.map((p, i) => (
                    <div key={p.id} className="flex items-center gap-2">
                      <Badge variant="secondary">
                        {i + 1}. {p.position_label}
                      </Badge>
                      {i < positions.length - 1 && <span className="text-muted-foreground">→</span>}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
        {(templates ?? []).length === 0 && (
          <p className="py-10 text-center text-sm text-muted-foreground">No templates yet.</p>
        )}
      </div>
    </div>
  );
}
