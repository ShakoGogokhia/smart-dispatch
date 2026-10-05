import { api } from "@/lib/api";

/** Rewrite localhost media URLs to the API origin so uploaded images load in every environment. */
export function resolveMarketMediaUrl(url?: string | null) {
  if (!url) {
    return null;
  }

  try {
    const apiOrigin = new URL(api.defaults.baseURL ?? window.location.origin).origin;
    const parsed = new URL(url, apiOrigin);

    if (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1") {
      return `${apiOrigin}${parsed.pathname}${parsed.search}${parsed.hash}`;
    }

    return parsed.toString();
  } catch {
    return url;
  }
}

/** Extract a readable message from an axios / react-query error. */
export function marketErrorMessage(error: unknown): string | null {
  if (!error) return null;
  const e = error as { response?: { data?: { message?: string } }; message?: string };
  return e.response?.data?.message ?? e.message ?? "Something went wrong.";
}
