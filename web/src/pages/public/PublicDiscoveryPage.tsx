import { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, BadgeCheck, Flame, MapPin, Package, Search, Sparkles, Star, Store, Tag } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Link, Navigate, useParams } from "react-router-dom";

import PublicAccountMenu from "@/components/PublicAccountMenu";
import ThemeToggle from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { formatMoney, toNumber } from "@/lib/format";
import { calcStorefrontPrice, formatMarketHours, formatPromoLabel, type StorefrontMarket } from "@/lib/storefront";

type DiscoveryCollection = "popular" | "combo" | "discounted" | "featured";

type DiscoveryItem = {
  id: number;
  market_id: number;
  market?: {
    id: number;
    name: string;
    code: string;
    is_active?: boolean;
    operating_status?: StorefrontMarket["operating_status"];
  } | null;
  name: string;
  sku: string;
  category?: string | null;
  image_url?: string | null;
  image_urls?: string[] | null;
  combo_offers?: Array<{ name: string; description?: string | null; combo_price: number | string }> | null;
  price: number | string;
  discount_type?: "none" | "percent" | "fixed";
  discount_value?: number | string;
  stock_qty: number;
  ordered_qty?: number;
  is_promoted?: boolean;
  review_summary?: { count?: number; average?: number | null };
};

type DiscoveryFeed = {
  popular: DiscoveryItem[];
  combo: DiscoveryItem[];
  discounted: DiscoveryItem[];
};

const collectionMeta: Record<DiscoveryCollection, { title: string; subtitle: string; description: string }> = {
  popular: {
    title: "Popular",
    subtitle: "Popular Items Right Now",
    description: "A filtered list of the popular discovery items from the main storefront.",
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
    description: "Promoted storefronts with premium placement.",
  },
};

