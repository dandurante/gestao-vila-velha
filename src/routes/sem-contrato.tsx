import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, AlertTriangle, Download } from "lucide-react";
import { useSortable } from "@/hooks/useSortable";
import { SortHeader } from "@/components/SortHeader";
import { exportSheet } from "@/lib/exportXlsx";

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

function SemContratoPage() {
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

  const semContrato = useMemo(() => {
    const comContrato = new Set(
      contractsRaw
        .filter((c: any) => c.status === "assinado")
        .map((c: any) => (c.freelancer_name ?? "").trim().toLowerCase()),
    );
    return registry
      .filter((r: any) => !comContrato.has((r.nome ?? "").trim().toLowerCase()))
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
          <Button variant="outline" size="sm" onClick={handleExport} disabled={!semContrato.length}>
            <Download className="mr-2 h-4 w-4" /> Exportar Excel
          </Button>
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
