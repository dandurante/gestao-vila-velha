import { createFileRoute } from "@tanstack/react-router";
import { FreelancerRegistry } from "@/components/FreelancerRegistry";

export const Route = createFileRoute("/cadastro")({
  component: CadastroRoute,
  head: () => ({
    meta: [
      { title: "Cadastro de Prestadores de Serviço" },
      {
        name: "description",
        content: "Gerencie o cadastro de freelancers para emissão de recibos.",
      },
    ],
  }),
});

function CadastroRoute() {
  return <FreelancerRegistry />;
}
