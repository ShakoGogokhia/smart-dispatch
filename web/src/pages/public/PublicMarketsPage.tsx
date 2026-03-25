import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Megaphone, Search, Sparkles, Star, Store, Users } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import ThemeToggle from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { auth } from "@/lib/auth";
import { formatMoney } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
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
    return "status-chip status-good";
  }

  if (value.includes("new")) {
    return "status-chip status-warn";
  }

  if (value.includes("staff")) {
    return "status-chip";
  }

  return "status-chip status-good";
}

function MarketRail({ title, subtitle, markets, autoScrollMs = 8000 }: RailProps) {
  const railRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!railRef.current || markets.length <= 1) {
      return;
    }

    const element = railRef.current;
    const timer = window.setInterval(() => {
      const nextLeft = element.scrollLeft + 320;
      const maxLeft = element.scrollWidth - element.clientWidth;

      element.scrollTo({
        left: nextLeft >= maxLeft ? 0 : nextLeft,
        behavior: "smooth",
      });
    }, autoScrollMs);

    return () => window.clearInterval(timer);
  }, [autoScrollMs, markets.length]);

  function scrollByCard(direction: "left" | "right") {
    railRef.current?.scrollBy({
      left: direction === "left" ? -320 : 320,
      behavior: "smooth",
    });
  }

  return (
    <section className="dashboard-card">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="section-kicker">{title}</div>
          <h2 className="section-title mt-2">{subtitle}</h2>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" className="h-11 w-11 rounded-2xl p-0" onClick={() => scrollByCard("left")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Button variant="secondary" className="h-11 w-11 rounded-2xl p-0" onClick={() => scrollByCard("right")}>
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div ref={railRef} className="market-rail">
        {markets.map((market) => (
          <article key={market.id} className={`market-rail-card ${market.is_featured ? "market-card-featured" : ""}`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="section-kicker">{market.code}</span>
                  {market.featured_badge && <span className={getBadgeTheme(market.featured_badge)}>{market.featured_badge}</span>}
                </div>
                <h3 className="font-display theme-ink mt-3 text-2xl font-semibold">{market.name}</h3>
              </div>
              <span className={`status-chip ${market.is_active ? "status-good" : "status-neutral"}`}>
                {market.is_active ? "Live" : "Hidden"}
              </span>
            </div>

            <p className="theme-copy mt-4 text-sm leading-6">{market.featured_headline || market.featured_copy || market.address || "Ready for orders."}</p>

            <div className="mt-4 flex flex-wrap gap-2">
              {market.active_promo && <span className="data-pill">{formatPromoLabel(market.active_promo)}</span>}
              <span className="data-pill">{market.active_items_count ?? 0} items</span>
            </div>

            <div className="mt-5 grid gap-2">
              {(market.item_preview ?? []).slice(0, 2).map((item) => (
                <div key={item.id} className="subpanel flex items-center justify-between px-4 py-3 text-sm">
                  <span className="theme-ink font-medium">{item.name}</span>
                  <span className="theme-copy">{formatMoney(calcStorefrontPrice(item))}</span>
                </div>
              ))}
            </div>

            <Button asChild className="mt-5 h-11">
              <Link to={`/m/${market.id}`}>
                Open market
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </article>
        ))}
      </div>
    </section>
  );
}

