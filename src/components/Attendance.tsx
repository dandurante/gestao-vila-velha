import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { UNITS, getUnitDisplayName } from "@/lib/units";
import { Button } from "@/components/ui/button";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";

const STATUS_OPTIONS = [
  "OK",
  "FOLGA",
  "ATRASO",
  "ATESTADO",
  "FALTA",
  "SUSPENSO",
  "DESLIGADO",
  "FÉRIAS",
  "LICENÇA",
  "ÓBITO",
  "AFAST. INSS",
] as const;
type Status = (typeof STATUS_OPTIONS)[number];

const REGIMES = ["CLT", "PJ", "J.A"] as const;

const MONTHS = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

const WEEKDAYS = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SAB"];

const STATUS_COLOR: Record<string, string> = {
  OK: "bg-emerald-50 text-emerald-700",
  FOLGA: "bg-slate-100 text-slate-700",
  ATRASO: "bg-amber-50 text-amber-700",
  ATESTADO: "bg-blue-50 text-blue-700",
  FALTA: "bg-red-50 text-red-700",
  SUSPENSO: "bg-orange-50 text-orange-700",
  DESLIGADO: "bg-zinc-200 text-zinc-700",
  FÉRIAS: "bg-indigo-50 text-indigo-700",
  LICENÇA: "bg-violet-50 text-violet-700",
  ÓBITO: "bg-stone-200 text-stone-700",
  "AFAST. INSS": "bg-fuchsia-50 text-fuchsia-700",
};

type Employee = {
  id: string;
  unit: string;
  name: string;
  cpf: string | null;
  regime: string;
  status: string;
  active: boolean;
};
type AttRecord = { id: string; employee_id: string; entry_date: string; status: string };

