import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  CalendarIcon,
  FileSignature,
  Download,
  ExternalLink,
  RefreshCw,
  ArrowLeft,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { formatBRLCurrency } from "@/lib/currency";
import { listSignedZapSignDocs } from "@/lib/zapsign.functions";
import { UNITS, getUnitDisplayName } from "@/lib/units";

interface FreelancerEntry {
  id: string;
  entry_date: string;
  unit: string;
  name: string;
  role: string;
  daily_rate: number;
  deliveries_total: number | null;
}

interface SignedReceipt {
  id: string;
  zapsign_token: string;
  freelancer_name: string;
  freelancer_cpf: string | null;
  freelancer_email: string | null;
  role: string | null;
  unit: string | null;
  amount: number;
  reference_period: string | null;
  signed_file_url: string | null;
  status: string;
  signed_at: string | null;
  created_at: string;
}

export function SignedReceiptsReport() {
  const queryClient = useQueryClient();
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [nameFilter, setNameFilter] = useState<string>("__all__");
  const [statusFilter, setStatusFilter] = useState<string>("signed");
  const [searchTerm, setSearchTerm] = useState("");

  // Filtros para "Lançamentos sem recibo assinado"
  const [pendStart, setPendStart] = useState<Date | undefined>();
  const [pendEnd, setPendEnd] = useState<Date | undefined>();
  const [pendUnit, setPendUnit] = useState<string>("__all__");

  const { data: receipts = [], isLoading } = useQuery({
    queryKey: ["signed_receipts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("signed_receipts")
        .select("*")
        .order("signed_at", { ascending: false, nullsFirst: false });
      if (error) throw error;
      return data as SignedReceipt[];
    },
  });

  const { data: allEntries = [] } = useQuery({
    queryKey: ["freelancers_all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("freelancers")
        .select("id, entry_date, unit, name, role, daily_rate, deliveries_total")
        .order("entry_date", { ascending: false });
      if (error) throw error;
      return data as FreelancerEntry[];
    },
  });

  // Constrói índice: nome (normalizado) -> lista de períodos [início, fim] já assinados
  const signedRangesByName = useMemo(() => {
    const map = new Map<string, Array<{ start: Date; end: Date }>>();
    const parseBR = (s: string): Date | null => {
      const m = s.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
      if (!m) return null;
      return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
    };
    for (const r of receipts) {
      if ((r.status || "").toLowerCase() !== "signed") continue;
      const key = (r.freelancer_name || "").trim().toLowerCase();
      if (!key) continue;
      const period = (r.reference_period || "").trim();
      let start: Date | null = null;
      let end: Date | null = null;
      // Formatos suportados: "dd/MM/yyyy a dd/MM/yyyy" ou "dd/MM/yyyy"
      const parts = period.split(/\s+a\s+/i);
      if (parts.length === 2) {
        start = parseBR(parts[0]);
        end = parseBR(parts[1]);
      } else if (parts.length === 1 && parts[0]) {
        start = parseBR(parts[0]);
        end = start;
      }
      if (!start || !end) continue;
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      const arr = map.get(key) || [];
      arr.push({ start, end });
      map.set(key, arr);
    }
    return map;
  }, [receipts]);

  const pendingEntries = useMemo(() => {
    return allEntries.filter((e) => {
      const key = (e.name || "").trim().toLowerCase();
      const ranges = signedRangesByName.get(key);
      if (ranges && ranges.length > 0) {
        const d = parseISO(e.entry_date);
        // Se a data do lançamento está dentro de algum período já assinado, não é pendente
        if (ranges.some((r) => d >= r.start && d <= r.end)) return false;
      }
      if (pendUnit !== "__all__" && e.unit !== pendUnit) return false;
      if (pendStart || pendEnd) {
        const d = parseISO(e.entry_date);
        if (pendStart) {
          const s = new Date(pendStart);
          s.setHours(0, 0, 0, 0);
          if (d < s) return false;
        }
        if (pendEnd) {
          const en = new Date(pendEnd);
          en.setHours(23, 59, 59, 999);
          if (d > en) return false;
        }
      }
      return true;
    });
  }, [allEntries, signedRangesByName, pendUnit, pendStart, pendEnd]);

  const importMutation = useMutation({
    mutationFn: async () => {
      const result = await listSignedZapSignDocs();
      const docs = result.docs || [];
      let imported = 0;
      let skipped = 0;

      for (const doc of docs) {
        const signer = doc.signers?.[0];
        // Verifica se já existe
        const { data: existing } = await supabase
          .from("signed_receipts")
          .select("id")
          .eq("zapsign_token", doc.token)
          .maybeSingle();

        if (existing) {
          skipped++;
          continue;
        }

        await supabase.from("signed_receipts").insert({
          zapsign_token: doc.token,
          freelancer_name: signer?.name || doc.name || "Desconhecido",
          freelancer_email: signer?.email || null,
          signed_file_url: doc.signed_file || null,
          status: doc.status || "signed",
          signed_at: doc.last_update_at || doc.created_at || new Date().toISOString(),
          amount: 0,
        });
        imported++;
      }

      return { imported, skipped, total: docs.length };
    },
    onSuccess: (res) => {
      toast.success(`Importação concluída: ${res.imported} novos, ${res.skipped} já existentes.`);
      queryClient.invalidateQueries({ queryKey: ["signed_receipts"] });
    },
    onError: (err: any) => {
      toast.error(`Erro ao importar: ${err.message || err}`);
    },
  });

  const uniqueNames = useMemo(() => {
    const set = new Set<string>();
    receipts.forEach((r) => set.add(r.freelancer_name));
    return Array.from(set).sort();
  }, [receipts]);

  const filtered = useMemo(() => {
    return receipts.filter((r) => {
      // Status
      if (statusFilter !== "all" && (r.status || "").toLowerCase() !== statusFilter) return false;

      // Nome (select)
      if (nameFilter !== "__all__" && r.freelancer_name !== nameFilter) return false;

      // Busca textual
      if (searchTerm.trim()) {
        const t = searchTerm.toLowerCase();
        const haystack =
          `${r.freelancer_name} ${r.freelancer_cpf || ""} ${r.unit || ""} ${r.role || ""}`.toLowerCase();
        if (!haystack.includes(t)) return false;
      }

      // Período (filtra por signed_at quando existir, senão created_at)
      if (startDate || endDate) {
        const dateStr = r.signed_at || r.created_at;
        if (!dateStr) return false;
        const d = parseISO(dateStr);
        if (startDate && d < new Date(startDate.setHours(0, 0, 0, 0))) return false;
        if (endDate) {
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          if (d > end) return false;
        }
      }

      return true;
    });
  }, [receipts, statusFilter, nameFilter, searchTerm, startDate, endDate]);

  const totalAmount = useMemo(
    () => filtered.reduce((acc, r) => acc + Number(r.amount || 0), 0),
    [filtered],
  );

  const exportCSV = () => {
    if (filtered.length === 0) {
      toast.warning("Nada para exportar.");
      return;
    }
    const headers = [
      "Nome",
      "CPF",
      "E-mail",
      "Função",
      "Loja",
      "Valor",
      "Período de referência",
      "Status",
      "Assinado em",
      "Link do PDF",
    ];
    const lines = filtered.map((r) => [
      r.freelancer_name,
      r.freelancer_cpf || "",
      r.freelancer_email || "",
      r.role || "",
      r.unit || "",
      Number(r.amount || 0)
        .toFixed(2)
        .replace(".", ","),
      r.reference_period || "",
      r.status,
      r.signed_at ? format(parseISO(r.signed_at), "dd/MM/yyyy HH:mm") : "",
      r.signed_file_url || "",
    ]);
    const csv = [headers, ...lines]
      .map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";"))
      .join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `recibos_assinados_${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const clearFilters = () => {
    setStartDate(undefined);
    setEndDate(undefined);
    setNameFilter("__all__");
    setStatusFilter("signed");
    setSearchTerm("");
  };

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
              <Link to="/">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Voltar
              </Link>
            </Button>
            <div className="mb-1 flex items-center gap-2">
              <div className="rounded-lg bg-primary/10 p-2">
                <FileSignature className="h-5 w-5 text-primary" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Recibos Assinados</h1>
            </div>
            <p className="text-sm text-muted-foreground">
              Histórico de recibos assinados pelos prestadores de serviço via ZapSign.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => importMutation.mutate()}
              disabled={importMutation.isPending}
            >
              <RefreshCw
                className={cn("mr-2 h-4 w-4", importMutation.isPending && "animate-spin")}
              />
              {importMutation.isPending ? "Importando..." : "Importar da ZapSign"}
            </Button>
            <Button variant="outline" onClick={exportCSV} disabled={filtered.length === 0}>
              <Download className="mr-2 h-4 w-4" />
              Exportar CSV
            </Button>
          </div>
        </header>

        {/* Filtros */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">Filtros</CardTitle>
            <CardDescription>Refine por período, prestador de serviço ou status.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-2">
                <Label>Data Inicial</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal text-xs sm:text-sm",
                        !startDate && "text-muted-foreground",
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {startDate ? format(startDate, "dd/MM/yyyy") : <span>dd/mm/aaaa</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={startDate}
                      onSelect={setStartDate}
                      locale={ptBR}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label>Data Final</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal text-xs sm:text-sm",
                        !endDate && "text-muted-foreground",
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {endDate ? format(endDate, "dd/MM/yyyy") : <span>dd/mm/aaaa</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={endDate}
                      onSelect={setEndDate}
                      locale={ptBR}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label>Prestador de Serviço</Label>
                <Select value={nameFilter} onValueChange={setNameFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Todos</SelectItem>
                    {uniqueNames.map((n) => (
                      <SelectItem key={n} value={n}>
                        {n}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="signed">Apenas assinados</SelectItem>
                    <SelectItem value="pending">Pendentes</SelectItem>
                    <SelectItem value="all">Todos os status</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome, CPF, loja..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Button variant="ghost" onClick={clearFilters}>
                Limpar filtros
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Resumo */}
        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          <Card>
            <CardContent className="pt-6">
              <p className="text-xs uppercase text-muted-foreground">Recibos encontrados</p>
              <p className="text-2xl font-bold">{filtered.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-xs uppercase text-muted-foreground">Valor total</p>
              <p className="text-2xl font-bold">{formatBRLCurrency(totalAmount)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-xs uppercase text-muted-foreground">Prestadores únicos</p>
              <p className="text-2xl font-bold">
                {new Set(filtered.map((r) => r.freelancer_name)).size}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Tabela */}
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-8 text-center text-muted-foreground">Carregando...</div>
            ) : filtered.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                Nenhum recibo encontrado. Tente ajustar os filtros ou importar da ZapSign.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Prestador de Serviço</TableHead>
                      <TableHead>Função</TableHead>
                      <TableHead>Loja</TableHead>
                      <TableHead>Período</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead>Assinado em</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">PDF</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell>
                          <div className="font-medium">{r.freelancer_name}</div>
                          {r.freelancer_cpf && (
                            <div className="text-xs text-muted-foreground">
                              CPF: {r.freelancer_cpf}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>{r.role || "-"}</TableCell>
                        <TableCell>{r.unit || "-"}</TableCell>
                        <TableCell className="text-sm">{r.reference_period || "-"}</TableCell>
                        <TableCell className="text-right font-medium">
                          {Number(r.amount) > 0 ? formatBRLCurrency(Number(r.amount)) : "-"}
                        </TableCell>
                        <TableCell className="text-sm">
                          {r.signed_at ? format(parseISO(r.signed_at), "dd/MM/yyyy HH:mm") : "-"}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              (r.status || "").toLowerCase() === "signed" ? "default" : "secondary"
                            }
                          >
                            {(r.status || "").toLowerCase() === "signed" ? "Assinado" : r.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {r.signed_file_url ? (
                            <Button variant="ghost" size="sm" asChild>
                              <a href={r.signed_file_url} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="h-4 w-4" />
                              </a>
                            </Button>
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Lançamentos sem recibo assinado */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle className="text-base">Lançamentos sem recibo assinado</CardTitle>
            <CardDescription>
              Prestadores com lançamentos no histórico, mas sem recibo assinado registrado.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-3 mb-4">
              <div className="space-y-2">
                <Label>Data Inicial</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal text-xs sm:text-sm",
                        !pendStart && "text-muted-foreground",
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {pendStart ? format(pendStart, "dd/MM/yyyy") : <span>dd/mm/aaaa</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={pendStart}
                      onSelect={setPendStart}
                      locale={ptBR}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label>Data Final</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal text-xs sm:text-sm",
                        !pendEnd && "text-muted-foreground",
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {pendEnd ? format(pendEnd, "dd/MM/yyyy") : <span>dd/mm/aaaa</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={pendEnd}
                      onSelect={setPendEnd}
                      locale={ptBR}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label>Loja</Label>
                <Select value={pendUnit} onValueChange={setPendUnit}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Todas</SelectItem>
                    {UNITS.map((u) => (
                      <SelectItem key={u} value={u}>
                        {getUnitDisplayName(u)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="mb-3 flex flex-wrap gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setPendStart(undefined);
                  setPendEnd(undefined);
                  setPendUnit("__all__");
                }}
              >
                Limpar filtros
              </Button>
              <Badge variant="secondary">{pendingEntries.length} lançamento(s)</Badge>
            </div>
            {pendingEntries.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">
                Nenhum lançamento pendente para os filtros selecionados.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Prestador</TableHead>
                      <TableHead>Função</TableHead>
                      <TableHead>Loja</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingEntries.map((e) => (
                      <TableRow key={e.id}>
                        <TableCell className="text-sm">
                          {format(parseISO(e.entry_date), "dd/MM/yyyy")}
                        </TableCell>
                        <TableCell className="font-medium">{e.name}</TableCell>
                        <TableCell>{e.role}</TableCell>
                        <TableCell>{e.unit}</TableCell>
                        <TableCell className="text-right">
                          {formatBRLCurrency(Number(e.deliveries_total ?? e.daily_rate ?? 0))}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
