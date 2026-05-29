"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Label } from "@/components/ui/label";

export function TableFilter({
  label,
  param,
  options
}: {
  label: string,
  param: string,
  options: { label: string, value: string }[]
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function handleChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(param, value);
    } else {
      params.delete(param);
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex flex-col gap-1.5 min-w-[150px]">
      <Label className="text-[10px] uppercase text-slate-500 font-bold px-1">{label}</Label>
      <select
        className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
        onChange={(e) => handleChange(e.target.value)}
        value={searchParams.get(param) || ""}
      >
        <option value="">Todos</option>
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  );
}
