import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";

export interface ExistingReceiptPeriod {
  unit: string | null;
  status: string;
  reference_period: string;
  overlappingDates: string[]; // ISO yyyy-MM-dd
}

const ACTIVE_STATUSES = ["signed", "pending", "sent"];

function onlyDigits(value: string | null | undefined): string {
  return (value || "").replace(/\D/g, "");
}

function normalizeName(value: string | null | undefined): string {
  return (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function parseBR(s: string): Date | null {
  const m = s.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
}

function parseReferencePeriod(period: string | null): { start: Date; end: Date } | null {
  if (!period) return null;
  const parts = period.split(/\s+a\s+/i);
  let start: Date | null = null;
  let end: Date | null = null;
  if (parts.length === 2) {
    start = parseBR(parts[0]);
    end = parseBR(parts[1]);
  } else if (parts.length === 1 && parts[0]) {
    start = parseBR(parts[0]);
    end = start;
  }
  if (!start || !end) return null;
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function toISO(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

function normalizeDateValue(v: unknown): string | null {
  if (!v) return null;
  if (typeof v === "string") {
    // Accept "yyyy-MM-dd" or full ISO timestamps
    if (/^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
    const d = new Date(v);
    if (!isNaN(d.getTime())) return toISO(d);
    return null;
  }
  if (v instanceof Date) return toISO(v);
  return null;
}

/**
 * Busca recibos já emitidos (assinado/pendente/enviado) que cubram
 * algum dos `workedDates` informados (mesmo prestador). O bloqueio é por DIA
 * efetivamente trabalhado, não por intervalo de seleção.
 *
 * Compatibilidade: para recibos antigos sem `worked_dates`, a verificação cai
 * para o intervalo `reference_period` (comportamento legado).
 */
export async function findOverlappingReceipts(params: {
  freelancerName: string;
  freelancerCpf?: string | null;
  unit?: string | null;
  workedDates: string[]; // ISO yyyy-MM-dd
}): Promise<ExistingReceiptPeriod[]> {
  const { freelancerName, freelancerCpf, unit, workedDates } = params;
  if (!workedDates || workedDates.length === 0) return [];
  const cpfDigits = onlyDigits(freelancerCpf);
  const nameKey = normalizeName(freelancerName);

  const { data, error } = await supabase
    .from("signed_receipts")
    .select("freelancer_name, freelancer_cpf, unit, status, reference_period, worked_dates")
    .in("status", ACTIVE_STATUSES)
    .not("worked_dates", "is", null);
  if (error) throw error;

  const out: ExistingReceiptPeriod[] = [];
  for (const r of data || []) {
    if (unit && r.unit && r.unit !== unit) continue;

    const sameFreelancer = cpfDigits
      ? onlyDigits((r as any).freelancer_cpf) === cpfDigits
      : normalizeName((r as any).freelancer_name) === nameKey;

    if (!sameFreelancer) continue;

    const wd: unknown = (r as any).worked_dates;
    let existingDates: string[] | null = null;
    if (Array.isArray(wd) && wd.length > 0) {
      existingDates = wd.map(normalizeDateValue).filter((x): x is string => !!x);
    }

    let overlap: string[] = [];
    if (existingDates && existingDates.length > 0) {
      const eSet = new Set(existingDates);
      overlap = workedDates.filter((d) => eSet.has(d));
    } else {
      // Recibos legados sem `worked_dates` não bloqueiam nenhum dia
      // (o intervalo de seleção não representa os dias efetivamente trabalhados).
      continue;
    }

    if (overlap.length > 0) {
      out.push({
        unit: r.unit,
        status: r.status,
        reference_period: (r as any).reference_period || "",
        overlappingDates: overlap.sort(),
      });
    }
  }
  return out;
}

export function formatPeriodList(periods: ExistingReceiptPeriod[]): string {
  return periods
    .map((p) => {
      const days = p.overlappingDates
        .map((iso) => {
          const [y, m, d] = iso.split("-");
          return `${d}/${m}/${y}`;
        })
        .join(", ");
      return p.unit ? `${days} (${p.unit})` : days;
    })
    .join("; ");
}
