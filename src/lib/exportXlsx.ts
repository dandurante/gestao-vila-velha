import * as XLSX from "xlsx";

export type ExportColumn = {
  header: string;
  key: string;
  type?: "date" | "currency" | "number" | "string";
};

export type ExportSheet = {
  name: string;
  rows: any[];
  cols: ExportColumn[];
};

function formatCell(v: any, type?: string) {
  if (v === null || v === undefined || v === "") return "";
  if (type === "date") {
    try {
      const d = typeof v === "string" ? new Date(v) : v;
      if (!(d instanceof Date) || isNaN(d.getTime())) return v;
      const dd = String(d.getDate()).padStart(2, "0");
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      return `${dd}/${mm}/${d.getFullYear()}`;
    } catch {
      return v;
    }
  }
  if (type === "currency" || type === "number") return Number(v) || 0;
  return v;
}

function buildSheet(rows: any[], cols: ExportColumn[]) {
  const header = cols.map((c) => c.header);
  const data = rows.map((r) => cols.map((c) => formatCell(r[c.key], c.type)));
  const ws = XLSX.utils.aoa_to_sheet([header, ...data]);
  const range = XLSX.utils.decode_range(ws["!ref"] || "A1");
  ws["!autofilter"] = { ref: ws["!ref"]! };
  ws["!cols"] = cols.map((c) => ({
    wch: Math.max(c.header.length, c.type === "currency" ? 14 : 12) + 2,
  }));
  cols.forEach((c, idx) => {
    if (c.type !== "currency") return;
    for (let R = 1; R <= range.e.r; ++R) {
      const ref = XLSX.utils.encode_cell({ c: idx, r: R });
      if (ws[ref]) {
        ws[ref].z = '"R$" #,##0.00';
        ws[ref].t = "n";
      }
    }
  });
  // bold header (works with SheetJS Pro/styled forks; harmless otherwise)
  for (let C = range.s.c; C <= range.e.c; ++C) {
    const ref = XLSX.utils.encode_cell({ c: C, r: 0 });
    if (ws[ref]) {
      (ws[ref] as any).s = {
        font: { bold: true },
        fill: { fgColor: { rgb: "E5E7EB" } },
      };
    }
  }
  return ws;
}

function sanitizeSheetName(name: string) {
  return name.replace(/[\\/?*[\]:]/g, " ").slice(0, 31) || "Sheet";
}

export function exportSheet(
  filename: string,
  rows: any[],
  cols: ExportColumn[],
  sheetName = "Relatório",
) {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, buildSheet(rows, cols), sanitizeSheetName(sheetName));
  XLSX.writeFile(wb, filename);
}

export function exportWorkbook(filename: string, sheets: ExportSheet[]) {
  const wb = XLSX.utils.book_new();
  sheets.forEach((s) => {
    XLSX.utils.book_append_sheet(wb, buildSheet(s.rows, s.cols), sanitizeSheetName(s.name));
  });
  XLSX.writeFile(wb, filename);
}
