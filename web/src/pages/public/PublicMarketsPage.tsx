import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Megaphone,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  Store,
  Ticket,
  Users,
  BadgeCheck,
  Flame,
  Grid2x2,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import ThemeToggle from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { auth } from "@/lib/auth";
import { formatMoney } from "@/lib/format";
import { getDefaultAuthedPath } from "@/lib/session";
import {
  calcStorefrontPrice,
  formatPromoLabel,
  type StorefrontMarket,
} from "@/lib/storefront";
import { useMe } from "@/lib/useMe";

type RailProps = {
  title: string;
  subtitle: string;
  description?: string;
  markets: StorefrontMarket[];
  autoScrollMs?: number;
};

function getBadgeTheme(badge?: string | null) {
  const value = (badge ?? "").trim().toLowerCase();

  if (value.includes("vip")) {
    return "bg-amber-300 text-black border border-amber-200 shadow-sm";
  }

  if (value.includes("new")) {
    return "bg-cyan-50 text-cyan-700 border border-cyan-200 dark:bg-cyan-950/40 dark:text-cyan-300 dark:border-cyan-800";
  }

  if (value.includes("staff")) {
    return "bg-violet-50 text-violet-700 border border-violet-200 dark:bg-violet-950/40 dark:text-violet-300 dark:border-violet-800";
  }

  return "bg-white/85 text-zinc-800 border border-white/70 dark:bg-zinc-900/85 dark:text-zinc-200 dark:border-zinc-700";
}

