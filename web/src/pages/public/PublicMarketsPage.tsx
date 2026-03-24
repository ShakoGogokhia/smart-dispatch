import { useDeferredValue, useMemo, useState } from "react";
import {
  ArrowRight,
  MapPin,
  Search,
  Settings2,
  ShieldCheck,
  ShoppingBasket,
  Sparkles,
  Store,
  TicketPercent,
  Truck,
  Users,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import ThemeToggle from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import {
  calcStorefrontPrice,
  formatPromoLabel,
  getMarketCopy,
  getMarketHeadline,
  type StorefrontItemPreview,
  type StorefrontMarket,
} from "@/lib/storefront";

type DiscoverItem = StorefrontItemPreview & {
  market_id: number;
  market_name: string;
};

type StaffLane = {
  title: string;
  text: string;
  icon: typeof Users;
};

export default function PublicMarketsPage() {
  const { language, setLanguage, t } = useI18n();
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);

  const marketsQ = useQuery({
    queryKey: ["public-markets"],
    queryFn: async () => (await api.get("/api/public/markets")).data as StorefrontMarket[],
  });

  const markets = marketsQ.data ?? [];
  const normalizedQuery = deferredQuery.trim().toLowerCase();

  const filteredMarkets = useMemo(() => {
    if (!normalizedQuery) return markets;

    return markets.filter((market) => {
      const haystack = [
        market.name,
        market.code,
        market.address,
        market.featured_headline,
        market.featured_copy,
        ...(market.item_preview ?? []).flatMap((item) => [item.name, item.sku]),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedQuery);
    });
  }, [markets, normalizedQuery]);

  const featuredMarkets = filteredMarkets.filter((market) => market.is_featured);
  const heroMarket = featuredMarkets[0] ?? filteredMarkets[0] ?? null;
  const activeMarkets = filteredMarkets.filter((market) => market.is_active).length;
  const discoverItems = useMemo<DiscoverItem[]>(() => {
    return filteredMarkets
      .flatMap((market) =>
        (market.item_preview ?? []).map((item) => ({
          ...item,
          market_id: market.id,
          market_name: market.name,
        })),
      )
      .slice(0, 6);
  }, [filteredMarkets]);

  const staffLanes: StaffLane[] = [
    {
      title: "Admin control",
      text: "Give promotion to any market, tune spotlight copy, and manage who owns what.",
      icon: ShieldCheck,
    },
    {
      title: "Market staff",
      text: "Open market tools, update items, and keep promo codes ready for public traffic.",
      icon: Settings2,
    },
    {
      title: "Dispatch team",
      text: "Orders, routes, and storefront operations stay connected from the same workspace.",
      icon: Truck,
    },
  ];

  return (
    <div className="app-shell storefront-shell">
      <div className="glow-orb left-[4%] top-20 h-56 w-56 bg-cyan-300/20" />
      <div className="glow-orb right-[6%] top-[18rem] h-72 w-72 bg-amber-300/18" />

      <div className="relative z-10 mx-auto max-w-7xl space-y-6">
        <section className="landing-stage page-enter">
          <div className="landing-stage__grid">
            <div className="landing-stage__copy">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="command-chip">
                  <Sparkles className="h-3.5 w-3.5" />
                  {t("public.marketplace")}
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <ThemeToggle />
                  <Button
                    variant={language === "ka" ? "default" : "secondary"}
                    className="h-10 rounded-[16px]"
                    onClick={() => setLanguage("ka")}
                  >
                    {t("lang.ka")}
                  </Button>
                  <Button
                    variant={language === "en" ? "default" : "secondary"}
                    className="h-10 rounded-[16px]"
                    onClick={() => setLanguage("en")}
                  >
                    {t("lang.en")}
                  </Button>
                </div>
              </div>

              <div className="mt-8">
                <div className="section-kicker text-cyan-100/80">Markets, promoted offers, staff access</div>
                <h1 className="font-display mt-4 max-w-4xl text-5xl font-semibold tracking-[-0.075em] text-white md:text-7xl">
                  A cleaner storefront with real discovery from the first screen.
                </h1>
                <p className="mt-5 max-w-3xl text-base leading-8 text-slate-300 md:text-lg">
                  Customers can discover markets and items immediately. Staff can jump into operations from the same
                  landing page. Promoted markets get a stronger visual spotlight automatically.
                </p>
              </div>

              <div className="mt-8 flex flex-wrap gap-3">
                <Button asChild size="lg">
                  <Link to={heroMarket ? `/m/${heroMarket.id}` : "/"}>
                    Discover market
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild variant="secondary" size="lg">
                  <Link to="/login">Open staff workspace</Link>
                </Button>
              </div>

              <div className="mt-8 grid gap-3 sm:grid-cols-3">
                <div className="landing-stat">
                  <div className="section-kicker text-cyan-100/75">Open markets</div>
                  <div className="mt-2 text-3xl font-semibold text-white">{activeMarkets}</div>
                </div>
                <div className="landing-stat">
                  <div className="section-kicker text-cyan-100/75">Promoted</div>
                  <div className="mt-2 text-3xl font-semibold text-white">{featuredMarkets.length}</div>
                </div>
                <div className="landing-stat">
                  <div className="section-kicker text-cyan-100/75">Items on load</div>
                  <div className="mt-2 text-3xl font-semibold text-white">{discoverItems.length}</div>
                </div>
              </div>
            </div>

            <div className="landing-stage__feature page-enter page-enter-delay-1">
              {heroMarket ? (
                <div className="feature-market-card float-card">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="section-kicker text-cyan-100/75">{heroMarket.featured_badge || "Promoted market"}</div>
                      <h2 className="mt-3 font-display text-3xl font-semibold tracking-[-0.05em] text-white">
                        {heroMarket.name}
                      </h2>
                    </div>
                    <span className="status-chip status-good">{heroMarket.is_active ? "Live" : "Offline"}</span>
                  </div>

                  <p className="mt-4 text-sm leading-7 text-slate-300">{getMarketHeadline(heroMarket)}</p>
                  <p className="mt-2 text-sm leading-7 text-slate-400">{getMarketCopy(heroMarket)}</p>

                  <div className="mt-5 flex flex-wrap gap-2">
                    <span className="data-pill">{heroMarket.code}</span>
                    <span className="data-pill">{heroMarket.active_items_count ?? 0} items</span>
                    {heroMarket.active_promo && <span className="data-pill">{formatPromoLabel(heroMarket.active_promo)}</span>}
                  </div>

                  <div className="mt-6 grid gap-3">
                    {(heroMarket.item_preview ?? []).slice(0, 3).map((item) => (
                      <div key={item.id} className="feature-market-row">
                        <div>
                          <div className="text-sm font-semibold text-white">{item.name}</div>
                          <div className="text-xs text-slate-400">{item.sku}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-semibold text-white">{formatMoney(calcStorefrontPrice(item))}</div>
                          <div className="text-xs text-slate-400">{item.stock_qty} stock</div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <Button asChild className="mt-6 h-12 w-full">
                    <Link to={`/m/${heroMarket.id}`}>
                      Shop promoted market
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              ) : (
                <div className="feature-market-card">
                  <div className="text-sm text-slate-300">No markets available yet.</div>
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="dashboard-card page-enter page-enter-delay-1">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="section-kicker">Discover items</div>
              <h2 className="section-title mt-2">See products before opening any store</h2>
              <p className="section-copy mt-3 max-w-2xl">
                This section loads item previews directly onto the main page so the marketplace feels active right away.
              </p>
            </div>
            <div className="relative w-full lg:max-w-md">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search markets, items, sku, address"
                className="input-shell pl-11"
              />
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {discoverItems.map((item, index) => (
              <div
                key={`${item.market_id}-${item.id}`}
                className={`discover-item-card page-enter ${index > 1 ? "page-enter-delay-1" : ""}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="section-kicker">{item.market_name}</div>
                    <div className="theme-ink mt-2 text-lg font-semibold">{item.name}</div>
                    <div className="theme-muted mt-1 text-sm">{item.sku}</div>
                  </div>
                  <div className="status-chip status-good">{item.stock_qty}</div>
                </div>
                <div className="mt-5 flex items-end justify-between gap-3">
                  <div>
                    <div className="font-display theme-ink text-2xl font-semibold">{formatMoney(calcStorefrontPrice(item))}</div>
                    <div className="theme-muted text-xs">ready to order</div>
                  </div>
                  <Button asChild variant="secondary" size="sm">
                    <Link to={`/m/${item.market_id}`}>Open</Link>
                  </Button>
                </div>
              </div>
            ))}

            {!discoverItems.length && (
              <div className="discover-item-card theme-copy text-sm md:col-span-2 xl:col-span-3">
                No item previews matched your search.
              </div>
            )}
          </div>
        </section>

        <section className="staff-strip page-enter page-enter-delay-2">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="command-chip">
                <Users className="h-3.5 w-3.5" />
                Staff on this page
              </div>
              <h2 className="section-title mt-3 text-white">Staff and admin access belongs on the landing page too.</h2>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300 md:text-base">
                Team members should not hunt for tools. From here they can enter the workspace, promote a market, and
                manage operations with one click.
              </p>
            </div>
            <Button asChild size="lg" variant="secondary">
              <Link to="/login">
                Enter staff workspace
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {staffLanes.map((lane, index) => {
              const Icon = lane.icon;
              return (
                <div key={lane.title} className={`staff-card page-enter ${index > 0 ? "page-enter-delay-1" : ""}`}>
                  <div className="flex h-12 w-12 items-center justify-center rounded-[18px] border border-white/12 bg-white/8">
                    <Icon className="h-5 w-5 text-cyan-100" />
                  </div>
                  <div className="mt-5 text-xl font-semibold text-white">{lane.title}</div>
                  <div className="mt-2 text-sm leading-7 text-slate-300">{lane.text}</div>
                </div>
              );
            })}
          </div>
        </section>

        <section>
          <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="section-kicker">{t("public.availableMarkets")}</div>
              <h2 className="section-title mt-2">Browse markets with promoted ones first</h2>
              <p className="section-copy mt-3 max-w-2xl">
                Promoted markets use a different card treatment, and every card keeps the location, live offer, and
                quick entry path readable.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="status-chip">{filteredMarkets.length} visible</span>
              <span className="status-chip">{featuredMarkets.length} promoted</span>
            </div>
          </div>

          {marketsQ.isLoading ? (
            <div className="dashboard-card theme-copy p-8 text-sm">{t("public.loadingMarkets")}</div>
          ) : marketsQ.isError ? (
            <div className="dashboard-card p-8 text-sm text-rose-700 dark:text-rose-100">{t("public.failedMarkets")}</div>
          ) : (
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {filteredMarkets.map((market, index) => (
                <Card
                  key={market.id}
                  className={`${market.is_featured ? "market-card-featured" : ""} page-enter ${index > 1 ? "page-enter-delay-1" : ""}`}
                >
                  <CardContent className="grid gap-5 p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="section-kicker">{market.code}</span>
                          {market.is_featured && <span className="status-chip status-good">{market.featured_badge || "Promoted"}</span>}
                        </div>
                        <h3 className="font-display theme-ink mt-2 text-3xl font-semibold tracking-[-0.05em]">{market.name}</h3>
                      </div>
                      <div className={`status-chip ${market.is_active ? "status-good" : "status-neutral"}`}>
                        {market.is_active ? t("public.open") : t("public.closed")}
                      </div>
                    </div>

                    <div className="subpanel p-4 text-sm leading-7">
                      <div className="theme-muted mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.2em]">
                        <MapPin className="theme-icon h-3.5 w-3.5" />
                        {t("public.location")}
                      </div>
                      <div className="theme-copy">{market.address || t("public.addressComingSoon")}</div>
                    </div>

                    <div className="subpanel p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="theme-ink font-medium">{market.active_promo ? "Live promotion" : "Storefront status"}</div>
                        {market.active_promo ? (
                          <TicketPercent className="h-4 w-4 text-cyan-700 dark:text-cyan-200" />
                        ) : (
                          <Store className="h-4 w-4 text-cyan-700 dark:text-cyan-200" />
                        )}
                      </div>
                      <div className="theme-copy mt-2 text-sm">{formatPromoLabel(market.active_promo)}</div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {(market.item_preview ?? []).slice(0, 2).map((item) => (
                        <span key={item.id} className="data-pill">
                          {item.name}
                        </span>
                      ))}
                      {!market.item_preview?.length && <span className="data-pill">Catalog preview soon</span>}
                    </div>

                    <Button asChild className="h-12">
                      <Link to={`/m/${market.id}`}>
                        {t("public.openMarket")}
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              ))}

              {!filteredMarkets.length && (
                <div className="dashboard-card theme-copy p-8 text-sm">No storefronts matched your search.</div>
              )}
            </div>
          )}
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <div className="dashboard-card page-enter">
            <div className="section-kicker">How it works</div>
            <div className="mt-3 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-[18px] bg-cyan-50 text-cyan-700 dark:bg-cyan-300/10 dark:text-cyan-100">
                <Store className="h-5 w-5" />
              </div>
              <div>
                <div className="theme-ink font-semibold">Pick market</div>
                <div className="theme-copy text-sm">Start from promoted or standard storefronts.</div>
              </div>
            </div>
          </div>
          <div className="dashboard-card page-enter page-enter-delay-1">
            <div className="section-kicker">Discovery</div>
            <div className="mt-3 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-[18px] bg-cyan-50 text-cyan-700 dark:bg-cyan-300/10 dark:text-cyan-100">
                <ShoppingBasket className="h-5 w-5" />
              </div>
              <div>
                <div className="theme-ink font-semibold">See items early</div>
                <div className="theme-copy text-sm">Main page previews make shopping faster.</div>
              </div>
            </div>
          </div>
          <div className="dashboard-card page-enter page-enter-delay-2">
            <div className="section-kicker">Handoff</div>
            <div className="mt-3 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-[18px] bg-cyan-50 text-cyan-700 dark:bg-cyan-300/10 dark:text-cyan-100">
                <Truck className="h-5 w-5" />
              </div>
              <div>
                <div className="theme-ink font-semibold">Checkout to dispatch</div>
                <div className="theme-copy text-sm">The flow stays clean for both customers and staff.</div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
