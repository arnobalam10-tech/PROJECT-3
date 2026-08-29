import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { logQueryError } from "@/lib/log-query-error";
import { logout } from "./actions";

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
      <header className="flex items-center justify-between border-b-[3px] border-black px-6 py-3">
        <nav className="flex items-center gap-6 text-xs font-medium uppercase tracking-wide">
          <Link href="/dashboard" className="text-sm font-bold lowercase tracking-tight">
            relay
          </Link>
          <Link href="/dashboard">Dashboard</Link>
          <Link href="/inbox">Inbox</Link>
          <Link href="/memos">My Memos</Link>
          <Link href="/completed">Completed</Link>
          <Link href="/search">Search</Link>
          <Link href="/delegations">Delegations</Link>
          <Link href="/notifications">
            Notifications
            {!!unreadCount && <span className="ml-1 text-red-700">({unreadCount})</span>}
          </Link>
          {profile.role === "org_admin" && (
            <>
              <Link href="/admin/users">Users</Link>
              <Link href="/admin/departments">Departments</Link>
              <Link href="/admin/templates">Templates</Link>
              <Link href="/admin/reports">Reports</Link>
              <Link href="/admin/audit-log">Audit Log</Link>
            </>
          )}
        </nav>
        <div className="flex items-center gap-4 text-xs">
          <span className="uppercase tracking-wide text-neutral-500">
            {profile.name} · {profile.role === "org_admin" ? "Admin" : "User"}
          </span>
          <form action={logout}>
            <button
              type="submit"
              className="border border-black px-3 py-1.5 font-medium uppercase tracking-wide"
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
