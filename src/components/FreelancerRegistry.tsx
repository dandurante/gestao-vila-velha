import { useState, useEffect, useRef } from "react";
import {
  Trash2,
  Edit2,
  Users,
  ShieldCheck,
  Plus,
  Mail,
  FileText,
  MapPin,
  Navigation,
  Loader2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  generateOperatorContractPdf,
  OPERATOR_UNIT_KEYS,
  type UnitKey,
} from "@/lib/operatorContract";
import { toast } from "sonner";
import { useFreelancerRegistry, RegisteredFreelancer } from "@/hooks/useFreelancerRegistry";
import { useUserRoles } from "@/hooks/useUserRole";
import { isValidCPF } from "@/lib/cpf";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Link } from "@tanstack/react-router";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { generateContractPdf } from "@/lib/contract";
import { sendToZapSign } from "@/lib/zapsign";
import { CurrencyInput } from "@/components/CurrencyInput";
import { ZapSignSendModal } from "@/components/ZapSignSendModal";

const ZAPSIGN_TOKEN = "0b65b8cd-104c-45f8-b273-3baa8d14dd3da9b9d31b-e2fb-49f5-b0d6-88e56bbd528f";

import { UNITS, getUnitDisplayName } from "@/lib/units";

export function FreelancerRegistry() {
  const { registry, addFreelancer, updateFreelancer, removeFreelancer, isLoaded } =
    useFreelancerRegistry();
  const queryClient = useQueryClient();
  const formSectionRef = useRef<HTMLDivElement | null>(null);
  const nomeInputRef = useRef<HTMLInputElement | null>(null);

  // Filtros da lista de cadastrados
  const [filterRole, setFilterRole] = useState<string>("__all__");
  const [filterUnit, setFilterUnit] = useState<string>("__all__");

  // Lançamentos para descobrir em quais lojas cada prestador trabalhou
  const { data: freelancerEntries = [] } = useQuery({
    queryKey: ["freelancers_units_by_name"],
    queryFn: async () => {
      const { data, error } = await supabase.from("freelancers").select("name, unit");
      if (error) throw error;
      return data as Array<{ name: string; unit: string }>;
    },
  });

  // Estados para Prestadores de Serviço
  const [nome, setNome] = useState("");
  const [cpf, setCpf] = useState("");
  const [pix, setPix] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [role, setRole] = useState<"Operador" | "Entregador">("Operador");
  const [endereco, setEndereco] = useState("");
  const [rg, setRg] = useState("");
  const [estadoCivil, setEstadoCivil] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setCurrentUserEmail(session?.user?.email ?? null);
    });
  }, []);

  // Estados para Gestão de Acessos
  const [newAllowedEmail, setNewAllowedEmail] = useState("");

  // Lojas geográficas
  const { data: storeLocations = [], refetch: refetchStoreLocations } = useQuery({
    queryKey: ["store_locations_all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("store_locations").select("*").order("name");
      if (error) throw error;
      return data as Array<{
        id: string;
        name: string;
        address: string | null;
        latitude: number;
        longitude: number;
        validation_radius: number;
      }>;
    },
  });

  // Estado para edição de localizações de lojas
  const [editingLocation, setEditingLocation] = useState<{
    id: string;
    name: string;
    address: string;
    latitude: number;
    longitude: number;
    validation_radius: number;
  } | null>(null);
  const [savingLocation, setSavingLocation] = useState(false);
  const [capturingGps, setCapturingGps] = useState(false);

  // Estados para "Gerar Contrato" (operadores)
  const [contractDialogOpen, setContractDialogOpen] = useState(false);
  const [contractOperatorId, setContractOperatorId] = useState<string>("");
  const [contractUnit, setContractUnit] = useState<UnitKey | "">("");
  const [contractDailyRate, setContractDailyRate] = useState<number>(0);
  const [generatingContract, setGeneratingContract] = useState(false);

  // ZapSign send modal state for operator contract
  const [zapOpen, setZapOpen] = useState(false);
  const [zapBlob, setZapBlob] = useState<Blob | null>(null);
  const [zapDocName, setZapDocName] = useState("");
  const [zapEmail, setZapEmail] = useState("");
  const [zapSigner, setZapSigner] = useState("");
  const [zapCpf, setZapCpf] = useState("");
  const [zapUnit, setZapUnit] = useState("");
  const [zapPhone, setZapPhone] = useState("");

  const handleSaveLocation = async () => {
    if (!editingLocation) return;
    setSavingLocation(true);
    try {
      const { error } = await supabase
        .from("store_locations")
        .update({
          address: editingLocation.address,
          latitude: editingLocation.latitude,
          longitude: editingLocation.longitude,
          validation_radius: editingLocation.validation_radius,
        })
        .eq("id", editingLocation.id);

      if (error) throw error;
      toast.success(`Configurações da loja ${editingLocation.name} salvas!`);
      setEditingLocation(null);
      refetchStoreLocations();
    } catch (err: any) {
      console.error(err);
      toast.error(`Erro ao salvar: ${err.message}`);
    } finally {
      setSavingLocation(false);
    }
  };

  const handleCaptureStoreGps = () => {
    setCapturingGps(true);
    if (!navigator.geolocation) {
      toast.error("Geolocalização não suportada no seu navegador.");
      setCapturingGps(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (editingLocation) {
          setEditingLocation({
            ...editingLocation,
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          });
          toast.success("Posição capturada com sucesso!");
        }
        setCapturingGps(false);
      },
      (err) => {
        console.error(err);
        toast.error("Erro ao capturar posição. Verifique as permissões de GPS.");
        setCapturingGps(false);
      },
      { enableHighAccuracy: true },
    );
  };

  const handleGenerateOperatorContract = async () => {
    const op = registry.find((r) => r.id === contractOperatorId);
    if (!op) {
      toast.error("Selecione o prestador de serviço.");
      return;
    }
    if (!contractUnit) {
      toast.error("Selecione a loja.");
      return;
    }
    if (!contractDailyRate || contractDailyRate <= 0) {
      toast.error("Informe o valor da diária.");
      return;
    }
    if (!op.endereco || !op.rg || !op.estado_civil) {
      toast.warning(
        "Faltam dados do operador: Endereço, RG ou Estado Civil. Edite o cadastro primeiro.",
      );
      return;
    }
    if (!op.email || !op.email.includes("@")) {
      toast.error("Operador sem e-mail válido para envio via ZapSign.");
      return;
    }
    try {
      setGeneratingContract(true);

      // Rule 6: Check for active contracts for this CPF
      const { data: existingContracts, error: contractErr } = await supabase
        .from("contracts")
        .select("id")
        .eq("freelancer_cpf", op.cpf)
        .in("status", ["assinado", "pendente"]);

      if (contractErr) {
        console.error("Erro ao consultar contratos existentes:", contractErr);
      }

      if (existingContracts && existingContracts.length > 0) {
        toast.error("Já existe contrato vigente para este prestador.");
        
        // Log de Auditoria do Bloqueio
        await (supabase as any).from("audit_logs").insert({
          user_email: currentUserEmail,
          action: "bloqueio de geração de contrato",
          freelancer_id: op.id,
          freelancer_name: op.nome,
          freelancer_cpf: op.cpf,
          reason: "Tentativa de emitir novo contrato com outro contrato ainda vigente",
          device_info: navigator.userAgent,
        });

        setGeneratingContract(false);
        return;
      }

      const { blob, filename } = generateOperatorContractPdf({
        nome: op.nome,
        cpf: op.cpf,
        rg: op.rg,
        endereco: op.endereco,
        estadoCivil: op.estado_civil,
        unit: contractUnit as UnitKey,
        dailyRate: contractDailyRate,
      });
      setZapBlob(blob);
      setZapDocName(filename.replace(/\.pdf$/, ""));
      setZapEmail(op.email);
      setZapSigner(op.nome);
      setZapCpf(op.cpf);
      setZapPhone(op.telefone || "");
      setZapUnit(contractUnit);
      setContractDialogOpen(false);
      setZapOpen(true);
    } catch (err: any) {
      toast.error(err.message || "Erro ao gerar contrato.");
    } finally {
      setGeneratingContract(false);
    }
  };

  const { data: allowedEmails = [] } = useQuery({
    queryKey: ["allowed_emails"],
    queryFn: async () => {
      const { data, error } = await supabase.from("allowed_emails").select("*").order("email");
      if (error) throw error;
      return data;
    },
  });

  // Query to get all welcome terms consents
  const { data: welcomeConsents = [], refetch: refetchWelcomeConsents } = useQuery({
    queryKey: ["vagas_welcome_consent_all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vagas_welcome_consent")
        .select("id, freelancer_id, email, accepted_at, sent_at")
        .order("sent_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const [sendingEmailId, setSendingEmailId] = useState<string | null>(null);
  const [sendingBulk, setSendingBulk] = useState(false);

  const sendSingleTermsEmail = async (freelancer: RegisteredFreelancer) => {
    if (!freelancer.email || !freelancer.email.includes("@")) {
      toast.error("Este prestador de serviço não possui um e-mail válido.");
      return;
    }
    setSendingEmailId(freelancer.id);
    try {
      const { sendWelcomeEmailFn } = await import("@/lib/email.functions");
      await sendWelcomeEmailFn({
        data: {
          freelancerId: freelancer.id,
          email: freelancer.email.trim().toLowerCase(),
          nome: freelancer.nome,
        }
      });
      toast.success(`E-mail de termos enviado com sucesso para ${freelancer.nome}!`);
      refetchWelcomeConsents();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Erro ao disparar e-mail de termos.");
    } finally {
      setSendingEmailId(null);
    }
  };

  const sendBulkTermsEmails = async (pendingFreelancers: RegisteredFreelancer[]) => {
    if (pendingFreelancers.length === 0) {
      toast.info("Não há prestadores pendentes para receber os termos por e-mail.");
      return;
    }
    setSendingBulk(true);
    try {
      const { sendBulkWelcomeEmailsFn } = await import("@/lib/email.functions");
      const list = pendingFreelancers.map((f) => ({
        id: f.id,
        email: f.email,
        nome: f.nome,
      }));
      
      const res = await sendBulkWelcomeEmailsFn({
        data: { freelancers: list }
      });
      
      const successCount = res.results.filter((r: any) => r.success).length;
      const failCount = res.results.filter((r: any) => !r.success).length;
      
      toast.success(`Disparo concluído: ${successCount} enviados com sucesso, ${failCount} falhas.`);
      refetchWelcomeConsents();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Erro ao disparar e-mails em lote.");
    } finally {
      setSendingBulk(false);
    }
  };

  const addEmailMutation = useMutation({
    mutationFn: async (email: string) => {
      const { error } = await supabase
        .from("allowed_emails")
        .insert([{ email: email.toLowerCase().trim() }]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["allowed_emails"] });
      setNewAllowedEmail("");
      toast.success("E-mail autorizado com sucesso!");
    },
    onError: (err: any) => {
      toast.error(err.message || "Erro ao autorizar e-mail.");
    },
  });

  const removeEmailMutation = useMutation({
    mutationFn: async (email: string) => {
      const { error } = await supabase.from("allowed_emails").delete().eq("email", email);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["allowed_emails"] });
      toast.success("Acesso removido.");
    },
  });

  const formatTelefone = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 11);
    if (digits.length <= 10) {
      return digits.replace(/^(\d{2})(\d)/, "($1) $2").replace(/(\d{4})(\d)/, "$1-$2");
    }
    return digits.replace(/^(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d)/, "$1-$2");
  };

  const resetForm = () => {
    setNome("");
    setCpf("");
    setPix("");
    setEmail("");
    setTelefone("");
    setRole("Operador");
    setEndereco("");
    setRg("");
    setEstadoCivil("");
    setEditingId(null);
  };

  const handleEdit = (f: RegisteredFreelancer) => {
    setNome(f.nome);
    setCpf(f.cpf);
    setPix(f.pix);
    setEmail(f.email ?? "");
    setTelefone(f.telefone ?? "");
    setRole(f.role ?? "Operador");
    setEndereco(f.endereco ?? "");
    setRg(f.rg ?? "");
    setEstadoCivil(f.estado_civil ?? "");
    setEditingId(f.id);
    toast.info(`Editando cadastro de ${f.nome}.`);
    requestAnimationFrame(() => {
      formSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      nomeInputRef.current?.focus();
      nomeInputRef.current?.select();
    });
  };

  const sendDeliveryContract = async (f: {
    nome: string;
    cpf: string;
    email: string;
    endereco: string;
    rg: string;
    estado_civil: string;
    telefone?: string;
  }) => {
    if (!f.email || !f.email.includes("@")) {
      toast.warning("Entregador cadastrado, mas sem e-mail válido para envio do contrato.");
      return;
    }
    if (!f.endereco || !f.rg || !f.estado_civil) {
      toast.warning(
        "Entregador cadastrado, mas faltam Endereço/RG/Estado Civil para gerar o contrato.",
      );
      return;
    }
    try {
      // Rule 6: Check for active contracts for this CPF
      const { data: existingContracts, error: contractErr } = await supabase
        .from("contracts")
        .select("id")
        .eq("freelancer_cpf", f.cpf)
        .in("status", ["assinado", "pendente"]);

      if (contractErr) {
        console.error("Erro ao consultar contratos existentes:", contractErr);
      }

      if (existingContracts && existingContracts.length > 0) {
        toast.warning("Já existe contrato vigente para este prestador. Contrato automático não enviado.");
        
        // Log de Auditoria do Bloqueio
        await (supabase as any).from("audit_logs").insert({
          user_email: currentUserEmail,
          action: "bloqueio de geração de contrato",
          freelancer_name: f.nome,
          freelancer_cpf: f.cpf,
          reason: "Cadastro de Entregador: já possui contrato vigente",
          device_info: navigator.userAgent,
        });

        return;
      }

      toast.info("Gerando contrato e enviando para ZapSign...");
      const { blob, filename } = generateContractPdf({
        nome: f.nome,
        cpf: f.cpf,
        rg: f.rg,
        endereco: f.endereco,
        estadoCivil: f.estado_civil,
      });
      const res = await sendToZapSign(
        ZAPSIGN_TOKEN,
        blob,
        filename.replace(/\.pdf$/, ""),
        f.email,
        f.nome,
      );
      // Persiste no banco para aparecer no dashboard como contrato pendente
      try {
        const expiresAt = new Date(new Date().setMonth(new Date().getMonth() + 3)).toISOString();
        await supabase.from("contracts").upsert(
          {
            zapsign_token: res?.token || null,
            freelancer_name: f.nome,
            freelancer_cpf: f.cpf || null,
            freelancer_email: f.email,
            status: "pendente",
            issued_at: new Date().toISOString(),
            expires_at: expiresAt,
          },
          { onConflict: "zapsign_token" },
        );

        // Log de Auditoria de Criação de Contrato
        await (supabase as any).from("audit_logs").insert({
          user_email: currentUserEmail,
          action: "geração de contrato",
          freelancer_name: f.nome,
          freelancer_cpf: f.cpf,
          old_status: null,
          new_status: "pendente",
          reason: "Geração automática de contrato para Entregador",
          device_info: navigator.userAgent,
        });

      } catch (e) {
        console.error("Erro ao registrar contrato no banco:", e);
      }
      toast.success(`Contrato enviado para ${f.email} via ZapSign.`);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Erro ao enviar contrato para ZapSign.");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome || !cpf || !pix) {
      toast.error("Preencha nome, CPF e Pix.");
      return;
    }

    const norm = (s: string) => (s || "").trim().toLowerCase();
    const normCpf = (s: string) => (s || "").replace(/\D/g, "");
    const cleanCpf = normCpf(cpf);

    if (!isValidCPF(cleanCpf)) {
      toast.error("CPF inválido.");
      return;
    }

    const payload = {
      nome,
      cpf: cleanCpf,
      pix,
      email,
      telefone,
      role,
      endereco,
      rg,
      estado_civil: estadoCivil,
    };

    try {
      if (editingId) {
        const sameCpf = registry.find(
          (r) => r.id !== editingId && normCpf(r.cpf) === cleanCpf && cleanCpf !== ""
        );
        if (sameCpf) {
          toast.error("Já existe cadastro para este CPF.");
          return;
        }

        const duplicate = registry.find((r) => {
          if (r.id === editingId) return false;
          return (
            normCpf(r.cpf) === cleanCpf &&
            norm(r.nome) === norm(nome) &&
            norm(r.pix) === norm(pix)
          );
        });
        if (duplicate) {
          toast.error("Já existe um prestador cadastrado com os mesmos dados.");
          return;
        }
        await updateFreelancer(editingId, payload);
        toast.success("Prestador de Serviço atualizado.");
      } else {
        const sameCpf = registry.find(
          (r) => normCpf(r.cpf) === cleanCpf && cleanCpf !== ""
        );
        if (sameCpf) {
          toast.error("Já existe cadastro para este CPF.");
          return;
        }

        const duplicate = registry.find(
          (r) =>
            normCpf(r.cpf) === cleanCpf &&
            norm(r.nome) === norm(nome) &&
            norm(r.pix) === norm(pix),
        );
        if (duplicate) {
          toast.error("Este prestador já está cadastrado com os mesmos dados.");
          return;
        }

        const newFreelancer = await addFreelancer(payload);
        toast.success("Prestador de Serviço cadastrado.");
        
        // Auto-send welcome terms email if email is provided
        if (payload.email && payload.email.includes("@") && newFreelancer?.id) {
          try {
            const { sendWelcomeEmailFn } = await import("@/lib/email.functions");
            await sendWelcomeEmailFn({
              data: {
                freelancerId: newFreelancer.id,
                email: payload.email.trim().toLowerCase(),
                nome: payload.nome,
              }
            });
            toast.info(`E-mail de termos enviado automaticamente para ${payload.nome}.`);
            refetchWelcomeConsents();
          } catch (emailErr) {
            console.error("Erro ao enviar e-mail automático de boas-vindas:", emailErr);
          }
        }

        if (role === "Entregador") {
          await sendDeliveryContract(payload);
        }
      }
      resetForm();
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar.");
    }
  };

  const { isAdmin: isRoleAdmin, hasFullAccess, isLoading: rolesLoading } = useUserRoles();
  const isAdmin = isRoleAdmin || hasFullAccess;

  if (!isLoaded || rolesLoading) return null;

  // Mapear os status de consentimento dos termos
  const consentMap = new Map<string, { status: "Aceito" | "Pendente" | "Não Enviado"; acceptedAt?: string; sentAt?: string }>();
  for (const c of welcomeConsents) {
    const fid = c.freelancer_id;
    const emailKey = c.email ? c.email.trim().toLowerCase() : "";
    const currentStatus = c.accepted_at ? "Aceito" : "Pendente";
    
    const updateMap = (key: string) => {
      const existing = consentMap.get(key);
      if (!existing || (existing.status !== "Aceito" && currentStatus === "Aceito")) {
        consentMap.set(key, {
          status: currentStatus,
          acceptedAt: c.accepted_at || undefined,
          sentAt: c.sent_at || undefined
        });
      }
    };

    if (fid) updateMap(fid);
    if (emailKey) updateMap(emailKey);
  }

  // Filtrar prestadores pendentes de aceite para o botão em lote
  const pendingList = registry.filter((r) => {
    if (r.active === false) return false;
    if (!r.email || !r.email.includes("@")) return false;
    const consent = consentMap.get(r.id) || (r.email ? consentMap.get(r.email.trim().toLowerCase()) : null);
    return !consent || consent.status !== "Aceito";
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/40">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="mb-1 flex items-center gap-2">
              <div className="rounded-lg bg-primary/10 p-2">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Administração</h1>
            </div>
            <p className="text-sm text-muted-foreground">
              Gestão de prestadores de serviço e permissões de acesso ao sistema.
            </p>
          </div>
          <Button variant="outline" asChild>
            <Link to="/">Voltar aos Lançamentos</Link>
          </Button>
        </header>

        <Tabs defaultValue="freelancers" className="space-y-6">
          <TabsList className={`grid w-full max-w-xl ${isAdmin ? "grid-cols-3" : "grid-cols-1"}`}>
            <TabsTrigger value="freelancers" className="flex items-center gap-2">
              <Users className="h-4 w-4" /> Prestadores de Serviço
            </TabsTrigger>
            {isAdmin && (
              <TabsTrigger value="access" className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4" /> Acessos
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="freelancers" className="space-y-6">
            <div className="flex justify-end">
              <Dialog open={contractDialogOpen} onOpenChange={setContractDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="gap-2">
                    <FileText className="h-4 w-4" /> Gerar Contrato
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Gerar Contrato de Operador</DialogTitle>
                    <DialogDescription>
                      Selecione o prestador (Operador) e a loja. Disponível apenas para Operadores.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-2">
                    <div className="space-y-2">
                      <Label>Prestador de Serviço (Operador)</Label>
                      <Select value={contractOperatorId} onValueChange={setContractOperatorId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o operador" />
                        </SelectTrigger>
                        <SelectContent>
                          {registry
                            .filter((r) => (r.role || "Operador") === "Operador")
                            .map((r) => (
                              <SelectItem key={r.id} value={r.id}>
                                {r.nome}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Loja</Label>
                      <Select
                        value={contractUnit}
                        onValueChange={(v) => setContractUnit(v as UnitKey)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione a loja" />
                        </SelectTrigger>
                        <SelectContent>
                          {OPERATOR_UNIT_KEYS.map((u) => (
                            <SelectItem key={u} value={u}>
                              {u}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Valor da Diária</Label>
                      <CurrencyInput
                        value={contractDailyRate}
                        onValueChange={setContractDailyRate}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="ghost" onClick={() => setContractDialogOpen(false)}>
                      Cancelar
                    </Button>
                    <Button onClick={handleGenerateOperatorContract} disabled={generatingContract}>
                      {generatingContract ? "Gerando..." : "Gerar e Enviar"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              {zapBlob && (
                <ZapSignSendModal
                  open={zapOpen}
                  onOpenChange={(o) => {
                    setZapOpen(o);
                    if (!o) {
                      setZapBlob(null);
                      setContractOperatorId("");
                      setContractUnit("");
                      setContractDailyRate(0);
                      setZapPhone("");
                    }
                  }}
                  pdfBlob={zapBlob}
                  docName={zapDocName}
                  signerEmail={zapEmail}
                  signerName={zapSigner}
                  signerPhone={zapPhone}
                  metadata={{
                    freelancerCpf: zapCpf,
                    role: "Operador",
                    unit: zapUnit,
                  }}
                  docType="contract"
                />
              )}
            </div>
            <div ref={formSectionRef}>
              <Card className="border-border/60 shadow-sm">
                <CardHeader>
                  <CardTitle>
                    {editingId ? "Editar Prestador de Serviço" : "Novo Prestador de Serviço"}
                  </CardTitle>
                  <CardDescription>Nome, CPF, Pix e Cargo.</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSubmit} className="space-y-5">
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
                      <div className="space-y-2 lg:col-span-2">
                        <Label>Nome Completo</Label>
                        <Input
                          ref={nomeInputRef}
                          value={nome}
                          onChange={(e) => setNome(e.target.value)}
                          placeholder="Ex: João da Silva"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>CPF</Label>
                        <Input
                          value={cpf}
                          onChange={(e) => setCpf(e.target.value)}
                          placeholder="000.000.000-00"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Chave Pix</Label>
                        <Input
                          value={pix}
                          onChange={(e) => setPix(e.target.value)}
                          placeholder="Email, CPF, Telefone"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>E-mail</Label>
                        <Input
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="exemplo@email.com"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Telefone</Label>
                        <Input
                          type="tel"
                          value={telefone}
                          onChange={(e) => setTelefone(formatTelefone(e.target.value))}
                          placeholder="(00) 00000-0000"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Cargo</Label>
                        <Select value={role} onValueChange={(v) => setRole(v as any)}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Operador">Operador</SelectItem>
                            <SelectItem value="Entregador">Entregador</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      <div className="space-y-2 lg:col-span-2">
                        <Label>Endereço</Label>
                        <Input
                          value={endereco}
                          onChange={(e) => setEndereco(e.target.value)}
                          placeholder="Rua, número, bairro, cidade/UF"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>RG</Label>
                        <Input
                          value={rg}
                          onChange={(e) => setRg(e.target.value)}
                          placeholder="00.000.000-0"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Estado Civil</Label>
                        <Select value={estadoCivil} onValueChange={setEstadoCivil}>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Solteiro(a)">Solteiro(a)</SelectItem>
                            <SelectItem value="Casado(a)">Casado(a)</SelectItem>
                            <SelectItem value="Divorciado(a)">Divorciado(a)</SelectItem>
                            <SelectItem value="Viúvo(a)">Viúvo(a)</SelectItem>
                            <SelectItem value="União Estável">União Estável</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="flex justify-end gap-2">
                      {editingId && (
                        <Button type="button" variant="ghost" onClick={resetForm}>
                          Cancelar Edição
                        </Button>
                      )}
                      <Button type="submit">
                        {editingId ? "Salvar Alterações" : "Cadastrar Prestador de Serviço"}
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </div>

            <Card className="border-border/60 shadow-sm">
              <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <CardTitle>Prestadores de Serviço Cadastrados</CardTitle>
                  <CardDescription>
                    Filtre por cargo ou loja onde já houve lançamento.
                  </CardDescription>
                </div>
                {pendingList.length > 0 && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-emerald-500/30 text-emerald-600 hover:text-emerald-500 hover:bg-emerald-500/10 gap-2 self-start sm:self-auto"
                    disabled={sendingBulk}
                    onClick={() => sendBulkTermsEmails(pendingList)}
                  >
                    {sendingBulk ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Mail className="h-4 w-4" />
                    )}
                    Enviar Termos para Pendentes ({pendingList.length})
                  </Button>
                )}
              </CardHeader>
              <CardContent className="px-0 sm:px-6">
                <div className="mb-4 grid gap-3 px-4 sm:grid-cols-2 sm:px-0">
                  <div className="space-y-2">
                    <Label>Cargo</Label>
                    <Select value={filterRole} onValueChange={setFilterRole}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__all__">Todos</SelectItem>
                        <SelectItem value="Operador">Operador</SelectItem>
                        <SelectItem value="Entregador">Entregador</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Loja</Label>
                    <Select value={filterUnit} onValueChange={setFilterUnit}>
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
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead className="hidden sm:table-cell">CPF</TableHead>
                        <TableHead>Cargo</TableHead>
                        <TableHead className="hidden lg:table-cell">Pix</TableHead>
                        <TableHead className="hidden md:table-cell">E-mail</TableHead>
                        <TableHead className="hidden lg:table-cell">Telefone</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Termos</TableHead>
                        <TableHead className="w-24 text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(() => {
                        const unitsByName = new Map<string, Set<string>>();
                        for (const e of freelancerEntries) {
                          const key = (e.name || "").trim().toLowerCase();
                          if (!key) continue;
                          if (!unitsByName.has(key)) unitsByName.set(key, new Set());
                          unitsByName.get(key)!.add(e.unit);
                        }
                        const filteredRegistry = registry.filter((r) => {
                          if (filterRole !== "__all__" && (r.role || "Operador") !== filterRole)
                            return false;
                          if (filterUnit !== "__all__") {
                            const units = unitsByName.get((r.nome || "").trim().toLowerCase());
                            if (!units || !units.has(filterUnit)) return false;
                          }
                          return true;
                        });
                        if (filteredRegistry.length === 0) {
                          return (
                            <TableRow>
                              <TableCell colSpan={9} className="text-center text-muted-foreground">
                                Nenhum prestador de serviço encontrado.
                              </TableCell>
                            </TableRow>
                          );
                        }
                        return filteredRegistry.map((r) => (
                          <TableRow key={r.id}>
                            <TableCell className="font-medium">{r.nome}</TableCell>
                            <TableCell className="hidden sm:table-cell">{r.cpf}</TableCell>
                            <TableCell>
                              <span
                                className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                                  r.role === "Entregador"
                                    ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                                    : "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400"
                                }`}
                              >
                                {r.role || "Operador"}
                              </span>
                            </TableCell>
                            <TableCell className="hidden lg:table-cell">{r.pix}</TableCell>
                            <TableCell className="hidden md:table-cell max-w-[150px] truncate" title={r.email ?? undefined}>
                              {r.email ?? "-"}
                            </TableCell>
                            <TableCell className="hidden lg:table-cell">{r.telefone ?? "-"}</TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="sm"
                                className={`h-7 px-2 text-xs font-semibold ${
                                  r.active !== false
                                    ? "text-emerald-600 hover:text-emerald-500 hover:bg-emerald-500/10"
                                    : "text-rose-600 hover:text-rose-500 hover:bg-rose-500/10"
                                }`}
                                onClick={async () => {
                                  try {
                                    await updateFreelancer(r.id, { active: r.active === false });
                                    toast.success(
                                      `Prestador ${r.nome} ${
                                        r.active === false ? "ativado" : "desativado"
                                      }!`,
                                    );
                                  } catch (err: any) {
                                    toast.error(`Erro ao alterar status: ${err.message}`);
                                  }
                                }}
                              >
                                {r.active !== false ? "Ativo" : "Inativo"}
                              </Button>
                            </TableCell>
                            <TableCell>
                              {(() => {
                                const consent = consentMap.get(r.id) || (r.email ? consentMap.get(r.email.trim().toLowerCase()) : null);
                                const status = consent ? consent.status : "Não Enviado";
                                return (
                                  <div className="flex items-center gap-2">
                                    <span
                                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                                        status === "Aceito"
                                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400"
                                          : status === "Pendente"
                                          ? "bg-amber-100 text-amber-800 dark:bg-amber-950/30 dark:text-amber-400"
                                          : "bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-400"
                                      }`}
                                    >
                                      {status}
                                    </span>
                                    {status !== "Aceito" && r.email && r.email.includes("@") && (
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6 text-muted-foreground hover:text-foreground cursor-pointer"
                                        disabled={sendingEmailId === r.id || sendingBulk}
                                        onClick={() => sendSingleTermsEmail(r)}
                                        title={status === "Pendente" ? "Reenviar e-mail de termos" : "Enviar e-mail de termos"}
                                      >
                                        {sendingEmailId === r.id ? (
                                          <Loader2 className="h-3 w-3 animate-spin" />
                                        ) : (
                                          <Mail className="h-3 w-3" />
                                        )}
                                      </Button>
                                    )}
                                  </div>
                                );
                              })()}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  aria-label={`Editar cadastro de ${r.nome}`}
                                  title="Editar cadastro"
                                  onClick={() => handleEdit(r)}
                                >
                                  <Edit2 className="h-4 w-4" />
                                </Button>
                                {isAdmin && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => {
                                      if (confirm("Remover prestador de serviço?"))
                                        removeFreelancer(r.id);
                                    }}
                                  >
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ));
                      })()}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>


          {isAdmin && (
            <TabsContent value="access" className="space-y-6">
              <Card className="border-border/60 shadow-sm">
                <CardHeader>
                  <CardTitle>Autorizar Novo E-mail</CardTitle>
                  <CardDescription>
                    Apenas e-mails nesta lista podem acessar o sistema.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <div className="relative flex-1">
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="usuario@gmail.com"
                        className="pl-10"
                        value={newAllowedEmail}
                        onChange={(e) => setNewAllowedEmail(e.target.value)}
                      />
                    </div>
                    <Button
                      onClick={() => addEmailMutation.mutate(newAllowedEmail)}
                      disabled={addEmailMutation.isPending}
                    >
                      <Plus className="mr-2 h-4 w-4" /> Autorizar Acesso
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border/60 shadow-sm">
                <CardHeader>
                  <CardTitle>E-mails Autorizados</CardTitle>
                </CardHeader>
                <CardContent className="px-0 sm:px-6">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>E-mail</TableHead>
                        <TableHead className="w-24 text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {allowedEmails.map((item: any) => (
                        <TableRow key={item.email}>
                          <TableCell className="font-medium">{item.email}</TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                if (confirm("Remover este acesso?"))
                                  removeEmailMutation.mutate(item.email);
                              }}
                              disabled={item.email === "dandurante@hotmail.com"} // Protege o admin principal
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>
      </div>
    </div>
  );
}
