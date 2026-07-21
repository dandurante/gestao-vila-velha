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
