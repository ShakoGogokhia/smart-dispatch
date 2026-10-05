import { useMemo, useState } from "react";
import { AlertCircle, ArrowRight, MapPin, Package, Search, ShoppingBasket, Store, Truck, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { EmptyState } from "@/components/app/empty-state";
import { StorefrontHeader } from "@/components/app/storefront-header";
import { isMarketOpen, type DiscoveryFeed } from "@/components/storefront/home/home-media";
import { MarketCard, MarketCardSkeleton } from "@/components/storefront/home/market-card";
import { ProductCard, ProductCardSkeleton } from "@/components/storefront/home/product-card";
import { ScrollRail, SectionHeader } from "@/components/storefront/home/section-header";
import { StorefrontFooter } from "@/components/storefront/home/storefront-footer";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { api } from "@/lib/api";
import { auth } from "@/lib/auth";
import { getDefaultAuthedPath } from "@/lib/session";
import type { StorefrontMarket } from "@/lib/storefront";
import { useMe } from "@/lib/useMe";
import { cn } from "@/lib/utils";

type QuickFilter = "all" | "open" | "featured" | "deals";

const QUICK_FILTERS: Array<{ value: QuickFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "open", label: "Open now" },
  { value: "featured", label: "Featured" },
  { value: "deals", label: "Has deals" },
];

const HOW_IT_WORKS = [
  { icon: Store, title: "Choose a market", description: "Browse local markets and see what's open right now." },
  { icon: ShoppingBasket, title: "Add items", description: "Fill your cart, apply deals and check out in a minute." },
  { icon: Truck, title: "Track delivery live", description: "Follow your order from the market to your door." },
];

const MARKET_CARD_RAIL_CLASS = "w-[17rem] shrink-0 snap-start sm:w-[19rem]";
const PRODUCT_CARD_RAIL_CLASS = "w-40 shrink-0 snap-start sm:w-48";

function marketHasDeals(market: StorefrontMarket) {
  if (market.active_promo) return true;
  return (market.item_preview ?? []).some((item) => item.discount_type && item.discount_type !== "none" && Number(item.discount_value ?? 0) > 0);
}

function SearchField({
  value,
  onChange,
  size = "default",
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  size?: "default" | "lg";
  className?: string;
}) {
  const large = size === "lg";

  return (
    <div className={cn("relative", className)}>
      <Search className={cn("pointer-events-none absolute top-1/2 -translate-y-1/2 text-muted-foreground", large ? "left-4 size-5" : "left-3 size-4")} />
      <Input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={large ? "Search markets by name, code, location, headline..." : "Search markets..."}
        aria-label="Search markets"
        className={cn(large ? "h-12 rounded-lg bg-background pr-10 pl-12 text-base shadow-sm" : "h-9 pl-9")}
      />
      {large && value ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Clear search"
          className="absolute top-1/2 right-2 -translate-y-1/2"
          onClick={() => onChange("")}
        >
          <X />
        </Button>
      ) : null}
    </div>
  );
}

function HeroStat({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="text-lg font-semibold tabular-nums">{value}</span>
      <span className="text-sm text-muted-foreground">{label}</span>
    </div>
  );
}

