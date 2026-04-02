import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Megaphone,
  Search,
  Sparkles,
  Star,
  Store,
  Users,
  MapPin,
  Ticket,
  ShieldCheck,
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
import { calcStorefrontPrice, formatPromoLabel, type StorefrontMarket } from "@/lib/storefront";
import { useMe } from "@/lib/useMe";

type RailProps = {
  title: string;
  subtitle: string;
  markets: StorefrontMarket[];
  autoScrollMs?: number;
};

function getBadgeTheme(badge?: string | null) {
  const value = (badge ?? "").trim().toLowerCase();

  if (value.includes("vip")) {
    return "bg-gradient-to-r from-amber-300 via-yellow-300 to-amber-400 text-black border border-amber-200";
  }

  if (value.includes("new")) {
    return "bg-cyan-50 text-cyan-700 border border-cyan-200 dark:bg-cyan-950/40 dark:text-cyan-300 dark:border-cyan-800";
  }

  if (value.includes("staff")) {
    return "bg-violet-50 text-violet-700 border border-violet-200 dark:bg-violet-950/40 dark:text-violet-300 dark:border-violet-800";
  }

  return "bg-zinc-100 text-zinc-700 border border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700";
}

function MarketRail({ title, subtitle, markets, autoScrollMs = 7000 }: RailProps) {
  const railRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!railRef.current || markets.length <= 1) return;

    const element = railRef.current;
    const interval = setInterval(() => {
      const nextLeft = element.scrollLeft + 392;
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
      left: direction === "left" ? -392 : 392,
      behavior: "smooth",
    });
  };

  if (markets.length === 0) return null;

  return (
    <section className="py-14 sm:py-16">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-5 mb-8 sm:mb-10">
        <div>
          <div className="uppercase text-xs tracking-[3px] font-medium text-cyan-600 dark:text-cyan-400">
            {title}
          </div>
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-tighter mt-2 text-zinc-900 dark:text-white">
            {subtitle}
          </h2>
        </div>

        <div className="flex gap-3">
          <Button
            variant="outline"
            size="icon"
            className="h-12 w-12 rounded-2xl border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900"
            onClick={() => scrollBy("left")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-12 w-12 rounded-2xl border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900"
            onClick={() => scrollBy("right")}
          >
            <ArrowRight className="h-5 w-5" />
          </Button>
        </div>
      </div>

      <div
        ref={railRef}
        className="flex gap-6 sm:gap-8 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-hide"
      >
        {markets.map((market) => (
          <article
            key={market.id}
            className="group min-w-[320px] sm:min-w-[360px] lg:min-w-[380px] flex-shrink-0 snap-start h-[560px] flex flex-col bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[2rem] overflow-hidden hover:border-cyan-300 dark:hover:border-cyan-700 hover:shadow-2xl transition-all duration-300"
          >
            <div className="relative h-52 overflow-hidden">
              {market.image_url ? (
                <img
                  src={market.image_url}
                  alt={market.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
              ) : (
                <div className="h-full w-full bg-gradient-to-br from-zinc-900 via-zinc-800 to-black" />
              )}

              <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
              <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-cyan-500 via-violet-500 to-fuchsia-500" />

              <div className="absolute top-5 left-5 right-5 flex items-start justify-between gap-3">
                <span className="font-mono text-xs sm:text-sm text-white/80 tracking-widest">
                  {market.code}
                </span>

                {market.featured_badge && (
                  <span
                    className={`text-xs font-semibold px-3.5 py-1.5 rounded-2xl backdrop-blur-sm ${getBadgeTheme(
                      market.featured_badge
                    )}`}
                  >
                    {market.featured_badge}
                  </span>
                )}
              </div>

              <div className="absolute bottom-5 left-5 right-5">
                <h3 className="text-2xl sm:text-3xl font-semibold tracking-tight text-white leading-none">
                  {market.name}
                </h3>
                <div className="flex items-center gap-2 mt-3 text-white/80 text-sm">
                  <MapPin className="h-4 w-4" />
                  <span className="line-clamp-1">{market.address || "Marketplace location"}</span>
                </div>
              </div>
            </div>

            <div className="flex-1 p-6 sm:p-7 flex flex-col">
              <p className="text-zinc-600 dark:text-zinc-400 text-[15px] leading-relaxed line-clamp-3 min-h-[72px]">
                {market.featured_headline ||
                  market.featured_copy ||
                  market.address ||
                  "Ready for orders."}
              </p>

              <div className="mt-5 flex flex-wrap gap-2">
                {market.active_promo && (
                  <span className="px-3.5 py-1.5 text-xs font-medium rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                    {formatPromoLabel(market.active_promo)}
                  </span>
                )}

                <span className="px-3.5 py-1.5 text-xs font-medium rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                  {market.active_items_count ?? 0} items
                </span>

                {market.is_featured ? (
                  <span className="px-3.5 py-1.5 text-xs font-medium rounded-full bg-cyan-100 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300">
                    Featured
                  </span>
                ) : null}
              </div>

              <div className="mt-6 rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 p-4">
                <div className="text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-3">
                  Preview Items
                </div>

                <div className="space-y-3">
                  {(market.item_preview ?? []).slice(0, 3).map((item) => (
                    <div key={item.id} className="flex items-center justify-between gap-3 text-sm">
                      <span className="font-medium text-zinc-800 dark:text-zinc-200 line-clamp-1">
                        {item.name}
                      </span>
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                        {formatMoney(calcStorefrontPrice(item))}
                      </span>
                    </div>
                  ))}

                  {(market.item_preview ?? []).length === 0 && (
                    <div className="text-sm text-zinc-500 dark:text-zinc-400">
                      No preview items available.
                    </div>
                  )}
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
        ))}
      </div>
    </section>
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
  const totalItems = filteredMarkets.reduce((sum, market) => sum + Number(market.active_items_count ?? 0), 0);

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-50 to-white dark:from-zinc-950 dark:to-zinc-950 text-zinc-900 dark:text-zinc-100">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 border-b border-zinc-200/80 dark:border-zinc-800 bg-white/90 dark:bg-zinc-950/90 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-20 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-cyan-500 to-violet-600 flex items-center justify-center shadow-lg">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <span className="font-bold text-2xl tracking-tighter">marketly</span>
          </div>

          <div className="flex items-center gap-4 sm:gap-6">
            {meQ.data && (
              <span className="hidden sm:inline text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Hi, {meQ.data.name.split(" ")[0]}
              </span>
            )}
            <ThemeToggle />
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-10 sm:pt-14 pb-24">
        {/* Hero */}
        <div className="relative overflow-hidden rounded-[2rem] border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xl mb-14 sm:mb-20">
          <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 via-violet-500/10 to-fuchsia-500/10 dark:from-cyan-500/5 dark:via-violet-500/5 dark:to-fuchsia-500/5" />
          <div className="relative p-8 sm:p-12 lg:p-16">
            <div className="text-center max-w-4xl mx-auto">
              <div className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-white/90 dark:bg-zinc-950/90 border border-zinc-200 dark:border-zinc-700 shadow-sm mb-8">
                <Sparkles className="h-4 w-4 text-cyan-500" />
                <span className="text-sm font-medium">Marketplace</span>
              </div>

              <h1 className="text-4xl sm:text-6xl lg:text-7xl font-bold tracking-tighter leading-none mb-6">
                Discover exceptional{" "}
                <span className="text-cyan-600 dark:text-cyan-400">markets</span>
              </h1>

              <p className="text-lg sm:text-xl text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto">
                Curated storefronts with unique products from independent sellers around the world.
              </p>

              <div className="flex flex-wrap gap-4 justify-center mt-10">
                {promotedMarkets.length > 0 && (
                  <Button asChild size="lg" className="h-14 px-8 sm:px-10 rounded-2xl text-base">
                    <Link to={`/m/${promotedMarkets[0].id}`}>
                      Explore Promoted Markets
                    </Link>
                  </Button>
                )}

                <Button
                  asChild
                  variant="outline"
                  size="lg"
                  className="h-14 px-8 sm:px-10 rounded-2xl text-base bg-white dark:bg-zinc-900"
                >
                  <Link to={meQ.data ? authedPath : "/login"}>
                    {meQ.data ? "Continue Workspace" : "Join Workspace"}
                  </Link>
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-12 max-w-4xl mx-auto">
              <div className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-950/70 backdrop-blur p-5 text-center">
                <div className="text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2">
                  Live Markets
                </div>
                <div className="text-3xl font-bold">{totalMarkets}</div>
              </div>

              <div className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-950/70 backdrop-blur p-5 text-center">
                <div className="text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2">
                  Featured
                </div>
                <div className="text-3xl font-bold">{totalFeatured}</div>
              </div>

              <div className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-950/70 backdrop-blur p-5 text-center">
                <div className="text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2">
                  Active Items
                </div>
                <div className="text-3xl font-bold">{totalItems}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="max-w-3xl mx-auto mb-14 sm:mb-20">
          <div className="rounded-[2rem] border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3 shadow-sm">
            <div className="relative">
              <Search className="absolute left-6 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-400" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search markets by name, code or location..."
                className="h-16 pl-16 text-lg rounded-[1.4rem] border-0 shadow-none focus-visible:ring-0"
              />
            </div>
          </div>
        </div>

        {/* Campaign Banner */}
        <div className="mb-14 sm:mb-20 rounded-[2rem] bg-gradient-to-br from-zinc-900 to-black text-white p-8 sm:p-12 relative overflow-hidden shadow-2xl">
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

              <p className="mt-3 text-white/80 max-w-2xl">
                Limited time shipping boost for selected markets with premium placement and better visibility.
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
              </div>
            </div>

            <Button asChild variant="secondary" className="rounded-2xl h-12 px-8 self-start lg:self-center">
              <Link to={promotedMarkets[0] ? `/m/${promotedMarkets[0].id}` : "#"}>
                View Sponsored
              </Link>
            </Button>
          </div>
        </div>

        {/* Rails */}
        {marketsQ.isLoading ? (
          <div className="py-24 sm:py-32 text-center text-lg text-zinc-500 dark:text-zinc-400">
            Loading markets...
          </div>
        ) : marketsQ.isError ? (
          <div className="py-24 sm:py-32 text-center text-rose-500">
            Failed to load markets. Please try again.
          </div>
        ) : filteredMarkets.length === 0 ? (
          <div className="rounded-[2rem] border border-dashed border-zinc-300 dark:border-zinc-700 p-12 text-center text-zinc-500 dark:text-zinc-400 bg-white dark:bg-zinc-900">
            No markets found for your search.
          </div>
        ) : (
          <>
            <MarketRail
              title="Featured"
              subtitle="Promoted Markets"
              markets={promotedMarkets}
              autoScrollMs={5500}
            />

            <MarketRail
              title="Community"
              subtitle="All Live Markets"
              markets={regularMarkets}
              autoScrollMs={8500}
            />
          </>
        )}

        {/* Info Cards */}
        <div className="mt-16 sm:mt-24 grid md:grid-cols-3 gap-6 sm:gap-8">
          {[
            {
              icon: Star,
              title: "VIP Markets",
              desc: "Premium placement with enhanced visibility and stronger presentation.",
            },
            {
              icon: Store,
              title: "New Markets",
              desc: "Fresh storefronts get early exposure with modern discovery-first layouts.",
            },
            {
              icon: Users,
              title: "Staff Picks",
              desc: "Hand-selected by the operations team for quality and reliability.",
            },
          ].map((item, i) => (
            <div
              key={i}
              className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[2rem] p-8 sm:p-10 hover:shadow-xl transition-shadow"
            >
              <div className="w-14 h-14 rounded-2xl bg-cyan-50 dark:bg-cyan-950/40 flex items-center justify-center mb-6">
                <item.icon className="h-7 w-7 text-cyan-600 dark:text-cyan-400" />
              </div>
              <h3 className="font-semibold text-2xl mb-3">{item.title}</h3>
              <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}