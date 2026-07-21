import { useMemo, useState } from "react";

export type SortDir = "asc" | "desc" | null;
export type SortType = "string" | "number" | "date";

export function useSortable<T extends Record<string, any>>(rows: T[]) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);
  const [sortType, setSortType] = useState<SortType>("string");

  const sorted = useMemo(() => {
    if (!sortKey || !sortDir) return rows;
    const arr = [...rows];
    arr.sort((a, b) => {
      let av: any = (a as any)[sortKey];
      let bv: any = (b as any)[sortKey];
      if (sortType === "date") {
        av = av ? new Date(av).getTime() : 0;
        bv = bv ? new Date(bv).getTime() : 0;
      } else if (sortType === "number") {
        av = Number(av) || 0;
        bv = Number(bv) || 0;
      } else {
        av = String(av ?? "").toLowerCase();
        bv = String(bv ?? "").toLowerCase();
      }
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return arr;
  }, [rows, sortKey, sortDir, sortType]);

  function toggle(key: string, type: SortType = "string") {
    if (sortKey !== key) {
      setSortKey(key);
      setSortType(type);
      setSortDir("asc");
      return;
    }
    if (sortDir === "asc") setSortDir("desc");
    else if (sortDir === "desc") {
      setSortDir(null);
      setSortKey(null);
    } else setSortDir("asc");
  }

  return { rows: sorted, sortKey, sortDir, toggle };
}

export type SortState = ReturnType<typeof useSortable<any>>;
