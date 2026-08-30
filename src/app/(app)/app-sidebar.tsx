"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Inbox,
  FileText,
  CheckCircle2,
  Search,
  Users2,
  Bell,
  UserCog,
  Building2,
  LayoutTemplate,
  BarChart3,
  ScrollText,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuBadge,
  SidebarHeader,
} from "@/components/ui/sidebar";

// Rendered as a child of next/link's <Link> (through SidebarMenuButton's
// render prop) so useLinkStatus's context is available -- shows a brief
// spinner on the clicked nav item itself, from click until the target
// route's segment starts streaming (at which point its own loading.tsx
// skeleton takes over).
function NavItemPendingIndicator() {
  const { pending } = useLinkStatus();
  if (!pending) return null;
  return (
    <span
      className="ml-auto h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent opacity-60"
      aria-hidden="true"
    />
  );
}

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/inbox", label: "Inbox", icon: Inbox },
  { href: "/memos", label: "My Memos", icon: FileText },
  { href: "/completed", label: "Completed", icon: CheckCircle2 },
  { href: "/search", label: "Search", icon: Search },
  { href: "/delegations", label: "Delegations", icon: Users2 },
  { href: "/notifications", label: "Notifications", icon: Bell },
];

const ADMIN_ITEMS = [
  { href: "/admin/users", label: "Users", icon: UserCog },
  { href: "/admin/departments", label: "Departments", icon: Building2 },
  { href: "/admin/templates", label: "Templates", icon: LayoutTemplate },
  { href: "/admin/reports", label: "Reports", icon: BarChart3 },
  { href: "/admin/audit-log", label: "Audit Log", icon: ScrollText },
];

export function AppSidebar({ isAdmin, unreadCount }: { isAdmin: boolean; unreadCount: number }) {
  const pathname = usePathname();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <Link href="/dashboard" className="flex items-center gap-2 px-2 py-1.5">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
            R
          </div>
          <span className="text-lg font-semibold tracking-tight group-data-[collapsible=icon]:hidden">
            Relay
          </span>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_ITEMS.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    render={<Link href={item.href} />}
                    isActive={pathname === item.href}
                    tooltip={item.label}
                  >
                    <item.icon />
                    <span>{item.label}</span>
                    <NavItemPendingIndicator />
                  </SidebarMenuButton>
                  {item.href === "/notifications" && unreadCount > 0 && (
                    <SidebarMenuBadge className="bg-primary text-primary-foreground">
                      {unreadCount}
                    </SidebarMenuBadge>
                  )}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {isAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel>Admin</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {ADMIN_ITEMS.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      render={<Link href={item.href} />}
                      isActive={pathname === item.href}
                      tooltip={item.label}
                    >
                      <item.icon />
                      <span>{item.label}</span>
                      <NavItemPendingIndicator />
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
    </Sidebar>
  );
}