function daysInMonth(year: number, month0: number) {
  return new Date(year, month0 + 1, 0).getDate();
}
function fmtDate(year: number, month0: number, day: number) {
  return `${year}-${String(month0 + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function Attendance() {
  const today = new Date();
  const [unit, setUnit] = useState<string>(UNITS[0]);
  const [month, setMonth] = useState<number>(today.getMonth());
  const [year, setYear] = useState<number>(today.getFullYear());
  const [addOpen, setAddOpen] = useState(false);
  const [newEmp, setNewEmp] = useState({ name: "", cpf: "", regime: "CLT" });

  const qc = useQueryClient();
  const totalDays = daysInMonth(year, month);
  const monthStart = fmtDate(year, month, 1);
  const monthEnd = fmtDate(year, month, totalDays);

  const { data: employees = [] } = useQuery({
    queryKey: ["att-emp", unit],
    queryFn: async (): Promise<Employee[]> => {
      const { data, error } = await supabase
        .from("attendance_employees" as any)
        .select("*")
        .eq("unit", unit)
        .eq("active", true)
        .order("name");
      if (error) throw error;
      return (data as any) ?? [];
    },
  });

  const { data: records = [] } = useQuery({
    queryKey: ["att-rec", unit, monthStart, monthEnd],
    queryFn: async (): Promise<AttRecord[]> => {
      const { data, error } = await supabase
        .from("attendance_records" as any)
        .select("id,employee_id,entry_date,status")
        .eq("unit", unit)
        .gte("entry_date", monthStart)
        .lte("entry_date", monthEnd);
      if (error) throw error;
      return (data as any) ?? [];
    },
  });

  const recordMap = useMemo(() => {
    const m = new Map<string, AttRecord>();
    records.forEach((r) => m.set(`${r.employee_id}|${r.entry_date}`, r));
    return m;
  }, [records]);

  const upsertRecord = useMutation({
    mutationFn: async ({
      employee_id,
      date,
      status,
    }: {
      employee_id: string;
      date: string;
      status: string | null;
    }) => {
      const existing = recordMap.get(`${employee_id}|${date}`);
      if (!status) {
        if (existing) {
          const { error } = await supabase
            .from("attendance_records" as any)
            .delete()
            .eq("id", existing.id);
          if (error) throw error;
        }
        return;
      }
      if (existing) {
        const { error } = await supabase
          .from("attendance_records" as any)
          .update({ status })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("attendance_records" as any)
          .insert({ employee_id, unit, entry_date: date, status });
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["att-rec", unit, monthStart, monthEnd] }),
    onError: (e: any) => toast.error(e.message ?? "Erro ao salvar"),
  });

  const addEmployee = useMutation({
    mutationFn: async () => {
      if (!newEmp.name.trim()) throw new Error("Informe o nome");
      const { error } = await supabase.from("attendance_employees" as any).insert({
        unit,
        name: newEmp.name.trim(),
        cpf: newEmp.cpf.trim() || null,
        regime: newEmp.regime,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Colaborador adicionado");
      setAddOpen(false);
      setNewEmp({ name: "", cpf: "", regime: "CLT" });
      qc.invalidateQueries({ queryKey: ["att-emp", unit] });
    },
    onError: (e: any) => toast.error(e.message ?? "Erro"),
  });

  const removeEmployee = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("attendance_employees" as any)
        .update({ active: false })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["att-emp", unit] }),
  });

  // Totais por colaborador
  const totals = useMemo(() => {
    return employees.map((emp) => {
      const counts: Record<string, number> = {} as any;
      STATUS_OPTIONS.forEach((s) => (counts[s] = 0));
      for (let d = 1; d <= totalDays; d++) {
        const r = recordMap.get(`${emp.id}|${fmtDate(year, month, d)}`);
        if (r && counts[r.status] !== undefined) counts[r.status]++;
      }
      const ausencias = counts["FALTA"] + counts["ATESTADO"] + counts["SUSPENSO"];
      const presencas = counts["OK"];
      const folgas = counts["FOLGA"];
      const diasConsiderados = presencas + ausencias;
      const pctPresenca = diasConsiderados > 0 ? presencas / diasConsiderados : 0;
      const pctAusencia = diasConsiderados > 0 ? ausencias / diasConsiderados : 0;
      return {
        emp,
        counts,
        presencas,
        ausencias,
        atrasos: counts["ATRASO"],
        folgas,
        pctPresenca,
        pctAusencia,
      };
    });
  }, [employees, recordMap, year, month, totalDays]);

  const resumo = useMemo(() => {
    const presencas = totals.reduce((a, t) => a + t.presencas, 0);
    const ausencias = totals.reduce((a, t) => a + t.ausencias, 0);
    const atrasos = totals.reduce((a, t) => a + t.atrasos, 0);
    const folgas = totals.reduce((a, t) => a + t.folgas, 0);
    const pct = totals.length ? totals.reduce((a, t) => a + t.pctPresenca, 0) / totals.length : 0;
    const pctAusencia = totals.length
      ? totals.reduce((a, t) => a + t.pctAusencia, 0) / totals.length
      : 0;
    return {
      presencas,
      ausencias,
      atrasos,
      folgas,
      pct,
      pctAusencia,
      colaboradores: employees.length,
    };
  }, [totals, employees.length]);

  const days = Array.from({ length: totalDays }, (_, i) => i + 1);

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="max-w-[1400px] mx-auto space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[160px]">
            <Label>Loja</Label>
            <Select value={unit} onValueChange={setUnit}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {UNITS.map((u) => (
                  <SelectItem key={u} value={u}>
                    {getUnitDisplayName(u)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Mês</Label>
            <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTHS.map((m, i) => (
                  <SelectItem key={m} value={String(i)}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Ano</Label>
            <Input
              type="number"
              className="w-[100px]"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
            />
          </div>
          <div className="ml-auto">
            <Dialog open={addOpen} onOpenChange={setAddOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="size-4" />
                  Colaborador
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Novo colaborador — {unit}</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <div>
                    <Label>Nome</Label>
                    <Input
                      value={newEmp.name}
                      onChange={(e) => setNewEmp({ ...newEmp, name: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>CPF</Label>
                    <Input
                      value={newEmp.cpf}
                      onChange={(e) => setNewEmp({ ...newEmp, cpf: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Regime</Label>
                    <Select
                      value={newEmp.regime}
                      onValueChange={(v) => setNewEmp({ ...newEmp, regime: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {REGIMES.map((r) => (
                          <SelectItem key={r} value={r}>
                            {r}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={() => addEmployee.mutate()} disabled={addEmployee.isPending}>
                    Salvar
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Resumo */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          {[
            ["Colaboradores", resumo.colaboradores],
            ["Presenças", resumo.presencas],
            ["Ausências", resumo.ausencias],
            ["Atrasos", resumo.atrasos],
            ["Folgas", resumo.folgas],
            ["% Presença", `${(resumo.pct * 100).toFixed(0)}%`],
          ].map(([l, v]) => (
            <Card key={l as string}>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs text-muted-foreground font-medium">{l}</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="text-2xl font-semibold">{v}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Grade */}
        <Card>
          <CardHeader>
            <CardTitle>
              Lançamento diário — {MONTHS[month]}/{year}
            </CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="text-xs border-collapse">
              <thead>
                <tr>
                  <th className="sticky left-0 bg-card border p-1 text-left min-w-[200px]">
                    Colaborador
                  </th>
                  <th className="border p-1">Regime</th>
                  {days.map((d) => {
                    const dow = new Date(year, month, d).getDay();
                    return (
                      <th key={d} className="border p-1 text-center min-w-[42px]">
                        <div>{d}</div>
                        <div className="text-[10px] text-muted-foreground">{WEEKDAYS[dow]}</div>
                      </th>
                    );
                  })}
                  <th className="border p-1">P</th>
                  <th className="border p-1">A</th>
                  <th className="border p-1">At</th>
                  <th className="border p-1">F</th>
                  <th className="border p-1">%P</th>
                  <th className="border p-1"></th>
                </tr>
              </thead>
              <tbody>
                {totals.map(({ emp, presencas, ausencias, atrasos, folgas, pctPresenca }) => (
                  <tr key={emp.id}>
                    <td className="sticky left-0 bg-card border p-1 font-medium">{emp.name}</td>
                    <td className="border p-1 text-center">{emp.regime}</td>
                    {days.map((d) => {
                      const date = fmtDate(year, month, d);
                      const rec = recordMap.get(`${emp.id}|${date}`);
                      const val = rec?.status ?? "";
                      return (
                        <td
                          key={d}
                          className={`border p-0 ${val ? (STATUS_COLOR[val] ?? "") : ""}`}
                        >
                          <select
                            className="w-full bg-transparent text-[10px] p-1 outline-none"
                            value={val}
                            onChange={(e) =>
                              upsertRecord.mutate({
                                employee_id: emp.id,
                                date,
                                status: e.target.value || null,
                              })
                            }
                          >
                            <option value="">—</option>
                            {STATUS_OPTIONS.map((s) => (
                              <option key={s} value={s}>
                                {s}
                              </option>
                            ))}
                          </select>
                        </td>
                      );
                    })}
                    <td className="border p-1 text-center font-medium text-emerald-700">
                      {presencas}
                    </td>
                    <td className="border p-1 text-center font-medium text-red-700">{ausencias}</td>
                    <td className="border p-1 text-center text-amber-700">{atrasos}</td>
                    <td className="border p-1 text-center text-slate-600">{folgas}</td>
                    <td className="border p-1 text-center">{(pctPresenca * 100).toFixed(0)}%</td>
                    <td className="border p-1 text-center">
                      <button
                        title="Remover"
                        onClick={() => {
                          if (confirm(`Remover ${emp.name}?`)) removeEmployee.mutate(emp.id);
                        }}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
                {employees.length === 0 && (
                  <tr>
                    <td colSpan={totalDays + 8} className="text-center p-6 text-muted-foreground">
                      Nenhum colaborador cadastrado nesta loja.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>

        {/* Painel resumo conforme modelo de presenteísmo */}
        <section className="space-y-3" aria-labelledby="attendance-summary-title">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="attendance-summary-title" className="text-lg font-semibold">
              Painel de presenteísmo por colaborador
            </h2>
            <p className="text-sm text-muted-foreground">
              {unit} · {MONTHS[month].toLowerCase()}/{year}
            </p>
          </div>

          <div className="flex flex-col items-start gap-3 xl:flex-row">
            <div className="w-full min-w-0 flex-1 overflow-x-auto rounded-md border">
              <table className="w-full min-w-[700px] border-collapse text-sm">
                <thead className="bg-muted/60">
                  <tr className="border-b">
                    <th className="p-2 text-center font-medium">QTD</th>
                    <th className="p-2 text-left font-medium">Colaborador</th>
                    <th className="p-2 text-center font-medium">Presenças</th>
                    <th className="p-2 text-center font-medium">Ausências</th>
                    <th className="p-2 text-center font-medium">Atrasos</th>
                    <th className="p-2 text-center font-medium">Folgas</th>
                    <th className="p-2 text-center font-medium">% Presença</th>
                    <th className="p-2 text-center font-medium">% Ausência</th>
                  </tr>
                </thead>
                <tbody>
                  {totals.map(
                    (
                      { emp, presencas, ausencias, atrasos, folgas, pctPresenca, pctAusencia },
                      index,
                    ) => (
                      <tr key={emp.id} className="border-b last:border-b-0 hover:bg-muted/30">
                        <td className="p-2 text-center">{index + 1}</td>
                        <td className="p-2 font-medium">{emp.name}</td>
                        <td className="p-2 text-center">{presencas}</td>
                        <td className="p-2 text-center">{ausencias}</td>
                        <td className="p-2 text-center">{atrasos}</td>
                        <td className="p-2 text-center">{folgas}</td>
                        <td className="p-2 text-center font-medium">
                          {(pctPresenca * 100).toFixed(1)}%
                        </td>
                        <td className="p-2 text-center font-medium">
                          {(pctAusencia * 100).toFixed(1)}%
                        </td>
                      </tr>
                    ),
                  )}
                  {totals.length === 0 && (
                    <tr>
                      <td colSpan={8} className="p-6 text-center text-muted-foreground">
                        Nenhum lançamento para resumir.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="w-full shrink-0 overflow-hidden rounded-md border xl:w-80">
              <div className="border-b bg-muted/60 px-4 py-2 text-center text-sm font-semibold uppercase tracking-wide">
                Resumo
              </div>
              {[
                ["Colaboradores lançados", resumo.colaboradores],
                ["Presenças", resumo.presencas],
                ["Ausências", resumo.ausencias],
                ["Atrasos", resumo.atrasos],
                ["Folgas", resumo.folgas],
                ["Presença média", `${(resumo.pct * 100).toFixed(1)}%`],
                ["Ausência média", `${(resumo.pctAusencia * 100).toFixed(1)}%`],
              ].map(([label, value]) => (
                <div
                  key={String(label)}
                  className="grid grid-cols-[1fr_auto] border-b last:border-b-0"
                >
                  <span className="bg-muted/30 px-4 py-2 font-medium">{label}</span>
                  <span className="min-w-20 px-4 py-2 text-right font-semibold">{value}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
