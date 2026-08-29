import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { logout } from "./actions";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireProfile();

  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between border-b-[3px] border-black px-6 py-3">
        <nav className="flex items-center gap-6 text-xs font-medium uppercase tracking-wide">
          <Link href="/dashboard">Dashboard</Link>
          <Link href="/inbox">Inbox</Link>
          <Link href="/memos">My Memos</Link>
          {profile.role === "org_admin" && (
            <>
              <Link href="/admin/users">Users</Link>
              <Link href="/admin/departments">Departments</Link>
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
