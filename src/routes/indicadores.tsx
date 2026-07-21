import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { toast } from "sonner";
import { UNITS, getUnitDisplayName } from "@/lib/units";
import {
  ArrowLeft,
  TrendingUp,
  Calendar as CalendarIcon,
  Trash2,
  Edit,
  Trophy,
  Award,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  Clock,
  Percent,
  ShoppingBag,
  Activity,
} from "lucide-react";
import { formatBRLCurrency } from "@/lib/currency";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { IndicadoresImportButton } from "@/components/IndicadoresImportButton";

export const Route = createFileRoute("/indicadores")({
  component: IndicadoresPage,
  head: () => ({
    meta: [
      { title: "Indicadores de Desempenho — Freeladex" },
      {
        name: "description",
        content: "Lançamento de indicadores de faturamento e performance por loja.",
      },
    ],
  }),
});

const getTodayDateString = (): string => {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

const getPastDateString = (daysAgo: number): string => {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

const getLocalDate = (dateStr: string): Date => {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day);
};

const formatDateString = (date: Date): string => {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

interface DatePickerButtonProps {
  dateStr: string;
  onSelect: (dateStr: string) => void;
}

function DatePickerButton({ dateStr, onSelect }: DatePickerButtonProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-full justify-start text-left font-normal bg-background border border-input",
            !dateStr && "text-muted-foreground",
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
          {dateStr ? (
            format(getLocalDate(dateStr), "dd/MM/yyyy", { locale: ptBR })
          ) : (
            <span>dd/mm/aaaa</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={dateStr ? getLocalDate(dateStr) : undefined}
          onSelect={(date) => {
            if (date) {
              onSelect(formatDateString(date));
            }
          }}
          locale={ptBR}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}

const deduplicateData = (data: any[]) => {
  const map = new Map<string, any>();
  
  data.forEach((item) => {
    let normName = item.store_name.trim();
    const lower = normName.toLowerCase();
    
    if (lower.includes("praia da costa") || lower.includes("costa")) normName = "Praia da Costa";
    else if (lower.includes("itaparica")) normName = "Itaparica";

    const key = `${normName}|${item.date}`;
    // Ao sobrescrever, pegamos a versão mais recente caso haja duplicatas por grafias diferentes.
    map.set(key, { ...item, store_name: normName });
  });
  
  return Array.from(map.values());
};

function IndicadoresPage() {
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState<string>(getTodayDateString());
  const [selectedStore, setSelectedStore] = useState<string>("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Helper function for local storage
  const usePersistentState = <T extends string>(
    key: string,
    initialValue: T,
  ): [T, (val: T) => void] => {
    const [state, setState] = useState<T>(() => {
      if (typeof window !== "undefined") {
        const saved = localStorage.getItem(key);
        if (saved) return saved as T;
      }
      return initialValue;
    });

    const setPersistentState = (val: T) => {
      setState(val);
      if (typeof window !== "undefined") {
        localStorage.setItem(key, val);
      }
    };

    return [state, setPersistentState];
  };

  // States dos campos de input
  const [fatFormatted, setFatFormatted] = useState("");
  const [fatValue, setFatValue] = useState<number>(0);
  const [pedidos, setPedidos] = useState("");
  const [adt, setAdt] = useState("");
  const [extremos, setExtremos] = useState("");
  const [entregas, setEntregas] = useState("");
  const [cmv, setCmv] = useState("");

  // Estados do Ranking Comparativo
  const [rankingMetric, setRankingMetric] = usePersistentState<string>(
    "caixa_rankingMetric",
    "fat",
  );
  const [rankingSortDir, setRankingSortDir] = usePersistentState<"asc" | "desc">(
    "caixa_rankingSortDir",
    "desc",
  );
  const [rankingStartDate, setRankingStartDate] = usePersistentState<string>(
    "caixa_rankingStartDate",
    getPastDateString(7),
  );
  const [rankingEndDate, setRankingEndDate] = usePersistentState<string>(
    "caixa_rankingEndDate",
    getTodayDateString(),
  );

  const handleRankingSort = (metric: string) => {
    if (rankingMetric === metric) {
      setRankingSortDir(rankingSortDir === "desc" ? "asc" : "desc");
    } else {
      setRankingMetric(metric);
      // Para ADT e CMV o melhor é menor, então começa asc; para os demais desc
      setRankingSortDir(metric === "adt" || metric === "cmv" ? "asc" : "desc");
    }
  };

  // Estados da Auto-Comparação
  const [compStore, setCompStore] = usePersistentState<string>("caixa_compStore", "");
  const [compStartA, setCompStartA] = usePersistentState<string>(
    "caixa_compStartA",
    getPastDateString(6),
  );
  const [compEndA, setCompEndA] = usePersistentState<string>(
    "caixa_compEndA",
    getTodayDateString(),
  );
  const [compStartB, setCompStartB] = usePersistentState<string>(
    "caixa_compStartB",
    getPastDateString(13),
  );
  const [compEndB, setCompEndB] = usePersistentState<string>(
    "caixa_compEndB",
    getPastDateString(7),
  );

  const applyPreset = (preset: "last7" | "thisWeek" | "thisMonth") => {
    const today = new Date();

    if (preset === "last7") {
      const endA = new Date(today);
      const startA = new Date(today);
      startA.setDate(today.getDate() - 6);

      const endB = new Date(startA);
      endB.setDate(startA.getDate() - 1);
      const startB = new Date(endB);
      startB.setDate(endB.getDate() - 6);

      setCompStartA(formatDateString(startA));
      setCompEndA(formatDateString(endA));
      setCompStartB(formatDateString(startB));
      setCompEndB(formatDateString(endB));
    } else if (preset === "thisWeek") {
      const day = today.getDay();
      const diffToMonday = day === 0 ? -6 : 1 - day;

      const startA = new Date(today);
      startA.setDate(today.getDate() + diffToMonday);
      const endA = new Date(startA);
      endA.setDate(startA.getDate() + 6);

      const startB = new Date(startA);
      startB.setDate(startA.getDate() - 7);
      const endB = new Date(startB);
      endB.setDate(startB.getDate() + 6);

      setCompStartA(formatDateString(startA));
      setCompEndA(formatDateString(endA));
      setCompStartB(formatDateString(startB));
      setCompEndB(formatDateString(endB));
    } else if (preset === "thisMonth") {
      const startA = new Date(today.getFullYear(), today.getMonth(), 1);
      const endA = new Date(today.getFullYear(), today.getMonth() + 1, 0);

      const startB = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const endB = new Date(today.getFullYear(), today.getMonth(), 0);

      setCompStartA(formatDateString(startA));
      setCompEndA(formatDateString(endA));
      setCompStartB(formatDateString(startB));
      setCompEndB(formatDateString(endB));
    }
  };

  // 1. Localizações das lojas (fixado para as unidades de Vila Velha: Praia da Costa e Itaparica)
  const storeLocations = useMemo(() => {
    return UNITS.map((unitName) => ({
      id: unitName,
      name: unitName,
    }));
  }, []);

  // 2. Consulta de indicadores na data selecionada
  const { data: indicatorsQueryData, refetch: refetchIndicators } = useQuery({
    queryKey: ["store_indicators", selectedDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_indicators")
        .select("*")
        .eq("date", selectedDate);
      if (error) throw error;
      return data as Array<{
        id: string;
        store_name: string;
        date: string;
        fat: number;
        pedidos: number;
        adt: number | null;
        extremos: number | null;
        entregas_motoqueiros: number | null;
        cmv: number | null;
      }>;
    },
  });

  const indicatorsList = useMemo(() => {
    const list = indicatorsQueryData || [];
    return list.filter((item) => UNITS.includes(item.store_name as any));
  }, [indicatorsQueryData]);

  // 3. Consulta de indicadores para o ranking (intervalo de datas)
  const { data: rankingRawData = [], isLoading: isLoadingRanking } = useQuery({
    queryKey: ["store_indicators_range", rankingStartDate, rankingEndDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_indicators")
        .select("*")
        .gte("date", rankingStartDate)
        .lte("date", rankingEndDate);
      if (error) throw error;
      return data as Array<{
        id: string;
        store_name: string;
        date: string;
        fat: number;
        pedidos: number;
        adt: number | null;
        extremos: number | null;
        entregas_motoqueiros: number | null;
        cmv: number | null;
      }>;
    },
  });

  // 4. Consulta de indicadores para comparação histórica (filtra por loja e período total)
  const compOverallStart = compStartB < compStartA ? compStartB : compStartA;
  const compOverallEnd = compEndA > compEndB ? compEndA : compEndB;

  const { data: compRawData = [], isLoading: isLoadingComp } = useQuery({
    queryKey: ["store_indicators_comparison", compStore, compOverallStart, compOverallEnd],
    enabled: !!compStore,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("store_indicators")
        .select("*")
        .eq("store_name", compStore)
        .gte("date", compOverallStart)
        .lte("date", compOverallEnd);
      if (error) throw error;
      return data as Array<{
        id: string;
        store_name: string;
        date: string;
        fat: number;
        pedidos: number;
        adt: number | null;
        extremos: number | null;
        entregas_motoqueiros: number | null;
        cmv: number | null;
      }>;
    },
  });

  // Default compStore configuration
  useEffect(() => {
    if (!compStore || !UNITS.includes(compStore as any)) {
      setCompStore("Praia da Costa");
    }
  }, [compStore]);

  // Process ranking list
  const rankingList = useMemo(() => {
    const storeGroups: Record<
      string,
      {
        store_name: string;
        fat: number;
        pedidos: number;
        adtSum: number;
        adtCount: number;
        extremos: number;
        entregasSum: number;
        entregasCount: number;
        cmvSum: number;
        cmvCount: number;
      }
    > = {};

    const filtered = rankingRawData.filter((item) => UNITS.includes(item.store_name as any));
    const dedupedData = deduplicateData(filtered);

    dedupedData.forEach((item) => {
      const normName = item.store_name;

      if (!storeGroups[normName]) {
        storeGroups[normName] = {
          store_name: normName,
          fat: 0,
          pedidos: 0,
          adtSum: 0,
          adtCount: 0,
          extremos: 0,
          entregasSum: 0,
          entregasCount: 0,
          cmvSum: 0,
          cmvCount: 0,
        };
      }

      const g = storeGroups[normName];
      g.fat += Number(item.fat);
      g.pedidos += Number(item.pedidos);
      if (item.adt !== null) {
        g.adtSum += Number(item.adt);
        g.adtCount += 1;
      }
      if (item.extremos !== null) {
        g.extremos += Number(item.extremos);
      }
      if (item.entregas_motoqueiros !== null) {
        g.entregasSum += Number(item.entregas_motoqueiros);
        g.entregasCount += 1;
      }
      if (item.cmv !== null) {
        g.cmvSum += Number(item.cmv);
        g.cmvCount += 1;
      }
    });

    const list = Object.values(storeGroups).map((g) => {
      return {
        store_name: g.store_name,
        fat: g.fat,
        pedidos: g.pedidos,
        adt: g.adtCount > 0 ? g.adtSum / g.adtCount : null,
        extremos: g.extremos,
        entregas_motoqueiros: g.entregasCount > 0 ? g.entregasSum / g.entregasCount : null,
        cmv: g.cmvCount > 0 ? g.cmvSum / g.cmvCount : null,
      };
    });

    list.sort((a, b) => {
      const valA = a[rankingMetric as keyof typeof a];
      const valB = b[rankingMetric as keyof typeof b];

      if (valA === null || valA === undefined) return 1;
      if (valB === null || valB === undefined) return -1;

      return rankingSortDir === "desc"
        ? (valB as number) - (valA as number)
        : (valA as number) - (valB as number);
    });

    return list;
  }, [rankingRawData, rankingMetric, rankingSortDir]);

  // Process comparison results
  const comparisonResults = useMemo(() => {
    if (!compStore) return null;

    const dedupedData = deduplicateData(compRawData);

    const dataA = dedupedData.filter((d) => d.date >= compStartA && d.date <= compEndA);
    const dataB = dedupedData.filter((d) => d.date >= compStartB && d.date <= compEndB);

    const aggregate = (list: typeof compRawData) => {
      const totals = {
        fat: 0,
        pedidos: 0,
        adtSum: 0,
        adtCount: 0,
        extremos: 0,
        entregasSum: 0,
        entregasCount: 0,
        cmvSum: 0,
        cmvCount: 0,
      };

      list.forEach((item) => {
        totals.fat += Number(item.fat);
        totals.pedidos += Number(item.pedidos);
        if (item.adt !== null) {
          totals.adtSum += Number(item.adt);
          totals.adtCount += 1;
        }
        if (item.extremos !== null) {
          totals.extremos += Number(item.extremos);
        }
        if (item.entregas_motoqueiros !== null) {
          totals.entregasSum += Number(item.entregas_motoqueiros);
          totals.entregasCount += 1;
        }
        if (item.cmv !== null) {
          totals.cmvSum += Number(item.cmv);
          totals.cmvCount += 1;
        }
      });

      return {
        fat: totals.fat,
        pedidos: totals.pedidos,
        adt: totals.adtCount > 0 ? totals.adtSum / totals.adtCount : null,
        extremos: totals.extremos,
        entregas_motoqueiros:
          totals.entregasCount > 0 ? totals.entregasSum / totals.entregasCount : null,
        cmv: totals.cmvCount > 0 ? totals.cmvSum / totals.cmvCount : null,
      };
    };

    const aggA = aggregate(dataA);
    const aggB = aggregate(dataB);

    return {
      a: aggA,
      b: aggB,
      daysA: dataA.length,
      daysB: dataB.length,
    };
  }, [compRawData, compStore, compStartA, compEndA, compStartB, compEndB]);

  const isCompStoreB = compStore === "Boali" || compStore === "GRU";

  const metricsToCompare = [
    {
      key: "fat",
      label: "Faturamento (FAT)",
      format: (val: number | null) => (val !== null ? formatBRLCurrency(val) : "R$ 0,00"),
      lowerIsBetter: false,
    },
    {
      key: "pedidos",
      label: "Pedidos (UN)",
      format: (val: number | null) => (val !== null ? `${Math.round(val)} un` : "0 un"),
      lowerIsBetter: false,
    },
    ...(!isCompStoreB
      ? [
          {
            key: "adt",
            label: "ADT (Min.)",
            format: (val: number | null) =>
              val !== null ? `${val.toFixed(1).replace(".", ",")} min` : "-",
            lowerIsBetter: true,
          },
          {
            key: "extremos",
            label: "Extremos",
            format: (val: number | null) => (val !== null ? `${Math.round(val)} un` : "-"),
            lowerIsBetter: true,
          },
          {
            key: "entregas_motoqueiros",
            label: "Entregas/Motoqueiro",
            format: (val: number | null) => (val !== null ? val.toFixed(2).replace(".", ",") : "-"),
            lowerIsBetter: false,
          },
          {
            key: "cmv",
            label: "CMV (%)",
            format: (val: number | null) =>
              val !== null ? `${val.toFixed(1).replace(".", ",")}%` : "-",
            lowerIsBetter: true,
          },
        ]
      : []),
  ];

  const renderVariation = (
    metric: (typeof metricsToCompare)[number],
    valA: number | null,
    valB: number | null,
  ) => {
    if (valA === null || valB === null) return <span className="text-muted-foreground">-</span>;
    if (valA === 0 && valB === 0) return <span className="text-muted-foreground">0%</span>;

    const diff = valA - valB;
    const pct = valB !== 0 ? (diff / valB) * 100 : 0;

    const isImprovement = metric.lowerIsBetter ? diff < 0 : diff > 0;
    const isNeutral = diff === 0;

    let textClass = "";
    if (isNeutral) {
      textClass = "text-muted-foreground";
    } else {
      textClass = isImprovement
        ? "text-emerald-600 font-semibold flex items-center gap-0.5"
        : "text-destructive font-semibold flex items-center gap-0.5";
    }

    const sign = diff > 0 ? "+" : "";
    const formattedDiff =
      metric.key === "fat"
        ? formatBRLCurrency(diff)
        : metric.key === "cmv"
          ? `${diff.toFixed(1).replace(".", ",")}%`
          : diff.toFixed(1).replace(".", ",");

    const ArrowIcon = diff > 0 ? ArrowUpRight : ArrowDownRight;

    return (
      <div className={textClass}>
        {!isNeutral && <ArrowIcon className="h-4 w-4 shrink-0" />}
        <span>
          {sign}
          {pct.toFixed(1).replace(".", ",")}% ({sign}
          {formattedDiff})
        </span>
      </div>
    );
  };

  const isGroupB = (store: string) => {
    return store === "Boali" || store === "GRU";
  };

  // Carregar dados existentes quando loja ou data mudar
  useEffect(() => {
    if (!selectedStore) {
      resetFields();
      return;
    }
    const existing = indicatorsList.find((ind) => ind.store_name === selectedStore);
    if (existing) {
      setFatValue(Number(existing.fat));
      setFatFormatted(
        new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(existing.fat),
      );
      setPedidos(String(existing.pedidos));
      setAdt(existing.adt ? String(existing.adt).replace(".", ",") : "");
      setExtremos(existing.extremos ? String(existing.extremos) : "");
      setEntregas(
        existing.entregas_motoqueiros
          ? String(existing.entregas_motoqueiros).replace(".", ",")
          : "",
      );
      setCmv(existing.cmv ? `${String(existing.cmv).replace(".", ",")}%` : "");
      setEditingId(existing.id);
    } else {
      if (editingId !== null) {
        resetFields(true);
      }
    }
  }, [selectedStore, indicatorsList, editingId]);

  const resetFields = (keepStore = false) => {
    if (!keepStore) setSelectedStore("");
    setFatFormatted("");
    setFatValue(0);
    setPedidos("");
    setAdt("");
    setExtremos("");
    setEntregas("");
    setCmv("");
    setEditingId(null);
  };

  const handleFatChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (!val || val === "R$") {
      setFatFormatted("");
      setFatValue(0);
      return;
    }
    const digits = val.replace(/\D/g, "");
    if (!digits) {
      setFatFormatted("");
      setFatValue(0);
      return;
    }

    // Se o valor anterior era zero e o usuário apagou um caractere, limpamos o campo
    if (Number(digits) === 0 && val.length < fatFormatted.length) {
      setFatFormatted("");
      setFatValue(0);
      return;
    }

    const cents = Number(digits) / 100;
    if (isNaN(cents)) return;
    setFatFormatted(
      new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents),
    );
    setFatValue(cents);
  };

  const handlePedidosChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    const clean = val.replace(/\D/g, "");
    setPedidos(clean);
  };

  const handleAdtChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Permite que o usuário digite ponto e converte automaticamente para vírgula
    const val = e.target.value.replace(/\./g, ",");
    let clean = val.replace(/[^0-9,]/g, "");
    const parts = clean.split(",");
    if (parts.length > 2) {
      clean = parts[0] + "," + parts.slice(1).join("");
    }
    setAdt(clean);
  };

  const handleExtremosChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    const clean = val.replace(/\D/g, "");
    setExtremos(clean);
  };

  const handleEntregasChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Permite que o usuário digite ponto e converte automaticamente para vírgula
    const val = e.target.value.replace(/\./g, ",");
    let clean = val.replace(/[^0-9,]/g, "");
    const parts = clean.split(",");
    if (parts.length > 2) {
      clean = parts[0] + "," + parts.slice(1).join("");
    }
    setEntregas(clean);
  };

  const handleCmvChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\./g, ",");

    // Se o usuário apagou o %, significa que ele pressionou backspace no final.
    // Queremos apagar também o número anterior ao %.
    if (cmv.endsWith("%") && !val.includes("%")) {
      const withoutPct = cmv.slice(0, -1);
      if (withoutPct.length > 0) {
        val = withoutPct.slice(0, -1);
      } else {
        val = "";
      }
    }

    let raw = val.replace(/%/g, "");
    let clean = raw.replace(/[^0-9,]/g, "");
    const parts = clean.split(",");
    if (parts.length > 2) {
      clean = parts[0] + "," + parts.slice(1).join("");
    }
    setCmv(clean ? `${clean}%` : "");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStore) {
      toast.error("Selecione a loja primeiro.");
      return;
    }
    if (fatValue <= 0) {
      toast.error("O Faturamento (FAT) precisa ser maior que zero.");
      return;
    }
    if (!pedidos) {
      toast.error("Preencha a quantidade de Pedidos.");
      return;
    }

    setSaving(true);
    try {
      const isB = isGroupB(selectedStore);
      const payload = {
        store_name: selectedStore,
        date: selectedDate,
        fat: fatValue,
        pedidos: parseInt(pedidos),
        adt: !isB && adt ? parseFloat(adt.replace(",", ".")) : null,
        extremos: !isB && extremos ? parseInt(extremos) : null,
        entregas_motoqueiros: !isB && entregas ? parseFloat(entregas.replace(",", ".")) : null,
        cmv: !isB && cmv ? parseFloat(cmv.replace("%", "").replace(",", ".")) : null,
      };

      const { error } = await supabase
        .from("store_indicators")
        .upsert(payload, { onConflict: "store_name,date" });

      if (error) throw error;

      toast.success(editingId ? "Indicadores atualizados!" : "Indicadores salvos com sucesso!");
      refetchIndicators();
      resetFields();
    } catch (err: any) {
      console.error(err);
      toast.error(`Erro ao salvar indicadores: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Deseja realmente remover os indicadores desta loja?")) return;
    try {
      const { error } = await supabase.from("store_indicators").delete().eq("id", id);
      if (error) throw error;
      toast.success("Indicadores excluídos com sucesso!");
      refetchIndicators();
    } catch (err: any) {
      console.error(err);
      toast.error(`Erro ao excluir: ${err.message}`);
    }
  };

  const activeIsGroupB = isGroupB(selectedStore);

  return (
    <div className="min-h-screen bg-muted/30 p-4 md:p-6 pb-24 font-sans">
      <div className="mx-auto max-w-5xl space-y-6">
        {/* Header */}
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Link to="/">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="mr-1 h-4 w-4" /> Voltar
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
                Lançamento de Indicadores
              </h1>
              <p className="text-sm text-muted-foreground">
                Insira os dados diários de performance das unidades comerciais.
              </p>
            </div>
          </div>
          <IndicadoresImportButton
            onImported={() => {
              queryClient.invalidateQueries({ queryKey: ["store_indicators"] });
              queryClient.invalidateQueries({ queryKey: ["store_indicators_range"] });
              queryClient.invalidateQueries({ queryKey: ["store_indicators_comparison"] });
            }}
          />
        </header>

        <Tabs defaultValue="lancamentos" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 md:w-auto md:inline-flex bg-background border border-border">
            <TabsTrigger value="lancamentos" className="px-6">
              Lançamentos
            </TabsTrigger>
            <TabsTrigger value="ranking" className="px-6">
              Ranking Comparativo
            </TabsTrigger>
            <TabsTrigger value="comparativo" className="px-6">
              Auto-Comparação
            </TabsTrigger>
          </TabsList>

          {/* Aba 1: Lançamentos */}
          <TabsContent value="lancamentos" className="space-y-6 mt-0">
            <div className="grid gap-6 md:grid-cols-3">
              {/* Formulário */}
              <Card className="border border-border/60 shadow-sm md:col-span-2">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-primary" />
                    Lançar Dados de Performance
                  </CardTitle>
                  <CardDescription>
                    Selecione a data, loja e preencha os indicadores correspondentes.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Seleção de Data e Loja */}
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2 flex flex-col justify-end">
                        <Label className="flex items-center gap-1">
                          <CalendarIcon className="h-4 w-4 text-muted-foreground" /> Data de
                          Referência
                        </Label>
                        <DatePickerButton dateStr={selectedDate} onSelect={setSelectedDate} />
                      </div>

                      <div className="space-y-2 flex flex-col justify-end">
                        <Label>Selecione a Loja</Label>
                        <Select value={selectedStore} onValueChange={setSelectedStore}>
                          <SelectTrigger className="bg-background">
                            <SelectValue placeholder="Selecione a unidade..." />
                          </SelectTrigger>
                          <SelectContent>
                            {[...storeLocations]
                              .sort((a: any, b: any) => {
                                const nameA = getUnitDisplayName(a.name).toLowerCase();
                                const nameB = getUnitDisplayName(b.name).toLowerCase();
                                return nameA.localeCompare(nameB, "pt-BR");
                              })
                              .map((loc: any) => (
                                <SelectItem key={loc.id} value={loc.name}>
                                  {getUnitDisplayName(loc.name)}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {selectedStore && (
                      <div className="pt-4 border-t space-y-4">
                        <div className="grid gap-4 sm:grid-cols-2">
                          {/* Campo FAT (R$) - Moeda */}
                          <div className="space-y-2">
                            <Label htmlFor="input-fat">FAT (R$)</Label>
                            <Input
                              id="input-fat"
                              value={fatFormatted}
                              onChange={handleFatChange}
                              placeholder="R$ 0,00"
                              className="bg-background font-medium"
                              required
                            />
                            <p className="text-[10px] text-muted-foreground">
                              Somente números aceitos (formatação automática)
                            </p>
                          </div>

                          {/* Campo Pedidos (UN) - Inteiro */}
                          <div className="space-y-2">
                            <Label htmlFor="input-pedidos">Pedidos (UN)</Label>
                            <Input
                              id="input-pedidos"
                              value={pedidos}
                              onChange={handlePedidosChange}
                              placeholder="Quantidade de pedidos"
                              className="bg-background"
                              required
                            />
                            <p className="text-[10px] text-muted-foreground">
                              Números inteiros, sem pontos ou vírgulas
                            </p>
                          </div>

                          {/* Campos Extras do Grupo A */}
                          {!activeIsGroupB && (
                            <>
                              {/* Campo ADT (Min.) - Decimal */}
                              <div className="space-y-2">
                                <Label htmlFor="input-adt">ADT (Min.)</Label>
                                <Input
                                  id="input-adt"
                                  value={adt}
                                  onChange={handleAdtChange}
                                  placeholder="Tempo médio de entrega"
                                  className="bg-background"
                                />
                                <p className="text-[10px] text-muted-foreground">
                                  Apenas números e vírgula decimal
                                </p>
                              </div>

                              {/* Campo Extremos - Inteiro */}
                              <div className="space-y-2">
                                <Label htmlFor="input-extremos">Extremos</Label>
                                <Input
                                  id="input-extremos"
                                  value={extremos}
                                  onChange={handleExtremosChange}
                                  placeholder="Pedidos extremos"
                                  className="bg-background"
                                />
                                <p className="text-[10px] text-muted-foreground">
                                  Números inteiros, sem pontos ou vírgulas
                                </p>
                              </div>

                              {/* Campo Entregas/Motoqueiros - Decimal */}
                              <div className="space-y-2">
                                <Label htmlFor="input-entregas">Entregas/Motoqueiros</Label>
                                <Input
                                  id="input-entregas"
                                  value={entregas}
                                  onChange={handleEntregasChange}
                                  placeholder="Produtividade"
                                  className="bg-background"
                                />
                                <p className="text-[10px] text-muted-foreground">
                                  Apenas números e vírgula decimal
                                </p>
                              </div>

                              {/* Campo CMV - Decimal com % */}
                              <div className="space-y-2">
                                <Label htmlFor="input-cmv">CMV (%)</Label>
                                <Input
                                  id="input-cmv"
                                  value={cmv}
                                  onChange={handleCmvChange}
                                  placeholder="0,0%"
                                  className="bg-background font-semibold"
                                />
                                <p className="text-[10px] text-muted-foreground">
                                  Apenas números e vírgula (% inclusa ao final)
                                </p>
                              </div>
                            </>
                          )}
                        </div>

                        <div className="flex justify-end gap-2 pt-2">
                          <Button type="button" variant="ghost" onClick={() => resetFields()}>
                            Limpar
                          </Button>
                          <Button type="submit" disabled={saving}>
                            {saving
                              ? "Salvando..."
                              : editingId
                                ? "Atualizar Indicadores"
                                : "Salvar Indicadores"}
                          </Button>
                        </div>
                      </div>
                    )}
                  </form>
                </CardContent>
              </Card>

              {/* Status do Dia (Resumo) */}
              <Card className="border border-border/60 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base">Resumo do Dia</CardTitle>
                  <CardDescription>
                    Status de preenchimento em {selectedDate.split("-").reverse().join("/")}.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Lançamentos Efetuados:
                  </div>
                  <div className="space-y-2">
                    {indicatorsList.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-4 text-center">
                        Nenhum lançamento efetuado nesta data.
                      </p>
                    ) : (
                      indicatorsList.map((item) => (
                        <div
                          key={item.id}
                          className="flex justify-between items-center p-2.5 rounded-lg border bg-background/50 text-sm"
                        >
                          <div>
                            <div className="font-semibold">
                              {getUnitDisplayName(item.store_name)}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              FAT: {formatBRLCurrency(item.fat)} | Pedidos: {item.pedidos}
                            </div>
                          </div>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-primary"
                              onClick={() => setSelectedStore(item.store_name)}
                              title="Editar"
                            >
                              <Edit className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive"
                              onClick={() => handleDelete(item.id)}
                              title="Excluir"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Tabela Detalhada */}
            {indicatorsList.length > 0 && (
              <Card className="border border-border/60 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base">Tabela Consolidada do Dia</CardTitle>
                </CardHeader>
                <CardContent className="px-0 sm:px-6">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Loja</TableHead>
                          <TableHead>Grupo</TableHead>
                          <TableHead>FAT (R$)</TableHead>
                          <TableHead>Pedidos (UN)</TableHead>
                          <TableHead>ADT (Min.)</TableHead>
                          <TableHead>Extremos</TableHead>
                          <TableHead>Entregas/Mot.</TableHead>
                          <TableHead>CMV (%)</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {indicatorsList.map((item) => {
                          const isB = isGroupB(item.store_name);
                          return (
                            <TableRow key={item.id}>
                              <TableCell className="font-semibold">
                                {getUnitDisplayName(item.store_name)}
                              </TableCell>
                              <TableCell>
                                <span
                                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                                    isB
                                      ? "bg-amber-100 text-amber-800"
                                      : "bg-blue-100 text-blue-800"
                                  }`}
                                >
                                  Grupo {isB ? "B" : "A"}
                                </span>
                              </TableCell>
                              <TableCell>{formatBRLCurrency(item.fat)}</TableCell>
                              <TableCell>{item.pedidos}</TableCell>
                              <TableCell>
                                {!isB && item.adt !== null
                                  ? `${String(item.adt).replace(".", ",")} min`
                                  : "-"}
                              </TableCell>
                              <TableCell>
                                {!isB && item.extremos !== null ? item.extremos : "-"}
                              </TableCell>
                              <TableCell>
                                {!isB && item.entregas_motoqueiros !== null
                                  ? String(item.entregas_motoqueiros).replace(".", ",")
                                  : "-"}
                              </TableCell>
                              <TableCell>
                                {!isB && item.cmv !== null
                                  ? `${String(item.cmv).replace(".", ",")}%`
                                  : "-"}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Aba 2: Ranking */}
          <TabsContent value="ranking" className="space-y-6 mt-0">
            <Card className="border border-border/60 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-primary" />
                  Ranking Comparativo de Performance
                </CardTitle>
                <CardDescription>
                  Todos os indicadores de todas as unidades no período. Clique no cabeçalho de
                  qualquer coluna para ordenar.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Filtros de Período */}
                <div className="grid gap-4 sm:grid-cols-2 bg-muted/40 p-4 rounded-xl border">
                  <div className="space-y-2">
                    <Label>Data Inicial</Label>
                    <DatePickerButton dateStr={rankingStartDate} onSelect={setRankingStartDate} />
                  </div>
                  <div className="space-y-2">
                    <Label>Data Final</Label>
                    <DatePickerButton dateStr={rankingEndDate} onSelect={setRankingEndDate} />
                  </div>
                </div>

                {/* Legenda de ordenação */}
                {rankingList.length > 0 && (
                  <div className="text-xs text-muted-foreground flex items-center gap-1">
                    <Activity className="h-3 w-3" />
                    Ordenando por:{" "}
                    <span className="font-semibold text-foreground">
                      {
                        {
                          fat: "Faturamento",
                          pedidos: "Pedidos",
                          adt: "ADT",
                          extremos: "Extremos",
                          entregas_motoqueiros: "Entregas/Mot.",
                          cmv: "CMV",
                        }[rankingMetric]
                      }
                    </span>
                    <span>({rankingSortDir === "desc" ? "maior → menor" : "menor → maior"})</span>
                  </div>
                )}

                {/* Tabela Completa */}
                {isLoadingRanking ? (
                  <div className="text-center py-8 text-muted-foreground animate-pulse">
                    Carregando dados do ranking...
                  </div>
                ) : rankingList.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground border border-dashed rounded-xl bg-background">
                    Nenhum registro encontrado neste período.
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border shadow-sm">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/40">
                          <TableHead className="w-8 text-center">#</TableHead>
                          <TableHead>Loja</TableHead>
                          {(
                            [
                              { key: "fat", label: "FAT (R$)" },
                              { key: "pedidos", label: "Pedidos" },
                              { key: "adt", label: "ADT (min)" },
                              { key: "extremos", label: "Extremos" },
                              { key: "entregas_motoqueiros", label: "Entr./Mot." },
                              { key: "cmv", label: "CMV (%)" },
                            ] as const
                          ).map((col) => (
                            <TableHead
                              key={col.key}
                              className="cursor-pointer select-none hover:bg-muted/70 text-right transition-colors"
                              onClick={() => handleRankingSort(col.key)}
                            >
                              <span className="flex items-center justify-end gap-1">
                                {col.label}
                                {rankingMetric === col.key ? (
                                  <span className="text-primary">
                                    {rankingSortDir === "desc" ? "↓" : "↑"}
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground/40">↕</span>
                                )}
                              </span>
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rankingList.map((item, index) => {
                          const position = index + 1;
                          let rowClass = "";
                          let posIcon = (
                            <span className="text-muted-foreground text-xs font-bold">
                              {position}º
                            </span>
                          );
                          if (position === 1) {
                            rowClass = "bg-amber-50/40 dark:bg-amber-950/10";
                            posIcon = <Trophy className="h-4 w-4 text-amber-500" />;
                          } else if (position === 2) {
                            rowClass = "bg-slate-50/50 dark:bg-slate-900/10";
                            posIcon = <Award className="h-4 w-4 text-slate-400" />;
                          } else if (position === 3) {
                            rowClass = "bg-orange-50/30 dark:bg-orange-950/10";
                            posIcon = <Award className="h-4 w-4 text-amber-700" />;
                          }

                          const fmtFat = item.fat != null ? formatBRLCurrency(item.fat) : "-";
                          const fmtPed = item.pedidos != null ? `${Math.round(item.pedidos)}` : "-";
                          const fmtAdt =
                            item.adt != null ? `${item.adt.toFixed(1).replace(".", ",")}` : "-";
                          const fmtExt =
                            item.extremos != null ? `${Math.round(item.extremos)}` : "-";
                          const fmtEntr =
                            item.entregas_motoqueiros != null
                              ? `${item.entregas_motoqueiros.toFixed(2).replace(".", ",")}`
                              : "-";
                          const fmtCmv =
                            item.cmv != null ? `${item.cmv.toFixed(1).replace(".", ",")}%` : "-";

                          return (
                            <TableRow key={item.store_name} className={rowClass}>
                              <TableCell className="text-center">{posIcon}</TableCell>
                              <TableCell className="font-semibold whitespace-nowrap">
                                {getUnitDisplayName(item.store_name)}
                              </TableCell>
                              <TableCell
                                className={`text-right font-medium ${rankingMetric === "fat" ? "text-primary font-bold" : ""}`}
                              >
                                {fmtFat}
                              </TableCell>
                              <TableCell
                                className={`text-right ${rankingMetric === "pedidos" ? "text-primary font-bold" : ""}`}
                              >
                                {fmtPed}
                              </TableCell>
                              <TableCell
                                className={`text-right ${rankingMetric === "adt" ? "text-primary font-bold" : ""}`}
                              >
                                {fmtAdt}
                              </TableCell>
                              <TableCell
                                className={`text-right ${rankingMetric === "extremos" ? "text-primary font-bold" : ""}`}
                              >
                                {fmtExt}
                              </TableCell>
                              <TableCell
                                className={`text-right ${rankingMetric === "entregas_motoqueiros" ? "text-primary font-bold" : ""}`}
                              >
                                {fmtEntr}
                              </TableCell>
                              <TableCell
                                className={`text-right ${rankingMetric === "cmv" ? "text-primary font-bold" : ""}`}
                              >
                                {fmtCmv}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Aba 3: Comparativo */}
          <TabsContent value="comparativo" className="space-y-6 mt-0">
            <Card className="border border-border/60 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  Auto-Comparação de Unidade
                </CardTitle>
                <CardDescription>
                  Selecione uma loja e compare o seu desempenho histórico entre dois períodos de
                  datas diferentes.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Seleção de Loja e Presets */}
                <div className="grid gap-4 md:grid-cols-2 bg-muted/40 p-4 rounded-xl border">
                  <div className="space-y-2">
                    <Label>Selecione a Loja</Label>
                    <Select value={compStore} onValueChange={setCompStore}>
                      <SelectTrigger className="bg-background">
                        <SelectValue placeholder="Selecione a loja..." />
                      </SelectTrigger>
                      <SelectContent>
                        {[...storeLocations]
                          .sort((a: any, b: any) => {
                            const nameA = getUnitDisplayName(a.name).toLowerCase();
                            const nameB = getUnitDisplayName(b.name).toLowerCase();
                            return nameA.localeCompare(nameB, "pt-BR");
                          })
                          .map((loc: any) => (
                            <SelectItem key={loc.id} value={loc.name}>
                              {getUnitDisplayName(loc.name)}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2 flex flex-col justify-end">
                    <Label className="mb-2">Períodos Sugeridos (Presets)</Label>
                    <div className="grid grid-cols-3 gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => applyPreset("last7")}
                        className="text-xs bg-background"
                      >
                        Últimos 7 dias
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => applyPreset("thisWeek")}
                        className="text-xs bg-background"
                      >
                        Esta Semana
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => applyPreset("thisMonth")}
                        className="text-xs bg-background"
                      >
                        Este Mês
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Seleção de Datas dos Períodos */}
                <div className="grid gap-6 sm:grid-cols-2">
                  {/* Período A */}
                  <div className="space-y-4 p-4 rounded-xl border bg-background/50">
                    <div className="font-semibold text-sm flex items-center gap-1.5 border-b pb-2">
                      <span className="h-2 w-2 rounded-full bg-primary" />
                      Período Principal (A)
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Data Inicial</Label>
                        <DatePickerButton dateStr={compStartA} onSelect={setCompStartA} />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Data Final</Label>
                        <DatePickerButton dateStr={compEndA} onSelect={setCompEndA} />
                      </div>
                    </div>
                  </div>

                  {/* Período B */}
                  <div className="space-y-4 p-4 rounded-xl border bg-background/50">
                    <div className="font-semibold text-sm flex items-center gap-1.5 border-b pb-2">
                      <span className="h-2 w-2 rounded-full bg-muted-foreground" />
                      Período de Comparação (B)
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Data Inicial</Label>
                        <DatePickerButton dateStr={compStartB} onSelect={setCompStartB} />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Data Final</Label>
                        <DatePickerButton dateStr={compEndB} onSelect={setCompEndB} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Resultados do Comparativo */}
                {isLoadingComp ? (
                  <div className="text-center py-8 text-muted-foreground animate-pulse">
                    Calculando comparativo histórico...
                  </div>
                ) : !compStore ? (
                  <div className="text-center py-12 text-muted-foreground border border-dashed rounded-xl bg-background">
                    Selecione uma loja para carregar o comparativo.
                  </div>
                ) : !comparisonResults ? (
                  <div className="text-center py-12 text-muted-foreground border border-dashed rounded-xl bg-background">
                    Erro ao carregar dados.
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Sumário rápido */}
                    <div className="grid gap-4 sm:grid-cols-2 text-xs text-muted-foreground bg-muted/20 p-3 rounded-lg border">
                      <div className="flex justify-between">
                        <span>Amostras no Período A:</span>
                        <span className="font-bold text-foreground">
                          {comparisonResults.daysA} dias lançados
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Amostras no Período B:</span>
                        <span className="font-bold text-foreground">
                          {comparisonResults.daysB} dias lançados
                        </span>
                      </div>
                    </div>

                    {/* Tabela de Comparação */}
                    <div className="border rounded-xl overflow-hidden bg-background shadow-sm">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/30">
                            <TableHead className="w-[30%]">Indicador</TableHead>
                            <TableHead className="text-right">Período Principal (A)</TableHead>
                            <TableHead className="text-right">Período de Comparação (B)</TableHead>
                            <TableHead className="text-right w-[30%]">Variação (A vs B)</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {metricsToCompare.map((metric) => {
                            const valA =
                              comparisonResults.a[metric.key as keyof typeof comparisonResults.a];
                            const valB =
                              comparisonResults.b[metric.key as keyof typeof comparisonResults.b];
                            return (
                              <TableRow key={metric.key}>
                                <TableCell className="font-medium">{metric.label}</TableCell>
                                <TableCell className="text-right font-semibold">
                                  {metric.format(valA)}
                                </TableCell>
                                <TableCell className="text-right text-muted-foreground">
                                  {metric.format(valB)}
                                </TableCell>
                                <TableCell className="text-right">
                                  {renderVariation(metric, valA, valB)}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
