import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { CheckCircle2, Loader2, Send, AlertTriangle, XCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { generateReceiptPdf, type ReceiptRow } from "@/lib/receiptPdf";
import { sendToZapSign } from "@/lib/zapsign";
import { useFreelancerRegistry } from "@/hooks/useFreelancerRegistry";
import { supabase } from "@/integrations/supabase/client";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { findOverlappingReceipts } from "@/lib/receiptOverlap";

const ZAPSIGN_TOKEN = "0b65b8cd-104c-45f8-b273-3baa8d14dd3da9b9d31b-e2fb-49f5-b0d6-88e56bbd528f";

export interface BulkSelectedPerson {
  name: string;
  pix: string;
}

interface BulkReceiptsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selected: BulkSelectedPerson[];
  rows: ReceiptRow[];
  startDate?: Date;
  endDate?: Date;
}

type ItemStatus =
  | { kind: "pending" }
  | { kind: "sending" }
  | { kind: "ok"; unit: string }
  | { kind: "skip"; reason: string }
  | { kind: "error"; message: string };

interface RunItem {
  name: string;
  pix: string;
  unit: string;
  status: ItemStatus;
}

export function BulkReceiptsModal({
  open,
  onOpenChange,
  selected,
  rows,
  startDate,
  endDate,
}: BulkReceiptsModalProps) {
  const { registry } = useFreelancerRegistry();
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [items, setItems] = useState<RunItem[]>([]);
  // Removed WhatsApp state variables

  // Pré-monta lista (1 linha por prestador × loja) para preview e progresso
  const initialItems = useMemo<RunItem[]>(() => {
    if (!startDate || !endDate) return [];
    const startISO = format(startDate, "yyyy-MM-dd");
    const endISO = format(endDate, "yyyy-MM-dd");
    const out: RunItem[] = [];
    for (const p of selected) {
      const personRows = rows.filter(
        (r) =>
          r.name === p.name &&
          r.pix === p.pix &&
          r.entry_date >= startISO &&
          r.entry_date <= endISO,
      );
      const units = Array.from(new Set(personRows.map((r) => r.unit))).sort();
      if (units.length === 0) {
        out.push({
          name: p.name,
          pix: p.pix,
          unit: "—",
          status: { kind: "skip", reason: "Sem lançamentos no período" },
        });
        continue;
      }
      for (const u of units) {
        out.push({ name: p.name, pix: p.pix, unit: u, status: { kind: "pending" } });
      }
    }
    return out;
  }, [selected, rows, startDate, endDate]);

  useEffect(() => {
    if (open) {
      setItems(initialItems);
      setDone(false);
      setRunning(false);
    }
  }, [open, initialItems]);

  const handleRun = async () => {
    if (!startDate || !endDate) {
      toast.error("Selecione o período antes de enviar.");
      return;
    }
    setRunning(true);
    const startISO = format(startDate, "yyyy-MM-dd");
    const endISO = format(endDate, "yyyy-MM-dd");

    // Trabalha sobre uma cópia local para garantir progresso UI estável
    const next = [...items];

    for (let i = 0; i < next.length; i++) {
      const it = next[i];
      if (it.status.kind === "skip") continue;

      next[i] = { ...it, status: { kind: "sending" } };
      setItems([...next]);

      const reg = registry.find(
        (r) => r.nome.trim().toLowerCase() === it.name.trim().toLowerCase() && r.pix === it.pix,
      );
      if (!reg) {
        next[i] = {
          ...it,
          status: { kind: "skip", reason: "Prestador não cadastrado" },
        };
        setItems([...next]);
        continue;
      }
      if (!reg.email || !reg.email.includes("@")) {
        next[i] = {
          ...it,
          status: { kind: "skip", reason: "Sem e-mail cadastrado" },
        };
        setItems([...next]);
        continue;
      }

      const periodRows = rows.filter(
        (r) =>
          r.name === it.name &&
          r.pix === it.pix &&
          r.unit === it.unit &&
          r.entry_date >= startISO &&
          r.entry_date <= endISO,
      );

      // Bloqueia se já existe recibo cobrindo algum dos dias trabalhados
      try {
        const workedDates = Array.from(new Set(periodRows.map((r) => r.entry_date))).sort();
        const overlaps = await findOverlappingReceipts({
          freelancerName: reg.nome,
          freelancerCpf: reg.cpf,
          unit: it.unit,
          workedDates,
        });
        if (overlaps.length > 0) {
          next[i] = {
            ...it,
            status: { kind: "skip", reason: "Recibo já emitido para um ou mais dias" },
          };
          setItems([...next]);
          continue;
        }
      } catch (err) {
        console.error("Falha ao verificar recibos existentes:", err);
      }

      try {
        const { blob, filename, amount, referencePeriod, workedDates } = generateReceiptPdf({
          freelancer: { nome: reg.nome, cpf: reg.cpf, rg: reg.rg, role: reg.role },
          unit: it.unit,
          periodRows,
          startDate,
          endDate,
        });

        const res = await sendToZapSign(
          ZAPSIGN_TOKEN,
          blob,
          filename,
          reg.email,
          reg.nome,
        );

        // Persiste no banco como pendente
        try {
          await supabase.from("signed_receipts").upsert(
            {
              zapsign_token: res.token,
              freelancer_name: reg.nome,
              freelancer_cpf: reg.cpf || null,
              freelancer_email: reg.email,
              role: reg.role || null,
              unit: it.unit,
              amount,
              reference_period: referencePeriod,
              worked_dates: workedDates,
              signed_file_url: res.signed_file || null,
              status: res.status || "pending",
              signed_at: null,
            } as any,
            { onConflict: "zapsign_token" },
          );
        } catch (dbErr) {
          console.error("Erro ao salvar recibo:", dbErr);
        }

        next[i] = { ...it, status: { kind: "ok", unit: it.unit } };
        setItems([...next]);
      } catch (err: any) {
        console.error("Erro ao enviar recibo em lote:", err);
        next[i] = {
          ...it,
          status: { kind: "error", message: err?.message || "Erro desconhecido" },
        };
        setItems([...next]);
      }
    }

    setRunning(false);
    setDone(true);

    const okCount = next.filter((x) => x.status.kind === "ok").length;
    const errCount = next.filter((x) => x.status.kind === "error").length;
    const skipCount = next.filter((x) => x.status.kind === "skip").length;
    if (okCount > 0) toast.success(`${okCount} recibo(s) enviado(s) para assinatura.`);
    if (errCount > 0) toast.error(`${errCount} falha(s) no envio.`);
    if (skipCount > 0) toast.info(`${skipCount} ignorado(s).`);
  };

  const pendingToSend = items.filter((i) => i.status.kind === "pending").length;

  return (
    <Dialog open={open} onOpenChange={(v) => !running && onOpenChange(v)}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Gerar e enviar recibos em lote</DialogTitle>
          <DialogDescription>
            {startDate && endDate ? (
              <>
                Período:{" "}
                <b>
                  {format(startDate, "dd/MM/yyyy", { locale: ptBR })} a{" "}
                  {format(endDate, "dd/MM/yyyy", { locale: ptBR })}
                </b>
                . Será gerado um recibo por prestador × loja e enviado por e-mail via ZapSign.
              </>
            ) : (
              "Selecione um período no filtro de Totais antes de continuar."
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[50vh] overflow-y-auto rounded-md border border-border/60">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-muted/60 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">Prestador</th>
                <th className="px-3 py-2 text-left">Loja</th>
                <th className="px-3 py-2 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-3 py-6 text-center text-muted-foreground">
                    Nenhum prestador selecionado.
                  </td>
                </tr>
              )}
              {items.map((it, idx) => (
                <tr
                  key={`${it.name}-${it.pix}-${it.unit}-${idx}`}
                  className="border-t border-border/50"
                >
                  <td className="px-3 py-2 font-medium">{it.name}</td>
                  <td className="px-3 py-2 text-muted-foreground">{it.unit}</td>
                  <td className="px-3 py-2">
                    <StatusBadge status={it.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-4 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-4">
            {/* WhatsApp options removed */}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={running}>
              {done ? "Fechar" : "Cancelar"}
            </Button>
            <Button
              onClick={handleRun}
              disabled={running || done || pendingToSend === 0 || !startDate || !endDate}
            >
              {running ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Enviar {pendingToSend} recibo(s)
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function StatusBadge({ status }: { status: ItemStatus }) {
  switch (status.kind) {
    case "pending":
      return <Badge variant="secondary">Pendente</Badge>;
    case "sending":
      return (
        <Badge variant="secondary" className="gap-1">
          <Loader2 className="h-3 w-3 animate-spin" /> Enviando
        </Badge>
      );
    case "ok":
      return (
        <Badge className="gap-1 bg-green-600 hover:bg-green-600">
          <CheckCircle2 className="h-3 w-3" /> Enviado
        </Badge>
      );
    case "skip":
      return (
        <Badge variant="outline" className="gap-1 text-amber-600 border-amber-300">
          <AlertTriangle className="h-3 w-3" /> {status.reason}
        </Badge>
      );
    case "error":
      return (
        <Badge variant="destructive" className="gap-1">
          <XCircle className="h-3 w-3" /> {status.message}
        </Badge>
      );
  }
}
