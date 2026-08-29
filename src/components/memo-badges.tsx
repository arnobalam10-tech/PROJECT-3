import { cn } from "@/lib/utils";

export const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  submitted: "Submitted",
  pending_review: "Pending Review",
  pending_approval: "Pending Approval",
  changes_requested: "Changes Requested",
  rejected: "Rejected",
  approved: "Approved",
  cancelled: "Cancelled",
};

// Colored pill badges per DESIGN.md: soft green for Approved/Completed,
// amber for Pending/in-progress, violet for anything needing the user's
// action now, gray for Rejected/Inactive/Cancelled.
const STATUS_CLASSES: Record<string, string> = {
  draft: "bg-secondary text-muted-foreground",
  submitted: "bg-amber-100 text-amber-800",
  pending_review: "bg-amber-100 text-amber-800",
  pending_approval: "bg-amber-100 text-amber-800",
  changes_requested: "bg-primary/10 text-primary",
  rejected: "bg-secondary text-muted-foreground",
  approved: "bg-lime/40 text-[#3f5200]",
  cancelled: "bg-secondary text-muted-foreground",
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        STATUS_CLASSES[status] ?? "bg-secondary text-muted-foreground",
        className,
      )}
    >
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

export function PriorityBadge({ priority, className }: { priority: string; className?: string }) {
  if (priority !== "urgent") {
    return <span className={cn("text-sm capitalize text-muted-foreground", className)}>{priority}</span>;
  }
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-medium text-rose-700",
        className,
      )}
    >
      Urgent
    </span>
  );
}

export function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}
