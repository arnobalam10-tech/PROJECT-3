import Link from "next/link";
import { Bell } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function NotificationBell({ unreadCount }: { unreadCount: number }) {
  return (
    <Link
      href="/notifications"
      aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ""}`}
      className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "relative")}
    >
      <Bell className="h-5 w-5" />
      {unreadCount > 0 && (
        <span className="absolute right-1.5 top-1.5 flex h-2 w-2 rounded-full bg-primary ring-2 ring-background" />
      )}
    </Link>
  );
}
