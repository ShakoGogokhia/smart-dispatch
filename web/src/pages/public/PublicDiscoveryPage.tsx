import { useMemo, useState } from "react";
import { AlertCircle, ArrowLeft, Search, SearchX } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Link, Navigate, useParams } from "react-router-dom";

import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { StorefrontHeader } from "@/components/app/storefront-header";
import type { DiscoveryFeed } from "@/components/storefront/home/home-media";
import { MarketCard, MarketCardSkeleton } from "@/components/storefront/home/market-card";
import { ProductCard, ProductCardSkeleton } from "@/components/storefront/home/product-card";
import { StorefrontFooter } from "@/components/storefront/home/storefront-footer";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api } from "@/lib/api";
import type { StorefrontMarket } from "@/lib/storefront";

type DiscoveryCollection = "popular" | "combo" | "discounted" | "featured";

const collectionMeta: Record<DiscoveryCollection, { title: string; subtitle: string; description: string }> = {
  popular: {
    title: "Popular",
    subtitle: "Popular Items Right Now",
    description: "The most ordered items across all markets right now.",
  },
  combo: {
    title: "Combos",
    subtitle: "Combo Picks",
    description: "Items with combo offers already configured by their markets.",
  },
  discounted: {
    title: "Deals",
    subtitle: "Discounted Items",
    description: "Live discounted items across public markets.",
  },
  featured: {
    title: "Featured",
    subtitle: "Promoted Markets",
    description: "Highlighted markets with special offers and picks.",
  },
};

const ITEM_GRID_CLASS = "grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5";
const MARKET_GRID_CLASS = "grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";

