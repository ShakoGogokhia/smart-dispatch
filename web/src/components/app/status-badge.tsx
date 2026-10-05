import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { formatOrderStatus } from "@/lib/format";
import { cn } from "@/lib/utils";

export type Tone = "neutral" | "success" | "warning" | "destructive" | "info" | "primary";

const TONES: Record<Tone, string> = {
  neutral: "border-transparent bg-muted text-muted-foreground",
  success: "border-transparent bg-success/15 text-success dark:bg-success/20",
  warning: "border-transparent bg-warning/25 text-warning-foreground dark:bg-warning/20 dark:text-warning",
  destructive: "border-transparent bg-destructive/10 text-destructive dark:bg-destructive/20",
  info: "border-transparent bg-info/15 text-info",
  primary: "border-transparent bg-primary/10 text-primary",
};

export function StatusBadge({
  tone = "neutral",
  children,
  className,
  dot = false,
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
  dot?: boolean;
}) {
  return (
    <Badge variant="outline" className={cn("gap-1.5 rounded-md font-medium", TONES[tone], className)}>
      {dot ? <span className="size-1.5 rounded-full bg-current" /> : null}
      {children}
    </Badge>
  );
}

/** Map a raw status string (order, payment, ticket, approval...) to a tone. */
export function toneForStatus(status: string | null | undefined): Tone {
  const s = String(status ?? "").toLowerCase();
  if (["cancel", "reject", "declin", "fail", "error", "blocked", "inactive", "expired", "refund", "out_of_stock"].some((k) => s.includes(k))) return "destructive";
  if (["delivered", "completed", "done", "paid", "approved", "resolved", "success", "active"].some((k) => s.includes(k))) return "success";
  if (["picked", "transit", "assigned", "accepted", "ready", "offered", "planned", "en_route", "on_route", "dispatched", "preparing", "in_progress", "processing"].some((k) => s.includes(k))) return "info";
  if (["pending", "new", "waiting", "open", "review", "draft", "low"].some((k) => s.includes(k))) return "warning";
  return "neutral";
}

/** Known order statuses get their friendly label ("MARKET_PENDING" -> "Waiting for market"), others "SOME_STATUS" -> "Some status". */
export function humanizeStatus(status: string | null | undefined) {
  const known = formatOrderStatus(status);
  if (status && known !== status.trim()) return known;
  const s = String(status ?? "").replace(/[_-]+/g, " ").trim().toLowerCase();
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : "Unknown";
}

/** Status string -> colored badge with a readable label. */
export function OrderStatusBadge({ status, className }: { status: string | null | undefined; className?: string }) {
  return (
    <StatusBadge tone={toneForStatus(status)} dot className={className}>
      {humanizeStatus(status)}
    </StatusBadge>
  );
}
