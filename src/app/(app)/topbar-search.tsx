"use client";

import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

export function TopbarSearch() {
  const router = useRouter();

  return (
    <form
      className="relative hidden w-full max-w-sm sm:block"
      onSubmit={(e) => {
        e.preventDefault();
        const q = new FormData(e.currentTarget).get("q");
        if (q) router.push(`/search?q=${encodeURIComponent(String(q))}`);
      }}
    >
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input name="q" placeholder="Search memos…" className="pl-9" />
    </form>
  );
}
