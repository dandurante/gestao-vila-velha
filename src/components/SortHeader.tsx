import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import type { SortState, SortType } from "@/hooks/useSortable";
import { cn } from "@/lib/utils";

export function SortHeader({
  label,
  sortKey,
  type = "string",
  state,
  className,
  align = "left",
}: {
  label: string;
  sortKey: string;
  type?: SortType;
  state: SortState;
  className?: string;
  align?: "left" | "right" | "center";
}) {
  const active = state.sortKey === sortKey;
  const Icon = active
    ? state.sortDir === "asc"
      ? ArrowUp
      : state.sortDir === "desc"
        ? ArrowDown
        : ArrowUpDown
    : ArrowUpDown;
  return (
    <th className={cn("px-4 py-2", `text-${align}`, className)}>
      <button
        type="button"
        onClick={() => state.toggle(sortKey, type)}
        className={cn(
          "inline-flex items-center gap-1 select-none hover:text-foreground",
          align === "right" && "ml-auto",
        )}
      >
        {label}
        <Icon className={cn("h-3 w-3", active ? "text-foreground" : "opacity-40")} />
      </button>
    </th>
  );
}
