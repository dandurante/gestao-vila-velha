import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface RegisteredFreelancer {
  id: string;
  nome: string;
  cpf: string;
  pix: string;
  email: string;
  telefone: string;
  role?: "Operador" | "Entregador";
  endereco?: string;
  rg?: string;
  estado_civil?: string;
  active?: boolean;
}

export function useFreelancerRegistry() {
  const queryClient = useQueryClient();

  const { data: registry = [], isLoading } = useQuery({
    queryKey: ["freelancer_registry"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("freelancer_registry")
        .select("*")
        .order("nome", { ascending: true });

      if (error) throw error;
      return data as RegisteredFreelancer[];
    },
  });

  const addMutation = useMutation({
    mutationFn: async (freelancer: Omit<RegisteredFreelancer, "id">) => {
      const { data, error } = await supabase
        .from("freelancer_registry")
        .insert([freelancer])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["freelancer_registry"] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<RegisteredFreelancer> & { id: string }) => {
      const { error } = await supabase.from("freelancer_registry").update(updates).eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["freelancer_registry"] });
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("freelancer_registry").delete().eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["freelancer_registry"] });
    },
  });

  return {
    registry,
    addFreelancer: (f: Omit<RegisteredFreelancer, "id">) => addMutation.mutateAsync(f),
    updateFreelancer: (id: string, updates: Partial<RegisteredFreelancer>) =>
      updateMutation.mutateAsync({ id, ...updates }),
    removeFreelancer: (id: string) => removeMutation.mutateAsync(id),
    isLoaded: !isLoading,
  };
}

function normName(s: string | null | undefined): string {
  return (s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function normDigits(s: string | null | undefined): string {
  return (s || "").replace(/\D/g, "");
}

export function findRegisteredFreelancer(
  registry: RegisteredFreelancer[],
  name: string,
  pix?: string,
): RegisteredFreelancer | undefined {
  const targetName = normName(name);
  if (!targetName) return undefined;

  const pixDigits = normDigits(pix);
  const targetPixNorm = (pix || "").trim().toLowerCase();

  // 1. Tenta por Nome exato (normalizado) + Pix (normalizado ou apenas dígitos)
  let found = registry.find((r) => {
    if (normName(r.nome) !== targetName) return false;
    if (!pix) return true;
    const rPixNorm = (r.pix || "").trim().toLowerCase();
    const rPixDigits = normDigits(r.pix);
    return rPixNorm === targetPixNorm || (pixDigits.length >= 8 && rPixDigits === pixDigits);
  });

  if (found) return found;

  // 2. Se não encontrou com Pix estrito, tenta por Nome (normalizado)
  found = registry.find((r) => normName(r.nome) === targetName);
  if (found) return found;

  // 3. Se não encontrou por Nome, tenta por Pix / CPF (apenas dígitos)
  if (pixDigits.length >= 8) {
    found = registry.find((r) => {
      const rPixDigits = normDigits(r.pix);
      const rCpfDigits = normDigits(r.cpf);
      return rPixDigits === pixDigits || rCpfDigits === pixDigits;
    });
  }

  return found;
}

