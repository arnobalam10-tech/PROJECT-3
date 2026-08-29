import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { toSafeErrorMessage } from "@/lib/safe-error-message";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.user) {
    return NextResponse.redirect(`${origin}/login?error=confirmation_failed`);
  }

  const { data: existingProfile } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", data.user.id)
    .maybeSingle();

  if (!existingProfile) {
    const meta = data.user.user_metadata as Record<string, string | null>;
    if (meta.pending_org_name && meta.pending_org_slug && meta.pending_admin_name) {
      const { error: rpcError } = await supabase.rpc("create_organization_with_admin", {
        org_name: meta.pending_org_name,
        org_slug: meta.pending_org_slug,
        admin_name: meta.pending_admin_name,
        admin_designation: meta.pending_admin_designation ?? null,
      });
      if (rpcError) {
        return NextResponse.redirect(
          `${origin}/login?error=${encodeURIComponent(toSafeErrorMessage(rpcError, "auth.callback.create_organization_with_admin"))}`,
        );
      }
    }
  }

  return NextResponse.redirect(`${origin}/dashboard`);
}
