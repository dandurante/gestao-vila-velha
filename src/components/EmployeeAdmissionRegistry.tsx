import { useState, useEffect, useRef } from "react";
import { Trash2, Edit2, Users, Store, Briefcase } from "lucide-react";
import { toast } from "sonner";
import { useEmployeeAdmission, RegisteredEmployee } from "@/hooks/useEmployeeAdmission";
import { useFreelancerRegistry } from "@/hooks/useFreelancerRegistry";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";

// ─── Lojas e Estados ────────────────────────────────────────────────────────
const LOJAS: { nome: string; estado: "ES" | "SP" | "RJ" }[] = [
  { nome: "Boali (ES)", estado: "ES" },
  { nome: "Domino's Aclimação (SP)", estado: "SP" },
  { nome: "Domino's Campo Belo (SP)", estado: "SP" },
  { nome: "Domino's Guarulhos (SP)", estado: "SP" },
  { nome: "Domino's Jabaquara (SP)", estado: "SP" },
  { nome: "Domino's J. Camburi (ES)", estado: "ES" },
  { nome: "Domino's P. Mandaqui (SP)", estado: "SP" },
  { nome: "Domino's Pinheiros (SP)", estado: "SP" },
  { nome: "Domino's Praia do Canto (ES)", estado: "ES" },
  { nome: "Domino's V. Clementino (SP)", estado: "SP" },
  { nome: "Domino's V. Gopouva (SP)", estado: "SP" },
  { nome: "Domino's Serra (ES)", estado: "ES" },
  { nome: "Fair Trade (RJ)", estado: "RJ" },
  { nome: "Spoleto", estado: "SP" },
];

const FUNCOES_POR_ESTADO: Record<"SP" | "ES" | "RJ", string[]> = {
  SP: [
    "Operador I",
    "Operador II",
    "Operador Instrutor",
    "Gerente Trainee I",
    "Gerente Trainee II",
    "Gerente Pleno I",
    "Gerente Pleno II",
  ],
  ES: [
    "Atendente I",
    "Atendente II",
    "Assistente de Gerente I",
    "Assistente de Gerente II",
    "Gerente Junior",
    "Gerente",
    "Supervisor Junior",
    "Supervisor",
    "Auxiliar de Serviços Gerais",
    "Motoboy Horista",
    "Treinador",
  ],
  RJ: ["Atendente", "Supervisora"],
};

