import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { logQueryError } from "@/lib/log-query-error";
import { logout } from "./actions";
import { NavLinks } from "./nav-links";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireProfile();
  const supabase = await createClient();
  const { count: unreadCount, error: unreadCountError } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", profile.id)
    .eq("is_read", false);
  logQueryError("layout.unreadCount", unreadCountError);

  return (
    <div className="min-h-screen">
      <header className="flex flex-col gap-3 border-b-[3px] border-ink px-6 py-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap items-center gap-6">
          <Link href="/dashboard" className="headline text-lg">
            relay
          </Link>
          <NavLinks isAdmin={profile.role === "org_admin"} unreadCount={unreadCount ?? 0} />
        </div>
        <div className="flex items-center gap-4 text-xs">
          <Link href="/profile" className="uppercase tracking-wide text-muted hover:text-ink">
            {profile.name} · {profile.role === "org_admin" ? "Admin" : "User"}
          </Link>
          <form action={logout}>
            <button
              type="submit"
              className="border border-ink px-3 py-1.5 font-medium uppercase tracking-wide"
            >
              Sign out
            </button>
          </form>
        </div>
      </header>
      <div className="px-6 py-8">{children}</div>
    </div>
  );
}
