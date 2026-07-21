import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Trash2,
  Copy,
  Check,
  Download,
  Users,
  FileText,
  CalendarIcon,
  Filter,
  ChevronsUpDown,
} from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { UNITS, UNIT_DETAILS, type Unit, getUnitDisplayName } from "@/lib/units";
import { formatBRL, formatBRLCurrency } from "@/lib/currency";
import { CurrencyInput } from "@/components/CurrencyInput";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useFreelancerRegistry } from "@/hooks/useFreelancerRegistry";
import { ReceiptModal } from "@/components/ReceiptModal";
import { BulkReceiptsModal } from "@/components/BulkReceiptsModal";
import { Checkbox } from "@/components/ui/checkbox";
import { Send } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format, startOfMonth, endOfMonth, isWithinInterval, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { type DateRange } from "react-day-picker";

interface FreelancerRow {
  id: string;
  entry_date: string;
  unit: string;
  name: string;
  role: string;
  pix: string;
  daily_rate: number;
  deliveries_count?: number | null;
  deliveries_total?: number | null;
}

interface SignedReceiptStatusRow {
  freelancer_name: string;
  freelancer_cpf: string | null;
  unit: string | null;
  status: string;
  reference_period: string | null;
}

interface DraftRow {
  name: string;
  pix: string;
  daily_rate: number;
  role?: "Operador" | "Entregador";
  deliveries_5?: number;
  deliveries_6?: number;
  deliveries_count?: number;
  deliveries_total?: number;
}

const emptyDraft: DraftRow = { name: "", pix: "", daily_rate: 0 };

