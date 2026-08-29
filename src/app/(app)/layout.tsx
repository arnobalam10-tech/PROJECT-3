import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { logQueryError } from "@/lib/log-query-error";
import { AppSidebar } from "./app-sidebar";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { TopbarSearch } from "./topbar-search";
import { NotificationBell } from "./notification-bell";
import { UserMenu } from "./user-menu";

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
    <SidebarProvider>
      <AppSidebar isAdmin={profile.role === "org_admin"} unreadCount={unreadCount ?? 0} />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-3 border-b bg-background px-4 sm:px-6">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="h-6" />
          <TopbarSearch />
          <div className="ml-auto flex items-center gap-2">
            <NotificationBell unreadCount={unreadCount ?? 0} />
            <UserMenu
              name={profile.name}
              role={profile.role === "org_admin" ? "Admin" : "Regular user"}
            />
          </div>
        </header>
        <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
