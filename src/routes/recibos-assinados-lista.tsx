import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Receipt, Download } from "lucide-react";
import { format, parseISO } from "date-fns";
import { useSortable } from "@/hooks/useSortable";
import { SortHeader } from "@/components/SortHeader";
import { exportSheet } from "@/lib/exportXlsx";

export const Route = createFileRoute("/recibos-assinados-lista")({
  component: RecibosAssinadosListaPage,
  head: () => ({
    meta: [
      { title: "Recibos assinados — Gestão de Recursos Humanos" },
      { name: "description", content: "Lista de recibos assinados pelos prestadores de serviço." },
    ],
  }),
});

function RecibosAssinadosListaPage() {
  const { data: registry = [] } = useQuery({
    queryKey: ["reg_full"],
    queryFn: async () => {
      const { data, error } = await supabase.from("freelancer_registry").select("*");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: receiptsRaw = [] } = useQuery({
    queryKey: ["signed_receipts_all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("signed_receipts").select("*").limit(5000);
      if (error) throw error;
      return data ?? [];
    },
  });

  const roleByName = useMemo(() => {
    const m = new Map<string, string>();
    registry.forEach((r: any) => {
      const k = (r.nome ?? "").trim().toLowerCase();
      if (k) m.set(k, r.role || "Operador");
    });
    return m;
  }, [registry]);

  const recibos = useMemo(() => {
    return receiptsRaw
      .filter((r: any) => r.status === "signed")
      .map((r: any) => ({
        id: r.id,
        nome: r.freelancer_name,
        unit: r.unit ?? "—",
        funcao: r.role || roleByName.get((r.freelancer_name ?? "").trim().toLowerCase()) || "—",
        email: r.freelancer_email ?? "—",
        signed_at: r.signed_at,
        signed_file_url: r.signed_file_url,
      }));
  }, [receiptsRaw, roleByName]);

  const sort = useSortable(recibos);

  function handleExport() {
    exportSheet(
      `recibos-assinados-${new Date().toISOString().slice(0, 10)}.xlsx`,
      sort.rows,
      [
        { header: "Nome", key: "nome" },
        { header: "Loja", key: "unit" },
        { header: "Função", key: "funcao" },
        { header: "E-mail", key: "email" },
        { header: "Data assinatura", key: "signed_at", type: "date" },
        { header: "Arquivo", key: "signed_file_url" },
      ],
      "Recibos assinados",
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
                <Receipt className="h-6 w-6 text-primary" /> Recibos assinados
              </h1>
              <p className="text-sm text-muted-foreground">
                {recibos.length} recibo(s) assinado(s)
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={handleExport} disabled={!recibos.length}>
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
                  <SortHeader label="Loja" sortKey="unit" state={sort} />
                  <SortHeader label="Função" sortKey="funcao" state={sort} />
                  <SortHeader label="E-mail" sortKey="email" state={sort} />
                  <SortHeader
                    label="Data assinatura"
                    sortKey="signed_at"
                    type="date"
                    state={sort}
                  />
                  <th className="px-4 py-2 text-left">Arquivo</th>
                </tr>
              </thead>
              <tbody>
                {sort.rows.map((r: any, i: number) => (
                  <tr key={r.id} className="border-t border-border/50">
                    <td className="px-4 py-2 text-muted-foreground">{i + 1}</td>
                    <td className="px-4 py-2 font-medium">{r.nome}</td>
                    <td className="px-4 py-2">{r.unit}</td>
                    <td className="px-4 py-2">{r.funcao}</td>
                    <td className="px-4 py-2">{r.email}</td>
                    <td className="px-4 py-2">
                      {r.signed_at ? format(parseISO(r.signed_at), "dd/MM/yyyy") : "—"}
                    </td>
                    <td className="px-4 py-2">
                      {r.signed_file_url ? (
                        <a
                          href={r.signed_file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline"
                        >
                          abrir
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
                {!sort.rows.length && (
                  <tr>
                    <td colSpan={7} className="px-4 py-6 text-center text-muted-foreground">
                      Nenhum recibo assinado.
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