export default function PublicMarketsPage() {
  const { language, setLanguage, t } = useI18n();
  const [search, setSearch] = useState("");
  const token = auth.getToken();
  const meQ = useMe({ enabled: !!token });

  const marketsQ = useQuery({
    queryKey: ["public-markets"],
    queryFn: async () => (await api.get("/api/public/markets")).data as StorefrontMarket[],
  });

  const allMarkets = marketsQ.data ?? [];
  const query = search.trim().toLowerCase();
  const markets = useMemo(() => {
    if (!query) return allMarkets;

    return allMarkets.filter((market) =>
      [market.name, market.code, market.address, market.featured_badge, market.featured_headline]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [allMarkets, query]);

  const promotedMarkets = markets.filter((market) => market.is_featured);
  const regularMarkets = markets.filter((market) => !market.is_featured);
  const authedPath = getDefaultAuthedPath(meQ.data?.roles);

  return (
    <div className="app-shell storefront-shell">
      <div className="relative z-10 mx-auto max-w-7xl space-y-6">
        <section className="landing-stage page-enter">
          <div className="landing-stage__grid !grid-cols-1">
            <div className="landing-stage__copy">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="command-chip">
                  <Sparkles className="h-3.5 w-3.5" />
                  {t("public.marketplace")}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {meQ.data && (
                    <Link to={authedPath} className="status-chip">
                      {t("public.signedInAsUser", { name: meQ.data.name })}
                    </Link>
                  )}
                  <ThemeToggle />
                  <Button variant={language === "ka" ? "default" : "secondary"} className="h-10 rounded-[16px]" onClick={() => setLanguage("ka")}>
                    {t("lang.ka")}
                  </Button>
                  <Button variant={language === "en" ? "default" : "secondary"} className="h-10 rounded-[16px]" onClick={() => setLanguage("en")}>
                    {t("lang.en")}
                  </Button>
                </div>
              </div>

              <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
                <div>
                  <div className="section-kicker text-cyan-100/80">Simpler marketplace</div>
                  <h1 className="font-display mt-4 max-w-4xl text-5xl font-semibold tracking-[-0.06em] text-white md:text-7xl">
                    Markets first, less noise, faster browsing.
                  </h1>
                  <p className="mt-4 max-w-2xl text-base leading-8 text-slate-300">
                    Promoted markets stay on their own line, regular markets stay below, and both rails scroll with arrows or automatically.
                  </p>
                  <div className="mt-6 flex flex-wrap gap-3">
                    <Button asChild size="lg">
                      <Link to={promotedMarkets[0] ? `/m/${promotedMarkets[0].id}` : "/"}>
                        Open promoted markets
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </Button>
                    <Button asChild variant="secondary" size="lg">
                      <Link to={meQ.data ? authedPath : "/login"}>{meQ.data ? "Continue workspace" : t("public.openWorkspace")}</Link>
                    </Button>
                  </div>
                </div>

                <div className="subpanel p-5">
                  <div className="section-kicker">Market badges</div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <span className="status-chip status-good">VIP Market</span>
                    <span className="status-chip status-warn">New Market</span>
                    <span className="status-chip">Staff Pick</span>
                  </div>
                  <p className="theme-copy mt-4 text-sm leading-6">
                    Admins can assign any badge. Owners can request those badges from the pricing page.
                  </p>
                </div>
              </div>

              <div className="mt-6 relative w-full lg:max-w-xl">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search markets"
                  className="input-shell pl-11"
                />
              </div>
            </div>
          </div>
        </section>

        <section className="dashboard-card banner-test page-enter page-enter-delay-1">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="command-chip">
                <Megaphone className="h-3.5 w-3.5" />
                Test banner ad
              </div>
              <h2 className="section-title mt-3">Banner slot: Smart Dispatch Boost Week</h2>
              <p className="section-copy mt-2">This is a sample banner area for paid placement or seasonal campaigns.</p>
            </div>
            <Button asChild variant="secondary">
              <Link to={promotedMarkets[0] ? `/m/${promotedMarkets[0].id}` : "/"}>
                View sponsored market
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </section>

        {marketsQ.isLoading ? (
          <div className="dashboard-card text-sm text-slate-600 dark:text-slate-300">{t("public.loadingMarkets")}</div>
        ) : marketsQ.isError ? (
          <div className="dashboard-card text-sm text-rose-700 dark:text-rose-100">{t("public.failedMarkets")}</div>
        ) : (
          <>
            <MarketRail
              title="Promoted markets"
              subtitle="VIP, New, and Staff Pick placements"
              markets={promotedMarkets}
              autoScrollMs={5000}
            />

            <MarketRail
              title="Regular markets"
              subtitle="All other live storefronts"
              markets={regularMarkets}
              autoScrollMs={10000}
            />
          </>
        )}

        <section className="dashboard-card">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="subpanel p-5">
              <Star className="h-5 w-5 text-cyan-700 dark:text-cyan-200" />
              <div className="theme-ink mt-3 font-semibold">VIP Market</div>
              <div className="theme-copy mt-2 text-sm">Premium placement with stronger visual treatment.</div>
            </div>
            <div className="subpanel p-5">
              <Store className="h-5 w-5 text-cyan-700 dark:text-cyan-200" />
              <div className="theme-ink mt-3 font-semibold">New Market</div>
              <div className="theme-copy mt-2 text-sm">Helps recently launched storefronts get early visibility.</div>
            </div>
            <div className="subpanel p-5">
              <Users className="h-5 w-5 text-cyan-700 dark:text-cyan-200" />
              <div className="theme-ink mt-3 font-semibold">Staff Pick</div>
              <div className="theme-copy mt-2 text-sm">Editorial-style badge chosen by the operations team.</div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
