import { useState, useEffect } from "react";
import { Send, CheckCircle2, ExternalLink, Loader2, RefreshCw, Printer, Clock } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { sendToZapSign, getZapSignDoc, type ZapSignDocResult } from "@/lib/zapsign";
import { supabase } from "@/integrations/supabase/client";

export interface ReceiptMetadata {
  freelancerCpf?: string;
  role?: string;
  unit?: string;
  amount?: number;
  referencePeriod?: string;
  workedDates?: string[];
}

interface ZapSignSendModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pdfBlob: Blob;
  docName: string;
  signerEmail: string;
  signerName: string;
  signerPhone?: string;
  metadata?: ReceiptMetadata;
  onSigned?: () => void;
  docType?: "receipt" | "contract";
}

const ZAPSIGN_TOKEN = "0b65b8cd-104c-45f8-b273-3baa8d14dd3da9b9d31b-e2fb-49f5-b0d6-88e56bbd528f";

export function ZapSignSendModal({
  open,
  onOpenChange,
  pdfBlob,
  docName,
  signerEmail: initialEmail,
  signerName,
  signerPhone,
  metadata,
  onSigned,
  docType = "receipt",
}: ZapSignSendModalProps) {
  const [email, setEmail] = useState(initialEmail || "");
  // Removed WhatsApp state variables
  const [isSending, setIsSending] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [result, setResult] = useState<ZapSignDocResult | null>(null);

  useEffect(() => {
    if (open) {
      setEmail(initialEmail || "");
      // Removed WhatsApp resets
      setResult(null);
    }
  }, [open, initialEmail, signerPhone]);

  const persistReceipt = async (doc: ZapSignDocResult, signed: boolean) => {
    try {
      if (docType === "contract") {
        const payload: any = {
          zapsign_token: doc.token,
          freelancer_name: signerName,
          freelancer_cpf: metadata?.freelancerCpf || null,
          freelancer_email: email,
          unit: metadata?.unit || null,
          signed_file_url: doc.signed_file || null,
          status: signed ? "assinado" : "pendente",
          signed_at: signed ? new Date().toISOString() : null,
          issued_at: new Date().toISOString(),
          expires_at: new Date(new Date().setMonth(new Date().getMonth() + 3)).toISOString(),
        };
        await supabase.from("contracts").upsert(payload, { onConflict: "zapsign_token" });
        return;
      }
      const payload: any = {
        zapsign_token: doc.token,
        freelancer_name: signerName,
        freelancer_cpf: metadata?.freelancerCpf || null,
        freelancer_email: email,
        role: metadata?.role || null,
        unit: metadata?.unit || null,
        amount: metadata?.amount ?? 0,
        reference_period: metadata?.referencePeriod || null,
        worked_dates:
          metadata?.workedDates && metadata.workedDates.length > 0 ? metadata.workedDates : null,
        signed_file_url: doc.signed_file || null,
        status: signed ? "signed" : doc.status || "pending",
        signed_at: signed ? new Date().toISOString() : null,
      };
      await supabase.from("signed_receipts").upsert(payload, { onConflict: "zapsign_token" });
    } catch (err) {
      console.error("Erro ao salvar documento no banco:", err);
    }
  };

  const handleSend = async () => {
    if (!email || !email.includes("@")) {
      toast.error("Por favor, informe um e-mail válido.");
      return;
    }

    setIsSending(true);
    try {
      const res = await sendToZapSign(
        ZAPSIGN_TOKEN,
        pdfBlob,
        docName,
        email,
        signerName,
      );
      setResult(res);
      // Salva o registro inicial (pendente) no banco
      await persistReceipt(res, false);
      toast.success("Documento enviado com sucesso para ZapSign!");
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Erro ao enviar para ZapSign.");
    } finally {
      setIsSending(false);
    }
  };

  const handleCheckStatus = async () => {
    if (!result?.token) return;
    setIsChecking(true);
    try {
      const updated = await getZapSignDoc(ZAPSIGN_TOKEN, result.token);
      setResult({ ...result, ...updated });
      const isSigned = (updated.status || "").toLowerCase() === "signed";
      if (isSigned) {
        await persistReceipt({ ...result, ...updated }, true);
        toast.success("Documento assinado!");
        onSigned?.();
      } else {
        toast.info(`Status atual: ${updated.status || "pendente"}`);
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Erro ao verificar status.");
    } finally {
      setIsChecking(false);
    }
  };

  const handlePrintSigned = () => {
    if (!result?.signed_file) return;
    window.open(result.signed_file, "_blank", "noopener,noreferrer");
  };

  const signer = result?.signers?.[0];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Enviar para Assinatura Digital</DialogTitle>
          <DialogDescription>
            O prestador de serviço receberá um e-mail da ZapSign para assinar o recibo.
          </DialogDescription>
        </DialogHeader>

        {!result ? (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nome do Signatário</Label>
              <Input value={signerName} readOnly className="bg-muted" />
            </div>
            <div className="space-y-2">
              <Label>E-mail do Prestador de Serviço</Label>
              <Input
                type="email"
                placeholder="email@exemplo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            {/* WhatsApp inputs removed */}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSend} disabled={isSending}>
                {isSending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    Enviar agora
                  </>
                )}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-5 py-4 text-center">
            {(() => {
              const status = (result.status || "").toLowerCase();
              const isSigned = status === "signed";
              return (
                <>
                  <div className="flex justify-center">
                    {isSigned ? (
                      <CheckCircle2 className="h-16 w-16 text-green-500" />
                    ) : (
                      <Clock className="h-16 w-16 text-amber-500" />
                    )}
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-lg font-semibold">
                      {isSigned ? "Documento Assinado!" : "Aguardando Assinatura"}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {isSigned ? (
                        <>
                          O recibo foi assinado por <b>{signerName}</b>.
                        </>
                      ) : (
                        <>
                          Link enviado para <b>{email}</b>. Aguardando assinatura do prestador de
                          serviço.
                        </>
                      )}
                    </p>
                    {result.status && (
                      <p className="text-xs text-muted-foreground">
                        Status atual: <b className="uppercase">{result.status}</b>
                      </p>
                    )}
                  </div>

                  {!isSigned && signer?.sign_url && (
                    <div className="rounded-lg bg-muted p-3">
                      <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
                        Link direto para assinatura:
                      </p>
                      <a
                        href={signer.sign_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 text-sm font-medium text-primary hover:underline"
                      >
                        Abrir link de assinatura <ExternalLink className="h-4 w-4" />
                      </a>
                    </div>
                  )}

                  <div className="flex flex-col gap-2">
                    {isSigned && result.signed_file ? (
                      <Button className="w-full" onClick={handlePrintSigned}>
                        <Printer className="mr-2 h-4 w-4" />
                        Abrir / Imprimir Recibo Assinado
                      </Button>
                    ) : (
                      <Button
                        className="w-full"
                        variant="secondary"
                        onClick={handleCheckStatus}
                        disabled={isChecking}
                      >
                        {isChecking ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Verificando...
                          </>
                        ) : (
                          <>
                            <RefreshCw className="mr-2 h-4 w-4" />
                            Verificar status
                          </>
                        )}
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => onOpenChange(false)}
                    >
                      Fechar
                    </Button>
                  </div>
                </>
              );
            })()}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
