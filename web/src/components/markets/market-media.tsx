import { Store } from "lucide-react";
import type { ReactNode } from "react";

import { resolveMarketMediaUrl } from "@/components/markets/market-utils";
import { cn } from "@/lib/utils";

/** Square market logo with initials fallback. */
export function MarketLogo({ src, name, className }: { src?: string | null; name: string; className?: string }) {
  const resolved = resolveMarketMediaUrl(src);
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return (
    <div
      className={cn(
        "flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted text-sm font-semibold text-muted-foreground",
        className,
      )}
    >
      {resolved ? <img src={resolved} alt={`${name} logo`} className="size-full object-cover" /> : initials || <Store className="size-5" />}
    </div>
  );
}

/** Banner strip (image or muted placeholder) with an optional overlay slot in the top corner. */
export function MarketBanner({ src, name, className, children }: { src?: string | null; name: string; className?: string; children?: ReactNode }) {
  const resolved = resolveMarketMediaUrl(src);

  return (
    <div className={cn("relative h-28 w-full overflow-hidden bg-muted", className)}>
      {resolved ? (
        <img src={resolved} alt={`${name} banner`} className="size-full object-cover" />
      ) : (
        <div className="flex size-full items-center justify-center text-muted-foreground">
          <Store className="size-6 opacity-40" />
        </div>
      )}
      {children ? <div className="absolute inset-x-2 top-2 flex flex-wrap justify-end gap-1.5">{children}</div> : null}
    </div>
  );
}
