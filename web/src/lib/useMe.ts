import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { normalizeRoles } from "@/lib/session";

export function useMe() {
  return useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const data = (await api.get("/api/me")).data;
      return {
        ...data,
        roles: normalizeRoles(data?.roles),
      };
    },
    retry: false,
  });
}
