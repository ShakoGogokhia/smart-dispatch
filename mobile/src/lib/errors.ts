import type { AxiosError } from "axios";

export function getErrorMessage(error: unknown, fallback = "Something went wrong") {
  if (!error || typeof error !== "object") {
    return fallback;
  }

  const axiosError = error as AxiosError<{ message?: string }>;
  return axiosError.response?.data?.message ?? (error as Error | null)?.message ?? fallback;
}