// ─── Componente ─────────────────────────────────────────────────────────────
export function EmployeeAdmissionRegistry() {
  const { registry, addEmployee, updateEmployee, removeEmployee, isLoaded } =
    useEmployeeAdmission();
  const { registry: freelancers } = useFreelancerRegistry();
  const formSectionRef = useRef<HTMLDivElement | null>(null);
  const nomeInputRef = useRef<HTMLInputElement | null>(null);

  const [filterRole, setFilterRole] = useState<string>("__all__");
  const [filterLoja, setFilterLoja] = useState<string>("__all__");

  // Campos do formulário
  const [nome, setNome] = useState("");
  const [cpf, setCpf] = useState("");
  const [pix, setPix] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [endereco, setEndereco] = useState("");
  const [rg, setRg] = useState("");
  const [estadoCivil, setEstadoCivil] = useState("");
  const [loja, setLoja] = useState("");
  const [funcao, setFuncao] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  // Estado derivado da loja selecionada
  const estadoLoja = LOJAS.find((l) => l.nome === loja)?.estado ?? null;
  const funcoesDisponiveis = estadoLoja ? FUNCOES_POR_ESTADO[estadoLoja] : [];

  // Reset funcao quando loja muda
  const handleLojaChange = (value: string) => {
    setLoja(value);
    setFuncao(""); // Limpa função ao trocar de loja
  };

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
    setEndereco("");
    setRg("");
    setEstadoCivil("");
    setLoja("");
    setFuncao("");
    setEditingId(null);
  };

  const handleEdit = (e: RegisteredEmployee) => {
    setNome(e.nome);
    setCpf(e.cpf);
    setPix(e.pix);
    setEmail(e.email ?? "");
    setTelefone(e.telefone ?? "");
    setEndereco(e.endereco ?? "");
    setRg(e.rg ?? "");
    setEstadoCivil(e.estado_civil ?? "");
    setLoja(e.loja ?? "");
    setFuncao(e.funcao ?? "");
    setEditingId(e.id);
    toast.info(`Editando cadastro de ${e.nome}.`);
    requestAnimationFrame(() => {
      formSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      nomeInputRef.current?.focus();
      nomeInputRef.current?.select();
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome || !cpf || !pix) {
      toast.error("Preencha nome, CPF e Pix.");
      return;
    }

    const norm = (s: string) => (s || "").trim().toLowerCase();
    const normCpf = (s: string) => (s || "").replace(/\D/g, "");

    const existsAsFreelancerOperator = freelancers.some(
      (f) => normCpf(f.cpf) === normCpf(cpf) && (f.role || "Operador") === "Operador",
    );
    if (existsAsFreelancerOperator) {
      toast.error("Este funcionário já está cadastrado como Operador Freelancer.");
      return;
    }

    const payload = {
      nome,
      cpf,
      pix,
      email,
      telefone,
      endereco,
      rg,
      estado_civil: estadoCivil,
      loja,
      funcao,
      role: "Operador" as const,
    };

    try {
      if (editingId) {
        const duplicate = registry.find((r) => {
          if (r.id === editingId) return false;
          return (
            normCpf(r.cpf) === normCpf(cpf) &&
            normCpf(r.cpf) !== "" &&
            norm(r.nome) === norm(nome) &&
            norm(r.pix) === norm(pix)
          );
        });
        if (duplicate) {
          toast.error("Já existe um funcionário com os mesmos dados.");
          return;
        }
        await updateEmployee(editingId, payload);
        toast.success("Funcionário atualizado.");
      } else {
        const duplicate = registry.find(
          (r) =>
            normCpf(r.cpf) === normCpf(cpf) &&
            normCpf(r.cpf) !== "" &&
            norm(r.nome) === norm(nome) &&
            norm(r.pix) === norm(pix),
        );
        if (duplicate) {
          toast.error("Funcionário já cadastrado com os mesmos dados.");
          return;
        }
        const sameCpf = registry.find(
          (r) => normCpf(r.cpf) === normCpf(cpf) && normCpf(cpf) !== "",
        );
        if (sameCpf) {
          toast.error(`CPF já cadastrado: ${sameCpf.nome}.`);
          return;
        }
        await addEmployee(payload);
        toast.success("Funcionário cadastrado com sucesso.");
      }
      resetForm();
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar.");
    }
  };

  const [session, setSession] = useState<any>(null);
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
  }, []);
  const isAdmin = session?.user?.email === "dandurante@hotmail.com";

  if (!isLoaded) return null;

  // Lojas únicas para filtro
  const lojasUnicas = Array.from(new Set(registry.map((r) => r.loja).filter(Boolean)));

  const filteredRegistry = registry.filter((r) => {
    if (filterRole !== "__all__" && (r.role || "Operador") !== filterRole) return false;
    if (filterLoja !== "__all__" && r.loja !== filterLoja) return false;
    return true;
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
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                Cadastro de Funcionários
              </h1>
            </div>
            <p className="text-sm text-muted-foreground">
              Gestão de registro e admissão de funcionários (regime CLT).
            </p>
          </div>
          <Button variant="outline" asChild>
            <Link to="/registro-admissao">Voltar ao Registro e Admissão</Link>
          </Button>
        </header>

        <div className="space-y-6">
          {/* ── Formulário ── */}
          <div ref={formSectionRef}>
            <Card className="border-border/60 shadow-sm">
              <CardHeader>
                <CardTitle>
                  {editingId ? "Editar Funcionário" : "Novo Funcionário para Admissão"}
                </CardTitle>
                <CardDescription>
                  Insira os dados do funcionário para o processo de admissão.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-5">
                  {/* Linha 1: Nome, CPF, Pix, Email, Telefone, Cargo */}
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
                    <div className="space-y-2 lg:col-span-2">
                      <Label>Nome Completo</Label>
                      <Input
                        ref={nomeInputRef}
                        value={nome}
                        onChange={(e) => setNome(e.target.value.toUpperCase())}
                        placeholder="Ex: JOÃO DA SILVA"
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
                  </div>

                  {/* Linha 2: Loja e Função */}
                  <div className="grid gap-4 sm:grid-cols-2">
                    {/* Loja */}
                    <div className="space-y-2">
                      <Label className="flex items-center gap-1.5">
                        <Store className="h-3.5 w-3.5 text-muted-foreground" />
                        Loja
                      </Label>
                      <Select value={loja} onValueChange={handleLojaChange}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione a loja" />
                        </SelectTrigger>
                        <SelectContent>
                          {LOJAS.map((l) => (
                            <SelectItem key={l.nome} value={l.nome}>
                              {l.nome}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Função — depende da loja selecionada */}
                    <div className="space-y-2">
                      <Label className="flex items-center gap-1.5">
                        <Briefcase className="h-3.5 w-3.5 text-muted-foreground" />
                        Função
                        {estadoLoja && (
                          <span className="ml-1 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                            {estadoLoja}
                          </span>
                        )}
                      </Label>
                      <Select value={funcao} onValueChange={setFuncao} disabled={!loja}>
                        <SelectTrigger>
                          <SelectValue
                            placeholder={loja ? "Selecione a função" : "Selecione a loja primeiro"}
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {funcoesDisponiveis.map((f) => (
                            <SelectItem key={f} value={f}>
                              {f}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Linha 3: Endereço, RG, Estado Civil */}
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <div className="space-y-2 lg:col-span-1">
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
                      {editingId ? "Salvar Alterações" : "Cadastrar Funcionário"}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>

          {/* ── Lista ── */}
          <Card className="border-border/60 shadow-sm">
            <CardHeader>
              <CardTitle>Funcionários Cadastrados para Admissão</CardTitle>
              <CardDescription>
                Lista de funcionários registrados no fluxo de admissão.
              </CardDescription>
            </CardHeader>
            <CardContent className="px-0 sm:px-6">
              {/* Filtros */}
              <div className="mb-4 grid gap-3 px-4 sm:grid-cols-2 sm:px-0">
                <div className="space-y-2">
                  <Label>Loja</Label>
                  <Select value={filterLoja} onValueChange={setFilterLoja}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">Todas as Lojas</SelectItem>
                      {lojasUnicas.map((l) => (
                        <SelectItem key={l} value={l}>
                          {l}
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
                      <TableHead>CPF</TableHead>
                      <TableHead>Loja</TableHead>
                      <TableHead>Função</TableHead>
                      <TableHead>Pix</TableHead>
                      <TableHead>Telefone</TableHead>
                      <TableHead className="w-24 text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRegistry.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center text-muted-foreground">
                          Nenhum funcionário cadastrado.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredRegistry.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell className="font-medium">{r.nome}</TableCell>
                          <TableCell>{r.cpf}</TableCell>
                          <TableCell>
                            {r.loja ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
                                <Store className="h-3 w-3" />
                                {r.loja}
                              </span>
                            ) : (
                              "—"
                            )}
                          </TableCell>
                          <TableCell>
                            {r.funcao ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                                {r.funcao}
                              </span>
                            ) : (
                              "—"
                            )}
                          </TableCell>
                          <TableCell>{r.pix}</TableCell>
                          <TableCell>{r.telefone ?? "—"}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                aria-label={`Editar ${r.nome}`}
                                title="Editar"
                                onClick={() => handleEdit(r)}
                              >
                                <Edit2 className="h-4 w-4" />
                              </Button>
                              {isAdmin && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => {
                                    if (confirm("Remover funcionário?")) removeEmployee(r.id);
                                  }}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
