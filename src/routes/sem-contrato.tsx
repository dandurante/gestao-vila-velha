import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, AlertTriangle, Download, RefreshCw } from "lucide-react";
import { useSortable } from "@/hooks/useSortable";
import { SortHeader } from "@/components/SortHeader";
import { exportSheet } from "@/lib/exportXlsx";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ZAPSIGN_TOKEN, getZapSignDoc } from "@/lib/zapsign";
import { listSignedZapSignDocs } from "@/lib/zapsign.functions";

export const Route = createFileRoute("/sem-contrato")({
  component: SemContratoPage,
  head: () => ({
    meta: [
      { title: "Prestadores sem contrato — Gestão de Recursos Humanos" },
      {
        name: "description",
        content: "Lista de prestadores cadastrados que ainda não possuem contrato assinado.",
      },
    ],
  }),
});

function normalizeNameKey(s: string | null | undefined): string {
  return (s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function SemContratoPage() {
  const queryClient = useQueryClient();

  const { data: registry = [] } = useQuery({
    queryKey: ["reg_full"],
    queryFn: async () => {
      const { data, error } = await supabase.from("freelancer_registry").select("*");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: contractsRaw = [] } = useQuery({
    queryKey: ["contracts_all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("contracts").select("*").limit(5000);
      if (error) throw error;
      return data ?? [];
    },
  });

  const syncContractsMutation = useMutation({
    mutationFn: async () => {
      let updatedCount = 0;
      const { data: dbContracts, error } = await supabase
        .from("contracts")
        .select("id, zapsign_token, status, freelancer_name, freelancer_cpf")
        .not("zapsign_token", "is", null);

      if (error) throw error;

      for (const c of dbContracts || []) {
        if (!c.zapsign_token) continue;
        try {
          const doc = await getZapSignDoc(ZAPSIGN_TOKEN, c.zapsign_token);
          const st = (doc?.status || "").toLowerCase();
          if (st === "signed" && c.status !== "assinado") {
            await supabase
              .from("contracts")
              .update({
                status: "assinado",
                signed_at: doc.last_update_at || (doc as any).created_at || new Date().toISOString(),
                signed_file_url: doc.signed_file || null,
              })
              .eq("id", c.id);
            updatedCount++;
          }
        } catch (e) {
          console.warn(`Erro ao verificar status do contrato ${c.id}:`, e);
        }
      }

      try {
        const res = await listSignedZapSignDocs();
        const signedDocs = res.docs || [];
        for (const sdoc of signedDocs) {
          const docName = (sdoc.name || "").toLowerCase();
          if (!docName.includes("contrato")) continue;

          const { data: existingContract } = await supabase
            .from("contracts")
            .select("id, status")
            .eq("zapsign_token", sdoc.token)
            .maybeSingle();

          if (existingContract) {
            if (existingContract.status !== "assinado") {
              await supabase
                .from("contracts")
                .update({
                  status: "assinado",
                  signed_at: sdoc.last_update_at || sdoc.created_at || new Date().toISOString(),
                  signed_file_url: sdoc.signed_file || null,
                })
                .eq("id", existingContract.id);
              updatedCount++;
            }
          } else {
            const signerName = sdoc.signers?.[0]?.name || sdoc.name;
            const reg = registry.find(
              (f) =>
                normalizeNameKey(f.nome) === normalizeNameKey(signerName) ||
                (sdoc.name && normalizeNameKey(sdoc.name).includes(normalizeNameKey(f.nome))),
            );

            if (reg) {
              await supabase.from("contracts").insert({
                freelancer_id: reg.id,
                freelancer_name: reg.nome,
                freelancer_cpf: reg.cpf,
                status: "assinado",
                zapsign_token: sdoc.token,
                signed_file_url: sdoc.signed_file || null,
                signed_at: sdoc.last_update_at || sdoc.created_at || new Date().toISOString(),
                unit: "Praia da Costa",
                daily_rate: 0,
              });
              updatedCount++;
            }
          }
        }
      } catch (err) {
        console.warn("Erro ao buscar documentos da ZapSign:", err);
      }

      return updatedCount;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ["contracts_all"] });
      queryClient.invalidateQueries({ queryKey: ["contracts_all_control"] });
      if (count > 0) {
        toast.success(`Sincronização concluída! ${count} contrato(s) atualizado(s).`);
      } else {
        toast.info("Status dos contratos atualizado com a ZapSign.");
      }
    },
    onError: (err: any) => {
      toast.error(`Erro ao sincronizar: ${err.message}`);
    },
  });

  const semContrato = useMemo(() => {
    const signedContracts = contractsRaw.filter((c: any) => c.status === "assinado");

    return registry
      .filter((r: any) => {
        const rCpfDigits = String(r.cpf ?? "").replace(/\D/g, "");
        const rNameKey = normalizeNameKey(r.nome);

        const hasSigned = signedContracts.some((c: any) => {
          const cCpfDigits = String(c.freelancer_cpf ?? "").replace(/\D/g, "");
          const cNameKey = normalizeNameKey(c.freelancer_name);

          const matchCpf = !!(rCpfDigits && cCpfDigits && rCpfDigits === cCpfDigits);
          const matchId = !!(r.id && c.freelancer_id === r.id);
          const matchName = !!(
            cNameKey &&
            rNameKey &&
            (cNameKey === rNameKey || cNameKey.includes(rNameKey) || rNameKey.includes(cNameKey))
          );

          return matchCpf || matchId || matchName;
        });

        return !hasSigned;
      })
      .map((r: any) => ({
        id: r.id,
        nome: r.nome,
        cpf: r.cpf,
        telefone: r.telefone,
        email: r.email,
        role: r.role,
      }));
  }, [registry, contractsRaw]);

  const sort = useSortable(semContrato);

  function handleExport() {
    exportSheet(
      `prestadores-sem-contrato-${new Date().toISOString().slice(0, 10)}.xlsx`,
      sort.rows,
      [
        { header: "Nome", key: "nome" },
        { header: "CPF", key: "cpf" },
        { header: "Telefone", key: "telefone" },
        { header: "E-mail", key: "email" },
        { header: "Função", key: "role" },
      ],
      "Sem contrato",
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 p-4 md:p-6 pb-24">
      <div className="mx-auto max-w-[1100px] space-y-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <Link to="/relatorios">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="mr-1 h-4 w-4" /> Voltar
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold tracking-tight md:text-3xl flex items-center gap-2">
                <AlertTriangle className="h-6 w-6 text-destructive" /> Prestadores sem contrato
              </h1>
              <p className="text-sm text-muted-foreground">
                {semContrato.length} prestador(es) sem contrato assinado
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => syncContractsMutation.mutate()}
              disabled={syncContractsMutation.isPending}
              className="gap-1.5 font-semibold text-xs"
              title="Sincronizar status dos contratos assinados na ZapSign"
            >
              <RefreshCw
                className={cn("h-3.5 w-3.5", syncContractsMutation.isPending && "animate-spin")}
              />
              {syncContractsMutation.isPending ? "Sincronizando..." : "Sincronizar ZapSign"}
            </Button>
            <Button variant="outline" size="sm" onClick={handleExport} disabled={!semContrato.length}>
              <Download className="mr-2 h-4 w-4" /> Exportar Excel
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Lista</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 text-left">#</th>
                  <SortHeader label="Nome" sortKey="nome" state={sort} />
                  <SortHeader label="CPF" sortKey="cpf" state={sort} />
                  <SortHeader label="Telefone" sortKey="telefone" state={sort} />
                  <SortHeader label="E-mail" sortKey="email" state={sort} />
                  <SortHeader label="Função" sortKey="role" state={sort} />
                </tr>
              </thead>
              <tbody>
                {sort.rows.map((r: any, i: number) => (
                  <tr key={r.id} className="border-t border-border/50">
                    <td className="px-4 py-2 text-muted-foreground">{i + 1}</td>
                    <td className="px-4 py-2 font-medium">{r.nome}</td>
                    <td className="px-4 py-2">{r.cpf}</td>
                    <td className="px-4 py-2">{r.telefone}</td>
                    <td className="px-4 py-2">{r.email}</td>
                    <td className="px-4 py-2">{r.role}</td>
                  </tr>
                ))}
                {!sort.rows.length && (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">
                      Todos os prestadores têm contrato assinado 🎉
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
