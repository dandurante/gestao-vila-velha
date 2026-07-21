import { createFileRoute } from "@tanstack/react-router";
import { Freelancers } from "@/components/Freelancers";

export const Route = createFileRoute("/lancamento")({
  component: LancamentoRoute,
  head: () => ({
    meta: [
      { title: "Lançamento de Freelancers" },
      {
        name: "description",
        content:
          "Lançamento diário de freelancers por loja, com totais semanais por prestador e por unidade.",
      },
    ],
  }),
});

function LancamentoRoute() {
  return <Freelancers />;
}