function MarketCard({ market }: { market: StorefrontMarket }) {
  const previewItems = (market.item_preview ?? []).slice(0, 3);
  const reviewAverage = market.review_summary?.average ?? 0;
  const reviewCount = market.review_summary?.count ?? 0;

  return (
    <article className="group min-w-[330px] sm:min-w-[370px] lg:min-w-[390px] h-[620px] flex-shrink-0 snap-start rounded-[2rem] overflow-hidden border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-cyan-300/70 dark:hover:border-cyan-700 hover:shadow-[0_25px_80px_rgba(0,0,0,0.12)] transition-all duration-500 flex flex-col">
      <div className="relative h-[270px] overflow-hidden">
        {market.image_url ? (
          <img
            src={market.image_url}
            alt={market.name}
            className="w-full h-full object-cover group-hover:scale-[1.06] transition-transform duration-700"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-zinc-950 via-zinc-900 to-black" />
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-black/10" />
        <div className="absolute top-0 inset-x-0 h-1.5 bg-cyan-500" />

        <div className="absolute top-5 left-5 right-5 flex items-start justify-between gap-3">
          <div className="flex flex-col gap-2">
            <span className="w-fit font-mono text-xs sm:text-sm tracking-widest text-white/80 bg-black/20 backdrop-blur-md rounded-full px-3 py-1.5 border border-white/10">
              {market.code}
            </span>

            {market.is_featured ? (
              <span className="w-fit px-3 py-1 rounded-full text-xs font-medium bg-cyan-400/15 text-cyan-100 border border-cyan-300/20 backdrop-blur-md">
                Featured
              </span>
            ) : null}
          </div>

          {market.featured_badge ? (
            <span
              className={`px-3.5 py-1.5 rounded-2xl text-xs font-semibold backdrop-blur-md ${getBadgeTheme(
                market.featured_badge
              )}`}
            >
              {market.featured_badge}
            </span>
          ) : null}
        </div>

        <div className="absolute bottom-5 left-5 right-5">
          <h3 className="text-2xl sm:text-3xl font-semibold tracking-tight text-white leading-none">
            {market.name}
          </h3>

          <div className="mt-3 flex items-center gap-2 text-sm text-white/80">
            <MapPin className="h-4 w-4" />
            <span className="line-clamp-1">
              {market.address || "Marketplace location"}
            </span>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col p-6 sm:p-7">
        <p className="text-[15px] leading-relaxed text-zinc-600 dark:text-zinc-400 line-clamp-3 min-h-[72px]">
          {market.featured_headline ||
            market.featured_copy ||
            market.address ||
            "Premium marketplace experience."}
        </p>

        <div className="mt-5 flex flex-wrap gap-2">
          {market.active_promo ? (
            <span className="px-3.5 py-1.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
              {formatPromoLabel(market.active_promo)}
            </span>
          ) : null}

          <span className="px-3.5 py-1.5 rounded-full text-xs font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
            {market.active_items_count ?? 0} items
          </span>

          <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
            <Star className="h-3.5 w-3.5 text-amber-400 fill-amber-400" />
            {reviewAverage ? reviewAverage.toFixed(1) : "New"}
            {reviewCount ? ` (${reviewCount})` : ""}
          </span>
        </div>

        <div className="mt-6 rounded-[1.5rem] border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Preview Items
            </div>
            <Grid2x2 className="h-4 w-4 text-zinc-400" />
          </div>

          <div className="space-y-3">
            {previewItems.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between gap-3 text-sm"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="h-10 w-10 overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-800">
                    {item.image_url ? (
                      <img src={item.image_url} alt={item.name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-zinc-400 dark:text-zinc-600">
                        <Store className="h-4 w-4" />
                      </div>
                    )}
                  </div>
                  <span className="font-medium text-zinc-800 dark:text-zinc-200 line-clamp-1">
                    {item.name}
                  </span>
                </div>
                <span className="font-semibold whitespace-nowrap text-emerald-600 dark:text-emerald-400">
                  {formatMoney(calcStorefrontPrice(item))}
                </span>
              </div>
            ))}

            {previewItems.length === 0 ? (
              <div className="text-sm text-zinc-500 dark:text-zinc-400">
                No preview items available.
              </div>
            ) : null}
          </div>
        </div>

        <div className="mt-auto pt-6">
          <Button asChild className="w-full h-14 rounded-2xl text-base font-semibold">
            <Link to={`/m/${market.id}`}>
              Open Market
              <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </Button>
        </div>
      </div>
    </article>
  );
}

function MarketRail({
  title,
  subtitle,
  description,
  markets,
  autoScrollMs = 7000,
}: RailProps) {
  const railRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!railRef.current || markets.length <= 1) return;

    const element = railRef.current;

    const interval = setInterval(() => {
      const nextLeft = element.scrollLeft + 404;
      const maxLeft = element.scrollWidth - element.clientWidth;

      element.scrollTo({
        left: nextLeft >= maxLeft ? 0 : nextLeft,
        behavior: "smooth",
      });
    }, autoScrollMs);

    return () => clearInterval(interval);
  }, [autoScrollMs, markets.length]);

  const scrollBy = (direction: "left" | "right") => {
    railRef.current?.scrollBy({
      left: direction === "left" ? -404 : 404,
      behavior: "smooth",
    });
  };

  if (markets.length === 0) return null;

  return (
    <section className="py-12 sm:py-14">
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 mb-8">
        <div className="max-w-2xl">
          <div className="uppercase text-xs tracking-[3px] font-medium text-cyan-600 dark:text-cyan-400">
            {title}
          </div>
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-tighter mt-2 text-zinc-900 dark:text-white">
            {subtitle}
          </h2>
          {description ? (
            <p className="mt-3 text-zinc-600 dark:text-zinc-400 leading-relaxed">
              {description}
            </p>
          ) : null}
        </div>

        <div className="flex gap-3">
          <Button
            variant="outline"
            size="icon"
            className="h-12 w-12 rounded-2xl border-zinc-300 dark:border-zinc-700 bg-white/90 dark:bg-zinc-900/90"
            onClick={() => scrollBy("left")}
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>

          <Button
            variant="outline"
            size="icon"
            className="h-12 w-12 rounded-2xl border-zinc-300 dark:border-zinc-700 bg-white/90 dark:bg-zinc-900/90"
            onClick={() => scrollBy("right")}
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>
      </div>

      <div
        ref={railRef}
        className="flex gap-6 sm:gap-8 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-hide"
      >
        {markets.map((market) => (
          <MarketCard key={market.id} market={market} />
        ))}
      </div>
    </section>
  );
}

function StatsCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number | string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="rounded-[2rem] border border-zinc-200 dark:border-zinc-800 bg-white/90 dark:bg-zinc-900/90 backdrop-blur p-5 sm:p-6 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2">
            {label}
          </div>
          <div className="text-3xl font-bold tracking-tight">{value}</div>
        </div>
        <div className="w-12 h-12 rounded-2xl bg-cyan-50 dark:bg-cyan-950/40 flex items-center justify-center">
          <Icon className="h-6 w-6 text-cyan-600 dark:text-cyan-400" />
        </div>
      </div>
    </div>
  );
}

export default function PublicMarketsPage() {
  const [search, setSearch] = useState("");
  const token = auth.getToken();
  const meQ = useMe({ enabled: !!token });

  const marketsQ = useQuery({
    queryKey: ["public-markets"],
    queryFn: async () => (await api.get("/api/public/markets")).data as StorefrontMarket[],
  });

  const allMarkets = marketsQ.data ?? [];
  const query = search.trim().toLowerCase();

  const filteredMarkets = useMemo(() => {
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

  const promotedMarkets = filteredMarkets.filter((m) => m.is_featured);
  const regularMarkets = filteredMarkets.filter((m) => !m.is_featured);

  const authedPath = getDefaultAuthedPath(meQ.data?.roles);

  const totalMarkets = filteredMarkets.length;
  const totalFeatured = promotedMarkets.length;
  const totalItems = filteredMarkets.reduce(
    (sum, market) => sum + Number(market.active_items_count ?? 0),
    0
  );

  const hasMarkets = filteredMarkets.length > 0;

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-50 via-white to-zinc-100/40 dark:from-zinc-950 dark:via-zinc-950 dark:to-zinc-900 text-zinc-900 dark:text-zinc-100">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 border-b border-zinc-200/80 dark:border-zinc-800 bg-white/90 dark:bg-zinc-950/90 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-20 flex items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-cyan-600 flex items-center justify-center shadow-lg">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <span className="font-bold text-2xl tracking-tighter">SMART_DISPATCH</span>
          </Link>

          <div className="flex items-center gap-4 sm:gap-6">
            {meQ.data ? (
              <span className="hidden sm:inline text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Hi, {meQ.data.name.split(" ")[0]}
              </span>
            ) : null}
            <ThemeToggle />
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-8 sm:pt-10 pb-24">
        {/* Advanced Hero */}
        <div className="relative overflow-hidden rounded-[2.25rem] border border-zinc-200 dark:border-zinc-800 shadow-[0_20px_80px_rgba(0,0,0,0.18)] mb-12">
          <div className="absolute inset-0 bg-gradient-to-br from-zinc-950 via-zinc-900 to-black" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(34,211,238,0.18),transparent_24%),radial-gradient(circle_at_85%_18%,rgba(168,85,247,0.20),transparent_24%),radial-gradient(circle_at_50%_100%,rgba(217,70,239,0.12),transparent_28%)]" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent" />

          <div className="relative px-6 py-8 sm:px-10 sm:py-10 lg:px-12 lg:py-12">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-white/10 backdrop-blur-md border border-white/10 text-white">
                <Sparkles className="h-4 w-4 text-cyan-300" />
                <span className="text-sm font-medium">Premium Marketplace</span>
              </div>

              <div className="flex flex-wrap gap-3">
                <div className="rounded-2xl bg-white/10 backdrop-blur-md px-4 py-3 border border-white/10 text-white text-sm">
                  {totalMarkets} markets
                </div>
                <div className="rounded-2xl bg-white/10 backdrop-blur-md px-4 py-3 border border-white/10 text-white text-sm">
                  {totalItems} items
                </div>
              </div>
            </div>

            <div className="grid lg:grid-cols-[1.2fr_0.8fr] gap-8 items-end mt-10">
              <div className="text-white">
                <div className="flex flex-wrap gap-3 mb-5">
                  <span className="px-4 py-2 rounded-full bg-white/10 border border-white/10 text-sm">
                    Premium storefronts
                  </span>
                  <span className="px-4 py-2 rounded-full bg-white/10 border border-white/10 text-sm">
                    Featured promotions
                  </span>
                  <span className="px-4 py-2 rounded-full bg-white/10 border border-white/10 text-sm">
                    Curated discovery
                  </span>
                </div>

                <h1 className="text-4xl sm:text-6xl lg:text-7xl font-bold tracking-tighter leading-none">
                  Discover exceptional markets
                </h1>

                <p className="mt-5 text-base sm:text-lg text-white/80 max-w-2xl leading-relaxed">
                  Explore premium storefronts with stronger presentation, better discovery,
                  curated promotions, and a polished browsing experience built to feel more
                  advanced and modern.
                </p>

                <div className="flex flex-wrap gap-4 mt-8">
                  {promotedMarkets.length > 0 ? (
                    <Button asChild size="lg" className="h-14 px-8 rounded-2xl text-base">
                      <Link to={`/m/${promotedMarkets[0].id}`}>
                        Explore Promoted Markets
                      </Link>
                    </Button>
                  ) : null}

                  <Button
                    asChild
                    variant="outline"
                    size="lg"
                    className="h-14 px-8 rounded-2xl text-base bg-white/10 text-white border-white/20 hover:bg-white/15 hover:text-white"
                  >
                    <Link to={meQ.data ? authedPath : "/login"}>
                      {meQ.data ? "Continue Workspace" : "Join Workspace"}
                    </Link>
                  </Button>
                </div>
              </div>

              <div className="grid gap-4">
                <div className="rounded-[1.75rem] bg-white/10 backdrop-blur-xl border border-white/10 p-5 text-white">
                  <div className="text-xs uppercase tracking-wider text-white/60 mb-2">
                    Discovery Highlight
                  </div>
                  <div className="text-2xl font-semibold tracking-tight">
                    Curated markets with a stronger visual storefront system
                  </div>
                  <div className="mt-3 text-sm text-white/75 leading-relaxed">
                    Cleaner hierarchy, better premium feel, and stronger first impression for users.
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-[1.5rem] bg-white/10 backdrop-blur-xl border border-white/10 p-5 text-white">
                    <div className="text-xs uppercase tracking-wider text-white/60 mb-2">
                      Featured
                    </div>
                    <div className="text-3xl font-bold">{totalFeatured}</div>
                  </div>

                  <div className="rounded-[1.5rem] bg-white/10 backdrop-blur-xl border border-white/10 p-5 text-white">
                    <div className="text-xs uppercase tracking-wider text-white/60 mb-2">
                      Active Items
                    </div>
                    <div className="text-3xl font-bold">{totalItems}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Search and quick stats */}
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_auto] gap-4 items-stretch mb-12">
          <div className="rounded-[2rem] border border-zinc-200 dark:border-zinc-800 bg-white/90 dark:bg-zinc-900/90 backdrop-blur p-3 shadow-sm">
            <div className="relative">
              <Search className="absolute left-6 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-400" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search markets by name, code, location, headline..."
                className="h-16 pl-16 text-lg rounded-[1.4rem] border-0 shadow-none focus-visible:ring-0 bg-transparent"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 xl:min-w-[600px]">
            <StatsCard label="Live" value={totalMarkets} icon={Store} />
            <StatsCard label="Featured" value={totalFeatured} icon={Flame} />
            <StatsCard label="Items" value={totalItems} icon={BadgeCheck} />
          </div>
        </div>

        {/* Campaign banner */}
        <div className="mb-14 rounded-[2rem] bg-gradient-to-br from-zinc-900 to-black text-white p-8 sm:p-12 relative overflow-hidden shadow-2xl border border-zinc-800">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.25),transparent_30%),radial-gradient(circle_at_bottom_left,rgba(168,85,247,0.22),transparent_35%)]" />

          <div className="relative flex flex-col lg:flex-row lg:items-center gap-8">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-4">
                <Megaphone className="h-6 w-6" />
                <span className="uppercase tracking-widest text-xs opacity-75">Campaign</span>
              </div>

              <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight">
                Smart Dispatch Boost Week
              </h2>

              <p className="mt-3 text-white/80 max-w-2xl leading-relaxed">
                Limited time shipping boost for selected markets with premium placement,
                cleaner discovery, and stronger visibility across the marketplace.
              </p>

              <div className="flex flex-wrap gap-3 mt-6">
                <div className="inline-flex items-center gap-2 rounded-full bg-white/10 border border-white/10 px-4 py-2 text-sm">
                  <Ticket className="h-4 w-4" />
                  Promo support
                </div>

                <div className="inline-flex items-center gap-2 rounded-full bg-white/10 border border-white/10 px-4 py-2 text-sm">
                  <ShieldCheck className="h-4 w-4" />
                  Trusted sellers
                </div>

                <div className="inline-flex items-center gap-2 rounded-full bg-white/10 border border-white/10 px-4 py-2 text-sm">
                  <Sparkles className="h-4 w-4" />
                  Premium visibility
                </div>
              </div>
            </div>

            <Button
              asChild
              variant="secondary"
              className="rounded-2xl h-12 px-8 self-start lg:self-center"
            >
              <Link to={promotedMarkets[0] ? `/m/${promotedMarkets[0].id}` : "#"}>
                View Sponsored
              </Link>
            </Button>
          </div>
        </div>

        {/* Content states */}
        {marketsQ.isLoading ? (
          <div className="rounded-[2rem] border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 py-24 sm:py-32 text-center shadow-sm">
            <div className="w-14 h-14 rounded-2xl bg-cyan-50 dark:bg-cyan-950/40 flex items-center justify-center mx-auto mb-5">
              <Store className="h-7 w-7 text-cyan-600 dark:text-cyan-400" />
            </div>
            <div className="text-lg text-zinc-600 dark:text-zinc-400">Loading markets...</div>
          </div>
        ) : marketsQ.isError ? (
          <div className="rounded-[2rem] border border-rose-200 dark:border-rose-900 bg-white dark:bg-zinc-900 py-24 sm:py-32 text-center shadow-sm">
            <div className="text-rose-500 text-lg">Failed to load markets. Please try again.</div>
          </div>
        ) : !hasMarkets ? (
          <div className="rounded-[2rem] border border-dashed border-zinc-300 dark:border-zinc-700 p-12 text-center text-zinc-500 dark:text-zinc-400 bg-white dark:bg-zinc-900 shadow-sm">
            <div className="w-14 h-14 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mx-auto mb-5">
              <Search className="h-6 w-6" />
            </div>
            <div className="text-xl font-semibold text-zinc-900 dark:text-white mb-2">
              No markets found
            </div>
            <div>Try a different search term.</div>
          </div>
        ) : (
          <>
            <MarketRail
              title="Featured"
              subtitle="Promoted Markets"
              description="Highlighted storefronts with premium placement, strong visuals, and featured discovery."
              markets={promotedMarkets}
              autoScrollMs={5500}
            />

            <MarketRail
              title="Community"
              subtitle="All Live Markets"
              description="Explore the full collection of active markets and discover products across every storefront."
              markets={regularMarkets}
              autoScrollMs={8500}
            />
          </>
        )}

        {/* Feature cards */}
        <div className="mt-16 sm:mt-20 grid md:grid-cols-3 gap-6 sm:gap-8">
          {[
            {
              icon: Star,
              title: "VIP Markets",
              desc: "Premium placement with enhanced visibility and stronger presentation.",
            },
            {
              icon: Store,
              title: "New Markets",
              desc: "Fresh storefronts get early exposure with a cleaner discovery-first layout.",
            },
            {
              icon: Users,
              title: "Staff Picks",
              desc: "Hand-selected by the operations team for quality, trust, and visual appeal.",
            },
          ].map((item, i) => (
            <div
              key={i}
              className="group bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[2rem] p-8 sm:p-10 hover:shadow-xl transition-all duration-300"
            >
              <div className="w-14 h-14 rounded-2xl bg-cyan-50 dark:bg-cyan-950/40 flex items-center justify-center mb-6 group-hover:scale-105 transition-transform">
                <item.icon className="h-7 w-7 text-cyan-600 dark:text-cyan-400" />
              </div>

              <h3 className="font-semibold text-2xl mb-3 tracking-tight">{item.title}</h3>
              <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
