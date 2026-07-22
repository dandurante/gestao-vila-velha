import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserRoles } from "@/hooks/useUserRole";
import { useFreelancerRegistry } from "@/hooks/useFreelancerRegistry";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { CurrencyInput } from "@/components/CurrencyInput";
import { generateReceiptPdf } from "@/lib/receiptPdf";
import { sendToZapSign } from "@/lib/zapsign";
import { listRecentZapSignDocs } from "@/lib/zapsign.functions";
import { Checkbox } from "@/components/ui/checkbox";
import { formatBRLCurrency } from "@/lib/currency";
import { getUnitDisplayName } from "@/lib/units";
import { exportWorkbook } from "@/lib/exportXlsx";
import {
  ClipboardCheck,
  ShieldCheck,
  DollarSign,
  MapPin,
  Eye,
  Check,
  X,
  Send,
  Loader2,
  FileText,
  AlertCircle,
  Upload,
  ExternalLink,
  Info,
  ArrowLeft,
  Settings,
  Download,
  RefreshCw,
} from "lucide-react";
import { differenceInDays, parseISO, format } from "date-fns";

const ZAPSIGN_TOKEN =
  (typeof process !== "undefined" && process.env?.VITE_ZAPSIGN_TOKEN) ||
  "0b65b8cd-104c-45f8-b273-3baa8d14dd3da9b9d31b-e2fb-49f5-b0d6-88e56bbd528f";

const AVAILABLE_STORES = [
  "Praia da Costa",
  "Itaparica",
];

