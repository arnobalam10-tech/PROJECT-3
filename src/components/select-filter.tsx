"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// A <Select> that updates the URL's query string on change and navigates —
// used for list-page filters. Deliberately not a native <form> submission:
// shadcn's Select (Base UI) does render a hidden native input for form
// compatibility, but nothing auto-submits the form on change without extra
// wiring, and a page can have several of these — client-side navigation
// keeps every filter's current value in sync via the URL itself, which is
// also what makes each filter shareable/bookmarkable.
export function SelectFilter({
  paramName,
  placeholder,
  options,
}: {
  paramName: string;
  placeholder: string;
  options: { value: string; label: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const current = searchParams.get(paramName) ?? "any";

  function handleChange(value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (!value || value === "any") {
      params.delete(paramName);
    } else {
      params.set(paramName, value);
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <Select value={current} onValueChange={handleChange}>
      <SelectTrigger className="w-40">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="any">{placeholder}</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
