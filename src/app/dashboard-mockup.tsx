import {
  LayoutDashboard,
  Inbox,
  FileText,
  CheckCircle2,
  Search,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const RAIL_ITEMS = [
  { icon: LayoutDashboard, active: true },
  { icon: Inbox, active: false },
  { icon: FileText, active: false },
  { icon: CheckCircle2, active: false },
  { icon: Search, active: false },
];

const STATS = [
  { label: "Awaiting action", value: "6", trend: "+2", up: true },
  { label: "Submitted", value: "14", trend: "+4", up: true },
  { label: "Avg. time", value: "1.8d", trend: "-0.3d", up: false },
];

const ROWS = [
  { name: "Priya Nair", subject: "Q4 marketing budget reallocation", status: "Urgent", tone: "urgent" as const },
  { name: "Marcus Webb", subject: "New vendor onboarding — office supplies", status: "In review", tone: "progress" as const },
  { name: "Sofia Reyes", subject: "Travel expense approval — APAC summit", status: "Approved", tone: "approved" as const },
];

const TONE_CLASSES: Record<string, string> = {
  urgent: "bg-primary/10 text-primary",
  progress: "bg-amber-100 text-amber-700",
  approved: "bg-lime/30 text-[#3f5200]",
};

export function DashboardMockup() {
  return (
    <div className="flex h-full min-h-[360px] text-sm">
      <div className="hidden w-14 shrink-0 flex-col items-center gap-3 border-r border-border py-4 sm:flex">
        {RAIL_ITEMS.map((item, i) => (
          <div
            key={i}
            className={`flex h-9 w-9 items-center justify-center rounded-lg ${
              item.active ? "bg-primary/10 text-primary" : "text-muted-foreground"
            }`}
          >
            <item.icon className="h-4 w-4" />
          </div>
        ))}
      </div>
      <div className="min-w-0 flex-1 space-y-4 p-4 sm:p-5">
        <div>
          <p className="text-base font-semibold">Good morning, Alice</p>
          <p className="text-xs text-muted-foreground">Here&apos;s what&apos;s moving through Relay today.</p>
        </div>

        <div className="grid grid-cols-2 gap-2.5 min-[420px]:grid-cols-3 sm:gap-3">
          {STATS.map((s) => (
            <Card key={s.label} className="gap-1.5 py-3 shadow-none first:col-span-2 min-[420px]:first:col-span-1">
              <CardContent className="px-3">
                <p className="truncate text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  {s.label}
                </p>
                <p className="text-xl font-semibold">{s.value}</p>
                <p
                  className={`flex items-center gap-0.5 text-[10px] font-medium ${
                    s.up ? "text-emerald-600" : "text-primary"
                  }`}
                >
                  {s.up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                  {s.trend}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="gap-0 py-0 shadow-none">
          <div className="border-b border-border px-4 py-2.5 text-xs font-medium text-muted-foreground">
            Needs your attention
          </div>
          <div className="divide-y divide-border">
            {ROWS.map((row) => (
              <div key={row.subject} className="flex items-center gap-3 px-4 py-2.5">
                <Avatar className="h-7 w-7 shrink-0">
                  <AvatarFallback className="bg-secondary text-[10px] font-medium">
                    {row.name.split(" ").map((p) => p[0]).join("")}
                  </AvatarFallback>
                </Avatar>
                <p className="min-w-0 flex-1 truncate text-xs">{row.subject}</p>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${TONE_CLASSES[row.tone]}`}
                >
                  {row.status}
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