export const Route = createFileRoute("/controle-operacional")({
  component: ControleOperacionalPage,
  head: () => ({
    meta: [
      { title: "Controle Operacional — Freeladex" },
      {
        name: "description",
        content: "Validação, aprovação e liberação financeira de prestadores de serviço.",
      },
    ],
  }),
});

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function ControleOperacionalPage() {
  const { roles, stores, isAdmin, hasFullAccess, isLoading: loadingRoles } = useUserRoles();
  const { registry: freelancers, isLoaded: freelancersLoaded } = useFreelancerRegistry();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<string>("manager");
  // Removed WhatsApp state variables

  // Sessão do usuário logado
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setCurrentUserEmail(session?.user?.email ?? null);
    });
  }, []);

  // --- QUERIES GERAIS ---

  // 1. Localizações das lojas (para geofencing no painel do gerente)
  const { data: storeLocations = [] } = useQuery({
    queryKey: ["store_locations_all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("store_locations").select("*");
      if (error) throw error;
      return data;
    },
  });

  // 2. Check-ins ativos (Check-in Validado)
  const { data: checkIns = [], refetch: refetchCheckIns } = useQuery({
    queryKey: ["check_ins_all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("check_ins")
        .select(
          `
          *,
          freelancer_registry (
            nome,
            cpf,
            role,
            pix,
            email,
            telefone
          )
        `,
        )
        .order("checked_in_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  // 3. Lançamentos (tabela freelancers)
  const { data: shifts = [], refetch: refetchShifts } = useQuery({
    queryKey: ["shifts_all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("freelancers")
        .select("*")
        .order("entry_date", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  // 4. Contratos
  const { data: contracts = [] } = useQuery({
    queryKey: ["contracts_all_control"],
    queryFn: async () => {
      const { data, error } = await supabase.from("contracts").select("*");
      if (error) throw error;
      return data;
    },
  });

  // 5. Restrições de check-in (habilitar/desabilitar ferramenta)
  const { data: checkinRestrictions = [], refetch: refetchRestrictions } = useQuery({
    queryKey: ["checkin_restrictions_all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("checkin_restrictions")
        .select("*")
        .eq("is_disabled", true);
      if (error) throw error;
      return data as Array<{
        id: string;
        store_name: string;
        role: string;
        is_disabled: boolean;
        updated_at: string;
        updated_by: string | null;
      }>;
    },
  });

  // 6. Termos de Adesão Logs
  const { data: termos = [], refetch: refetchTermos } = useQuery({
    queryKey: ["termo_adesao_logs_all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("termo_adesao_logs")
        .select("*")
        .order("accepted_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: isAdmin || hasFullAccess,
  });

  // Estados do controle de restrições
  const [restrictionStore, setRestrictionStore] = useState<string>("TODAS");
  const [restrictionRole, setRestrictionRole] = useState<string>("TODOS");
  const [isRestrictionModalOpen, setIsRestrictionModalOpen] = useState(false);
  const [savingRestriction, setSavingRestriction] = useState(false);

  // Aplica (ou remove) um bloqueio para um par loja+cargo, sempre checando
  // o erro retornado pelo Supabase — uma falha de RLS não lança exceção,
  // então sem essa checagem o painel exibiria sucesso sem gravar nada.
  const applyRestriction = async (s: string, r: string, isDisableAction: boolean) => {
    if (isDisableAction) {
      const { error } = await supabase
        .from("checkin_restrictions")
        .upsert(
          { store_name: s, role: r, is_disabled: true, updated_by: currentUserEmail },
          { onConflict: "store_name,role" },
        );
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from("checkin_restrictions")
        .delete()
        .match({ store_name: s, role: r });
      if (error) throw error;
    }
  };

  const handleToggleRestriction = async (store: string, role: string, isDisableAction: boolean) => {
    if (!store || !role) {
      toast.error("Por favor, selecione a loja e o cargo.");
      return;
    }
    setSavingRestriction(true);
    try {
      if (store === "TODAS" && role === "TODOS") {
        const storesList = [
          "Jabaquara",
          "Spoleto",
          "Campo Belo",
          "V. Clementino",
          "V. GOPOUVA",
          "P. MANDAQUI",
          "Aclimação",
          "Pinheiros",
          "GRU",
          "J. Camburi",
          "P. Canto",
          "Serra",
          "Boali",
        ];
        const rolesList = ["Operador", "Entregador"];

        for (const s of storesList) {
          for (const r of rolesList) {
            await applyRestriction(s, r, isDisableAction);
          }
        }
      } else if (store === "TODAS") {
        const storesList = [
          "Jabaquara",
          "Spoleto",
          "Campo Belo",
          "V. Clementino",
          "V. GOPOUVA",
          "P. MANDAQUI",
          "Aclimação",
          "Pinheiros",
          "GRU",
          "J. Camburi",
          "P. Canto",
          "Serra",
          "Boali",
        ];
        for (const s of storesList) {
          await applyRestriction(s, role, isDisableAction);
        }
      } else if (role === "TODOS") {
        const rolesList = ["Operador", "Entregador"];
        for (const r of rolesList) {
          await applyRestriction(store, r, isDisableAction);
        }
      } else {
        await applyRestriction(store, role, isDisableAction);
      }

      toast.success(
        isDisableAction ? `Check-in desabilitado com sucesso!` : `Check-in habilitado com sucesso!`,
      );
      refetchRestrictions();
    } catch (err: any) {
      console.error(err);
      toast.error(`Erro ao atualizar status: ${err.message}`);
    } finally {
      setSavingRestriction(false);
    }
  };

  // 5. Recibos assinados
  const { data: receipts = [], refetch: refetchReceipts } = useQuery({
    queryKey: ["receipts_all_control"],
    queryFn: async () => {
      const { data, error } = await supabase.from("signed_receipts").select("*");
      if (error) throw error;
      return data;
    },
  });

  // --- ESTADOS PARA MODAIS E SELEÇÕES ---

  // Visualização de Foto
  const [zoomPhotoUrl, setZoomPhotoUrl] = useState<string | null>(null);

  // Aba 1: Validação do Gerente
  const [validatingCheckIn, setValidatingCheckIn] = useState<any | null>(null);
  const [selectedRole, setSelectedRole] = useState<string>("Operador");
  const [dailyRate, setDailyRate] = useState<number>(0);
  const [notes, setNotes] = useState<string>("");
  const [deliveries5, setDeliveries5] = useState<string>("0");
  const [deliveries6, setDeliveries6] = useState<string>("0");
  const [savingShift, setSavingShift] = useState(false);
  const [submittingBatch, setSubmittingBatch] = useState(false);

  // Aba 2: Aprovação do Diretor
  const [rejectingShift, setRejectingShift] = useState<any | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string>("");
  const [savingRejection, setSavingRejection] = useState(false);
  const [approvingBatch, setApprovingBatch] = useState(false);

  // Aba 3: Liberação Financeira
  const [payingShift, setPayingShift] = useState<any | null>(null); // individual (operador)
  const [payingGroup, setPayingGroup] = useState<any | null>(null); // consolidado (motoboys de uma loja)
  const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [paymentMethod, setPaymentMethod] = useState<string>("Pix");
  const [paymentVoucher, setPaymentVoucher] = useState<File | null>(null);
  const [uploadingVoucher, setUploadingVoucher] = useState(false);
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
  const [zapDocs, setZapDocs] = useState<any[]>([]);
  const [loadingZapDocs, setLoadingZapDocs] = useState(false);
  const [auditStoreFilter, setAuditStoreFilter] = useState<string>("all");

  useEffect(() => {
    if (isAuditModalOpen) {
      setLoadingZapDocs(true);
      listRecentZapSignDocs()
        .then((res) => {
          setZapDocs(res.docs || []);
        })
        .catch((err) => {
          console.error("Erro ao carregar documentos do ZapSign:", err);
          toast.error("Não foi possível carregar o status em tempo real da ZapSign.");
        })
        .finally(() => {
          setLoadingZapDocs(false);
        });
    }
  }, [isAuditModalOpen]);

  // --- DETERMINAÇÃO DE PERMISSÕES ---
  const isManager = roles.includes("gestor_loja") || isAdmin || hasFullAccess;
  const isDirector =
    roles.includes("admin") ||
    (roles as string[]).includes("diretor") ||
    (roles as string[]).includes("coordenador") ||
    hasFullAccess;
  const isFinance = roles.includes("financeiro") || isAdmin || hasFullAccess;

  // Definir tab padrão na carga
  useEffect(() => {
    if (!loadingRoles) {
      if (isManager) setActiveTab("manager");
      else if (isDirector) setActiveTab("director");
      else if (isFinance) setActiveTab("finance");
    }
  }, [loadingRoles, roles]);

  // --- FILTROS DE DADOS OPERACIONAIS ---

  // Check-ins pendentes de lançamento na freelancers
  const pendingCheckIns = checkIns.filter((c) => {
    // Apenas check-ins validados
    if (c.status !== "Check-in Validado") return false;
    // O gerente só vê as lojas associadas a ele (se houver restrição)
    if (!isAdmin && !hasFullAccess && stores.length > 0 && !stores.includes(c.unit)) return false;
    // Não pode estar já vinculado a um lançamento na freelancers
    const alreadyLaunched = shifts.some((s) => s.checkin_id === c.id);
    return !alreadyLaunched;
  });

  // Lançamentos validados pelo gerente mas não enviados (Status: pendente, approval_status: pendente)
  const validatedShifts = shifts.filter((s) => {
    if (s.validation_status !== "validado_gerente" || s.approval_status !== "pendente")
      return false;
    if (!isAdmin && !hasFullAccess && stores.length > 0 && !stores.includes(s.unit)) return false;
    return true;
  });

  // Lançamentos aguardando aprovação da diretoria
  const awaitingApprovalShifts = shifts.filter((s) => {
    return s.approval_status === "aguardando_aprovacao";
  });

  // Lançamentos aprovados aguardando pagamento
  const approvedShifts = shifts.filter((s) => {
    return s.approval_status === "aprovado" && s.payment_status === "pendente";
  });

  // --- FUNÇÕES E MUTATIONS ---

  // Abertura da modal de validação de check-in
  const openValidationDialog = (checkIn: any) => {
    setValidatingCheckIn(checkIn);
    const fl = checkIn.freelancer_registry;
    setSelectedRole(fl?.role || "Operador");
    setNotes("");
    setDeliveries5("0");
    setDeliveries6("0");

    // Tenta encontrar uma diária no cadastro de prestadores ou contrato correspondente
    const defaultFreelancer = freelancers.find((f) => f.id === checkIn.freelancer_id);
    // Busca taxa em contratos vigentes
    const contract = contracts.find(
      (c) =>
        c.freelancer_id === checkIn.freelancer_id &&
        c.status === "assinado" &&
        c.unit === checkIn.unit,
    );

    // Prefill valor da diária
    if (contract) {
      // Se tiver contrato, pode usar a taxa do contrato
      setDailyRate(Number(contract.daily_rate || 0));
    } else {
      setDailyRate(0); // Gestor preenche
    }
  };

  // Salvar a validação do gerente (inserir na tabela freelancers)
  const handleSaveShift = async () => {
    if (!validatingCheckIn) return;
    if (dailyRate <= 0 && selectedRole !== "Entregador") {
      toast.error("Informe o valor da diária.");
      return;
    }

    setSavingShift(true);
    try {
      const fl = validatingCheckIn.freelancer_registry;
      const checkInDate = validatingCheckIn.checked_in_at.slice(0, 10);

      // Bloqueio: não permitir que o usuário lance diária de um mesmo prestador com as duas funções no mesmo dia
      const norm = (s: string) => (s || "").trim().toLowerCase();
      const flNameNorm = norm(fl.nome);
      const alreadyHasShift = shifts.some(
        (s) => s.entry_date === checkInDate && norm(s.name) === flNameNorm
      );

      if (alreadyHasShift) {
        toast.error(`O prestador ${fl.nome} já possui um lançamento nesta data.`);
        setSavingShift(false);
        return;
      }

      const q5 = Number(deliveries5 || 0);
      const q6 = Number(deliveries6 || 0);
      const totalDeliveries = q5 * 5 + q6 * 6;

      const payload = {
        entry_date: checkInDate,
        unit: validatingCheckIn.unit,
        name: fl.nome,
        pix: fl.pix,
        role: selectedRole,
        daily_rate: dailyRate,
        deliveries_count: selectedRole === "Entregador" ? q5 + q6 : null,
        deliveries_total: selectedRole === "Entregador" ? totalDeliveries : null,
        checkin_id: validatingCheckIn.id,
        validation_status: "validado_gerente",
        validated_by: currentUserEmail || "Gerente",
        validated_at: new Date().toISOString(),
        approval_status: "pendente",
      };

      const { error } = await supabase.from("freelancers").insert(payload);
      if (error) throw error;

      // Log de Auditoria
      await (supabase as any).from("audit_logs").insert({
        user_id: null,
        user_email: currentUserEmail,
        user_profile: "Gerente",
        action: "Validar e Lançar Diária",
        freelancer_id: validatingCheckIn.freelancer_id,
        freelancer_name: fl.nome,
        unit: validatingCheckIn.unit,
        old_status: "Check-in Validado",
        new_status: "Lançamento Validado",
        device_info: navigator.userAgent,
      });

      toast.success(`Serviço de ${fl.nome} validado com sucesso!`);
      setValidatingCheckIn(null);
      refetchShifts();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Erro ao salvar lançamento.");
    } finally {
      setSavingShift(false);
    }
  };

  // Rejeitar check-in pelo gerente
  const handleRejectCheckin = async (checkIn: any) => {
    if (!confirm(`Deseja realmente rejeitar a presença de ${checkIn.freelancer_registry?.nome}?`))
      return;

    try {
      const { error } = await supabase
        .from("check_ins")
        .update({ status: "Check-in Rejeitado" })
        .eq("id", checkIn.id);

      if (error) throw error;

      // Log
      await (supabase as any).from("audit_logs").insert({
        user_id: null,
        user_email: currentUserEmail,
        user_profile: "Gerente",
        action: "Rejeitar Check-in",
        freelancer_id: checkIn.freelancer_id,
        freelancer_name: checkIn.freelancer_registry?.nome,
        unit: checkIn.unit,
        old_status: "Check-in Validado",
        new_status: "Check-in Rejeitado",
        device_info: navigator.userAgent,
      });

      toast.success("Presença rejeitada.");
      refetchCheckIns();
    } catch (err: any) {
      console.error(err);
      toast.error("Erro ao rejeitar check-in.");
    }
  };

  // Enviar os lançamentos validados da semana para aprovação
  const handleSendToApproval = async () => {
    if (validatedShifts.length === 0) {
      toast.info("Não há lançamentos validados para enviar.");
      return;
    }

    setSubmittingBatch(true);
    try {
      // Normaliza CPF (só dígitos) para casar contratos/recibos do mesmo jeito
      // que o check-in (validate_checkin_cpf usa CPF, não freelancer_id).
      const onlyDigits = (v: any) => String(v ?? "").replace(/\D/g, "");

      // Validar regras impeditivas para cada prestador no lote
      for (const shift of validatedShifts) {
        // Encontra cadastro do prestador
        const fl = freelancers.find(
          (f) => f.nome.trim().toLowerCase() === shift.name.trim().toLowerCase(),
        );

        if (!fl) {
          throw new Error(`Prestador ${shift.name} não localizado no cadastro.`);
        }

        // 1. Prestador ativo
        if (fl.active === false) {
          throw new Error(`Bloqueio: O prestador ${shift.name} está inativo no sistema.`);
        }

        // Validações de contrato e recibo atrasado foram removidas conforme solicitado
      }

      // Se passou em todas as validações, atualiza o status de aprovação
      const shiftIds = validatedShifts.map((s) => s.id);

      const { error } = await supabase
        .from("freelancers")
        .update({ approval_status: "aguardando_aprovacao" })
        .in("id", shiftIds);

      if (error) throw error;

      // Log
      for (const s of validatedShifts) {
        await (supabase as any).from("audit_logs").insert({
          user_id: null,
          user_email: currentUserEmail,
          user_profile: "Gerente",
          action: "Enviar para Aprovação",
          freelancer_name: s.name,
          unit: s.unit,
          old_status: "Lançamento Validado",
          new_status: "Aguardando Aprovação",
          device_info: navigator.userAgent,
        });
      }

      toast.success("Lote enviado para aprovação da diretoria!");
      refetchShifts();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Erro ao enviar lote.");
    } finally {
      setSubmittingBatch(false);
    }
  };

  // --- ABA 2: APROVAÇÃO DO DIRETOR ---

  // Aprovar lote ou lançamento individual e gerar recibo ZapSign
  const handleApproveShifts = async (shiftsToApprove: any[]) => {
    if (shiftsToApprove.length === 0) return;

    setApprovingBatch(true);
    toast.info("Aprovando lançamentos e gerando recibos...");

    try {
      // Rule 3: Parameterized emission days validation
      const { data: settingsData } = await (supabase as any)
        .from("vagas_receipt_settings")
        .select("*")
        .limit(1)
        .maybeSingle();

      const freelancerDay = (settingsData as any)?.freelancer_day ?? 0; // Default: Sunday (0)
      const motoboyDay = (settingsData as any)?.motoboy_day ?? 3;       // Default: Wednesday (3)
      const today = new Date().getDay();

      const hasFreelancer = shiftsToApprove.some((s) => s.role !== "Entregador");
      const hasMotoboy = shiftsToApprove.some((s) => s.role === "Entregador");

      if ((hasFreelancer && today !== freelancerDay) || (hasMotoboy && today !== motoboyDay)) {
        toast.error("Hoje não é o dia programado para emissão de recibos.");
        setApprovingBatch(false);
        return;
      }

      // 1. Atualizar status de aprovação na tabela freelancers
      const ids = shiftsToApprove.map((s) => s.id);
      const { error: updateError } = await supabase
        .from("freelancers")
        .update({
          approval_status: "aprovado",
          approved_by: currentUserEmail || "Diretor",
          approved_at: new Date().toISOString(),
        })
        .in("id", ids);

      if (updateError) throw updateError;

      // 2. Agrupar lançamentos aprovados por (CPF do prestador, Unit) para consolidar recibos semanais
      // Filtramos apenas os aprovados que não têm recibo gerado
      const groups: Record<string, { cpf: string; name: string; unit: string; rows: any[] }> = {};

      for (const s of shiftsToApprove) {
        const fl = freelancers.find(
          (f: any) => f.nome.trim().toLowerCase() === s.name.trim().toLowerCase()
        );

        if (!fl) {
          console.warn(`Prestador ${s.name} não encontrado no registro para emissão de recibo.`);
          continue;
        }

        const cleanCpf = fl.cpf.replace(/\D/g, "");
        const key = `${cleanCpf}|${s.unit}`;
        if (!groups[key]) {
          groups[key] = { cpf: fl.cpf, name: fl.nome, unit: s.unit, rows: [] };
        }
        groups[key].rows.push(s);
      }

      // 3. Gerar recibo para cada grupo
      for (const key of Object.keys(groups)) {
        const { cpf, name, unit, rows: groupRows } = groups[key];
        const fl = freelancers.find(
          (f: any) => f.cpf.replace(/\D/g, "") === cpf.replace(/\D/g, "")
        );

        if (!fl) continue;

        // Rule 2: Check for existing active receipt covering any of the dates
        const activeReceipt = receipts.find((r: any) => {
          const isActive = r.status !== "Cancelado" && r.status !== "Desconsiderado" && r.status !== "Substituído" && r.status !== "cancelado";
          if (!isActive) return false;

          const isSameCpf = r.freelancer_cpf && r.freelancer_cpf.replace(/\D/g, "") === cpf.replace(/\D/g, "");
          if (!isSameCpf) return false;

          // Check if worked_dates overlaps with groupRows entry_dates
          return groupRows.some((row) => r.worked_dates && r.worked_dates.includes(row.entry_date));
        });

        if (activeReceipt) {
          toast.error(`Já existe um recibo para esta prestação de serviço que ainda não foi assinado. Utilize a opção de reenviar o recibo para assinatura.`);
          
          // Log de Auditoria do Bloqueio
          await (supabase as any).from("audit_logs").insert({
            user_email: currentUserEmail,
            action: "bloqueio por recibo pendente",
            freelancer_name: fl.nome,
            freelancer_cpf: fl.cpf,
            reason: "Tentativa de emitir recibo duplicado para data de serviço já coberta por recibo ativo",
            device_info: navigator.userAgent,
          });

          continue;
        }

        // Achar período (datas min e max)
        const dates = groupRows.map((r) => parseISO(r.entry_date));
        const startDate = new Date(Math.min(...dates.map((d) => d.getTime())));
        const endDate = new Date(Math.max(...dates.map((d) => d.getTime())));

        try {
          // Gerar PDF do Recibo
          const { blob, filename, amount, referencePeriod, workedDates } = generateReceiptPdf({
            freelancer: {
              nome: fl.nome,
              cpf: fl.cpf,
              rg: fl.rg,
              role: fl.role,
            },
            unit,
            periodRows: groupRows.map((r) => ({
              name: r.name,
              pix: r.pix,
              unit: r.unit,
              entry_date: r.entry_date,
              daily_rate: r.daily_rate,
              deliveries_total: r.deliveries_total,
            })),
            startDate,
            endDate,
          });

          // Se tiver e-mail cadastrado, envia para o ZapSign
          if (fl.email && fl.email.includes("@")) {
            toast.info(
              `Enviando recibo de ${fl.nome} (${formatBRLCurrency(amount)}) para ZapSign...`,
            );

            const res = await sendToZapSign(
              ZAPSIGN_TOKEN,
              blob,
              filename,
              fl.email,
              fl.nome
            );

            // Gravar em signed_receipts
            const receiptPayload = {
              zapsign_token: res.token,
              freelancer_name: fl.nome,
              freelancer_cpf: fl.cpf,
              freelancer_email: fl.email,
              role: fl.role || null,
              unit,
              amount,
              reference_period: referencePeriod,
              worked_dates: workedDates,
              signed_file_url: res.signed_file || null,
              status: "pending",
              created_at: new Date().toISOString(),
            };

            await supabase
              .from("signed_receipts")
              .upsert(receiptPayload as any, { onConflict: "zapsign_token" });

            // Vincular token do recibo nos lançamentos aprovados
            const rowIds = groupRows.map((r) => r.id);
            await supabase
              .from("freelancers")
              .update({ receipt_token: res.token })
              .in("id", rowIds);

            // Log de Auditoria de Emissão de Recibo
            await (supabase as any).from("audit_logs").insert({
              user_email: currentUserEmail,
              action: "emissão de recibos",
              freelancer_name: fl.nome,
              freelancer_cpf: fl.cpf,
              old_status: null,
              new_status: "pending",
              reason: `Recibo semanal consolidado emitido para o período ${referencePeriod}`,
              device_info: navigator.userAgent,
            });

            toast.success(`Recibo de ${fl.nome} enviado para assinatura!`);
          } else {
            toast.warning(
              `Prestador ${fl.nome} não possui e-mail válido. O recibo foi aprovado, mas não enviado ao ZapSign.`,
            );
          }
        } catch (pdfErr: any) {
          console.error(`Erro ao gerar recibo para ${name}:`, pdfErr);
          toast.error(`Falha ao emitir recibo para ${name}: ${pdfErr.message}`);
        }
      }

      // Log geral
      for (const s of shiftsToApprove) {
        await (supabase as any).from("audit_logs").insert({
          user_id: null,
          user_email: currentUserEmail,
          user_profile: "Diretor",
          action: "Aprovar Serviço",
          freelancer_name: s.name,
          unit: s.unit,
          old_status: "Aguardando Aprovação",
          new_status: "Aprovado",
          device_info: navigator.userAgent,
        });
      }

      toast.success("Lançamentos aprovados e recibos emitidos!");
      refetchShifts();
      refetchReceipts();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Erro ao aprovar lançamentos.");
    } finally {
      setApprovingBatch(false);
    }
  };

  // Rejeitar lançamento com motivo
  const handleRejectShift = async () => {
    if (!rejectingShift || !rejectionReason.trim()) {
      toast.error("Informe o motivo da rejeição.");
      return;
    }

    setSavingRejection(true);
    try {
      const { error } = await supabase
        .from("freelancers")
        .update({
          approval_status: "rejeitado_diretor",
          rejection_reason: rejectionReason,
          validation_status: "pendente", // Retorna ao gerente
        })
        .eq("id", rejectingShift.id);

      if (error) throw error;

      // Log
      await (supabase as any).from("audit_logs").insert({
        user_id: null,
        user_email: currentUserEmail,
        user_profile: "Diretor",
        action: "Rejeitar Lançamento",
        freelancer_name: rejectingShift.name,
        unit: rejectingShift.unit,
        old_status: "Aguardando Aprovação",
        new_status: "Rejeitado (Diretor)",
        device_info: navigator.userAgent,
      });

      toast.success("Lançamento rejeitado e devolvido ao gerente.");
      setRejectingShift(null);
      setRejectionReason("");
      refetchShifts();
    } catch (err: any) {
      console.error(err);
      toast.error("Erro ao rejeitar lançamento.");
    } finally {
      setSavingRejection(false);
    }
  };

  // --- ABA 3: LIBERAÇÃO FINANCEIRA ---

  // Upload do comprovante de pagamento
  const handleUploadVoucher = async (file: File): Promise<string | null> => {
    setUploadingVoucher(true);
    try {
      const fileName = `voucher_${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, "")}`;
      const filePath = `vouchers/${paymentDate}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("payment-vouchers")
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from("payment-vouchers").getPublicUrl(filePath);
      return data.publicUrl;
    } catch (err: any) {
      console.error(err);
      toast.error("Erro ao enviar comprovante de pagamento.");
      return null;
    } finally {
      setUploadingVoucher(false);
    }
  };

  // Registrar pagamento de operador individual
  const handlePayShift = async () => {
    if (!payingShift) return;

    try {
      let voucherUrl = null;
      if (paymentVoucher) {
        voucherUrl = await handleUploadVoucher(paymentVoucher);
        if (!voucherUrl) return; // Erro no upload
      }

      // Suporta pagamento agregado: o prestador pode ter vários lançamentos
      // (dias) somados num único pagamento.
      const ids: string[] = payingShift.ids ?? [payingShift.id];
      const totalValue = Number(
        payingShift.amount ??
          Number(payingShift.daily_rate || 0) + Number(payingShift.deliveries_total || 0),
      );

      const { error } = await supabase
        .from("freelancers")
        .update({
          payment_status: "pago",
          payment_date: paymentDate,
          payment_method: paymentMethod,
          payment_amount_paid: totalValue,
          payment_voucher_url: voucherUrl,
        })
        .in("id", ids);

      if (error) throw error;

      // Log
      await (supabase as any).from("audit_logs").insert({
        user_id: null,
        user_email: currentUserEmail,
        user_profile: "Financeiro",
        action: "Registrar Pagamento Operador",
        freelancer_name: payingShift.name,
        unit: payingShift.unit,
        old_status: "Aprovado",
        new_status: "Pago",
        device_info: navigator.userAgent,
      });

      toast.success(`Pagamento de ${payingShift.name} registrado com sucesso!`);
      setPayingShift(null);
      setPaymentVoucher(null);
      refetchShifts();
    } catch (err: any) {
      console.error(err);
      toast.error("Erro ao registrar pagamento.");
    }
  };

  // Registrar pagamento consolidado de motoboys
  const handlePayGroup = async () => {
    if (!payingGroup) return;

    try {
      let voucherUrl = null;
      if (paymentVoucher) {
        voucherUrl = await handleUploadVoucher(paymentVoucher);
        if (!voucherUrl) return;
      }

      const ids = payingGroup.shifts.map((s: any) => s.id);

      const { error } = await supabase
        .from("freelancers")
        .update({
          payment_status: "pago",
          payment_date: paymentDate,
          payment_method: paymentMethod,
          payment_amount_paid: payingGroup.amount, // Valor cheio consolidado
          payment_voucher_url: voucherUrl,
        })
        .in("id", ids);

      if (error) throw error;

      // Logs
      for (const s of payingGroup.shifts) {
        await (supabase as any).from("audit_logs").insert({
          user_id: null,
          user_email: currentUserEmail,
          user_profile: "Financeiro",
          action: "Registrar Pagamento Consolidado Motoboy",
          freelancer_name: s.name,
          unit: s.unit,
          old_status: "Aprovado",
          new_status: "Pago",
          device_info: navigator.userAgent,
        });
      }

      toast.success(
        `Pagamento de ${payingGroup.amountFormatted} para a ${payingGroup.company} registrado!`,
      );
      setPayingGroup(null);
      setPaymentVoucher(null);
      refetchShifts();
    } catch (err: any) {
      console.error(err);
      toast.error("Erro ao registrar pagamento do lote.");
    }
  };

  // Consolidar Motoboys por Loja para o Financeiro
  const consolidatedMotoboys = approvedShifts
    .filter((s) => s.role === "Entregador")
    .reduce((acc: any[], shift) => {
      const existing = acc.find((item) => item.unit === shift.unit);
      const shiftVal = Number(shift.daily_rate || 0) + Number(shift.deliveries_total || 0);

      if (existing) {
        existing.amount += shiftVal;
        existing.shifts.push(shift);
      } else {
        acc.push({
          unit: shift.unit,
          company: "Star Gold Delivery Ltda.",
          cnpj: "61.011.091/0001-55",
          pix: "financeiro@stargold.com",
          amount: shiftVal,
          shifts: [shift],
        });
      }
      return acc;
    }, []);

  // Operadores/auxiliares aprovados agregados por (loja, prestador): soma os
  // lançamentos (dias) de cada prestador num único valor para pagamento.
  const consolidatedOperators = approvedShifts
    .filter((s) => s.role !== "Entregador")
    .reduce((acc: any[], shift) => {
      const key = `${shift.unit}||${shift.name.trim().toLowerCase()}`;
      const val = Number(shift.daily_rate || 0) + Number(shift.deliveries_total || 0);
      const existing = acc.find((i) => i.key === key);
      if (existing) {
        existing.amount += val;
        existing.lancamentos += 1;
        existing.ids.push(shift.id);
      } else {
        const fl = freelancers.find(
          (f) => f.nome.trim().toLowerCase() === shift.name.trim().toLowerCase(),
        );
        acc.push({
          key,
          unit: shift.unit,
          name: shift.name,
          cpf: shift.cpf || fl?.cpf || "",
          pix: shift.pix || fl?.pix || "",
          role: shift.role,
          amount: val,
          lancamentos: 1,
          ids: [shift.id],
        });
      }
      return acc;
    }, []);

  // Exporta o relatório para o Financeiro: aprovados e ainda pendentes de
  // pagamento, agrupados por loja + prestador (valor total), em Excel.
  // Ao final, oferece marcar os lançamentos como pagos.
  const exportFinanceiro = async () => {
    if (approvedShifts.length === 0) {
      toast.info("Não há lançamentos aprovados pendentes de pagamento para exportar.");
      return;
    }

    // Aba 1: um registro por (loja, prestador), somando os lançamentos.
    const porPrestadorMap = new Map<string, any>();
    for (const s of approvedShifts) {
      const valor = Number(s.daily_rate || 0) + Number(s.deliveries_total || 0);
      const fl = freelancers.find(
        (f) => f.nome.trim().toLowerCase() === s.name.trim().toLowerCase(),
      );
      const key = `${s.unit}||${s.name.trim().toLowerCase()}`;
      const cur = porPrestadorMap.get(key) || {
        loja: getUnitDisplayName(s.unit),
        prestador: s.name,
        cpf: s.cpf || fl?.cpf || "",
        pix: s.pix || fl?.pix || "",
        funcao: s.role,
        lancamentos: 0,
        valor_total: 0,
      };
      cur.lancamentos += 1;
      cur.valor_total += valor;
      porPrestadorMap.set(key, cur);
    }
    const porPrestador = Array.from(porPrestadorMap.values()).sort(
      (a, b) => a.loja.localeCompare(b.loja) || a.prestador.localeCompare(b.prestador),
    );

    // Aba 2: resumo por loja (operadores x motoboys x total) + total geral.
    const porLojaMap = new Map<string, any>();
    for (const s of approvedShifts) {
      const valor = Number(s.daily_rate || 0) + Number(s.deliveries_total || 0);
      const loja = getUnitDisplayName(s.unit);
      const cur = porLojaMap.get(loja) || { loja, operadores: 0, motoboys: 0, total: 0 };
      if (s.role === "Entregador") cur.motoboys += valor;
      else cur.operadores += valor;
      cur.total += valor;
      porLojaMap.set(loja, cur);
    }
    const porLoja = Array.from(porLojaMap.values()).sort((a, b) => a.loja.localeCompare(b.loja));
    const totalGeral = porLoja.reduce(
      (acc, r) => ({
        operadores: acc.operadores + r.operadores,
        motoboys: acc.motoboys + r.motoboys,
        total: acc.total + r.total,
      }),
      { operadores: 0, motoboys: 0, total: 0 },
    );
    porLoja.push({ loja: "TOTAL GERAL", ...totalGeral });

    const hoje = new Date().toISOString().slice(0, 10);
    exportWorkbook(`financeiro-a-pagar-${hoje}.xlsx`, [
      {
        name: "Por Prestador",
        rows: porPrestador,
        cols: [
          { header: "Loja", key: "loja" },
          { header: "Prestador", key: "prestador" },
          { header: "CPF", key: "cpf" },
          { header: "Chave PIX", key: "pix" },
          { header: "Função", key: "funcao" },
          { header: "Lançamentos", key: "lancamentos", type: "number" },
          { header: "Valor Total", key: "valor_total", type: "currency" },
        ],
      },
      {
        name: "Resumo por Loja",
        rows: porLoja,
        cols: [
          { header: "Loja", key: "loja" },
          { header: "Operadores (R$)", key: "operadores", type: "currency" },
          { header: "Motoboys (R$)", key: "motoboys", type: "currency" },
          { header: "Total (R$)", key: "total", type: "currency" },
        ],
      },
    ]);
    toast.success("Relatório financeiro exportado.");

    // Oferece dar baixa: marcar os lançamentos exportados como pagos.
    const ids = approvedShifts.map((s) => s.id);
    const confirmar = window.confirm(
      `Relatório exportado com ${ids.length} lançamento(s).\n\n` +
        `Deseja marcar TODOS como PAGOS agora? Eles sairão da lista de pendentes. ` +
        `Esta ação não anexa comprovante e é difícil de desfazer.`,
    );
    if (!confirmar) return;

    try {
      const hojeData = new Date().toISOString().slice(0, 10);
      const results = await Promise.all(
        approvedShifts.map((s) =>
          supabase
            .from("freelancers")
            .update({
              payment_status: "pago",
              payment_date: hojeData,
              payment_method: "Exportação Financeiro",
              payment_amount_paid: Number(s.daily_rate || 0) + Number(s.deliveries_total || 0),
            })
            .eq("id", s.id),
        ),
      );
      const falhas = results.filter((r) => r.error).length;
      if (falhas > 0) {
        toast.warning(`${ids.length - falhas} marcados como pagos; ${falhas} falharam.`);
      } else {
        toast.success(`${ids.length} lançamento(s) marcados como pagos.`);
      }
      refetchShifts();
    } catch (err: any) {
      console.error(err);
      toast.error("Erro ao marcar lançamentos como pagos.");
    }
  };

  const compileAuditReport = (mode: "operator" | "entregador") => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    
    let startDate: Date;
    let endDate: Date;
    
    if (mode === "operator") {
      const daysToCurrentMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      const currentMonday = new Date(today);
      currentMonday.setDate(today.getDate() - daysToCurrentMonday);
      
      startDate = new Date(currentMonday);
      startDate.setDate(currentMonday.getDate() - 7);
      
      endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + 6);
    } else {
      const daysToLastWednesday = (dayOfWeek + 7 - 3) % 7;
      endDate = new Date(today);
      endDate.setDate(today.getDate() - daysToLastWednesday);
      
      startDate = new Date(endDate);
      startDate.setDate(endDate.getDate() - 6);
    }
    
    const formatDate = (d: Date) => {
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      return `${yyyy}-${mm}-${dd}`;
    };
    
    const startStr = formatDate(startDate);
    const endStr = formatDate(endDate);
    
    const filteredShifts = shifts.filter((s) => {
      const dateOk = s.entry_date >= startStr && s.entry_date <= endStr;
      if (!dateOk) return false;
      
      const isEntregador = s.role === "Entregador";
      return mode === "entregador" ? isEntregador : !isEntregador;
    });
    
    const map = new Map<string, any>();
    
    for (const s of filteredShifts) {
      const shiftName = s.name || "";
      const key = `${s.unit || "N/A"}||${shiftName.trim().toLowerCase()}`;
      const fl = freelancers.find(
        (f) => (f.nome || "").trim().toLowerCase() === shiftName.trim().toLowerCase()
      );
      
      const valor = Number(s.daily_rate || 0) + Number(s.deliveries_total || 0);
      
      if (map.has(key)) {
        const existing = map.get(key);
        existing.valor_total += valor;
        if (!existing.worked_dates.includes(s.entry_date)) {
          existing.worked_dates.push(s.entry_date);
        }
      } else {
        map.set(key, {
          name: shiftName,
          unit: s.unit || "",
          pix: s.pix || fl?.pix || "—",
          cpf: fl?.cpf || "—",
          valor_total: valor,
          worked_dates: [s.entry_date],
        });
      }
    }
    
    const reportData = Array.from(map.values()).map((item) => {
      // 1. Verificar nos documentos da ZapSign em tempo real
      const runtimeDoc = zapDocs.find((zd) => {
        const docNameLower = (zd.name || "").toLowerCase();
        const freelancerNameLower = item.name.toLowerCase();
        
        // Limpeza básica dos nomes para comparação segura
        const cleanFreelancerName = freelancerNameLower.replace(/\s+/g, "");
        const cleanDocName = docNameLower.replace(/[^a-z0-9]/g, "");
        
        // 1. Verificação exata por nome completo ou palavras
        let nameMatches = cleanDocName.includes(cleanFreelancerName) ||
          freelancerNameLower.split(" ").every(word => word.length > 2 && docNameLower.includes(word));
          
        // 2. Tolerância a pequenos erros de grafia: primeiro nome + loja (ex: leonardo + J_Camburi)
        const firstName = freelancerNameLower.split(" ")[0];
        if (!nameMatches && firstName.length >= 3) {
          const cleanUnit = (item.unit || "").toLowerCase().replace(/[^a-z0-9]/g, "");
          const docCleaned = docNameLower.replace(/[^a-z0-9]/g, "");
          const unitMatches = docNameLower.includes(cleanUnit) || docCleaned.includes(cleanUnit);
          const firstNameMatches = docNameLower.includes(firstName);
          if (firstNameMatches && unitMatches) {
            nameMatches = true;
          }
        }

        if (!nameMatches) return false;
        if (!docNameLower.includes("recibo")) return false;
        
        // Verifica se no nome do documento tem a data inicial ou final do período
        return docNameLower.includes(startStr) || docNameLower.includes(endStr);
      });

      let isGenerated = false;
      let isSigned = false;
      let receiptStatus = null;
      let receiptToken = null;

      if (runtimeDoc) {
        isGenerated = true;
        isSigned = runtimeDoc.status === "signed" || runtimeDoc.status === "assinado";
        receiptStatus = runtimeDoc.status;
        receiptToken = runtimeDoc.token;
      } else {
        // 2. Fallback para os recibos locais no banco de dados do Supabase
        const receipt = receipts.find((r: any) => {
          const isSameCpf = r.freelancer_cpf && item.cpf !== "—" &&
            r.freelancer_cpf.replace(/\D/g, "") === item.cpf.replace(/\D/g, "");
          const isSameName = r.freelancer_name && 
            (r.freelancer_name || "").trim().toLowerCase() === (item.name || "").trim().toLowerCase();
            
          if (!isSameCpf && !isSameName) return false;
          
          const isActive = r.status !== "Cancelado" && r.status !== "Desconsiderado" && r.status !== "Substituído" && r.status !== "cancelado";
          if (!isActive) return false;
          
          return item.worked_dates.some((date: string) => r.worked_dates && r.worked_dates.includes(date));
        });

        if (receipt) {
          isGenerated = true;
          isSigned = receipt.status === "signed" || receipt.status === "assinado" || receipt.status === "signed_receipt";
          receiptStatus = receipt.status;
          receiptToken = receipt.zapsign_token;
        }
      }
      
      return {
        ...item,
        isGenerated,
        isSigned,
        receiptStatus,
        receiptToken,
      };
    });
    
    const filteredReportData = auditStoreFilter === "all"
      ? reportData
      : reportData.filter((item) => item.unit === auditStoreFilter);
      
    return {
      startDateFormatted: startDate.toLocaleDateString("pt-BR"),
      endDateFormatted: endDate.toLocaleDateString("pt-BR"),
      reportData: filteredReportData.sort((a, b) => 
        (a.unit || "").localeCompare(b.unit || "") || 
        (a.name || "").localeCompare(b.name || "")
      ),
    };
  };

  const exportAuditReport = (reportData: any[], startFmt: string, endFmt: string, title: string) => {
    const rows = reportData.map((item) => ({
      loja: getUnitDisplayName(item.unit),
      prestador: item.name,
      cpf: item.cpf,
      pix: item.pix,
      valor_total: item.valor_total,
      gerado: item.isGenerated ? "Sim" : "Não",
      assinado: item.isSigned ? "Sim" : "Não",
      status_recibo: item.receiptStatus || "Não Gerado",
    }));

    exportWorkbook(`conferencia-recibos-${title.toLowerCase().replace(/\s+/g, "-")}-${startFmt.replace(/\//g, "-")}-a-${endFmt.replace(/\//g, "-")}.xlsx`, [
      {
        name: "Conferência Recibos",
        rows,
        cols: [
          { header: "Loja", key: "loja" },
          { header: "Prestador", key: "prestador" },
          { header: "CPF", key: "cpf" },
          { header: "Chave PIX", key: "pix" },
          { header: "Valor a Receber", key: "valor_total", type: "currency" },
          { header: "Recibo Gerado?", key: "gerado" },
          { header: "Recibo Assinado?", key: "assinado" },
          { header: "Status Recibo", key: "status_recibo" },
        ],
      },
    ]);
    toast.success("Relatório de conferência exportado com sucesso!");
  };
  return (
    <div className="min-h-screen bg-muted/30 p-4 md:p-6 pb-24 font-sans">
      <div className="mx-auto max-w-7xl space-y-6">
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
                Controle Operacional
              </h1>
              <p className="text-sm text-muted-foreground">
                Gestão integrada de validação de GPS, aprovação de serviços e liberação financeira.
              </p>
            </div>
          </div>
          {(isAdmin || hasFullAccess) && (
            <Button
              onClick={() => setIsRestrictionModalOpen(true)}
              variant="outline"
              className="gap-2 self-start sm:self-center border-amber-500/30 text-amber-600 hover:text-amber-500 hover:bg-amber-500/10"
            >
              <Settings className="h-4 w-4" /> Status do Check-in
            </Button>
          )}
        </header>

        {/* Tab Selection */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 max-w-3xl bg-card border border-border/60">
            <TabsTrigger value="manager" disabled={!isManager} className="gap-2">
              <ClipboardCheck className="h-4 w-4" /> 1. Validação
            </TabsTrigger>
            <TabsTrigger value="director" disabled={!isDirector} className="gap-2">
              <ShieldCheck className="h-4 w-4" /> 2. Aprovação
            </TabsTrigger>
            <TabsTrigger value="finance" disabled={!isFinance} className="gap-2">
              <DollarSign className="h-4 w-4" /> 3. Financeiro
            </TabsTrigger>
            <TabsTrigger value="termos" disabled={!isAdmin && !hasFullAccess} className="gap-2">
              <FileText className="h-4 w-4" /> 4. Termos
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: VALIDAÇÃO DO GERENTE */}
          <TabsContent value="manager" className="space-y-6">
            <div className="grid gap-6 md:grid-cols-3">
              {/* Check-ins ativos na semana */}
              <Card className="md:col-span-2 border border-border/60 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    Check-ins Realizados (Celular)
                  </CardTitle>
                  <CardDescription>
                    Lista de prestadores que realizaram check-in nas unidades e aguardam lançamento
                    operacional.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0 overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Prestador</TableHead>
                        <TableHead>Loja</TableHead>
                        <TableHead>Data/Hora</TableHead>
                        <TableHead>GPS/Distância</TableHead>
                        <TableHead>Foto</TableHead>
                        <TableHead className="w-32 text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pendingCheckIns.map((check) => {
                        const fl = check.freelancer_registry;
                        const store = storeLocations.find((s) => s.name === check.unit);
                        let distanceStr = "Buscando...";
                        if (store) {
                          const distance = calculateDistance(
                            check.latitude,
                            check.longitude,
                            store.latitude,
                            store.longitude,
                          );
                          distanceStr = `${Math.round(distance)}m`;
                        }

                        return (
                          <TableRow key={check.id} className="hover:bg-muted/30">
                            <TableCell>
                              <div>
                                <p className="font-semibold text-foreground">
                                  {fl?.nome || "Não identificado"}
                                </p>
                                <p className="text-[10px] text-muted-foreground uppercase">
                                  {fl?.role || "Operador"}
                                </p>
                              </div>
                            </TableCell>
                            <TableCell className="font-medium">
                              {getUnitDisplayName(check.unit)}
                            </TableCell>
                            <TableCell>
                              {format(parseISO(check.checked_in_at), "dd/MM/yyyy HH:mm")}
                            </TableCell>
                            <TableCell>
                              <span className="flex items-center gap-1 text-xs">
                                <MapPin className="h-3 w-3 text-emerald-500" />
                                {distanceStr}
                              </span>
                            </TableCell>
                            <TableCell>
                              {check.image_url ? (
                                <button
                                  onClick={() => setZoomPhotoUrl(check.image_url)}
                                  className="h-10 w-10 rounded-lg overflow-hidden border border-border hover:opacity-85 transition-opacity"
                                >
                                  <img
                                    src={check.image_url}
                                    alt="Check-in Photo"
                                    className="h-full w-full object-cover"
                                  />
                                </button>
                              ) : (
                                <span className="text-xs text-muted-foreground">Sem foto</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  title="Rejeitar presença"
                                  onClick={() => handleRejectCheckin(check)}
                                  className="h-8 w-8 text-destructive hover:bg-destructive/10"
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => openValidationDialog(check)}
                                  className="h-8 gap-1.5 text-xs text-primary border-primary/20 hover:bg-primary/5"
                                >
                                  <Check className="h-3.5 w-3.5" /> Validar
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      {pendingCheckIns.length === 0 && (
                        <TableRow>
                          <TableCell
                            colSpan={6}
                            className="text-center py-8 text-muted-foreground text-sm"
                          >
                            Nenhum check-in pendente de validação.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {/* Fechamento Semanal (Enviar para aprovação) */}
              <Card className="border border-border/60 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base">Fechamento Semanal</CardTitle>
                  <CardDescription>
                    Envie os lançamentos validados da loja para aprovação final da diretoria.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-xl bg-card border border-border/60 p-4 space-y-3">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Lançamentos validados:</span>
                      <span className="font-bold">{validatedShifts.length}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Valor consolidado:</span>
                      <span className="font-bold text-emerald-600">
                        {formatBRLCurrency(
                          validatedShifts.reduce(
                            (acc, r) =>
                              acc + Number(r.daily_rate || 0) + Number(r.deliveries_total || 0),
                            0,
                          ),
                        )}
                      </span>
                    </div>
                  </div>

                  <Button
                    onClick={handleSendToApproval}
                    className="w-full bg-emerald-600 hover:bg-emerald-500 font-bold h-11"
                    disabled={validatedShifts.length === 0 || submittingBatch}
                  >
                    {submittingBatch ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Verificando e Enviando...
                      </>
                    ) : (
                      <>
                        <Send className="mr-2 h-4 w-4" />
                        Enviar para Aprovação
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Modal de Lançamento e Validação de Check-in */}
            <Dialog
              open={!!validatingCheckIn}
              onOpenChange={(open) => !open && setValidatingCheckIn(null)}
            >
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Validar Serviço e Lançar Diária</DialogTitle>
                  <DialogDescription>
                    Confirme os dados da presença e preencha as informações operacionais.
                  </DialogDescription>
                </DialogHeader>
                {validatingCheckIn && (
                  <div className="space-y-4 py-2">
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="bg-muted p-2 rounded-lg">
                        <span className="text-muted-foreground block">Prestador:</span>
                        <span className="font-bold">
                          {validatingCheckIn.freelancer_registry?.nome}
                        </span>
                      </div>
                      <div className="bg-muted p-2 rounded-lg">
                        <span className="text-muted-foreground block">Loja:</span>
                        <span className="font-bold">
                          {getUnitDisplayName(validatingCheckIn.unit)}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Função Exercida</Label>
                      <Select value={selectedRole} onValueChange={setSelectedRole}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Operador">Operador de Loja</SelectItem>
                          <SelectItem value="Entregador">Motoboy (Entregador)</SelectItem>
                          <SelectItem value="Auxiliar Geral">Auxiliar Geral</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {selectedRole === "Entregador" ? (
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label>Entregas de R$ 5,00</Label>
                          <Input
                            type="number"
                            min="0"
                            value={deliveries5}
                            onChange={(e) => setDeliveries5(e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Entregas de R$ 6,00</Label>
                          <Input
                            type="number"
                            min="0"
                            value={deliveries6}
                            onChange={(e) => setDeliveries6(e.target.value)}
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <Label>Valor da Diária (R$)</Label>
                        <CurrencyInput value={dailyRate} onValueChange={setDailyRate} />
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label>Observações / Nota Operacional</Label>
                      <Textarea
                        placeholder="Ex: trabalhou turno duplo, atraso de 15m compensado..."
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        rows={2}
                      />
                    </div>
                  </div>
                )}
                <DialogFooter>
                  <Button variant="ghost" onClick={() => setValidatingCheckIn(null)}>
                    Cancelar
                  </Button>
                  <Button onClick={handleSaveShift} disabled={savingShift}>
                    {savingShift ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      "Confirmar Lançamento"
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </TabsContent>

          {/* TAB 2: APROVAÇÃO DA DIRETORIA */}
          <TabsContent value="director" className="space-y-6">
            <Card className="border border-border/60 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base">Lançamentos Aguardando Aprovação</CardTitle>
                  <CardDescription>
                    Exibição de dossiês com fotos, coordenadas de GPS e históricos para liberação de
                    assinaturas.
                  </CardDescription>
                </div>
                {awaitingApprovalShifts.length > 0 && (
                  <div className="flex flex-col items-end gap-2 md:flex-row md:items-center">
                    <div className="flex items-center gap-4 mr-4 mb-2 md:mb-0">
                      {/* WhatsApp options removed */}
                    </div>
                    <Button
                      onClick={() => handleApproveShifts(awaitingApprovalShifts)}
                      className="bg-emerald-600 hover:bg-emerald-500 font-bold"
                      disabled={approvingBatch}
                    >
                      {approvingBatch ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Aprovando Lote...
                        </>
                      ) : (
                        "Aprovar Todos em Lote"
                      )}
                    </Button>
                  </div>
                )}
              </CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Prestador</TableHead>
                      <TableHead>Loja</TableHead>
                      <TableHead>Diária / Serviços</TableHead>
                      <TableHead>Foto Check-in</TableHead>
                      <TableHead>Documentos / Recibos</TableHead>
                      <TableHead className="w-32 text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {awaitingApprovalShifts.map((shift) => {
                      const fl = freelancers.find(
                        (f) => f.nome.trim().toLowerCase() === shift.name.trim().toLowerCase(),
                      );
                      const flCpfDigits = String(fl?.cpf ?? "").replace(/\D/g, "");
                      const contract = contracts.find(
                        (c) =>
                          c.status === "assinado" &&
                          ((flCpfDigits &&
                            String(c.freelancer_cpf ?? "").replace(/\D/g, "") === flCpfDigits) ||
                            (fl?.id && c.freelancer_id === fl.id)),
                      );

                      // Buscar check-in correspondente
                      const check = checkIns.find((c) => c.id === shift.checkin_id);

                      // Recibos recentes para histórico
                      const hist = receipts.filter((r) => r.freelancer_cpf === fl?.cpf).slice(0, 2);

                      return (
                        <TableRow key={shift.id} className="hover:bg-muted/30">
                          <TableCell>
                            <div>
                              <p className="font-semibold text-foreground">{shift.name}</p>
                              <p className="text-[10px] text-muted-foreground uppercase">
                                {shift.role}
                              </p>
                              <p className="text-[10px] text-muted-foreground">
                                Data do Serviço: {format(parseISO(shift.entry_date), "dd/MM/yyyy")}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell className="font-medium">
                            {getUnitDisplayName(shift.unit)}
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-bold text-emerald-600">
                                {formatBRLCurrency(
                                  Number(shift.daily_rate || 0) +
                                    Number(shift.deliveries_total || 0),
                                )}
                              </p>
                              {shift.deliveries_count && (
                                <p className="text-[10px] text-muted-foreground">
                                  {shift.deliveries_count} entregas
                                </p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {check?.image_url ? (
                              <button
                                onClick={() => setZoomPhotoUrl(check.image_url)}
                                className="h-12 w-12 rounded-lg overflow-hidden border border-border hover:opacity-85 transition-opacity"
                              >
                                <img
                                  src={check.image_url}
                                  alt="Check-in Photo"
                                  className="h-full w-full object-cover"
                                />
                              </button>
                            ) : (
                              <span className="text-xs text-muted-foreground">
                                Sem check-in vinculado
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              {contract ? (
                                <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-600 border border-emerald-500/20">
                                  Contrato Assinado
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-600 border border-amber-500/20">
                                  Sem contrato assinado
                                </span>
                              )}
                              {hist.length > 0 && (
                                <div className="text-[9px] text-muted-foreground space-y-0.5 mt-1">
                                  <p className="font-semibold">Recibos Recentes:</p>
                                  {hist.map((h: any) => (
                                    <p key={h.zapsign_token}>
                                      • {formatBRLCurrency(h.amount)} (
                                      {h.status === "signed" ? "✓" : "Pendente"})
                                    </p>
                                  ))}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setRejectingShift(shift)}
                                className="h-8 w-8 text-destructive hover:bg-destructive/10"
                                title="Rejeitar e devolver ao gerente"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleApproveShifts([shift])}
                                className="h-8 gap-1 text-xs text-primary border-primary/20 hover:bg-primary/5"
                              >
                                <Check className="h-3.5 w-3.5" /> Aprovar
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {awaitingApprovalShifts.length === 0 && (
                      <TableRow>
                        <TableCell
                          colSpan={6}
                          className="text-center py-8 text-muted-foreground text-sm"
                        >
                          Não há lançamentos aguardando aprovação administrativa.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Modal de Rejeição da Diretoria */}
            <Dialog
              open={!!rejectingShift}
              onOpenChange={(open) => !open && setRejectingShift(null)}
            >
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Rejeitar Lançamento - {rejectingShift?.name}</DialogTitle>
                  <DialogDescription>
                    Explique o motivo da rejeição para que o gerente de loja possa corrigir.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-2">
                  <div className="space-y-2">
                    <Label htmlFor="reject-reason">Motivo da Rejeição</Label>
                    <Textarea
                      id="reject-reason"
                      placeholder="Ex: quantidade de entregas divergente do relatório do caixa..."
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      rows={3}
                      required
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="ghost" onClick={() => setRejectingShift(null)}>
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleRejectShift}
                    disabled={savingRejection}
                    className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                  >
                    Confirmar Rejeição
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </TabsContent>

          {/* TAB 3: LIBERAÇÃO FINANCEIRA */}
          <TabsContent value="finance" className="space-y-6">
            <div className="space-y-6">
              {/* Ação: exportar relatório para o Financeiro */}
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-muted-foreground">
                  {approvedShifts.length} lançamento(s) aprovado(s) aguardando pagamento ·{" "}
                  <span className="font-semibold text-emerald-600">
                    {formatBRLCurrency(
                      approvedShifts.reduce(
                        (acc, s) =>
                          acc + Number(s.daily_rate || 0) + Number(s.deliveries_total || 0),
                        0,
                      ),
                    )}
                  </span>
                </p>
                <div className="flex gap-2 self-start sm:self-auto flex-wrap">
                  <Button
                    onClick={() => setIsAuditModalOpen(true)}
                    variant="outline"
                    size="sm"
                    className="gap-2 text-emerald-700 border-emerald-600/30 hover:bg-emerald-500/10"
                  >
                    <ClipboardCheck className="h-4 w-4" /> Conferência Recibos (Semana Anterior)
                  </Button>
                  <Button
                    onClick={exportFinanceiro}
                    variant="outline"
                    size="sm"
                    disabled={approvedShifts.length === 0}
                    className="gap-2"
                  >
                    <Download className="h-4 w-4" /> Exportar para o Financeiro (Excel)
                  </Button>
                </div>
              </div>

              {/* Seção 1: Operadores e Auxiliares (Pagamento Direto) */}
              <Card className="border border-border/60 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    Operadores e Outros Prestadores (Pagamento Individual)
                  </CardTitle>
                  <CardDescription>
                    Pagamentos realizados diretamente na conta do prestador individual (exige Pix e
                    CPF).
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0 overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Prestador</TableHead>
                        <TableHead>CPF</TableHead>
                        <TableHead>Chave PIX</TableHead>
                        <TableHead>Loja</TableHead>
                        <TableHead>Valor</TableHead>
                        <TableHead className="w-24 text-right">Ação</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {consolidatedOperators.map((op) => (
                        <TableRow key={op.key} className="hover:bg-muted/30">
                          <TableCell className="font-medium">
                            {op.name}
                            {op.lancamentos > 1 && (
                              <span className="ml-1 text-[10px] text-muted-foreground">
                                ({op.lancamentos} lanç.)
                              </span>
                            )}
                          </TableCell>
                          <TableCell>{op.cpf || "-"}</TableCell>
                          <TableCell className="font-mono text-xs">{op.pix}</TableCell>
                          <TableCell>{getUnitDisplayName(op.unit)}</TableCell>
                          <TableCell className="font-bold text-emerald-600">
                            {formatBRLCurrency(op.amount)}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setPayingShift(op)}
                              className="h-8 text-xs text-primary border-primary/20 hover:bg-primary/5"
                            >
                              Pagar
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                      {consolidatedOperators.length === 0 && (
                        <TableRow>
                          <TableCell
                            colSpan={6}
                            className="text-center py-6 text-muted-foreground text-xs"
                          >
                            Nenhum pagamento pendente de operador.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {/* Seção 2: Motoboys (Pagamento Consolidado para Star Gold Delivery Ltda.) */}
              <Card className="border border-border/60 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    Motoboys (Pagamento Consolidado por Loja)
                  </CardTitle>
                  <CardDescription>
                    Pagamentos consolidados a serem enviados para a empresa terceirizada de
                    entregas.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0 overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Loja</TableHead>
                        <TableHead>Empresa Prestadora</TableHead>
                        <TableHead>CNPJ</TableHead>
                        <TableHead>Chave PIX</TableHead>
                        <TableHead>Valor Consolidado</TableHead>
                        <TableHead className="w-24 text-right">Ação</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {consolidatedMotoboys.map((g) => (
                        <TableRow key={g.unit} className="hover:bg-muted/30">
                          <TableCell className="font-medium">
                            {getUnitDisplayName(g.unit)}
                          </TableCell>
                          <TableCell>{g.company}</TableCell>
                          <TableCell>{g.cnpj}</TableCell>
                          <TableCell className="font-mono text-xs">{g.pix}</TableCell>
                          <TableCell className="font-bold text-emerald-600">
                            {formatBRLCurrency(g.amount)}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                setPayingGroup({
                                  ...g,
                                  amountFormatted: formatBRLCurrency(g.amount),
                                })
                              }
                              className="h-8 text-xs text-primary border-primary/20 hover:bg-primary/5"
                            >
                              Pagar Lote
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                      {consolidatedMotoboys.length === 0 && (
                        <TableRow>
                          <TableCell
                            colSpan={6}
                            className="text-center py-6 text-muted-foreground text-xs"
                          >
                            Nenhum pagamento pendente de motoboy.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
              {/* Seção 3: Recibos Pendentes de Assinatura (Reenvio) */}
              <Card className="border border-border/60 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    Recibos Pendentes de Assinatura (Reenvio Rápido)
                  </CardTitle>
                  <CardDescription>
                    Lista de recibos gerados que ainda não foram assinados na ZapSign.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0 overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Prestador</TableHead>
                        <TableHead>CPF</TableHead>
                        <TableHead>Período</TableHead>
                        <TableHead>Loja</TableHead>
                        <TableHead>Valor</TableHead>
                        <TableHead className="w-32 text-right">Ação</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {receipts
                        .filter((r: any) => r.status === "pending" || r.status === "sent")
                        .map((r: any) => (
                          <TableRow key={r.zapsign_token} className="hover:bg-muted/30">
                            <TableCell className="font-medium">
                              {r.freelancer_name}
                            </TableCell>
                            <TableCell>{r.freelancer_cpf || "—"}</TableCell>
                            <TableCell>{r.reference_period || "—"}</TableCell>
                            <TableCell>{getUnitDisplayName(r.unit)}</TableCell>
                            <TableCell className="font-bold text-emerald-600">
                              {formatBRLCurrency(r.amount)}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={async () => {
                                  try {
                                    const { resendDocumentSignatureFn } = await import("@/lib/email.functions");
                                    await resendDocumentSignatureFn({
                                      data: {
                                        type: "receipt",
                                        docToken: r.zapsign_token,
                                        email: r.freelancer_email,
                                        nome: r.freelancer_name,
                                      }
                                    });
                                    
                                    // Log de Auditoria
                                    await (supabase as any).from("audit_logs").insert({
                                      user_email: currentUserEmail,
                                      action: "reenvio de recibo",
                                      freelancer_name: r.freelancer_name,
                                      freelancer_cpf: r.freelancer_cpf,
                                      reason: "Reenviar e-mail de assinatura de recibo manualmente pelo painel",
                                      device_info: navigator.userAgent,
                                    });

                                    toast.success("E-mail de assinatura reenviado!");
                                  } catch (err: any) {
                                    console.error(err);
                                    toast.error(err.message || "Erro ao reenviar e-mail.");
                                  }
                                }}
                                className="h-8 text-xs text-primary border-primary/20 hover:bg-primary/5"
                              >
                                Reenviar
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      {receipts.filter((r: any) => r.status === "pending" || r.status === "sent").length === 0 && (
                        <TableRow>
                          <TableCell
                            colSpan={6}
                            className="text-center py-6 text-muted-foreground text-xs"
                          >
                            Nenhum recibo pendente de assinatura.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>

            {/* Modal de Registrar Pagamento Operador */}
            <Dialog open={!!payingShift} onOpenChange={(open) => !open && setPayingShift(null)}>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Registrar Pagamento - {payingShift?.name}</DialogTitle>
                  <DialogDescription>
                    Registre os dados do comprovante e marque como Pago.
                  </DialogDescription>
                </DialogHeader>
                {payingShift && (
                  <div className="space-y-4 py-2">
                    <div className="bg-muted p-3 rounded-lg text-xs space-y-2">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Beneficiário:</span>
                        <span className="font-bold">{payingShift.name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Chave Pix:</span>
                        <span className="font-mono">{payingShift.pix}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Valor a Pagar:</span>
                        <span className="font-bold text-emerald-600">
                          {formatBRLCurrency(
                            Number(
                              payingShift.amount ??
                                Number(payingShift.daily_rate || 0) +
                                  Number(payingShift.deliveries_total || 0),
                            ),
                          )}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label htmlFor="pay-date">Data do Pagamento</Label>
                        <Input
                          id="pay-date"
                          type="date"
                          value={paymentDate}
                          onChange={(e) => setPaymentDate(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="pay-method">Meio de Pagamento</Label>
                        <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                          <SelectTrigger id="pay-method">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Pix">Pix</SelectItem>
                            <SelectItem value="Transferência">TED / DOC</SelectItem>
                            <SelectItem value="Outro">Outro</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="pay-voucher">Comprovante de Pagamento (Imagem / PDF)</Label>
                      <Input
                        id="pay-voucher"
                        type="file"
                        accept="image/*,application/pdf"
                        onChange={(e) => setPaymentVoucher(e.target.files?.[0] || null)}
                      />
                    </div>
                  </div>
                )}
                <DialogFooter>
                  <Button variant="ghost" onClick={() => setPayingShift(null)}>
                    Cancelar
                  </Button>
                  <Button onClick={handlePayShift} disabled={uploadingVoucher}>
                    {uploadingVoucher ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      "Confirmar Pagamento"
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Modal de Registrar Pagamento Lote Motoboy */}
            <Dialog open={!!payingGroup} onOpenChange={(open) => !open && setPayingGroup(null)}>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>
                    Registrar Pagamento Terceirizado -{" "}
                    {payingGroup ? getUnitDisplayName(payingGroup.unit) : ""}
                  </DialogTitle>
                  <DialogDescription>
                    Registre os dados do repasse para a empresa de delivery.
                  </DialogDescription>
                </DialogHeader>
                {payingGroup && (
                  <div className="space-y-4 py-2">
                    <div className="bg-muted p-3 rounded-lg text-xs space-y-2">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Destinatário:</span>
                        <span className="font-bold">{payingGroup.company}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">CNPJ:</span>
                        <span className="font-mono">{payingGroup.cnpj}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">PIX CNPJ:</span>
                        <span className="font-mono">{payingGroup.pix}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Total do Lote:</span>
                        <span className="font-bold text-emerald-600">
                          {payingGroup.amountFormatted}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label htmlFor="pay-g-date">Data do Pagamento</Label>
                        <Input
                          id="pay-g-date"
                          type="date"
                          value={paymentDate}
                          onChange={(e) => setPaymentDate(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="pay-g-method">Meio de Pagamento</Label>
                        <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                          <SelectTrigger id="pay-g-method">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Pix">Pix</SelectItem>
                            <SelectItem value="Transferência">TED / DOC</SelectItem>
                            <SelectItem value="Outro">Outro</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="pay-g-voucher">Comprovante de Pagamento (Imagem / PDF)</Label>
                      <Input
                        id="pay-g-voucher"
                        type="file"
                        accept="image/*,application/pdf"
                        onChange={(e) => setPaymentVoucher(e.target.files?.[0] || null)}
                      />
                    </div>
                  </div>
                )}
                <DialogFooter>
                  <Button variant="ghost" onClick={() => setPayingGroup(null)}>
                    Cancelar
                  </Button>
                  <Button onClick={handlePayGroup} disabled={uploadingVoucher}>
                    {uploadingVoucher ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      "Confirmar Lote Pago"
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </TabsContent>

          {/* TAB 4: TERMOS */}
          <TabsContent value="termos" className="space-y-6">
            <Card className="border-border/50 bg-card/50 backdrop-blur">
              <CardHeader className="pb-3 border-b border-border/50">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-emerald-500" />
                    Aceites do Termo Único de Adesão
                  </CardTitle>
                  <Button variant="outline" size="sm" onClick={() => refetchTermos()}>
                    <RefreshCw className="mr-1 h-3.5 w-3.5" /> Atualizar
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="rounded-md border border-border/50 bg-background/50 overflow-x-auto max-h-[600px] overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead>Data/Hora</TableHead>
                        <TableHead>Prestador</TableHead>
                        <TableHead>CPF</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {termos.map((termo: any) => (
                        <TableRow key={termo.id}>
                          <TableCell className="font-mono text-xs whitespace-nowrap">
                            {new Date(termo.accepted_at).toLocaleString()}
                          </TableCell>
                          <TableCell className="font-medium whitespace-nowrap">{termo.freelancer_nome}</TableCell>
                          <TableCell className="whitespace-nowrap">{termo.freelancer_cpf}</TableCell>
                        </TableRow>
                      ))}
                      {termos.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={3} className="text-center py-8 text-muted-foreground text-sm">
                            Nenhum aceite registrado até o momento.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Modal para Visualizar a Foto em tamanho real */}
      <Dialog open={!!zoomPhotoUrl} onOpenChange={(open) => !open && setZoomPhotoUrl(null)}>
        <DialogContent className="max-w-md p-0 overflow-hidden bg-slate-900 border-slate-800">
          <DialogHeader className="p-4 bg-slate-950 border-b border-slate-800">
            <DialogTitle className="text-slate-100 text-sm">
              Evidência de Check-in (Foto)
            </DialogTitle>
          </DialogHeader>
          {zoomPhotoUrl && (
            <div className="aspect-[4/3] w-full">
              <img src={zoomPhotoUrl} alt="Evidência" className="h-full w-full object-cover" />
            </div>
          )}
          <DialogFooter className="p-4 bg-slate-950 border-t border-slate-800">
            <Button
              onClick={() => setZoomPhotoUrl(null)}
              className="w-full bg-slate-800 hover:bg-slate-700 text-slate-100"
            >
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Restrições de Check-in */}
      <Dialog open={isRestrictionModalOpen} onOpenChange={setIsRestrictionModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Status da Ferramenta de Check-in</DialogTitle>
            <DialogDescription>
              Habilite ou desabilite temporariamente a ferramenta de check-in para lojas e cargos
              específicos.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Formulário de Configuração */}
            <div className="rounded-lg border bg-muted/30 p-4 space-y-4">
              <h4 className="font-semibold text-sm">Configurar Restrição</h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Unidade / Loja</Label>
                  <Select value={restrictionStore} onValueChange={setRestrictionStore}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a loja" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="TODAS">Todas as Lojas</SelectItem>
                      {AVAILABLE_STORES.map((name) => (
                        <SelectItem key={name} value={name}>
                          {getUnitDisplayName(name)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Tipo de Prestador</Label>
                  <Select value={restrictionRole} onValueChange={setRestrictionRole}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o cargo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="TODOS">Todos os Cargos</SelectItem>
                      <SelectItem value="Operador">Operador</SelectItem>
                      <SelectItem value="Entregador">Entregador</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleToggleRestriction(restrictionStore, restrictionRole, false)}
                  disabled={savingRestriction}
                  className="text-emerald-600 hover:text-emerald-500 hover:bg-emerald-50"
                >
                  Habilitar Check-in
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleToggleRestriction(restrictionStore, restrictionRole, true)}
                  disabled={savingRestriction}
                >
                  Desabilitar Check-in
                </Button>
              </div>
            </div>

            {/* Listagem de Restrições Ativas */}
            <div className="space-y-2">
              <h4 className="font-semibold text-sm">Bloqueios Ativos</h4>
              <div className="max-h-[320px] overflow-y-auto border rounded-lg bg-background">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Loja</TableHead>
                      <TableHead className="text-center">Operador</TableHead>
                      <TableHead className="text-center">Entregador</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {AVAILABLE_STORES.map((store) => {
                      const opBlocked = checkinRestrictions.some(
                        (r: any) => r.store_name === store && r.role === "Operador",
                      );
                      const enBlocked = checkinRestrictions.some(
                        (r: any) => r.store_name === store && r.role === "Entregador",
                      );
                      const cellClass =
                        "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold cursor-pointer transition-colors";
                      return (
                        <TableRow key={store}>
                          <TableCell className="font-medium">{getUnitDisplayName(store)}</TableCell>
                          <TableCell className="text-center">
                            <button
                              disabled={savingRestriction}
                              onClick={() => handleToggleRestriction(store, "Operador", !opBlocked)}
                              className={`${cellClass} ${opBlocked ? "bg-red-50 text-red-700 hover:bg-red-100 dark:bg-red-950/30 dark:text-red-400" : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-400"}`}
                            >
                              {opBlocked ? "Inativo" : "Ativo"}
                            </button>
                          </TableCell>
                          <TableCell className="text-center">
                            <button
                              disabled={savingRestriction}
                              onClick={() =>
                                handleToggleRestriction(store, "Entregador", !enBlocked)
                              }
                              className={`${cellClass} ${enBlocked ? "bg-red-50 text-red-700 hover:bg-red-100 dark:bg-red-950/30 dark:text-red-400" : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-400"}`}
                            >
                              {enBlocked ? "Inativo" : "Ativo"}
                            </button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsRestrictionModalOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      {/* Modal de Conferência de Recibos da Semana Anterior */}
      <Dialog open={isAuditModalOpen} onOpenChange={setIsAuditModalOpen}>
        {isAuditModalOpen && (
          <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5 text-emerald-600" />
              Conferência de Recibos e Pagamentos
            </DialogTitle>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
              <DialogDescription className="text-xs sm:text-sm">
                Demonstrativo consolidado para conciliação de recibos por período e tipo de prestador.
              </DialogDescription>
              <div className="flex items-center gap-2 min-w-[200px] self-start sm:self-auto">
                <span className="text-xs text-muted-foreground whitespace-nowrap font-medium">Filtrar por Loja:</span>
                <Select value={auditStoreFilter} onValueChange={setAuditStoreFilter}>
                  <SelectTrigger className="h-8 text-xs bg-white border border-border/80 min-w-[150px]">
                    <SelectValue placeholder="Selecione a loja" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as Lojas</SelectItem>
                    {AVAILABLE_STORES.map((store) => (
                      <SelectItem key={store} value={store}>
                        {getUnitDisplayName(store)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </DialogHeader>

          <Tabs defaultValue="operadores" className="flex-1 flex flex-col min-h-0">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="operadores">Operadores (Segunda a Domingo)</TabsTrigger>
              <TabsTrigger value="entregadores">Entregadores (Quinta a Quarta)</TabsTrigger>
            </TabsList>
            
            <TabsContent value="operadores" className="flex-1 flex flex-col min-h-0 space-y-4 pt-4">
              {(() => {
                const { startDateFormatted, endDateFormatted, reportData } = compileAuditReport("operator");
                return (
                  <div className="flex-1 flex flex-col min-h-0 space-y-3">
                    <div className="bg-emerald-50 text-emerald-800 p-3 rounded-lg border border-emerald-100 flex items-center justify-between text-xs sm:text-sm font-semibold">
                      <span className="flex items-center gap-2 flex-wrap">
                        <span>Período: <span className="underline">{startDateFormatted}</span> a <span className="underline">{endDateFormatted}</span> (Seg a Dom)</span>
                        {loadingZapDocs && (
                          <span className="flex items-center gap-1 text-xs text-emerald-600 font-normal animate-pulse">
                            <Loader2 className="h-3 w-3 animate-spin" /> Atualizando via ZapSign...
                          </span>
                        )}
                      </span>
                      <Button
                        onClick={() => exportAuditReport(reportData, startDateFormatted, endDateFormatted, "Operadores")}
                        variant="outline"
                        size="sm"
                        className="gap-1 border-emerald-600/30 text-emerald-700 bg-white hover:bg-emerald-50 h-8"
                      >
                        <Download className="h-3.5 w-3.5" /> Exportar (Excel)
                      </Button>
                    </div>

                    <div className="flex-1 overflow-y-auto border border-border/60 rounded-md">
                      <Table>
                        <TableHeader className="bg-muted/40 sticky top-0 z-10">
                          <TableRow>
                            <TableHead>Prestador</TableHead>
                            <TableHead>Loja</TableHead>
                            <TableHead>Valor a Receber</TableHead>
                            <TableHead>PIX</TableHead>
                            <TableHead className="text-center">Recibo Gerado</TableHead>
                            <TableHead className="text-center">Recibo Assinado</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {reportData.map((item) => (
                            <TableRow key={`${item.unit}-${item.name}`} className="hover:bg-muted/30">
                              <TableCell className="font-semibold text-foreground text-xs sm:text-sm">
                                {item.name}
                              </TableCell>
                              <TableCell className="text-xs">
                                {getUnitDisplayName(item.unit)}
                              </TableCell>
                              <TableCell className="font-bold text-emerald-600 text-xs sm:text-sm">
                                {formatBRLCurrency(item.valor_total)}
                              </TableCell>
                              <TableCell className="font-mono text-xs max-w-[150px] truncate" title={item.pix}>
                                {item.pix}
                              </TableCell>
                              <TableCell className="text-center">
                                {item.isGenerated ? (
                                  <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                    <Check className="h-3 w-3" /> Sim
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-800">
                                    <X className="h-3 w-3" /> Não
                                  </span>
                                )}
                              </TableCell>
                              <TableCell className="text-center">
                                {item.isSigned ? (
                                  <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                    <Check className="h-3 w-3" /> Assinado
                                  </span>
                                ) : item.isGenerated ? (
                                  <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                                    <AlertCircle className="h-3 w-3" /> Pendente
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-800">
                                    —
                                  </span>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                          {reportData.length === 0 && (
                            <TableRow>
                              <TableCell colSpan={6} className="text-center py-8 text-muted-foreground text-xs">
                                Nenhum lançamento de operador no período.
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                );
              })()}
            </TabsContent>

            <TabsContent value="entregadores" className="flex-1 flex flex-col min-h-0 space-y-4 pt-4">
              {(() => {
                const { startDateFormatted, endDateFormatted, reportData } = compileAuditReport("entregador");
                return (
                  <div className="flex-1 flex flex-col min-h-0 space-y-3">
                    <div className="bg-emerald-50 text-emerald-800 p-3 rounded-lg border border-emerald-100 flex items-center justify-between text-xs sm:text-sm font-semibold">
                      <span className="flex items-center gap-2 flex-wrap">
                        <span>Período: <span className="underline">{startDateFormatted}</span> a <span className="underline">{endDateFormatted}</span> (Qui a Qua)</span>
                        {loadingZapDocs && (
                          <span className="flex items-center gap-1 text-xs text-emerald-600 font-normal animate-pulse">
                            <Loader2 className="h-3 w-3 animate-spin" /> Atualizando via ZapSign...
                          </span>
                        )}
                      </span>
                      <Button
                        onClick={() => exportAuditReport(reportData, startDateFormatted, endDateFormatted, "Entregadores")}
                        variant="outline"
                        size="sm"
                        className="gap-1 border-emerald-600/30 text-emerald-700 bg-white hover:bg-emerald-50 h-8"
                      >
                        <Download className="h-3.5 w-3.5" /> Exportar (Excel)
                      </Button>
                    </div>

                    <div className="flex-1 overflow-y-auto border border-border/60 rounded-md">
                      <Table>
                        <TableHeader className="bg-muted/40 sticky top-0 z-10">
                          <TableRow>
                            <TableHead>Entregador</TableHead>
                            <TableHead>Loja</TableHead>
                            <TableHead>Valor a Receber</TableHead>
                            <TableHead>PIX</TableHead>
                            <TableHead className="text-center">Recibo Gerado</TableHead>
                            <TableHead className="text-center">Recibo Assinado</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {reportData.map((item) => (
                            <TableRow key={`${item.unit}-${item.name}`} className="hover:bg-muted/30">
                              <TableCell className="font-semibold text-foreground text-xs sm:text-sm">
                                {item.name}
                              </TableCell>
                              <TableCell className="text-xs">
                                {getUnitDisplayName(item.unit)}
                              </TableCell>
                              <TableCell className="font-bold text-emerald-600 text-xs sm:text-sm">
                                {formatBRLCurrency(item.valor_total)}
                              </TableCell>
                              <TableCell className="font-mono text-xs max-w-[150px] truncate" title={item.pix}>
                                {item.pix}
                              </TableCell>
                              <TableCell className="text-center">
                                {item.isGenerated ? (
                                  <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                    <Check className="h-3 w-3" /> Sim
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-800">
                                    <X className="h-3 w-3" /> Não
                                  </span>
                                )}
                              </TableCell>
                              <TableCell className="text-center">
                                {item.isSigned ? (
                                  <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                    <Check className="h-3 w-3" /> Assinado
                                  </span>
                                ) : item.isGenerated ? (
                                  <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                                    <AlertCircle className="h-3 w-3" /> Pendente
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-800">
                                    —
                                  </span>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                          {reportData.length === 0 && (
                            <TableRow>
                              <TableCell colSpan={6} className="text-center py-8 text-muted-foreground text-xs">
                                Nenhum lançamento de entregador no período.
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                );
              })()}
            </TabsContent>
          </Tabs>

          <DialogFooter className="mt-4">
            <Button variant="ghost" onClick={() => setIsAuditModalOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