function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatDateBR(iso: string): string {
  if (!iso) return "-";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function parseBRDate(s: string): Date | null {
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
    start = parseBRDate(parts[0]);
    end = parseBRDate(parts[1]);
  } else if (parts.length === 1 && parts[0]) {
    start = parseBRDate(parts[0]);
    end = start;
  }
  if (!start || !end) return null;
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

// Extrai período a partir do filename (ex: ..._2026-05-21_a_2026-05-27.pdf)
function parsePeriodFromFilename(name: string | null): { start: Date; end: Date } | null {
  if (!name) return null;
  const m = name.match(/(\d{4})-(\d{2})-(\d{2})_a_(\d{4})-(\d{2})-(\d{2})/);
  if (!m) {
    const single = name.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (!single) return null;
    const d = new Date(Number(single[1]), Number(single[2]) - 1, Number(single[3]));
    const s = new Date(d);
    s.setHours(0, 0, 0, 0);
    const e = new Date(d);
    e.setHours(23, 59, 59, 999);
    return { start: s, end: e };
  }
  const start = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  start.setHours(0, 0, 0, 0);
  const end = new Date(Number(m[4]), Number(m[5]) - 1, Number(m[6]));
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

// Normaliza nome para comparação (remove acentos, espaços, caracteres especiais)
function normalizeNameKey(s: string): string {
  return (s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

// Extrai um slug do "freelancer_name" (que pode ser o filename completo)
function receiptNameSlug(raw: string): string {
  let s = (raw || "").trim();
  s = s.replace(/\.pdf$/i, "");
  s = s.replace(/^recibo[_\s-]*/i, "");
  s = s.replace(/[_\s-]?\d{4}-\d{2}-\d{2}.*$/, "");
  return normalizeNameKey(s);
}

async function fetchAllFromTable<T>(
  table: "freelancers" | "signed_receipts",
  select: string,
  orderColumn: string,
): Promise<T[]> {
  const pageSize = 1000;
  const all: T[] = [];

  for (let from = 0; ; from += pageSize) {
    const to = from + pageSize - 1;
    const { data, error } = await (supabase as any)
      .from(table)
      .select(select)
      .order(orderColumn, { ascending: false })
      .range(from, to);

    if (error) throw error;
    const page = (data || []) as T[];
    all.push(...page);
    if (page.length < pageSize) break;
  }

  return all;
}

export function Freelancers() {
  const [mounted, setMounted] = useState(false);
  const { registry, isLoaded } = useFreelancerRegistry();
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [receiptData, setReceiptData] = useState({ name: "", pix: "" });
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const isAdmin = userEmail === "dandurante@hotmail.com";

  useEffect(() => {
    setMounted(true);
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserEmail(session?.user?.email ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUserEmail(session?.user?.email ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const qc = useQueryClient();
  const [today, setToday] = useState<string>("");
  const [entryDate, setEntryDate] = useState<string>("");

  useEffect(() => {
    const iso = toISODate(new Date());
    setToday(iso);
    setEntryDate((prev) => prev || iso);
  }, []);

  const [unit, setUnit] = useState<Unit>(UNITS[0]);
  const [selectedState, setSelectedState] = useState<"SP" | "ES">("SP");
  const [filterUnit, setFilterUnit] = useState<Unit | "all">("all");
  const [historyRoleFilter, setHistoryRoleFilter] = useState<"all" | "Operador" | "Entregador">(
    "all",
  );
  const [historyPerson, setHistoryPerson] = useState<string>("all");
  const [drafts, setDrafts] = useState<DraftRow[]>([{ ...emptyDraft }]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [historyRange, setHistoryRange] = useState<DateRange | undefined>(undefined); // Intervalo p/ histórico

  // Filtro de Totais
  const [totalsUnit, setTotalsUnit] = useState<Unit | "all">("all");
  const [roleFilter, setRoleFilter] = useState<"all" | "Operador" | "Entregador">("all");
  const [selectedPerson, setSelectedPerson] = useState<string>("all"); // filtro por prestador de serviço nos totais
  const [selectedTotalsUnit, setSelectedTotalsUnit] = useState<string>("all"); // filtro de loja específico nos totais por loja
  const [receiptStatusFilter, setReceiptStatusFilter] = useState<
    "all" | "signed" | "sent" | "not_issued"
  >("all"); // filtro por status do recibo
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });
  const [personPage, setPersonPage] = useState(1);
  const PERSON_PAGE_SIZE = 12;
  useEffect(() => {
    setPersonPage(1);
  }, [selectedPerson, totalsUnit, roleFilter, receiptStatusFilter, dateRange]);

  // Seleção múltipla para envio em lote
  const [selectedBulkKeys, setSelectedBulkKeys] = useState<Set<string>>(new Set());
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const personKey = (name: string, pix: string) => `${name.toLowerCase()}|${pix}`;
  const toggleBulk = (key: string) => {
    setSelectedBulkKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["freelancers"],
    queryFn: async () => {
      const data = await fetchAllFromTable<FreelancerRow>("freelancers", "*", "entry_date");
      return data.sort((a, b) => {
        const byDate = b.entry_date.localeCompare(a.entry_date);
        if (byDate !== 0) return byDate;
        return b.id.localeCompare(a.id);
      });
    },
  });

  const { data: signedReceipts = [] } = useQuery({
    queryKey: ["signed_receipts", "freelancers_status_filter"],
    queryFn: async () => {
      const data = await fetchAllFromTable<SignedReceiptStatusRow>(
        "signed_receipts",
        "freelancer_name, freelancer_cpf, unit, status, reference_period",
        "created_at",
      );
      return data.filter((r) => ["signed", "pending", "sent"].includes(r.status));
    },
  });

  const insertMutation = useMutation({
    mutationFn: async (payload: Array<Omit<FreelancerRow, "id">>) => {
      const { error } = await supabase.from("freelancers").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["freelancers"] });
      setDrafts([{ ...emptyDraft }]);
      toast.success("Lançamento salvo!");
    },
    onError: (err: Error) => toast.error(`Erro ao salvar: ${err.message}`),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("freelancers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["freelancers"] });
      toast.success("Lançamento removido");
    },
    onError: (err: Error) => toast.error(`Erro ao remover: ${err.message}`),
  });

  const updateDraft = (index: number, patch: Partial<DraftRow>) => {
    setDrafts((prev) => prev.map((d, i) => (i === index ? { ...d, ...patch } : d)));
  };

  const addDraftRow = () => setDrafts((prev) => [...prev, { ...emptyDraft }]);
  const removeDraftRow = (index: number) =>
    setDrafts((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== index)));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const valid = drafts.filter((d) => d.name.trim() && d.pix.trim() && d.daily_rate > 0);
    if (valid.length === 0) {
      toast.error("Preencha pelo menos um freelancer (nome, pix e valor).");
      return;
    }

    // Bloqueia duplicidade: mesmo prestador (nome) já lançado nesta data
    const norm = (s: string) => s.trim().toLowerCase();
    const existingNamesOnDate = new Set(
      rows.filter((r) => r.entry_date === entryDate).map((r) => norm(r.name)),
    );
    const seenInBatch = new Set<string>();
    for (const d of valid) {
      const key = norm(d.name);
      if (existingNamesOnDate.has(key)) {
        toast.error(
          `${d.name.trim()} já possui lançamento em ${entryDate.split("-").reverse().join("/")}.`,
        );
        return;
      }
      if (seenInBatch.has(key)) {
        toast.error(`${d.name.trim()} está duplicado na mesma data dentro deste lançamento.`);
        return;
      }
      seenInBatch.add(key);
    }

    const payload = valid.map((d) => {
      const q5 = Number(d.deliveries_5 || 0);
      const q6 = Number(d.deliveries_6 || 0);
      const totalDeliveries = q5 * 5 + q6 * 6;
      return {
        entry_date: entryDate,
        unit,
        name: d.name.trim(),
        role: "Freelancer Autônomo",
        pix: d.pix.trim(),
        daily_rate: d.daily_rate,
        deliveries_count: d.role === "Entregador" ? q5 + q6 : null,
        deliveries_total: d.role === "Entregador" ? totalDeliveries : null,
      };
    });
    insertMutation.mutate(payload);
  };

  const handleCopyPix = async (id: string, pix: string) => {
    try {
      await navigator.clipboard.writeText(pix);
      setCopiedId(id);
      toast.success("Pix copiado!");
      setTimeout(() => setCopiedId((c) => (c === id ? null : c)), 1500);
    } catch {
      toast.error("Não foi possível copiar");
    }
  };

  // Cálculos de Totais baseados no Intervalo de Datas e Loja selecionada
  const filteredTotalsRows = useMemo(() => {
    if (!dateRange?.from || !dateRange?.to) return [];

    return rows.filter((r) => {
      const date = parseISO(r.entry_date);
      const matchesDate = isWithinInterval(date, { start: dateRange.from!, end: dateRange.to! });
      const matchesUnit = totalsUnit === "all" || r.unit === totalsUnit;
      return matchesDate && matchesUnit;
    });
  }, [rows, dateRange, totalsUnit]);

  // Lista de prestadores de serviço únicos com lançamentos no período (para o seletor de totais)
  const peopleWithEntries = useMemo(() => {
    const set = new Map<string, string>(); // key -> displayName
    for (const r of filteredTotalsRows) {
      const name = (r.name || "").trim();
      if (!name) continue;
      const key = name.toLowerCase();
      if (!set.has(key)) set.set(key, name);
    }
    return Array.from(set.values()).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [filteredTotalsRows]);

  // Lista de lojas únicas com lançamentos no período (para o seletor de totais por loja)
  const unitsWithEntries = useMemo(() => {
    const set = new Set<string>();
    for (const r of filteredTotalsRows) {
      if (r.unit && r.unit.trim()) set.add(r.unit);
    }
    return Array.from(set).sort();
  }, [filteredTotalsRows]);

  const totalsByPerson = useMemo(() => {
    const map = new Map<
      string,
      { name: string; pix: string; total: number; days: number; lastUnit: string; role: string }
    >();

    for (const r of filteredTotalsRows) {
      // Busca o cargo no registro
      const reg = registry.find(
        (f) => f.nome.trim().toLowerCase() === (r.name || "").trim().toLowerCase(),
      );
      const role = reg?.role || "Operador";

      // Filtra por cargo se houver filtro selecionado
      if (roleFilter !== "all" && role !== roleFilter) continue;
      // Filtra por prestador de serviço selecionado
      if (selectedPerson !== "all" && r.name.toLowerCase() !== selectedPerson.toLowerCase())
        continue;

      const key = `${r.name.toLowerCase()}|${r.pix}`;
      const entryValue = Number(r.daily_rate) + Number(r.deliveries_total || 0);
      const cur = map.get(key);
      if (cur) {
        cur.total += entryValue;
        cur.days += 1;
        cur.lastUnit = r.unit;
      } else {
        map.set(key, {
          name: r.name,
          pix: r.pix,
          total: entryValue,
          days: 1,
          lastUnit: r.unit,
          role: role,
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }, [filteredTotalsRows, registry, roleFilter, selectedPerson]);

  // Pré-processa recibos: extrai período (do reference_period OU do filename)
  // e um "slug" normalizado do nome para casar com o prestador
  const processedReceipts = useMemo(() => {
    return signedReceipts.map((r) => {
      const period =
        parseReferencePeriod(r.reference_period) ?? parsePeriodFromFilename(r.freelancer_name);
      const slug = receiptNameSlug(r.freelancer_name);
      const cpf = (r.freelancer_cpf || "").replace(/\D/g, "");
      // status normalizado: "signed" = assinado; "sent" = emitido mas não assinado (pending/sent)
      const normStatus: "signed" | "sent" = r.status === "signed" ? "signed" : "sent";
      return { period, slug, cpf, status: normStatus, unit: r.unit || null };
    });
  }, [signedReceipts]);

  // Mapeia o status do recibo de cada prestador no período selecionado
  const personReceiptStatus = useMemo(() => {
    const map = new Map<string, "signed" | "sent" | "not_issued">();
    if (!dateRange?.from || !dateRange?.to) return map;

    const rangeStart = new Date(dateRange.from);
    rangeStart.setHours(0, 0, 0, 0);
    const rangeEnd = new Date(dateRange.to);
    rangeEnd.setHours(23, 59, 59, 999);

    // recibos que estão dentro do período selecionado
    const inRange = processedReceipts.filter((r) => {
      if (!r.period) return false;
      return !(r.period.end < rangeStart || r.period.start > rangeEnd);
    });

    // para cada prestador exibido, verifica se há recibo correspondente
    for (const p of totalsByPerson) {
      const nameKey = normalizeNameKey(p.name);
      if (!nameKey) continue;
      // procura por CPF do registry, se houver
      const reg = registry.find((f) => normalizeNameKey(f.nome) === nameKey);
      const regCpf = (reg?.cpf || "").replace(/\D/g, "");

      let best: "signed" | "sent" | null = null;
      for (const r of inRange) {
        if (totalsUnit !== "all" && r.unit && r.unit !== totalsUnit) continue;
        const matches =
          (regCpf && r.cpf && r.cpf === regCpf) ||
          (r.slug &&
            (r.slug === nameKey || r.slug.startsWith(nameKey) || nameKey.startsWith(r.slug)));
        if (!matches) continue;
        if (r.status === "signed") {
          best = "signed";
          break;
        }
        best = best ?? "sent";
      }
      map.set(nameKey, best ?? "not_issued");
    }
    return map;
  }, [processedReceipts, dateRange, totalsByPerson, registry, totalsUnit]);

  // Filtra totais por prestador de acordo com o status do recibo selecionado
  const filteredTotalsByPerson = useMemo(() => {
    if (receiptStatusFilter === "all") return totalsByPerson;
    return totalsByPerson.filter((p) => {
      const status = personReceiptStatus.get(normalizeNameKey(p.name)) ?? "not_issued";
      return status === receiptStatusFilter;
    });
  }, [totalsByPerson, personReceiptStatus, receiptStatusFilter]);

  const totalsByUnit = useMemo(() => {
    const map = new Map<string, { unit: string; total: number; count: number }>();
    for (const r of filteredTotalsRows) {
      if (selectedTotalsUnit !== "all" && r.unit !== selectedTotalsUnit) continue;
      // Aplica o mesmo filtro de função usado em "Totais por Prestador" e no histórico
      const reg = registry.find(
        (f) => f.nome.trim().toLowerCase() === (r.name || "").trim().toLowerCase(),
      );
      const role = reg?.role || "Operador";
      if (roleFilter !== "all" && role !== roleFilter) continue;

      const entryValue = Number(r.daily_rate) + Number(r.deliveries_total || 0);
      const cur = map.get(r.unit);
      if (cur) {
        cur.total += entryValue;
        cur.count += 1;
      } else {
        map.set(r.unit, { unit: r.unit, total: entryValue, count: 1 });
      }
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [filteredTotalsRows, selectedTotalsUnit, registry, roleFilter]);

  const periodGrandTotal = useMemo(() => {
    let total = 0;
    for (const r of filteredTotalsRows) {
      const reg = registry.find(
        (f) => f.nome.trim().toLowerCase() === (r.name || "").trim().toLowerCase(),
      );
      const role = reg?.role || "Operador";
      if (roleFilter !== "all" && role !== roleFilter) continue;
      if (selectedPerson !== "all" && r.name.toLowerCase() !== selectedPerson.toLowerCase())
        continue;
      total += Number(r.daily_rate) + Number(r.deliveries_total || 0);
    }
    return total;
  }, [filteredTotalsRows, registry, roleFilter, selectedPerson]);

  // Lançamentos após filtros de Loja, Função e Data (sem filtro de pessoa) — usado para popular o seletor de pessoas
  const historyBaseRows = useMemo(() => {
    let filtered = rows;
    if (filterUnit !== "all") {
      filtered = filtered.filter((r) => r.unit === filterUnit);
    }
    if (historyRoleFilter !== "all") {
      filtered = filtered.filter((r) => {
        const reg = registry.find(
          (f) => f.nome.trim().toLowerCase() === (r.name || "").trim().toLowerCase(),
        );
        const role = reg?.role || "Operador";
        return role === historyRoleFilter;
      });
    }
    if (historyRange?.from) {
      const fromISO = toISODate(historyRange.from);
      const toISOStr = toISODate(historyRange.to ?? historyRange.from);
      filtered = filtered.filter((r) => r.entry_date >= fromISO && r.entry_date <= toISOStr);
    } else if (today) {
      filtered = filtered.filter((r) => r.entry_date === today);
    }
    return filtered;
  }, [rows, filterUnit, historyRange, today, historyRoleFilter, registry]);

  const historyPeople = useMemo(() => {
    const set = new Map<string, string>();
    for (const r of historyBaseRows) {
      const key = (r.name || "").trim().toLowerCase();
      if (key && !set.has(key)) set.set(key, r.name);
    }
    return Array.from(set.values()).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [historyBaseRows]);

  // Reseta o filtro de pessoa quando o conjunto disponível muda e a pessoa selecionada não está mais presente
  useEffect(() => {
    if (historyPerson === "all") return;
    const exists = historyPeople.some(
      (n) => n.trim().toLowerCase() === historyPerson.trim().toLowerCase(),
    );
    if (!exists) setHistoryPerson("all");
  }, [historyPeople, historyPerson]);

  const visibleRows = useMemo(() => {
    if (historyPerson === "all") return historyBaseRows;
    return historyBaseRows.filter(
      (r) => (r.name || "").trim().toLowerCase() === historyPerson.trim().toLowerCase(),
    );
  }, [historyBaseRows, historyPerson]);

  const exportCSV = () => {
    const header = ["Data", "Loja", "Nome", "Função", "Pix", "Valor diária"];
    const lines = visibleRows.map((r) =>
      [
        formatDateBR(r.entry_date),
        r.unit,
        r.name,
        r.role,
        r.pix,
        formatBRL(Number(r.daily_rate)).replace(".", ""),
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(";"),
    );
    const csv = "\uFEFF" + [header.join(";"), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `freelancers-${today}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!mounted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/40">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="h-8 w-64 animate-pulse rounded-md bg-muted" />
          <div className="mt-6 h-64 animate-pulse rounded-lg bg-muted/60" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/40">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <header className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="mb-1 flex items-center gap-2">
              <div className="rounded-lg bg-primary/10 p-2">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                Controle de Freelancers
              </h1>
            </div>
            <p className="text-sm text-muted-foreground">
              Lançamentos diários por loja e totais consolidados por período.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" asChild>
              <Link to="/cadastro">Cadastrar</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/recibos-assinados">
                <FileText className="mr-2 h-4 w-4" />
                Recibos Assinados
              </Link>
            </Button>
            <Button variant="outline" onClick={exportCSV} disabled={visibleRows.length === 0}>
              <Download className="mr-2 h-4 w-4" />
              Exportar CSV
            </Button>
          </div>
        </header>

        {/* Form de Lançamento */}
        <Card className="mb-8 border-border/60 shadow-sm">
          <CardHeader>
            <CardTitle>Novo lançamento</CardTitle>
            <CardDescription>
              Selecione data e loja. Adicione um ou mais freelancers e salve tudo de uma vez.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label>Estado</Label>
                  <Select
                    value={selectedState}
                    onValueChange={(v: "SP" | "ES") => {
                      setSelectedState(v);
                      // Reseta para a primeira loja do estado selecionado
                      const firstInState = UNITS.find((u) => UNIT_DETAILS[u].state === v);
                      if (firstInState) setUnit(firstInState);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SP">São Paulo (SP)</SelectItem>
                      <SelectItem value="ES">Espírito Santo (ES)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="entry-date">Data</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant={"outline"}
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !entryDate && "text-muted-foreground",
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {entryDate ? (
                          format(new Date(entryDate + "T12:00:00"), "dd/MM/yyyy", { locale: ptBR })
                        ) : (
                          <span>dd/mm/aaaa</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={entryDate ? new Date(entryDate + "T12:00:00") : undefined}
                        onSelect={(date) => {
                          if (date) {
                            const y = date.getFullYear();
                            const m = String(date.getMonth() + 1).padStart(2, "0");
                            const d = String(date.getDate()).padStart(2, "0");
                            setEntryDate(`${y}-${m}-${d}`);
                          }
                        }}
                        locale={ptBR}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-2">
                  <Label>Loja</Label>
                  <Select value={unit} onValueChange={(v) => setUnit(v as Unit)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {UNITS.filter((u) => UNIT_DETAILS[u].state === selectedState).map((u) => (
                        <SelectItem key={u} value={u}>
                          {getUnitDisplayName(u)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-3">
                {drafts.map((d, i) => {
                  const isEntregador = d.role === "Entregador";
                  return (
                    <div
                      key={i}
                      className="grid gap-3 rounded-lg border border-border/60 bg-card/50 p-3 sm:grid-cols-12"
                    >
                      <div className="space-y-1 sm:col-span-4">
                        <Label className="text-xs">Nome (Cadastrado)</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              role="combobox"
                              className={cn(
                                "w-full justify-between font-normal",
                                !d.name && "text-muted-foreground",
                              )}
                            >
                              {d.name || "Selecione..."}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent
                            className="w-[var(--radix-popover-trigger-width)] p-0"
                            align="start"
                          >
                            <Command>
                              <CommandInput placeholder="Digite o nome..." />
                              <CommandList>
                                <CommandEmpty>Nenhum prestador encontrado.</CommandEmpty>
                                <CommandGroup>
                                  {registry.map((f) => (
                                    <CommandItem
                                      key={f.id}
                                      value={f.nome}
                                      onSelect={() => {
                                        updateDraft(i, {
                                          name: f.nome,
                                          pix: f.pix,
                                          role: (f.role as "Operador" | "Entregador") || "Operador",
                                          deliveries_5: undefined,
                                          deliveries_6: undefined,
                                          deliveries_count: undefined,
                                          deliveries_total: undefined,
                                        });
                                      }}
                                    >
                                      <Check
                                        className={cn(
                                          "mr-2 h-4 w-4",
                                          d.name === f.nome ? "opacity-100" : "opacity-0",
                                        )}
                                      />
                                      {f.nome}
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      </div>
                      <div className="space-y-1 sm:col-span-4">
                        <Label className="text-xs">Pix</Label>
                        <Input
                          value={d.pix}
                          readOnly
                          className="bg-muted"
                          placeholder="Selecione o nome"
                        />
                      </div>
                      <div className="space-y-1 sm:col-span-3">
                        <Label className="text-xs">Diária</Label>
                        <CurrencyInput
                          value={d.daily_rate}
                          onValueChange={(v) => updateDraft(i, { daily_rate: v })}
                        />
                      </div>
                      <div className="flex items-end sm:col-span-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeDraftRow(i)}
                          disabled={drafts.length === 1}
                          aria-label="Remover linha"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>

                      {isEntregador &&
                        (() => {
                          const q5 = Number(d.deliveries_5 || 0);
                          const q6 = Number(d.deliveries_6 || 0);
                          const totalEntregas = q5 * 5 + q6 * 6;
                          return (
                            <>
                              <div className="space-y-1 sm:col-span-4">
                                <Label className="text-xs">Qtd. entregas R$ 5,00</Label>
                                <Input
                                  type="number"
                                  inputMode="numeric"
                                  min={0}
                                  value={d.deliveries_5 ?? ""}
                                  onChange={(e) =>
                                    updateDraft(i, {
                                      deliveries_5:
                                        e.target.value === "" ? undefined : Number(e.target.value),
                                    })
                                  }
                                  placeholder="0"
                                />
                              </div>
                              <div className="space-y-1 sm:col-span-4">
                                <Label className="text-xs">Qtd. entregas R$ 6,00</Label>
                                <Input
                                  type="number"
                                  inputMode="numeric"
                                  min={0}
                                  value={d.deliveries_6 ?? ""}
                                  onChange={(e) =>
                                    updateDraft(i, {
                                      deliveries_6:
                                        e.target.value === "" ? undefined : Number(e.target.value),
                                    })
                                  }
                                  placeholder="0"
                                />
                              </div>
                              <div className="space-y-1 sm:col-span-4">
                                <Label className="text-xs">Valor total das entregas</Label>
                                <Input
                                  value={formatBRLCurrency(totalEntregas)}
                                  readOnly
                                  className="bg-muted"
                                />
                              </div>
                            </>
                          );
                        })()}
                    </div>
                  );
                })}
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
                <Button type="button" variant="outline" onClick={addDraftRow}>
                  <Plus className="mr-2 h-4 w-4" />
                  Adicionar prestador de serviço
                </Button>
                <Button type="submit" disabled={insertMutation.isPending}>
                  {insertMutation.isPending ? "Salvando..." : "Salvar lançamento"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Filtros de Totais e Recibos */}
        <Card className="mb-8 border-border/60 bg-muted/20 shadow-sm">
          <CardContent className="pt-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div className="flex flex-1 flex-col gap-4 sm:flex-row sm:items-end">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <CalendarIcon className="h-4 w-4" />
                    Período para Totais/Recibos
                  </Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal sm:w-[280px]",
                          !dateRange && "text-muted-foreground",
                        )}
                      >
                        {dateRange?.from ? (
                          dateRange.to ? (
                            <>
                              {format(dateRange.from, "dd/MM/yyyy")} -{" "}
                              {format(dateRange.to, "dd/MM/yyyy")}
                            </>
                          ) : (
                            format(dateRange.from, "dd/MM/yyyy")
                          )
                        ) : (
                          <span>Selecione o período</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        initialFocus
                        mode="range"
                        defaultMonth={dateRange?.from}
                        selected={dateRange}
                        onSelect={setDateRange}
                        numberOfMonths={2}
                        locale={ptBR}
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Filter className="h-4 w-4" />
                    Filtrar Loja
                  </Label>
                  <Select
                    value={totalsUnit}
                    onValueChange={(v) => setTotalsUnit(v as Unit | "all")}
                  >
                    <SelectTrigger className="w-full sm:w-[180px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas as lojas</SelectItem>
                      {UNITS.map((u) => (
                        <SelectItem key={u} value={u}>
                          {getUnitDisplayName(u)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Cargo
                  </Label>
                  <Select value={roleFilter} onValueChange={(v) => setRoleFilter(v as any)}>
                    <SelectTrigger className="w-full sm:w-[150px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="Operador">Operadores</SelectItem>
                      <SelectItem value="Entregador">Entregadores</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="text-right">
                <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                  Total do Período
                </p>
                <p className="text-2xl font-bold text-primary">
                  {formatBRLCurrency(periodGrandTotal)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Totals Section */}
        <div className="mb-8 grid items-stretch gap-4 lg:grid-cols-2">
          <Card className="flex flex-col border-border/60 shadow-sm">
            <CardHeader className="flex flex-col gap-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <CardTitle className="text-base">Totais por Prestador de Serviço</CardTitle>
                  <CardDescription>Consolidado do período selecionado.</CardDescription>
                </div>
                <Select value={selectedPerson} onValueChange={setSelectedPerson}>
                  <SelectTrigger className="w-full sm:w-[220px]">
                    <SelectValue placeholder="Todos prestadores de serviço" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos prestadores de serviço</SelectItem>
                    {peopleWithEntries.map((n) => (
                      <SelectItem key={n} value={n}>
                        {n}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={receiptStatusFilter}
                  onValueChange={(v: "all" | "signed" | "sent" | "not_issued") =>
                    setReceiptStatusFilter(v)
                  }
                >
                  <SelectTrigger className="w-full sm:w-[160px]">
                    <SelectValue placeholder="Status do recibo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os status</SelectItem>
                    <SelectItem value="signed">Assinado</SelectItem>
                    <SelectItem value="sent">Enviado</SelectItem>
                    <SelectItem value="not_issued">Não emitido</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {filteredTotalsByPerson.length > 0 &&
                (() => {
                  const allKeys = filteredTotalsByPerson.map((p) => personKey(p.name, p.pix));
                  const allChecked =
                    allKeys.length > 0 && allKeys.every((k) => selectedBulkKeys.has(k));
                  const someChecked = allKeys.some((k) => selectedBulkKeys.has(k));
                  return (
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/60 bg-muted/30 px-3 py-2">
                      <label className="flex cursor-pointer items-center gap-2 text-sm">
                        <Checkbox
                          checked={allChecked ? true : someChecked ? "indeterminate" : false}
                          onCheckedChange={(v) => {
                            setSelectedBulkKeys((prev) => {
                              const next = new Set(prev);
                              if (v) allKeys.forEach((k) => next.add(k));
                              else allKeys.forEach((k) => next.delete(k));
                              return next;
                            });
                          }}
                        />
                        <span>Selecionar todos ({filteredTotalsByPerson.length})</span>
                      </label>
                      <div className="flex items-center gap-2">
                        {selectedBulkKeys.size > 0 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8"
                            onClick={() => setSelectedBulkKeys(new Set())}
                          >
                            Limpar
                          </Button>
                        )}
                        <Button
                          type="button"
                          size="sm"
                          className="h-8"
                          disabled={selectedBulkKeys.size === 0}
                          onClick={() => setBulkModalOpen(true)}
                        >
                          <Send className="mr-1 h-4 w-4" />
                          Gerar e enviar ({selectedBulkKeys.size})
                        </Button>
                      </div>
                    </div>
                  );
                })()}
            </CardHeader>
            <CardContent className="flex flex-1 flex-col">
              {filteredTotalsByPerson.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sem lançamentos para este filtro.</p>
              ) : (
                <>
                  <ul className="flex-1 divide-y divide-border/60">
                    {filteredTotalsByPerson
                      .slice((personPage - 1) * PERSON_PAGE_SIZE, personPage * PERSON_PAGE_SIZE)
                      .map((p) => (
                        <li key={`${p.name}-${p.pix}`} className="flex items-center gap-3 py-2">
                          <Checkbox
                            checked={selectedBulkKeys.has(personKey(p.name, p.pix))}
                            onCheckedChange={() => toggleBulk(personKey(p.name, p.pix))}
                            aria-label={`Selecionar ${p.name}`}
                          />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{p.name}</p>
                            <p className="truncate text-xs text-muted-foreground">
                              <span
                                className={`mr-2 inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                                  p.role === "Entregador"
                                    ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                                    : "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400"
                                }`}
                              >
                                {p.role}
                              </span>
                              {p.days} {p.days === 1 ? "diária" : "diárias"} • {p.pix}
                            </p>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="font-mono-tabular text-sm font-semibold">
                              {formatBRLCurrency(p.total)}
                            </span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-primary"
                              onClick={() => {
                                setReceiptData({ name: p.name, pix: p.pix });
                                setReceiptOpen(true);
                              }}
                              title="Gerar Recibo"
                            >
                              <FileText className="h-4 w-4" />
                            </Button>
                          </div>
                        </li>
                      ))}
                  </ul>
                  {filteredTotalsByPerson.length > PERSON_PAGE_SIZE &&
                    (() => {
                      const totalPages = Math.ceil(
                        filteredTotalsByPerson.length / PERSON_PAGE_SIZE,
                      );
                      const currentPage = Math.min(personPage, totalPages);
                      return (
                        <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-3">
                          <span className="text-xs text-muted-foreground">
                            Página {currentPage} de {totalPages} • {filteredTotalsByPerson.length}{" "}
                            prestadores
                          </span>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 px-2"
                              disabled={currentPage <= 1}
                              onClick={() => setPersonPage((p) => Math.max(1, p - 1))}
                            >
                              Anterior
                            </Button>
                            <Select
                              value={String(currentPage)}
                              onValueChange={(v) => setPersonPage(Number(v))}
                            >
                              <SelectTrigger className="h-7 w-[70px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                                  <SelectItem key={n} value={String(n)}>
                                    {n}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 px-2"
                              disabled={currentPage >= totalPages}
                              onClick={() => setPersonPage((p) => Math.min(totalPages, p + 1))}
                            >
                              Próxima
                            </Button>
                          </div>
                        </div>
                      );
                    })()}
                </>
              )}
            </CardContent>
          </Card>

          <Card className="flex flex-col border-border/60 shadow-sm">
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle className="text-base">Totais por Loja</CardTitle>
                <CardDescription>Somatório de diárias no período selecionado.</CardDescription>
              </div>
              <Select value={selectedTotalsUnit} onValueChange={setSelectedTotalsUnit}>
                <SelectTrigger className="w-full sm:w-[200px]">
                  <SelectValue placeholder="Todas as lojas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as lojas</SelectItem>
                  {unitsWithEntries.map((u) => (
                    <SelectItem key={u} value={u}>
                      {u}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardHeader>
            <CardContent>
              {totalsByUnit.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sem lançamentos para este filtro.</p>
              ) : (
                <ul className="divide-y divide-border/60">
                  {totalsByUnit.map((u) => (
                    <li key={u.unit} className="flex items-center justify-between py-2">
                      <div>
                        <p className="text-sm font-medium">{u.unit}</p>
                        <p className="text-xs text-muted-foreground">
                          {u.count} {u.count === 1 ? "lançamento" : "lançamentos"}
                        </p>
                      </div>
                      <span className="font-mono-tabular text-sm font-semibold">
                        {formatBRLCurrency(u.total)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Tabela de Lançamentos Individuais */}
        <Card className="border-border/60 shadow-sm">
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base">Histórico de Lançamentos</CardTitle>
              <CardDescription>Todos os lançamentos ordenados por data.</CardDescription>
            </div>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
              <div className="flex gap-1">
                <Button
                  type="button"
                  variant={historyRoleFilter === "all" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setHistoryRoleFilter("all")}
                >
                  Todos
                </Button>
                <Button
                  type="button"
                  variant={historyRoleFilter === "Operador" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setHistoryRoleFilter("Operador")}
                >
                  Operadores
                </Button>
                <Button
                  type="button"
                  variant={historyRoleFilter === "Entregador" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setHistoryRoleFilter("Entregador")}
                >
                  Entregadores
                </Button>
              </div>
              <div className="w-full sm:w-72">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant={"outline"}
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !historyRange?.from && "text-muted-foreground",
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {historyRange?.from ? (
                        historyRange.to ? (
                          <>
                            {format(historyRange.from, "dd/MM/yyyy")} -{" "}
                            {format(historyRange.to, "dd/MM/yyyy")}
                          </>
                        ) : (
                          format(historyRange.from, "dd/MM/yyyy")
                        )
                      ) : (
                        <span>Hoje</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="end">
                    <Calendar
                      mode="range"
                      defaultMonth={historyRange?.from}
                      selected={historyRange}
                      onSelect={setHistoryRange}
                      numberOfMonths={2}
                      locale={ptBR}
                      initialFocus
                    />
                    <div className="border-t p-2">
                      <Button
                        variant="ghost"
                        className="w-full text-xs"
                        onClick={() => setHistoryRange(undefined)}
                      >
                        Ver Hoje
                      </Button>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
              <div className="w-full sm:w-48">
                <Select value={filterUnit} onValueChange={(v) => setFilterUnit(v as Unit | "all")}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todas as lojas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as lojas</SelectItem>
                    {UNITS.map((u) => (
                      <SelectItem key={u} value={u}>
                        {getUnitDisplayName(u)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-full sm:w-56">
                <Select value={historyPerson} onValueChange={(v) => setHistoryPerson(v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos os prestadores" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os prestadores</SelectItem>
                    {historyPeople.map((p) => (
                      <SelectItem key={p} value={p}>
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-0 sm:px-6">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Loja</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Função</TableHead>
                    <TableHead>Pix</TableHead>
                    <TableHead className="text-right">Diária</TableHead>
                    <TableHead className="text-right">Entregas</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    {isAdmin && <TableHead className="w-12" />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center text-muted-foreground">
                        Carregando...
                      </TableCell>
                    </TableRow>
                  ) : visibleRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center text-muted-foreground">
                        Nenhum lançamento ainda.
                      </TableCell>
                    </TableRow>
                  ) : (
                    visibleRows.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="whitespace-nowrap">
                          {formatDateBR(r.entry_date)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="font-normal">
                            {r.unit}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium">{r.name}</TableCell>
                        <TableCell className="text-muted-foreground">{r.role}</TableCell>
                        <TableCell>
                          <button
                            type="button"
                            onClick={() => handleCopyPix(r.id, r.pix)}
                            className="group inline-flex max-w-[220px] items-center gap-1.5 rounded-md border border-border/60 bg-muted/40 px-2 py-1 text-xs transition-colors hover:bg-muted"
                            title="Copiar pix"
                          >
                            <span className="truncate">{r.pix}</span>
                            {copiedId === r.id ? (
                              <Check className="h-3.5 w-3.5 shrink-0 text-primary" />
                            ) : (
                              <Copy className="h-3.5 w-3.5 shrink-0 text-muted-foreground group-hover:text-foreground" />
                            )}
                          </button>
                        </TableCell>
                        <TableCell className="font-mono-tabular text-right">
                          {formatBRLCurrency(Number(r.daily_rate))}
                        </TableCell>
                        <TableCell className="font-mono-tabular text-right">
                          {Number((r as any).deliveries_total || 0) > 0
                            ? formatBRLCurrency(Number((r as any).deliveries_total || 0))
                            : "—"}
                        </TableCell>
                        <TableCell className="font-mono-tabular text-right font-semibold">
                          {formatBRLCurrency(
                            Number(r.daily_rate) + Number((r as any).deliveries_total || 0),
                          )}
                        </TableCell>
                        {isAdmin && (
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => deleteMutation.mutate(r.id)}
                              aria-label="Excluir"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <ReceiptModal
          open={receiptOpen}
          onOpenChange={setReceiptOpen}
          freelancerName={receiptData.name}
          pix={receiptData.pix}
          rows={rows}
          initialUnit={totalsUnit === "all" ? "" : totalsUnit}
          initialDateRange={
            dateRange?.from && dateRange?.to
              ? { from: dateRange.from, to: dateRange.to }
              : undefined
          }
        />

        <BulkReceiptsModal
          open={bulkModalOpen}
          onOpenChange={setBulkModalOpen}
          selected={totalsByPerson
            .filter((p) => selectedBulkKeys.has(personKey(p.name, p.pix)))
            .map((p) => ({ name: p.name, pix: p.pix }))}
          rows={rows}
          startDate={dateRange?.from}
          endDate={dateRange?.to}
        />
      </div>
    </div>
  );
}
