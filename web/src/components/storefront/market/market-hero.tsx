import { Clock, Heart, MapPin, MessageSquare, Package, Store, Tag, Truck } from "lucide-react";

import { StatusBadge } from "@/components/app/status-badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { formatMoney, toNumber } from "@/lib/format";
import type { MarketPromo, StorefrontMarket } from "@/lib/storefront";
import { cn } from "@/lib/utils";

import { RatingInline } from "./market-ratings";
import { getMarketBannerUrl, initials, resolveMarketMediaUrl } from "./market-utils";

function formatDeliverySlot(slot: { label?: string; from?: string; to?: string } | string) {
  if (typeof slot === "string") return slot;
  if (slot.label) return slot.label;
  if (slot.from && slot.to) return `${slot.from} - ${slot.to}`;
  return slot.from ?? slot.to ?? "";
}

export function MarketHero({
  market,
  isOpen,
  hoursLabel,
  operatingHoursList,
  promo,
  itemCount,
  reviewSummary,
  onShowReviews,
  canFavorite,
  isFavorite,
  favoritePending,
  onToggleFavorite,
}: {
  market?: StorefrontMarket;
  isOpen: boolean;
  hoursLabel: string | null;
  operatingHoursList: string[];
  promo?: MarketPromo | null;
  itemCount: number;
  reviewSummary: { average: number; count: number };
  onShowReviews: () => void;
  canFavorite: boolean;
  isFavorite: boolean;
  favoritePending: boolean;
  onToggleFavorite: () => void;
}) {
  const bannerUrl = getMarketBannerUrl(market);
  const logoUrl = resolveMarketMediaUrl(market?.logo_url);
  const statusLabel = market?.operating_status?.label ?? (isOpen ? "Open now" : "Closed now");
  const deliverySlots = (market?.delivery_slots ?? []).map(formatDeliverySlot).filter(Boolean);
  const headline = market?.featured_headline;
  const copy = market?.featured_copy;

  return (
    <section className="space-y-4">
      <div className="relative">
        <div className="h-40 w-full overflow-hidden rounded-xl bg-muted md:h-56">
          {bannerUrl ? (
            <img src={bannerUrl} alt={market?.name ?? "Market"} className="size-full object-cover" />
          ) : (
            <div className="flex size-full items-center justify-center text-muted-foreground/50">
              <Store className="size-12" />
            </div>
          )}
        </div>
        <Avatar className="absolute -bottom-8 left-4 size-16 rounded-xl border-4 border-background bg-card shadow-sm md:left-6 md:size-20">
          {logoUrl ? <AvatarImage src={logoUrl} alt={`${market?.name ?? "Market"} logo`} className="object-cover" /> : null}
          <AvatarFallback className="rounded-lg bg-primary/10 text-lg font-semibold text-primary">
            {initials(market?.name)}
          </AvatarFallback>
        </Avatar>
      </div>

      <div className="flex flex-col gap-4 pt-8 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="min-w-0 break-words text-2xl font-semibold tracking-tight md:text-3xl">{market?.name}</h1>
            {market?.featured_badge ? (
              <Badge variant="secondary" className={cn(market.featured_theme?.shape === "soft" && "rounded-md")}>
                {market.featured_badge}
              </Badge>
            ) : null}
          </div>
          {headline ? <p className="text-base font-medium">{headline}</p> : null}
          {copy ? <p className="max-w-2xl text-sm text-muted-foreground">{copy}</p> : null}
          {market?.code ? <p className="font-mono text-xs text-muted-foreground">Market code {market.code}</p> : null}
        </div>

        <div className="flex shrink-0 flex-wrap gap-2">
          <Button variant="outline" onClick={onShowReviews}>
            <MessageSquare />
            Reviews
          </Button>
          {canFavorite ? (
            <Button
              variant="outline"
              onClick={onToggleFavorite}
              disabled={favoritePending}
              aria-pressed={isFavorite}
            >
              <Heart className={cn(isFavorite && "fill-destructive text-destructive")} />
              {isFavorite ? "Saved" : "Save market"}
            </Button>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        <button
          type="button"
          onClick={onShowReviews}
          className="inline-flex items-center gap-1 rounded-sm hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <RatingInline value={reviewSummary.average} count={reviewSummary.count} />
          <span className="text-muted-foreground">{reviewSummary.count === 1 ? "review" : "reviews"}</span>
        </button>

        <div className="flex items-center gap-2">
          <StatusBadge tone={isOpen ? "success" : "destructive"} dot>
            {statusLabel}
          </StatusBadge>
          {hoursLabel ? <span className="text-muted-foreground">{hoursLabel}</span> : null}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="link" size="sm" className="h-auto px-0">
                <Clock />
                See hours
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-64">
              <div className="mb-2 text-sm font-semibold">Opening hours</div>
              <ul className="space-y-1 text-sm">
                {operatingHoursList.map((entry) => {
                  const [day, ...rest] = entry.split(" ");
                  return (
                    <li key={entry} className="flex justify-between gap-4 tabular-nums">
                      <span className="font-medium">{day}</span>
                      <span className="text-muted-foreground">{rest.join(" ") || entry}</span>
                    </li>
                  );
                })}
              </ul>
            </PopoverContent>
          </Popover>
        </div>

        {market?.address ? (
          <span className="flex min-w-0 items-center gap-1.5 text-muted-foreground">
            <MapPin className="size-4 shrink-0" />
            <span className="truncate">{market.address}</span>
          </span>
        ) : null}

        <span className="flex items-center gap-1.5 text-muted-foreground">
          <Package className="size-4" />
          <span className="tabular-nums">{itemCount}</span> products
        </span>

        {deliverySlots.length > 0 ? (
          <span className="flex min-w-0 items-center gap-1.5 text-muted-foreground">
            <Truck className="size-4 shrink-0" />
            <span className="truncate">Delivery: {deliverySlots.join(", ")}</span>
          </span>
        ) : null}

        {promo ? (
          <Badge variant="outline" className="gap-1 border-primary/30 bg-primary/10 text-primary">
            <Tag />
            {promo.code} · {promo.type === "percent" ? `${toNumber(promo.value)}% off` : `${formatMoney(promo.value)} off`}
          </Badge>
        ) : null}
      </div>

      {market && !isOpen ? (
        <Alert variant="destructive">
          <Clock />
          <AlertTitle>{statusLabel} · ordering is unavailable</AlertTitle>
          <AlertDescription>
            {hoursLabel
              ? `You can browse the menu, but items can't be added to the cart right now. ${hoursLabel.replace(/\.$/, "")}.`
              : "You can browse the menu, but items can't be added to the cart until the market opens again."}
          </AlertDescription>
        </Alert>
      ) : null}
    </section>
  );
}

export function MarketHeroSkeleton() {
  return (
    <div className="space-y-4">
      <div className="relative">
        <Skeleton className="h-40 w-full rounded-xl md:h-56" />
        <Skeleton className="absolute -bottom-8 left-4 size-16 rounded-xl border-4 border-background md:left-6 md:size-20" />
      </div>
      <div className="space-y-2 pt-8">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <div className="flex flex-wrap gap-3">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-5 w-40" />
      </div>
    </div>
  );
}
