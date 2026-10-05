import { Package, Star, Store } from "lucide-react";
import { Link } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatMoney, toNumber } from "@/lib/format";
import { calcStorefrontPrice } from "@/lib/storefront";
import { cn } from "@/lib/utils";

import { getDiscoveryItemImageUrl, type DiscoveryItem } from "./home-media";

export function ProductCard({ item, className }: { item: DiscoveryItem; className?: string }) {
  const imageUrl = getDiscoveryItemImageUrl(item);
  const reviewAverage = item.review_summary?.average ?? 0;
  const reviewCount = item.review_summary?.count ?? 0;
  const comboCount = item.combo_offers?.length ?? 0;
  const basePrice = toNumber(item.price);
  const finalPrice = calcStorefrontPrice(item);
  const isDiscounted = Math.abs(basePrice - finalPrice) > 0.01;
  const hasDeal = isDiscounted || (!!item.discount_type && item.discount_type !== "none");
  const marketIsOpen = item.market?.operating_status?.is_open ?? item.market?.is_active ?? true;

  return (
    <Link
      to={`/m/${item.market_id}`}
      aria-label={`${item.name} at ${item.market?.name ?? "market"}${marketIsOpen ? "" : " (closed)"}`}
      className={cn(
        "group flex min-w-0 flex-col overflow-hidden rounded-xl border bg-card text-card-foreground shadow-sm transition-shadow outline-none hover:shadow-md focus-visible:ring-[3px] focus-visible:ring-ring/50",
        className,
      )}
    >
      <div className="relative aspect-square overflow-hidden bg-muted">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt=""
            loading="lazy"
            className={cn(
              "size-full object-cover transition-transform duration-500 group-hover:scale-105",
              !marketIsOpen && "opacity-60",
            )}
          />
        ) : (
          <div className="flex size-full items-center justify-center text-muted-foreground">
            <Package className="size-8" />
          </div>
        )}

        <div className="absolute inset-x-2 top-2 flex flex-wrap gap-1">
          {hasDeal ? <Badge className="border-transparent bg-destructive text-destructive-foreground shadow-sm">Deal</Badge> : null}
          {comboCount > 0 ? (
            <Badge className="border-transparent bg-info text-info-foreground shadow-sm">
              {comboCount} combo{comboCount === 1 ? "" : "s"}
            </Badge>
          ) : null}
          {item.is_promoted ? <Badge className="border-transparent bg-foreground text-background shadow-sm">Promoted</Badge> : null}
        </div>

        {!marketIsOpen ? (
          <div className="absolute inset-x-0 bottom-0 bg-background/85 px-2.5 py-1 text-xs font-medium text-foreground backdrop-blur-sm">
            Market closed
          </div>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <div className="min-w-0">
          <h3 className="line-clamp-1 text-sm font-semibold">{item.name}</h3>
          <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
            <Store className="size-3 shrink-0" />
            <span className="truncate">{item.market?.name ?? "Market item"}</span>
          </p>
        </div>

        <div className="flex flex-wrap items-baseline gap-x-1.5">
          <span className="font-semibold tabular-nums">{formatMoney(finalPrice)}</span>
          {isDiscounted ? (
            <span className="text-xs text-muted-foreground line-through tabular-nums">{formatMoney(basePrice)}</span>
          ) : null}
        </div>

        <div className="mt-auto flex flex-wrap items-center gap-x-2 gap-y-1 pt-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Star className="size-3 fill-warning text-warning" />
            <span className="font-medium text-foreground tabular-nums">{reviewCount ? reviewAverage.toFixed(1) : "New"}</span>
            {reviewCount ? <span className="tabular-nums">({reviewCount})</span> : null}
          </span>
          <span aria-hidden>·</span>
          <span className="truncate">{item.category || "General"}</span>
          {item.ordered_qty ? (
            <>
              <span aria-hidden>·</span>
              <span className="tabular-nums">{item.ordered_qty} ordered</span>
            </>
          ) : null}
        </div>
      </div>
    </Link>
  );
}

export function ProductCardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("overflow-hidden rounded-xl border bg-card shadow-sm", className)}>
      <Skeleton className="aspect-square w-full rounded-none" />
      <div className="space-y-2 p-3">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
        <Skeleton className="h-4 w-1/3" />
      </div>
    </div>
  );
}