function resolveMediaUrl(url?: string | null) {
  if (!url) return null;

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

function getDiscoveryItemImageUrl(item: DiscoveryItem) {
  const urls = [...(item.image_urls ?? [])];

  if (item.image_url) {
    urls.push(item.image_url);
  }

  return resolveMediaUrl(urls.find((url) => typeof url === "string" && url.length > 0));
}

function getMarketBannerUrl(market: StorefrontMarket) {
  return resolveMediaUrl(market.banner_url) ?? resolveMediaUrl(market.image_url) ?? resolveMediaUrl(market.logo_url);
}

function ItemCard({ item }: { item: DiscoveryItem }) {
  const imageUrl = getDiscoveryItemImageUrl(item);
  const basePrice = toNumber(item.price);
  const finalPrice = calcStorefrontPrice(item);
  const isDiscounted = Math.abs(basePrice - finalPrice) > 0.01;
  const comboCount = item.combo_offers?.length ?? 0;
  const reviewAverage = item.review_summary?.average ?? 0;
  const reviewCount = item.review_summary?.count ?? 0;
  const marketIsOpen = item.market?.operating_status?.is_open ?? item.market?.is_active ?? true;

  return (
    <article className="group flex min-h-[430px] flex-col overflow-hidden rounded-[1.8rem] border border-zinc-200 bg-white p-4 shadow-sm transition-all duration-300 hover:border-cyan-300/70 hover:shadow-xl dark:border-zinc-800 dark:bg-zinc-900">
      <div className="relative h-48 overflow-hidden rounded-[1.4rem] bg-zinc-100 dark:bg-zinc-800">
        {imageUrl ? (
          <img src={imageUrl} alt={item.name} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-zinc-400 dark:text-zinc-600">
            <Package className="h-8 w-8" />
          </div>
        )}

        <div className="absolute left-3 top-3 flex flex-wrap gap-2">
          {isDiscounted ? <span className="rounded-full bg-rose-500 px-3 py-1 text-[11px] font-semibold text-white">Deal</span> : null}
          {comboCount > 0 ? <span className="rounded-full bg-cyan-500 px-3 py-1 text-[11px] font-semibold text-white">{comboCount} combo{comboCount === 1 ? "" : "s"}</span> : null}
          {item.is_promoted ? <span className="rounded-full bg-slate-900 px-3 py-1 text-[11px] font-semibold text-white dark:bg-white dark:text-slate-950">Promoted</span> : null}
        </div>
      </div>

      <div className="mt-4 flex flex-1 flex-col gap-3">
        <div>
          <h2 className="line-clamp-2 text-xl font-semibold tracking-tight text-zinc-950 dark:text-white">{item.name}</h2>
          <div className="mt-1 line-clamp-1 text-sm text-zinc-500 dark:text-zinc-400">{item.market?.name ?? "Market item"}</div>
        </div>

        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-lg font-semibold text-emerald-600 dark:text-emerald-400">{formatMoney(finalPrice)}</div>
            {isDiscounted ? <div className="text-xs line-through text-zinc-400 dark:text-zinc-500">{formatMoney(basePrice)}</div> : null}
          </div>
          <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
            <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
            <span>{reviewCount ? reviewAverage.toFixed(1) : "New"}</span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">{item.category || "General"}</span>
          {item.ordered_qty ? <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">{item.ordered_qty} ordered</span> : null}
        </div>

        <Button asChild className={`mt-auto h-11 rounded-2xl text-sm font-semibold ${marketIsOpen ? "" : "bg-rose-600 hover:bg-rose-700"}`}>
          <Link to={`/m/${item.market_id}`}>
            {marketIsOpen ? "Open Market" : "View Menu - Closed"}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </div>
    </article>
  );
}

function MarketListCard({ market }: { market: StorefrontMarket }) {
  const heroImage = getMarketBannerUrl(market);
  const logoImage = resolveMediaUrl(market.logo_url);
  const reviewAverage = market.review_summary?.average ?? 0;
  const reviewCount = market.review_summary?.count ?? 0;
  const ratingLabel = reviewCount ? reviewAverage.toFixed(1) : "New";
  const featuredBadge = market.featured_badge || "Promoted";
  const operatingStatus = market.operating_status;
  const isOpen = operatingStatus?.is_open ?? market.is_active;
  const hoursLabel = formatMarketHours(market);

  return (
    <article className="group flex min-h-[520px] flex-col overflow-hidden rounded-[1.8rem] border border-zinc-200 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-cyan-300/70 hover:shadow-2xl dark:border-zinc-800 dark:bg-zinc-900">
      <div className="relative h-60 overflow-hidden bg-zinc-100 dark:bg-zinc-800">
        {heroImage ? (
          <img src={heroImage} alt={market.name} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-zinc-400 dark:text-zinc-600">
            <Store className="h-9 w-9" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-black/5" />

        <div className="absolute left-4 right-4 top-4 flex items-start justify-between gap-3">
          <span className="rounded-full border border-white/20 bg-white/15 px-3 py-1 text-xs font-semibold text-white backdrop-blur-md">
            {featuredBadge}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200/30 bg-black/35 px-3 py-1 text-xs font-semibold text-white backdrop-blur-md">
            <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
            {ratingLabel}
          </span>
        </div>

        <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            {logoImage ? (
              <img src={logoImage} alt={`${market.name} logo`} className="h-16 w-16 rounded-2xl border border-white/30 bg-white object-cover shadow-lg" />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/20 bg-white/15 text-white backdrop-blur-md">
                <Store className="h-7 w-7" />
              </div>
            )}
            <div className="min-w-0 text-white">
              <h2 className="line-clamp-1 text-2xl font-semibold tracking-tight">{market.name}</h2>
              <div className="mt-1 line-clamp-1 font-mono text-xs uppercase tracking-[0.18em] text-white/70">{market.code}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-1 flex-col p-5">
        <p className="line-clamp-2 min-h-[48px] text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
          {market.featured_headline || market.featured_copy || market.address || "Premium marketplace experience."}
        </p>

        {market.address ? (
          <div className="mt-4 flex items-start gap-2 rounded-2xl bg-zinc-50 px-4 py-3 text-sm text-zinc-600 dark:bg-zinc-950 dark:text-zinc-400">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-cyan-600 dark:text-cyan-400" />
            <span className="line-clamp-2">{market.address}</span>
          </div>
        ) : null}

        <div className="mt-5 grid grid-cols-3 gap-3 text-sm">
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-950">
            <div className="text-xs text-zinc-500 dark:text-zinc-400">Items</div>
            <div className="mt-1 font-semibold">{market.active_items_count ?? 0}</div>
          </div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-900/60 dark:bg-amber-950/30">
            <div className="text-xs text-zinc-500 dark:text-zinc-400">Rating</div>
            <div className="mt-1 inline-flex items-center gap-1.5 font-semibold text-zinc-950 dark:text-white">
              <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
              {ratingLabel}
            </div>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-950">
            <div className="text-xs text-zinc-500 dark:text-zinc-400">Status</div>
            <div className={`mt-1 font-semibold ${isOpen ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-300"}`}>
              {isOpen ? "Open" : "Closed"}
            </div>
          </div>
        </div>

        <div className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${
          isOpen
            ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300"
            : "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300"
        }`}>
          <div className="font-semibold">{operatingStatus?.label ?? (isOpen ? "Open now" : "Closed now")}</div>
          {hoursLabel ? <div className="mt-1 text-xs opacity-80">{hoursLabel}</div> : null}
        </div>

        {market.active_promo ? (
          <div className="mt-4 flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300">
            <Tag className="h-4 w-4" />
            {formatPromoLabel(market.active_promo)}
          </div>
        ) : null}

        <Button asChild className={`mt-auto h-12 w-full rounded-2xl text-sm font-semibold ${isOpen ? "" : "bg-rose-600 hover:bg-rose-700"}`}>
          <Link to={`/m/${market.id}`}>
            {isOpen ? "Open Market" : "View Menu - Closed"}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </div>
    </article>
  );
}

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
  const rawItems = isMarketCollection ? [] : discoveryQ.data?.[activeCollection] ?? [];
  const rawMarkets = marketsQ.data?.filter((market) => market.is_featured) ?? [];

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

  if (!hasValidCollection) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-50 via-white to-zinc-100/40 text-zinc-900 dark:from-zinc-950 dark:via-zinc-950 dark:to-zinc-900 dark:text-zinc-100">
      <nav className="sticky top-0 z-50 border-b border-zinc-200/80 bg-white/90 backdrop-blur-xl dark:border-zinc-800 dark:bg-zinc-950/90">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-cyan-600 shadow-lg">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <span className="text-2xl font-bold tracking-tighter">SMART_DISPATCH</span>
          </Link>

          <div className="flex items-center gap-3">
            <ThemeToggle />
            <PublicAccountMenu />
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-7xl px-4 pb-24 pt-8 sm:px-6 sm:pt-10">
        <div className="mb-8">
          <Button asChild variant="ghost" className="mb-6 rounded-2xl">
            <Link to="/">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to markets
            </Link>
          </Button>

          <div className="overflow-hidden rounded-[2rem] border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-3xl">
                <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[3px] text-cyan-600 dark:text-cyan-400">
                  {isMarketCollection ? <Flame className="h-4 w-4" /> : <BadgeCheck className="h-4 w-4" />}
                  {meta.title}
                </div>
                <h1 className="mt-3 text-4xl font-bold tracking-tighter text-zinc-950 dark:text-white sm:text-6xl">{meta.subtitle}</h1>
                <p className="mt-4 max-w-2xl text-base leading-relaxed text-zinc-600 dark:text-zinc-400">{meta.description}</p>
              </div>

              <div className="rounded-2xl bg-zinc-50 px-5 py-4 text-sm dark:bg-zinc-950">
                <div className="text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Showing</div>
                <div className="mt-1 text-3xl font-bold">{resultCount}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="mb-8 grid gap-4 lg:grid-cols-[1fr_auto]">
          <div className="rounded-[1.5rem] border border-zinc-200 bg-white/90 p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/90">
            <div className="relative">
              <Search className="absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-400" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={isMarketCollection ? "Filter markets by name, code, location..." : "Filter items by name, market, SKU, category..."}
                className="h-14 rounded-[1.2rem] border-0 bg-transparent pl-14 text-base shadow-none focus-visible:ring-0"
              />
            </div>
          </div>

          {!isMarketCollection ? (
            <select
              value={marketFilter}
              onChange={(e) => setMarketFilter(e.target.value)}
              className="h-20 rounded-[1.5rem] border border-zinc-200 bg-white px-5 text-sm font-medium text-zinc-800 shadow-sm outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 lg:min-w-[260px]"
            >
              <option value="all">All markets</option>
              {marketOptions.map((market) => (
                <option key={market.id} value={market.id}>
                  {market.name}
                </option>
              ))}
            </select>
          ) : null}
        </div>

        <div className="mb-8 flex flex-wrap gap-3">
          {(Object.keys(collectionMeta) as DiscoveryCollection[]).map((key) => (
            <Button key={key} asChild variant={key === activeCollection ? "default" : "outline"} className="rounded-2xl">
              <Link to={`/discover/${key}`}>{collectionMeta[key].subtitle}</Link>
            </Button>
          ))}
        </div>

        {loading ? (
          <div className="rounded-[2rem] border border-zinc-200 bg-white py-24 text-center text-zinc-600 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">Loading {meta.subtitle.toLowerCase()}...</div>
        ) : error ? (
          <div className="rounded-[2rem] border border-rose-200 bg-white py-24 text-center text-rose-500 shadow-sm dark:border-rose-900 dark:bg-zinc-900">Failed to load this list. Please try again.</div>
        ) : resultCount === 0 ? (
          <div className="rounded-[2rem] border border-dashed border-zinc-300 bg-white p-12 text-center text-zinc-500 shadow-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">No results match this filter.</div>
        ) : isMarketCollection ? (
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {filteredMarkets.map((market) => (
              <MarketListCard key={market.id} market={market} />
            ))}
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredItems.map((item) => (
              <ItemCard key={`${item.market_id}-${item.id}`} item={item} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
