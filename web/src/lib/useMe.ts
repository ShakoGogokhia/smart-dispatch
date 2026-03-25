import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { normalizeRoles } from "@/lib/session";

export function useMe(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const data = (await api.get("/api/me")).data;
      return {
        ...data,
        roles: normalizeRoles(data?.roles),
        language: data?.language === "ka" ? "ka" : "en",
      };
    },
    enabled: options?.enabled ?? true,
    retry: false,
  });
}