export default function PublicDiscoveryPage() {
  const { collection } = useParams();
  const selectedCollection = collection as DiscoveryCollection | undefined;
  const hasValidCollection = !!selectedCollection && selectedCollection in collectionMeta;
  const activeCollection: DiscoveryCollection = hasValidCollection ? selectedCollection : "popular";
  const [search, setSearch] = useState("");
  const [marketFilter, setMarketFilter] = useState("all");

  const marketsQ = useQuery({
    queryKey: ["public-markets"],
    queryFn: async () => (await api.get("/api/public/markets")).data as StorefrontMarket[],
  });

  const discoveryQ = useQuery({
    queryKey: ["public-discovery-items"],
    queryFn: async () => (await api.get("/api/public/discovery-items")).data as DiscoveryFeed,
  });

  const meta = collectionMeta[activeCollection];
  const query = search.trim().toLowerCase();
  const isMarketCollection = activeCollection === "featured";
  const rawItems = useMemo(
    () => (isMarketCollection ? [] : discoveryQ.data?.[activeCollection] ?? []),
    [activeCollection, discoveryQ.data, isMarketCollection],
  );
  const rawMarkets = useMemo(() => marketsQ.data?.filter((market) => market.is_featured) ?? [], [marketsQ.data]);

  const marketOptions = useMemo(() => {
    const options = new Map<number, string>();
    rawItems.forEach((item) => {
      if (item.market?.id && item.market.name) {
        options.set(item.market.id, item.market.name);
      }
    });
    return Array.from(options, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [rawItems]);

  const filteredItems = useMemo(() => {
    return rawItems.filter((item) => {
      const matchesMarket = marketFilter === "all" || String(item.market_id) === marketFilter;
      const matchesSearch =
        !query ||
        [item.name, item.sku, item.category, item.market?.name, item.market?.code]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(query);

      return matchesMarket && matchesSearch;
    });
  }, [marketFilter, query, rawItems]);

  const filteredMarkets = useMemo(() => {
    return rawMarkets.filter((market) => {
      if (!query) return true;

      return [market.name, market.code, market.address, market.featured_badge, market.featured_headline, market.featured_copy]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [query, rawMarkets]);

  const loading = marketsQ.isLoading || (!isMarketCollection && discoveryQ.isLoading);
  const error = marketsQ.isError || (!isMarketCollection && discoveryQ.isError);
  const resultCount = isMarketCollection ? filteredMarkets.length : filteredItems.length;
  const isFiltering = !!query || marketFilter !== "all";

  if (!hasValidCollection) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <StorefrontHeader />

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 md:py-8">
        <PageHeader
          title={meta.subtitle}
          description={meta.description}
          breadcrumbs={[{ label: "Markets", to: "/" }, { label: meta.title }]}
          actions={
            <>
              {!loading && !error ? (
                <Badge variant="secondary" className="tabular-nums">
                  Showing {resultCount}
                </Badge>
              ) : null}
              <Button asChild variant="ghost" size="sm">
                <Link to="/">
                  <ArrowLeft />
                  Back to markets
                </Link>
              </Button>
            </>
          }
        >
          <nav aria-label="Collections" className="scrollbar-hide -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
            {(Object.keys(collectionMeta) as DiscoveryCollection[]).map((key) => (
              <Button
                key={key}
                asChild
                size="sm"
                variant={key === activeCollection ? "default" : "outline"}
                className="shrink-0 rounded-full"
              >
                <Link to={`/discover/${key}`} aria-current={key === activeCollection ? "page" : undefined}>
                  {collectionMeta[key].subtitle}
                </Link>
              </Button>
            ))}
          </nav>

          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={isMarketCollection ? "Filter markets by name, code, location..." : "Filter items by name, market, SKU, category..."}
                aria-label={isMarketCollection ? "Filter markets" : "Filter items"}
                className="pl-9"
              />
            </div>

            {!isMarketCollection ? (
              <Select value={marketFilter} onValueChange={setMarketFilter}>
                <SelectTrigger className="w-full sm:w-60" aria-label="Filter by market">
                  <SelectValue placeholder="All markets" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All markets</SelectItem>
                  {marketOptions.map((market) => (
                    <SelectItem key={market.id} value={String(market.id)}>
                      {market.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
          </div>
        </PageHeader>

        {loading ? (
          <div className={isMarketCollection ? MARKET_GRID_CLASS : ITEM_GRID_CLASS} aria-label={`Loading ${meta.subtitle.toLowerCase()}`}>
            {Array.from({ length: 8 }).map((_, index) =>
              isMarketCollection ? <MarketCardSkeleton key={index} /> : <ProductCardSkeleton key={index} />,
            )}
          </div>
        ) : error ? (
          <Alert variant="destructive">
            <AlertCircle />
            <AlertTitle>Couldn't load this list</AlertTitle>
            <AlertDescription>
              <p>Failed to load this list. Please try again.</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-1"
                onClick={() => {
                  void marketsQ.refetch();
                  if (!isMarketCollection) void discoveryQ.refetch();
                }}
              >
                Try again
              </Button>
            </AlertDescription>
          </Alert>
        ) : resultCount === 0 ? (
          <EmptyState
            icon={SearchX}
            title="No results match this filter"
            description={isFiltering ? "Try a different search term or pick another market." : "Nothing is listed here yet. Check back soon."}
            action={
              isFiltering ? (
                <Button
                  variant="outline"
                  onClick={() => {
                    setSearch("");
                    setMarketFilter("all");
                  }}
                >
                  Clear filters
                </Button>
              ) : (
                <Button asChild variant="outline">
                  <Link to="/">Browse markets</Link>
                </Button>
              )
            }
          />
        ) : isMarketCollection ? (
          <div className={MARKET_GRID_CLASS}>
            {filteredMarkets.map((market) => (
              <MarketCard key={market.id} market={market} />
            ))}
          </div>
        ) : (
          <div className={ITEM_GRID_CLASS}>
            {filteredItems.map((item) => (
              <ProductCard key={`${item.market_id}-${item.id}`} item={item} />
            ))}
          </div>
        )}
      </main>

      <StorefrontFooter />
    </div>
  );
}
