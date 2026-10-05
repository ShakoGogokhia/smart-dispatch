import { Clock, MapPin, Star, Store, Tag } from "lucide-react";
import { Link } from "react-router-dom";

import { StatusBadge } from "@/components/app/status-badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatMoney } from "@/lib/format";
import { calcStorefrontPrice, formatMarketHours, formatPromoLabel, type StorefrontMarket } from "@/lib/storefront";
import { cn } from "@/lib/utils";

import { getBadgeTheme, getMarketBannerUrl, isMarketOpen, resolveMarketMediaUrl } from "./home-media";

export function MarketCard({ market, className }: { market: StorefrontMarket; className?: string }) {
  const previewItems = (market.item_preview ?? []).slice(0, 3);
  const totalItems = Number(market.active_items_count ?? previewItems.length);
  const remainingItems = Math.max(totalItems - previewItems.length, 0);
  const reviewAverage = market.review_summary?.average ?? 0;
  const reviewCount = market.review_summary?.count ?? 0;
  const heroImage = getMarketBannerUrl(market);
  const logoImage = resolveMarketMediaUrl(market.logo_url);
  const isOpen = isMarketOpen(market);
  const hoursLabel = formatMarketHours(market);
  const statusLabel = market.operating_status?.label ?? (isOpen ? "Open now" : "Closed now");
  const blurb = market.featured_headline || market.featured_copy;

  return (
    <Link
      to={`/m/${market.id}`}
      aria-label={`${market.name}${isOpen ? "" : " (closed)"}`}
      className={cn(
        "group flex min-w-0 flex-col overflow-hidden rounded-xl border bg-card text-card-foreground shadow-sm transition-shadow outline-none hover:shadow-md focus-visible:ring-[3px] focus-visible:ring-ring/50",
        className,
      )}
    >
      <div className="relative">
        <div className="relative aspect-video overflow-hidden rounded-t-xl bg-muted">
          {heroImage ? (
            <img
              src={heroImage}
              alt=""
              loading="lazy"
              className={cn(
                "size-full object-cover transition-transform duration-500 group-hover:scale-105",
                !isOpen && "opacity-60 grayscale-[40%]",
              )}
            />
          ) : (
            <div className="flex size-full items-center justify-center text-muted-foreground">
              <Store className="size-8" />
            </div>
          )}

          {!isOpen ? (
            <div className="absolute inset-x-0 bottom-0 bg-background/85 px-3 py-1.5 pl-20 text-xs font-medium text-foreground backdrop-blur-sm">
              <span className="line-clamp-1">Closed{hoursLabel ? ` · ${hoursLabel}` : ""}</span>
            </div>
          ) : null}

          <div className="absolute inset-x-2 top-2 flex items-start justify-between gap-2">
            <div className="flex min-w-0 flex-wrap gap-1.5">
              {market.is_featured ? (
                <Badge className="border-transparent bg-background/90 text-foreground shadow-sm backdrop-blur-sm">Featured</Badge>
              ) : null}
              {market.active_promo ? (
                <Badge className="max-w-full border-transparent bg-primary text-primary-foreground shadow-sm">
                  <Tag />
                  <span className="truncate">{formatPromoLabel(market.active_promo)}</span>
                </Badge>
              ) : null}
            </div>
            {market.featured_badge ? (
              <Badge className={cn("shrink-0 shadow-sm", getBadgeTheme(market.featured_badge, market.featured_theme))}>
                {market.featured_badge}
              </Badge>
            ) : null}
          </div>
        </div>

        <Avatar className="absolute -bottom-6 left-4 size-14 rounded-xl bg-card shadow-sm ring-4 ring-card">
          {logoImage ? <AvatarImage src={logoImage} alt={`${market.name} logo`} className="object-cover" /> : null}
          <AvatarFallback className="rounded-xl bg-muted">
            <Store className="size-5" />
          </AvatarFallback>
        </Avatar>
      </div>

      <div className={cn("flex flex-1 flex-col gap-2.5 px-4 pt-8 pb-4", !isOpen && "opacity-80")}>
        <div className="min-w-0">
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="truncate font-semibold">{market.name}</h3>
            <span className="shrink-0 font-mono text-[11px] text-muted-foreground">{market.code}</span>
          </div>
          <p className="mt-0.5 flex items-center gap-1 text-sm text-muted-foreground">
            <MapPin className="size-3.5 shrink-0" />
            <span className="truncate">{market.address || "Marketplace location"}</span>
          </p>
          {blurb ? <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{blurb}</p> : null}
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm">
          <span className="inline-flex items-center gap-1">
            <Star className="size-3.5 fill-warning text-warning" />
            <span className="font-medium tabular-nums">{reviewAverage ? reviewAverage.toFixed(1) : "New"}</span>
            {reviewCount ? <span className="text-muted-foreground tabular-nums">({reviewCount})</span> : null}
          </span>
          <StatusBadge tone={isOpen ? "success" : "destructive"} dot>
            {statusLabel}
          </StatusBadge>
          <span className="text-muted-foreground tabular-nums">
            {market.active_items_count ?? 0} items
          </span>
        </div>

        {isOpen && hoursLabel ? (
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="size-3.5 shrink-0" />
            <span className="truncate">{hoursLabel}</span>
          </p>
        ) : null}

        {previewItems.length > 0 ? (
          <div className="mt-auto flex items-center gap-2 border-t pt-3">
            {previewItems.map((item) => {
              const imageUrl = resolveMarketMediaUrl(item.image_url);
              const finalPrice = calcStorefrontPrice(item);
              const isDiscounted = Math.abs(finalPrice - Number(item.price)) > 0.01;

              return (
                <div key={item.id} className="flex min-w-0 flex-1 items-center gap-1.5" title={item.name}>
                  <div className="size-8 shrink-0 overflow-hidden rounded-md bg-muted">
                    {imageUrl ? (
                      <img src={imageUrl} alt={item.name} loading="lazy" className="size-full object-cover" />
                    ) : (
                      <div className="flex size-full items-center justify-center text-muted-foreground">
                        <Store className="size-3.5" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 leading-tight">
                    <div className="truncate text-[11px] text-muted-foreground">{item.name}</div>
                    <div className="truncate text-xs font-medium tabular-nums">
                      {formatMoney(finalPrice)}
                      {isDiscounted ? (
                        <span className="ml-1 font-normal text-muted-foreground line-through">{formatMoney(item.price)}</span>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
            {remainingItems > 0 ? (
              <span className="shrink-0 text-xs text-muted-foreground tabular-nums">+{remainingItems}</span>
            ) : null}
          </div>
        ) : (
          <p className="mt-auto border-t pt-3 text-xs text-muted-foreground">No preview items available.</p>
        )}
      </div>
    </Link>
  );
}

export function MarketCardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("overflow-hidden rounded-xl border bg-card shadow-sm", className)}>
      <Skeleton className="aspect-video w-full rounded-none" />
      <div className="space-y-2.5 px-4 pt-8 pb-4">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-3.5 w-1/2" />
        <div className="flex gap-2">
          <Skeleton className="h-5 w-12" />
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-5 w-14" />
        </div>
        <Skeleton className="h-8 w-full" />
      </div>
    </div>
  );
}
