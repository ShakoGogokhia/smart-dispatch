import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export function useMe() {
  return useQuery({
    queryKey: ["me"],
    queryFn: async () => (await api.get("/api/me")).data,
    retry: false,
  });
}