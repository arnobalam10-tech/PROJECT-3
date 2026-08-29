import { Paperclip, MessageSquare } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

const CHAIN = [
  { name: "Priya Nair", state: "done" as const },
  { name: "You", state: "current" as const },
  { name: "Marcus Webb", state: "upcoming" as const },
  { name: "Finance", state: "upcoming" as const },
];

const STATE_CLASSES: Record<string, string> = {
  done: "bg-lime/40 ring-2 ring-background",
  current: "bg-primary ring-2 ring-background",
  upcoming: "bg-secondary ring-2 ring-background",
};

// AvatarFallback sets its own text-muted-foreground by default, which
// overriding the wrapper's text color alone doesn't beat — set it directly
// here per state so "current" (solid violet) gets readable white text
// instead of low-contrast gray-on-violet.
const FALLBACK_TEXT_CLASSES: Record<string, string> = {
  done: "text-[#3f5200]",
  current: "text-primary-foreground",
  upcoming: "text-muted-foreground",
};

export function MemoDetailMockup() {
  return (
    <div className="min-h-[360px] space-y-4 p-4 text-sm sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[11px] text-muted-foreground">MEMO-2026-00412 · Priya Nair</p>
          <p className="truncate text-base font-semibold">Q4 marketing budget reallocation</p>
        </div>
        <span className="shrink-0 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary">
          Needs your review
        </span>
      </div>

      <Card className="gap-2 py-3 shadow-none">
        <CardContent className="space-y-2 px-4">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Routing
          </p>
          <div className="flex items-center">
            {CHAIN.map((p, i) => (
              <div key={p.name} className="flex items-center">
                <div className="flex flex-col items-center gap-1">
                  <Avatar className={`h-8 w-8 ${STATE_CLASSES[p.state]}`}>
                    <AvatarFallback
                      className={`bg-transparent text-[10px] font-medium ${FALLBACK_TEXT_CLASSES[p.state]}`}
                    >
                      {p.name === "You" ? "Y" : p.name.split(" ").map((s) => s[0]).join("")}
                    </AvatarFallback>
                  </Avatar>
                  <span className="max-w-14 truncate text-[9px] text-muted-foreground">{p.name}</span>
                </div>
                {i < CHAIN.length - 1 && <div className="mx-1 h-px w-6 bg-border sm:w-10" />}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="gap-2 py-3 shadow-none">
        <CardContent className="space-y-2 px-4">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Body</p>
          <p className="text-xs leading-relaxed text-foreground/80">
            Requesting to shift $18,400 from the paused print campaign into paid social for the
            product launch window. Full breakdown attached.
          </p>
          <div className="flex items-center gap-3 pt-1 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <Paperclip className="h-3 w-3" /> budget-breakdown.xlsx
            </span>
            <span className="flex items-center gap-1">
              <MessageSquare className="h-3 w-3" /> 2 comments
            </span>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" className="rounded-full">
          Approve
        </Button>
        <Button size="sm" variant="outline" className="rounded-full">
          Forward
        </Button>
        <Button size="sm" variant="outline" className="rounded-full text-destructive hover:text-destructive">
          Reject
        </Button>
      </div>
    </div>
  );
}
