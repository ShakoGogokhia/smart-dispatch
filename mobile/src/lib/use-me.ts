import { useQuery } from "@tanstack/react-query";

import { api } from "@/src/lib/api";
import { normalizeRoles } from "@/src/lib/session";

export function useMe(enabled = true) {
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
    retry: false,
    enabled,
  });
}
