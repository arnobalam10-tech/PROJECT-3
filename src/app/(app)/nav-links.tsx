"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const pathname = usePathname();
  // Exact match only — a prefix match would make e.g. /memos/[id] (a memo
  // detail page reachable from Inbox, Completed, or Search just as easily
  // as from My Memos) incorrectly highlight "My Memos" every time.
  const active = pathname === href;
  return (
    <Link
      href={href}
      className={`border-b-2 pb-0.5 ${
        active ? "border-ink text-ink" : "border-transparent text-muted hover:text-ink"
      }`}
    >
      {children}
    </Link>
  );
}

export function NavLinks({
  isAdmin,
  unreadCount,
}: {
  isAdmin: boolean;
  unreadCount: number;
}) {
  return (
    <nav className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-medium uppercase tracking-wide">
      <NavLink href="/dashboard">Dashboard</NavLink>
      <NavLink href="/inbox">Inbox</NavLink>
      <NavLink href="/memos">My Memos</NavLink>
      <NavLink href="/completed">Completed</NavLink>
      <NavLink href="/search">Search</NavLink>
      <NavLink href="/delegations">Delegations</NavLink>
      <NavLink href="/notifications">
        Notifications
        {!!unreadCount && <span className="ml-1 text-accent">({unreadCount})</span>}
      </NavLink>
      {isAdmin && (
        <>
          {/* Hidden below sm: at narrow widths the nav already wraps onto
              its own line there, which reads as its own section break —
              a 1px divider surviving that wrap point looks orphaned. */}
          <span aria-hidden className="hidden h-3 w-px bg-rule sm:block" />
          <NavLink href="/admin/users">Users</NavLink>
          <NavLink href="/admin/departments">Departments</NavLink>
          <NavLink href="/admin/templates">Templates</NavLink>
          <NavLink href="/admin/reports">Reports</NavLink>
          <NavLink href="/admin/audit-log">Audit Log</NavLink>
        </>
      )}
    </nav>
  );
}
