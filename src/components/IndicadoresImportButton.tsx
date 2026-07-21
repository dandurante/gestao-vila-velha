import { useRef, useState } from "react";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { Upload, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  onImported?: () => void;
}

const normalize = (v: any): string =>
  String(v ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase()
    .trim();

const findCol = (headerMap: Record<string, number>, patterns: string[]): number | undefined => {
  for (const p of patterns) {
    if (headerMap[p] !== undefined) return headerMap[p];
  }
  for (const key of Object.keys(headerMap)) {
    if (patterns.some((p) => key.includes(p))) return headerMap[key];
  }
  return undefined;
};

const toIsoDate = (d: Date): string => {
  // Use UTC parts — cellDates:true returns the native date the cell was stored as.
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

const parseNumber = (v: any): number | null => {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return isFinite(v) ? v : null;
  let s = String(v).trim();
  if (!s) return null;
  s = s.replace(/[R$\s%]/g, "");
  // pt-BR: "1.234,56" -> "1234.56"
  if (s.includes(",")) {
    s = s.replace(/\./g, "").replace(",", ".");
  }
  const n = Number(s);
  return isFinite(n) ? n : null;
};

type Row = {
  store_name: string;
  date: string;
  fat: number;
  pedidos: number;
  adt: number | null;
  extremos: number | null;
  entregas_motoqueiros: number | null;
  cmv: number | null;
};

export function IndicadoresImportButton({ onImported }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);

  const handlePick = () => inputRef.current?.click();

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    try {
      const buf = await file.arrayBuffer();
      // CRÍTICO: cellDates:true para evitar bug de fuso horário no Brasil
      const wb = XLSX.read(buf, { cellDates: true });

      const rows: Row[] = [];
      const skipped: string[] = [];

      for (const sheetName of wb.SheetNames) {
        if (normalize(sheetName) === "geral") continue;
        const ws = wb.Sheets[sheetName];
        if (!ws) continue;

        const matrix: any[][] = XLSX.utils.sheet_to_json(ws, {
          header: 1,
          raw: true,
          defval: null,
        });

        // No Excel do cliente, a linha 0 é o cabeçalho e os dados começam na linha 1
        // Colunas fixas: 0 = Data, 1 = Loja, 2 = FAT (SSS), 3 = Pedidos (SSO), 4 = ADT, 5 = Extremos, 6 = Entregas, 7 = CMV
        for (let i = 1; i < matrix.length; i++) {
          const r = matrix[i] || [];
          const rawDate = r[0];

          if (!(rawDate instanceof Date) || isNaN(rawDate.getTime())) continue;

          const fat = parseNumber(r[2]);
          const pedidos = parseNumber(r[3]);

          if (fat === null) continue;

          let rawStoreName = r[1] ? String(r[1]).trim() : sheetName.trim();

          // Mapeamento e normalização para alinhar com os nomes oficiais definidos em src/lib/units.ts
          let normalizedStore = rawStoreName;
          const lowerStore = rawStoreName.toLowerCase();

          if (lowerStore.includes("jabaquara")) {
            normalizedStore = "Jabaquara";
          } else if (lowerStore.includes("spoleto")) {
            normalizedStore = "Spoleto";
          } else if (lowerStore.includes("campo belo")) {
            normalizedStore = "Campo Belo";
          } else if (lowerStore.includes("clementino") || lowerStore === "vila clementino") {
            normalizedStore = "V. Clementino";
          } else if (lowerStore.includes("gopouva") || lowerStore === "vila gopouva") {
            normalizedStore = "V. GOPOUVA";
          } else if (lowerStore.includes("mandaqui") || lowerStore === "parque mandaqui") {
            normalizedStore = "P. MANDAQUI";
          } else if (lowerStore.includes("aclimacao") || lowerStore.includes("aclimação")) {
            normalizedStore = "Aclimação";
          } else if (lowerStore.includes("pinheiros")) {
            normalizedStore = "Pinheiros";
          } else if (lowerStore.includes("gru") || lowerStore.includes("aeroporto")) {
            normalizedStore = "GRU";
          } else if (lowerStore.includes("camburi") || lowerStore === "jardim camburi") {
            normalizedStore = "J. Camburi";
          } else if (lowerStore.includes("canto") || lowerStore === "praia do canto") {
            normalizedStore = "P. Canto";
          } else if (lowerStore.includes("serra")) {
            normalizedStore = "Serra";
          } else if (lowerStore.includes("boali")) {
            normalizedStore = "Boali";
          }

          const isoDateStr = toIsoDate(rawDate);
          
          // Filtro solicitado: apenas de 01/01/2026 a 02/07/2026
          if (isoDateStr < "2026-01-01" || isoDateStr > "2026-07-02") {
            continue;
          }

          rows.push({
            store_name: normalizedStore,
            date: isoDateStr,
            fat,
            pedidos: pedidos !== null ? Math.round(pedidos) : 0,
            adt: parseNumber(r[4]),
            extremos: (() => {
              const n = parseNumber(r[5]);
              return n === null ? null : Math.round(n);
            })(),
            entregas_motoqueiros: parseNumber(r[6]),
            cmv: (() => {
              const c = parseNumber(r[7]);
              return c !== null ? (c <= 1 ? c * 100 : c) : null;
            })(),
          });
        }
      }

      if (rows.length === 0) {
        toast.error("Nenhuma linha válida encontrada na planilha.");
        return;
      }

      // Deduplicate rows by store_name and date
      const dedupMap = new Map<string, Row>();
      for (const r of rows) {
        dedupMap.set(`${r.store_name}|${r.date}`, r);
      }
      const deduped = Array.from(dedupMap.values());

      // Upsert em lotes de 500
      const batchSize = 500;
      let inserted = 0;
      for (let i = 0; i < deduped.length; i += batchSize) {
        const batch = deduped.slice(i, i + batchSize);
        const { error } = await supabase
          .from("store_indicators")
          .upsert(batch, { onConflict: "store_name,date" });
        if (error) throw error;
        inserted += batch.length;
      }

      const msg =
        `${inserted} linha(s) importada(s)` +
        (skipped.length ? ` — abas ignoradas: ${skipped.join(", ")}` : "");
      toast.success(msg);
      onImported?.();
    } catch (err: any) {
      console.error(err);
      toast.error(`Erro ao importar: ${err.message ?? err}`);
    } finally {
      setLoading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        onChange={handleFile}
      />
      <Button type="button" variant="outline" size="sm" onClick={handlePick} disabled={loading}>
        {loading ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Upload className="mr-2 h-4 w-4" />
        )}
        {loading ? "Importando..." : "Importar planilha"}
      </Button>
    </>
  );
}
