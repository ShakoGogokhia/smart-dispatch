import { formatOrderStatus, type AppLanguage } from "@/src/lib/format";

export type Tone = "neutral" | "success" | "warning" | "destructive" | "info" | "primary";

/** Map a raw status string (order, payment, ticket, approval...) to a tone. Same rules as the web app. */
export function toneForStatus(status: string | null | undefined): Tone {
  const s = String(status ?? "").toLowerCase();
  if (["cancel", "reject", "declin", "fail", "error", "blocked", "inactive", "expired", "refund", "out_of_stock"].some((k) => s.includes(k))) return "destructive";
  if (["delivered", "completed", "done", "paid", "approved", "resolved", "success", "active"].some((k) => s.includes(k))) return "success";
  if (["picked", "transit", "assigned", "accepted", "ready", "offered", "planned", "en_route", "on_route", "dispatched", "preparing", "in_progress", "processing"].some((k) => s.includes(k))) return "info";
  if (["pending", "new", "waiting", "open", "review", "draft", "low"].some((k) => s.includes(k))) return "warning";
  return "neutral";
}

/** Known order statuses get their friendly label ("MARKET_PENDING" -> "Waiting for market"), others "SOME_STATUS" -> "Some status". */
export function humanizeStatus(status: string | null | undefined, language: AppLanguage = "en") {
  const known = formatOrderStatus(status, language);
  if (status && known !== status.trim()) return known;
  const s = String(status ?? "").replace(/[_-]+/g, " ").trim().toLowerCase();
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : "Unknown";
}
