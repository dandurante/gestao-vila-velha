import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "gestor_loja" | "financeiro" | "rh";

export function useUserRoles() {
  const { data, isLoading } = useQuery({
    queryKey: ["user_roles_self"],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) return { roles: [] as AppRole[], stores: [] as string[] };

      const [{ data: roles }, { data: stores }] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", uid),
        supabase.from("user_store_assignments").select("unit").eq("user_id", uid),
      ]);

      return {
        roles: (roles ?? []).map((r: any) => r.role as AppRole),
        stores: (stores ?? []).map((s: any) => s.unit as string),
      };
    },
  });

  const roles = data?.roles ?? [];
  const stores = data?.stores ?? [];
  const isAdmin = roles.includes("admin");
  // Sem nenhuma role atribuída => modo legado: vê tudo (compat com app atual)
  const hasFullAccess =
    isAdmin || roles.includes("financeiro") || roles.includes("rh") || roles.length === 0;

  return { roles, stores, isAdmin, hasFullAccess, isLoading };
}