export default function PublicMarketsPage() {
  const [search, setSearch] = useState("");
  const [quickFilter, setQuickFilter] = useState<QuickFilter>("all");
  const token = auth.getToken();
  const meQ = useMe({ enabled: !!token });

  const marketsQ = useQuery({
    queryKey: ["public-markets"],
    queryFn: async () => (await api.get("/api/public/markets")).data as StorefrontMarket[],
  });

  const discoveryQ = useQuery({
    queryKey: ["public-discovery-items"],
    queryFn: async () => (await api.get("/api/public/discovery-items")).data as DiscoveryFeed,
  });

  const allMarkets = useMemo(() => marketsQ.data ?? [], [marketsQ.data]);
  const query = search.trim().toLowerCase();

  const searchedMarkets = useMemo(() => {
    if (!query) return allMarkets;

    return allMarkets.filter((market) =>
      [
        market.name,
        market.code,
        market.address,
        market.featured_badge,
        market.featured_headline,
        market.featured_copy,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [allMarkets, query]);

  const filteredMarkets = useMemo(() => {
    switch (quickFilter) {
      case "open":
        return searchedMarkets.filter(isMarketOpen);
      case "featured":
        return searchedMarkets.filter((market) => market.is_featured);
      case "deals":
        return searchedMarkets.filter(marketHasDeals);
      default:
        return searchedMarkets;
    }
  }, [quickFilter, searchedMarkets]);

  const promotedMarkets = filteredMarkets.filter((market) => market.is_featured);
  const promotedMarketIds = new Set(promotedMarkets.map((market) => market.id));
  const regularMarkets = filteredMarkets.filter((market) => !promotedMarketIds.has(market.id));
  const showFeaturedAsGrid = quickFilter === "featured";
  const gridMarkets = showFeaturedAsGrid ? promotedMarkets : regularMarkets;

  const authedPath = getDefaultAuthedPath(meQ.data?.roles);

  const totalMarkets = allMarkets.length;
  const totalOpen = allMarkets.filter(isMarketOpen).length;
  const totalItems = allMarkets.reduce((sum, market) => sum + Number(market.active_items_count ?? 0), 0);

  const hasMarkets = filteredMarkets.length > 0;
  const discoveryFeed = discoveryQ.data;
  const isFiltering = !!query || quickFilter !== "all";

  const clearFilters = () => {
    setSearch("");
    setQuickFilter("all");
  };

  const productRail = (title: string, description: string, items: DiscoveryFeed["popular"] | undefined, href: string) =>
    items && items.length > 0 ? (
      <ScrollRail title={title} description={description} href={href}>
        {items.map((item) => (
          <ProductCard key={`${item.market_id}-${item.id}`} item={item} className={PRODUCT_CARD_RAIL_CLASS} />
        ))}
      </ScrollRail>
    ) : null;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <StorefrontHeader
        center={<SearchField value={search} onChange={setSearch} className="mx-auto hidden max-w-sm md:block" />}
      />

      <main className="mx-auto w-full max-w-7xl flex-1 space-y-10 px-4 py-6 sm:px-6 md:py-8">
        {/* Hero */}
        <section className="rounded-xl border bg-primary/5 px-5 py-8 sm:px-8 md:py-12">
          <div className="max-w-2xl space-y-5">
            <div className="space-y-2">
              {meQ.data ? (
                <p className="text-sm font-medium text-primary">Hi, {meQ.data.name.split(" ")[0]}</p>
              ) : null}
              <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
                Order from local markets, delivered fast
              </h1>
              <p className="text-base text-muted-foreground">
                Find a market near you, add what you need, and track your delivery live.
              </p>
            </div>

            <SearchField value={search} onChange={setSearch} size="lg" />

            <div className="flex flex-wrap gap-x-6 gap-y-2">
              <HeroStat value={totalMarkets} label="live markets" />
              <HeroStat value={totalItems} label="items" />
              <HeroStat value={totalOpen} label="open now" />
            </div>

            <div className="flex flex-wrap gap-2">
              <Button asChild>
                <a href="#markets">
                  Browse markets
                  <ArrowRight />
                </a>
              </Button>
              <Button asChild variant="outline">
                <Link to="/track">
                  <MapPin />
                  Track an order
                </Link>
              </Button>
              <Button asChild variant="ghost">
                <Link to={meQ.data ? authedPath : "/login"}>
                  {meQ.data ? "Continue workspace" : "Join workspace"}
                </Link>
              </Button>
            </div>
          </div>
        </section>

        {/* Markets */}
        <section id="markets" className="scroll-mt-20 space-y-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <ToggleGroup
              type="single"
              variant="outline"
              size="sm"
              spacing={2}
              value={quickFilter}
              onValueChange={(value) => setQuickFilter((value || "all") as QuickFilter)}
              aria-label="Filter markets"
              className="flex-wrap"
            >
              {QUICK_FILTERS.map((filter) => (
                <ToggleGroupItem
                  key={filter.value}
                  value={filter.value}
                  className="rounded-full px-3.5 data-[state=on]:border-primary data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
                >
                  {filter.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
            {marketsQ.isSuccess ? (
              <p className="text-sm text-muted-foreground tabular-nums">
                {filteredMarkets.length} of {totalMarkets} markets
              </p>
            ) : null}
          </div>

          {marketsQ.isLoading ? (
            <div className="space-y-4">
              <SectionHeader title="All markets" description="Loading markets..." />
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {Array.from({ length: 8 }).map((_, index) => (
                  <MarketCardSkeleton key={index} />
                ))}
              </div>
            </div>
          ) : marketsQ.isError ? (
            <Alert variant="destructive">
              <AlertCircle />
              <AlertTitle>Couldn't load markets</AlertTitle>
              <AlertDescription>
                <p>Failed to load markets. Please try again.</p>
                <Button variant="outline" size="sm" className="mt-1" onClick={() => marketsQ.refetch()}>
                  Try again
                </Button>
              </AlertDescription>
            </Alert>
          ) : !hasMarkets ? (
            <EmptyState
              icon={Search}
              title="No markets found"
              description={
                isFiltering
                  ? "Nothing matches your search or filter. Try a different term or show all markets."
                  : "There are no live markets right now. Please check back soon."
              }
              action={
                isFiltering ? (
                  <Button variant="outline" onClick={clearFilters}>
                    Clear search
                  </Button>
                ) : null
              }
            />
          ) : (
            <>
              {!showFeaturedAsGrid && promotedMarkets.length > 0 ? (
                <ScrollRail
                  title="Featured markets"
                  description={`${promotedMarkets.length} highlighted market${promotedMarkets.length === 1 ? "" : "s"} with special offers and picks.`}
                  href="/discover/featured"
                  autoScrollMs={5500}
                >
                  {promotedMarkets.map((market) => (
                    <MarketCard key={market.id} market={market} className={MARKET_CARD_RAIL_CLASS} />
                  ))}
                </ScrollRail>
              ) : null}

              {gridMarkets.length > 0 ? (
                <div className="space-y-4">
                  <SectionHeader
                    title={showFeaturedAsGrid ? "Featured markets" : "All markets"}
                    description={
                      showFeaturedAsGrid
                        ? "Highlighted markets with special offers and picks."
                        : "Every live market. Tap a card to see its menu."
                    }
                    href={showFeaturedAsGrid ? "/discover/featured" : undefined}
                  />
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {gridMarkets.map((market) => (
                      <MarketCard key={market.id} market={market} />
                    ))}
                  </div>
                </div>
              ) : null}
            </>
          )}
        </section>

        {/* Product rails */}
        {discoveryQ.isLoading ? (
          <section className="space-y-4">
            <SectionHeader title="Popular right now" description="Loading items..." />
            <div className="scrollbar-hide flex gap-4 overflow-hidden">
              {Array.from({ length: 6 }).map((_, index) => (
                <ProductCardSkeleton key={index} className={PRODUCT_CARD_RAIL_CLASS} />
              ))}
            </div>
          </section>
        ) : discoveryQ.isSuccess ? (
          <>
            {productRail(
              "Popular right now",
              "Top items by recent orders. Without order history yet, these are random live picks.",
              discoveryFeed?.popular,
              "/discover/popular",
            )}
            {productRail("Deals", "Discounted items across all markets.", discoveryFeed?.discounted, "/discover/discounted")}
            {productRail("Combo picks", "Items with combo offers set up by their market.", discoveryFeed?.combo, "/discover/combo")}
          </>
        ) : null}

        {/* How it works */}
        <section className="space-y-4">
          <SectionHeader title="How it works" />
          <ol className="grid gap-4 sm:grid-cols-3">
            {HOW_IT_WORKS.map((step, index) => (
              <li key={step.title} className="flex items-start gap-3 rounded-xl border bg-card p-4 shadow-sm">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <step.icon className="size-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold">
                    <span className="mr-1.5 text-muted-foreground tabular-nums">{index + 1}.</span>
                    {step.title}
                  </p>
                  <p className="mt-0.5 text-sm text-muted-foreground">{step.description}</p>
                </div>
              </li>
            ))}
          </ol>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Package className="size-4" />
            <span>
              Already ordered?{" "}
              <Link to="/track" className="font-medium text-primary hover:underline">
                Track your order
              </Link>
            </span>
          </div>
        </section>
      </main>

      <StorefrontFooter />
    </div>
  );
}
