import { Truck } from "lucide-react";
import { Link } from "react-router-dom";

import { cn } from "@/lib/utils";

/** Smart Dispatch logo mark + wordmark. */
export function Brand({ to = "/", className, subtitle }: { to?: string; className?: string; subtitle?: string }) {
  return (
    <Link to={to} className={cn("flex min-w-0 items-center gap-2.5", className)}>
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
        <Truck className="size-4" />
      </span>
      <span className="min-w-0 leading-tight">
        <span className="block truncate text-[15px] font-semibold tracking-tight">Smart Dispatch</span>
        {subtitle ? <span className="block truncate text-xs text-muted-foreground">{subtitle}</span> : null}
      </span>
    </Link>
  );
}
