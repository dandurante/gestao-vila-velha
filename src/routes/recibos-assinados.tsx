import { createFileRoute } from "@tanstack/react-router";
import { SignedReceiptsReport } from "@/components/SignedReceiptsReport";

export const Route = createFileRoute("/recibos-assinados")({
  component: SignedReceiptsRoute,
  head: () => ({
    meta: [
      { title: "Recibos Assinados" },
      {
        name: "description",
        content:
          "Relatório de recibos assinados pelos prestadores de serviço, com filtros por período e nome.",
      },
    ],
  }),
});

function SignedReceiptsRoute() {
  return <SignedReceiptsReport />;
}
