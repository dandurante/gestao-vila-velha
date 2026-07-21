import { useState, useMemo, useEffect } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { CalendarIcon, Send } from "lucide-react";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { useFreelancerRegistry } from "@/hooks/useFreelancerRegistry";
import { generateReceiptPdf } from "@/lib/receiptPdf";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ZapSignSendModal } from "./ZapSignSendModal";
import { findOverlappingReceipts, formatPeriodList } from "@/lib/receiptOverlap";

interface ReceiptModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  freelancerName: string;
  pix: string;
  rows: any[];
  initialUnit?: string;
  initialDateRange?: { from: Date; to: Date };
}

export function ReceiptModal({
  open,
  onOpenChange,
  freelancerName,
  pix,
  rows,
  initialUnit,
  initialDateRange,
}: ReceiptModalProps) {
  const { registry } = useFreelancerRegistry();
  const [startDate, setStartDate] = useState<Date | undefined>(initialDateRange?.from);
  const [endDate, setEndDate] = useState<Date | undefined>(initialDateRange?.to);
  const [unit, setUnit] = useState<string>(initialUnit || "");

  // Estado para o ZapSign
  const [zapSignOpen, setZapSignOpen] = useState(false);
  const [lastBlob, setLastBlob] = useState<Blob | null>(null);
  const [lastFilename, setLastFilename] = useState("");
  const [isSigned, setIsSigned] = useState(false);
  const [lastMetadata, setLastMetadata] = useState<{
    amount: number;
    referencePeriod: string;
    workedDates: string[];
  } | null>(null);

  // Atualiza os campos quando as props iniciais mudarem (ex: ao clicar em outro prestador de serviço)
  useEffect(() => {
    if (open) {
      setStartDate(initialDateRange?.from);
      setEndDate(initialDateRange?.to);
      setUnit(initialUnit || "");
      setLastBlob(null);
      setIsSigned(false);
      setLastMetadata(null);
    }
  }, [open, initialUnit, initialDateRange]);

  const freelancerInfo = useMemo(() => {
    return registry.find((f) => f.nome === freelancerName && f.pix === pix);
  }, [registry, freelancerName, pix]);

  const availableUnits = useMemo(() => {
    if (!startDate || !endDate) return [];
    const startISO = format(startDate, "yyyy-MM-dd");
    const endISO = format(endDate, "yyyy-MM-dd");

    const filtered = rows.filter(
      (r) =>
        r.name === freelancerName &&
        r.pix === pix &&
        r.entry_date >= startISO &&
        r.entry_date <= endISO,
    );

    const unitSet = new Set<string>();
    filtered.forEach((r) => unitSet.add(r.unit));
    return Array.from(unitSet).sort();
  }, [rows, freelancerName, pix, startDate, endDate]);

  const handleGenerate = async (): Promise<void> => {
    if (!startDate || !endDate || !unit) {
      toast.error("Selecione a loja e o período (início e fim).");
      return;
    }

    if (!freelancerInfo) {
      toast.error("Prestador de Serviço não cadastrado. Vá até a tela de Cadastro primeiro.");
      return;
    }

    const startISO = format(startDate, "yyyy-MM-dd");
    const endISO = format(endDate, "yyyy-MM-dd");

    const periodRows = rows.filter(
      (r) =>
        r.name === freelancerName &&
        r.pix === pix &&
        r.unit === unit &&
        r.entry_date >= startISO &&
        r.entry_date <= endISO,
    );

    if (periodRows.length === 0) {
      toast.warning(`Nenhum lançamento encontrado para a loja ${unit} neste período.`);
      return;
    }

    // Bloqueia se já existe recibo cobrindo algum dos dias efetivamente trabalhados
    try {
      const workedDates = Array.from(new Set(periodRows.map((r) => r.entry_date))).sort();
      const overlaps = await findOverlappingReceipts({
        freelancerName: freelancerInfo.nome,
        freelancerCpf: freelancerInfo.cpf,
        unit,
        workedDates,
      });
      if (overlaps.length > 0) {
        toast.error(
          `Já existe recibo emitido para esse prestador nestes dias: ${formatPeriodList(overlaps)}.`,
          { duration: 8000 },
        );
        return;
      }
    } catch (err) {
      console.error("Falha ao verificar recibos existentes:", err);
    }

    try {
      const { blob, filename, amount, referencePeriod, workedDates } = generateReceiptPdf({
        freelancer: {
          nome: freelancerInfo.nome,
          cpf: freelancerInfo.cpf,
          rg: freelancerInfo.rg,
          role: freelancerInfo.role,
        },
        unit,
        periodRows,
        startDate,
        endDate,
      });

      setLastBlob(blob);
      setLastFilename(filename);
      setIsSigned(false);
      setLastMetadata({ amount, referencePeriod, workedDates });

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success("Recibo gerado com sucesso!");
    } catch (err: any) {
      console.error("Erro na geração do PDF:", err);
      toast.error(`Erro ao gerar PDF: ${err.message || "Erro desconhecido"}`);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Gerar Recibo de Pagamento</DialogTitle>
            <DialogDescription>
              Selecione a loja e o período para consolidar o recibo.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {!freelancerInfo && (
              <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
                Prestador de Serviço não cadastrado (CPF/Pix). Vá até a tela de Cadastro primeiro.
              </div>
            )}

            <div className="space-y-2">
              <Label>Loja para o Recibo</Label>
              <Select value={unit} onValueChange={setUnit}>
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      availableUnits.length > 0
                        ? "Selecione a loja..."
                        : "Nenhum lançamento no período"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {availableUnits.map((u) => (
                    <SelectItem key={u} value={u}>
                      {u}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start">Data Inicial</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant={"outline"}
                      className={cn(
                        "w-full justify-start text-left font-normal text-xs sm:text-sm",
                        !startDate && "text-muted-foreground",
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {startDate ? (
                        format(startDate, "dd/MM/yyyy", { locale: ptBR })
                      ) : (
                        <span>dd/mm/aaaa</span>
                      )}
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
                <Label htmlFor="end">Data Final</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant={"outline"}
                      className={cn(
                        "w-full justify-start text-left font-normal text-xs sm:text-sm",
                        !endDate && "text-muted-foreground",
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {endDate ? (
                        format(endDate, "dd/MM/yyyy", { locale: ptBR })
                      ) : (
                        <span>dd/mm/aaaa</span>
                      )}
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
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>

            {lastBlob && !isSigned && (
              <Button
                variant="outline"
                className="border-primary/50 text-primary hover:bg-primary/5"
                onClick={() => setZapSignOpen(true)}
              >
                <Send className="mr-2 h-4 w-4" />
                Enviar para Assinatura
              </Button>
            )}

            {isSigned && (
              <div className="flex items-center justify-center gap-2 rounded-md border border-primary/40 bg-primary/10 px-3 py-2 text-sm font-medium text-primary">
                ✓ Documento assinado
              </div>
            )}

            <Button
              onClick={handleGenerate}
              disabled={!freelancerInfo || !unit || !startDate || !endDate}
            >
              {lastBlob ? "Baixar novamente" : "Baixar Recibo (PDF)"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal ZapSign */}
      {freelancerInfo && lastBlob && (
        <ZapSignSendModal
          open={zapSignOpen}
          onOpenChange={setZapSignOpen}
          pdfBlob={lastBlob}
          docName={lastFilename}
          signerEmail={freelancerInfo.email || ""}
          signerName={freelancerInfo.nome}
          metadata={{
            freelancerCpf: freelancerInfo.cpf,
            role: freelancerInfo.role,
            unit,
            amount: lastMetadata?.amount,
            referencePeriod: lastMetadata?.referencePeriod,
            workedDates: lastMetadata?.workedDates,
          }}
          onSigned={() => setIsSigned(true)}
        />
      )}
    </>
  );
}
