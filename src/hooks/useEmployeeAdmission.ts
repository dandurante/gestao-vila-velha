import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface RegisteredEmployee {
  id: string;
  nome: string;
  cpf: string;
  pix: string;
  email: string;
  telefone: string;
  role: "Operador" | "Entregador";
  endereco: string;
  rg: string;
  estado_civil: string;
  loja: string;
  funcao: string;
}

export function useEmployeeAdmission() {
  const queryClient = useQueryClient();

  const { data: registry = [], isLoading } = useQuery({
    queryKey: ["employee_admission_registry"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_admission_registry")
        .select("*")
        .order("nome", { ascending: true });

      if (error) throw error;
      return data as RegisteredEmployee[];
    },
  });

  const addMutation = useMutation({
    mutationFn: async (employee: Omit<RegisteredEmployee, "id">) => {
      const { data, error } = await supabase
        .from("employee_admission_registry")
        .insert([employee])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employee_admission_registry"] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<RegisteredEmployee> & { id: string }) => {
      const { error } = await supabase
        .from("employee_admission_registry")
        .update(updates)
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employee_admission_registry"] });
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("employee_admission_registry").delete().eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employee_admission_registry"] });
    },
  });

  return {
    registry,
    addEmployee: (e: Omit<RegisteredEmployee, "id">) => addMutation.mutateAsync(e),
    updateEmployee: (id: string, updates: Partial<RegisteredEmployee>) =>
      updateMutation.mutateAsync({ id, ...updates }),
    removeEmployee: (id: string) => removeMutation.mutateAsync(id),
    isLoaded: !isLoading,
  };
}
