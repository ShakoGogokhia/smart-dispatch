import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  BadgePercent,
  Clock3,
  Heart,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  Store,
  Users,
} from "lucide-react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { getVisitorKey, loadFavoriteIds, loadRecentlyViewedMarkets, rememberViewedMarket, syncMeta, toggleFavoriteMarket } from "@/lib/publicMarketplace";
import { calcStorefrontPrice, formatEtaWindow, formatMarketHours, formatPromoLabel, type MarketBanner, type StorefrontMarket } from "@/lib/storefront";

type SectionDefinition = {
  accentClass: string;
  emptyText: string;
  icon: typeof BadgePercent;
  id: string;
  markets: StorefrontMarket[];
  shortLabel: string;
  title: string;
};

function getMarketTone(market: StorefrontMarket) {
  const badge = (market.featured_badge ?? "").toLowerCase();

  if (market.active_promo) {
    return "market-tone-discounted";
  }

  if (badge.includes("vip")) {
    return "market-tone-vip";
  }

  if (badge.includes("staff")) {
    return "market-tone-staff";
  }

  return "market-tone-default";
}

function getMarketBadgeTheme(badge?: string | null) {
  const value = (badge ?? "").trim().toLowerCase();

  if (value.includes("vip")) {
    return "status-chip status-good";
  }

  if (value.includes("staff")) {
    return "status-chip";
  }

  if (value.includes("new")) {
    return "status-chip status-warn";
  }

  return "status-chip status-neutral";
}

function buildSearchText(market: StorefrontMarket) {
  return [
    market.name,
    market.code,
    market.address,
    market.category,
    market.featured_badge,
    market.featured_headline,
    market.featured_copy,
    ...(market.item_preview ?? []).map((item) => item.name),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function usePublicCopy() {
  const { language } = useI18n();

  return language === "ka"
    ? {
        allMarkets: "ყველა მარკეტი",
        curatedPicks: "რჩეული შეთავაზებები",
        discountedMarkets: "დაკლებული მარკეტები",
        discountedNow: "ახლა ფასდაკლება",
        discounts: "ფასდაკლება",
        discoverMarkets: "აღმოაჩინე მარკეტები",
        fasterMarketplace: "უფრო სწრაფი საჯარო მარკეტფლეისი.",
        featured: "ფიჩერდი",
        featuredMarkets: "ფიჩერდ მარკეტები",
        freshDiscounts: "ახალი ფასდაკლებები",
        items: "პროდუქტი",
        markets: "მარკეტები",
        noDiscountedMarkets: "ახლა ფასდაკლებული მარკეტები არ არის.",
        noFeaturedMarkets: "ახლა ფიჩერდ მარკეტები არ არის.",
        noMarkets: "ამჟამად მარკეტები არ არის.",
        noStaffPicks: "ახლა სტაფის რჩეული მარკეტები არ არის.",
        noVipMarkets: "ახლა VIP მარკეტები არ არის.",
        openMarket: "მარკეტის გახსნა",
        openMarketShort: "გახსენი მარკეტი",
        openThisMarket: "გახსენი ეს მარკეტი ახლავე.",
        popularNow: "პოპულარული ახლა",
        searchPlaceholder: "მოძებნე მარკეტი, პროდუქტი, მისამართი",
        staff: "სტაფი",
        staffPicks: "სტაფის რჩეული",
        staffWorkspace: "სამუშაო სივრცე",
        summary: "ჯერ ფასდაკლებები, მერე კატეგორიები და მარკეტის გახსნა ერთი დაჭერით.",
        thisSectionWaits: "ეს სექცია შემდეგ შესაბამის მარკეტს აჩვენებს როგორც კი გამოჩნდება.",
        vipMarkets: "VIP მარკეტები",
      }
    : {
        allMarkets: "All markets",
        curatedPicks: "Curated picks",
        discountedMarkets: "Discounted markets",
        discountedNow: "Discounted now",
        discounts: "Discounts",
        discoverMarkets: "Discover markets",
        fasterMarketplace: "A faster public marketplace.",
        featured: "Featured",
        featuredMarkets: "Featured markets",
        freshDiscounts: "Fresh discounts",
        items: "items",
        markets: "Markets",
        noDiscountedMarkets: "No discounted markets right now.",
        noFeaturedMarkets: "No featured markets right now.",
        noMarkets: "No markets available right now.",
        noStaffPicks: "No staff picks right now.",
        noVipMarkets: "No VIP markets right now.",
        openMarket: "Open market",
        openMarketShort: "Open market",
        openThisMarket: "Open this market now.",
        popularNow: "Popular now",
        searchPlaceholder: "Search markets, items, address",
        staff: "Staff",
        staffPicks: "Staff picks",
        staffWorkspace: "Staff workspace",
        summary: "Browse discounts first, jump through categories, and open any market with one tap.",
        thisSectionWaits: "This section will highlight the next market as soon as one matches.",
        vipMarkets: "VIP markets",
      };
}

function CompactMarketCard({
  market,
  favorite,
  onOpen,
  onToggleFavorite,
}: {
  favorite: boolean;
  market: StorefrontMarket;
  onOpen: (market: StorefrontMarket, source: string) => void;
  onToggleFavorite: (marketId: number) => void;
}) {
  const previewItem = market.item_preview?.[0];
  const tone = getMarketTone(market);
  const copy = usePublicCopy();

  return (
    <article className={`public-market-card ${tone}`}>
      <div className="public-market-card__media">
        <div className="public-market-card__topbar">
          <div className="public-market-card__badge-row">
            {market.featured_badge && <span className={getMarketBadgeTheme(market.featured_badge)}>{market.featured_badge}</span>}
            {market.active_promo && <span className="status-chip status-warn">{formatPromoLabel(market.active_promo)}</span>}
          </div>
          <div className="public-market-card__status-row">
            <button type="button" className="status-chip" onClick={() => onToggleFavorite(market.id)}>
              <Heart className={`h-4 w-4 ${favorite ? "fill-current" : ""}`} />
            </button>
            <span className={`status-chip public-market-card__availability ${market.is_open_now === false ? "status-warn" : "status-good"}`}>
              {market.is_open_now === false ? "Closed" : "Open"}
            </span>
          </div>
        </div>

        <div className="public-market-card__art">
          {market.cover_url ? (
            <img src={market.cover_url} alt={`${market.name} cover`} className="h-full w-full object-cover" />
          ) : (
            <div className="public-market-card__glyph">{market.code.slice(0, 2).toUpperCase()}</div>
          )}
        </div>
      </div>

      <div className="public-market-card__body">
        <div className="public-market-card__intro">
          <h3 className="public-market-card__title">{market.name}</h3>
          <p className="public-market-card__subtitle">
            {[market.category, market.address || copy.openMarketShort].filter(Boolean).join(" • ")}
          </p>
        </div>

        <div className="public-market-card__details">
          <div className="public-market-card__metrics text-slate-500 dark:text-slate-400">
            <span className="status-chip status-neutral">
              <Clock3 className="h-3.5 w-3.5" />
              {formatEtaWindow(market.delivery_eta_minutes)}
            </span>
            <span className="status-chip status-neutral">{formatMoney(market.minimum_order ?? 0)} min</span>
            <span className="status-chip status-neutral">
              <Star className="h-3.5 w-3.5" />
              {market.average_rating ? `${market.average_rating.toFixed(1)} (${market.rating_count ?? 0})` : "New"}
            </span>
          </div>

          <div className="public-market-card__preview text-slate-500 dark:text-slate-400">
            {previewItem ? (
              <>
                <span className="font-medium text-slate-950 dark:text-white">{previewItem.name}</span>
                <span className="mx-2 text-slate-300 dark:text-slate-600">•</span>
                <span>{formatMoney(calcStorefrontPrice(previewItem))}</span>
              </>
            ) : (
              <span>
                {market.active_items_count ?? 0} {copy.items}
              </span>
            )}
          </div>

          <div className="public-market-card__footer-row">
            <span className="rounded-full bg-slate-950/6 px-3 py-1 text-xs font-semibold text-cyan-700 dark:bg-white/8 dark:text-cyan-200">
              {market.active_items_count ?? 0} {copy.items}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">{formatMarketHours(market.opens_at, market.closes_at)}</span>
          </div>
        </div>

        <Button asChild className="mt-5 h-11 w-full rounded-[16px] bg-cyan-500 text-slate-950 hover:bg-cyan-400">
          <Link to={`/m/${market.id}`} onClick={() => onOpen(market, "public-card")}>
            {copy.openMarket}
          </Link>
        </Button>
      </div>
    </article>
  );
}

function MarketRail({
  accentClass,
  emptyText,
  favoriteIds,
  icon: Icon,
  id,
  markets,
  onOpen,
  onToggleFavorite,
  shortLabel,
  title,
}: SectionDefinition & {
  favoriteIds: number[];
  onOpen: (market: StorefrontMarket, source: string) => void;
  onToggleFavorite: (marketId: number) => void;
}) {
  const railRef = useRef<HTMLDivElement | null>(null);

  function scrollByCard(direction: "left" | "right") {
    railRef.current?.scrollBy({
      left: direction === "left" ? -320 : 320,
      behavior: "smooth",
    });
  }

  return (
    <section id={id} className="public-market-section page-enter">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className={`public-section-icon ${accentClass}`}>
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">{shortLabel}</div>
            <h2 className="mt-1 font-display text-2xl font-semibold tracking-[-0.04em] text-slate-950 dark:text-white">{title}</h2>
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="secondary" className="public-arrow-button" onClick={() => scrollByCard("left")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Button variant="secondary" className="public-arrow-button" onClick={() => scrollByCard("right")}>
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {markets.length ? (
        <div ref={railRef} className="market-rail">
          {markets.map((market) => (
            <CompactMarketCard
              key={market.id}
              market={market}
              favorite={favoriteIds.includes(market.id)}
              onOpen={onOpen}
              onToggleFavorite={onToggleFavorite}
            />
          ))}
        </div>
      ) : (
        <div className="public-empty-state">{emptyText}</div>
      )}
    </section>
  );
}

function PromoShowcase({
  accentClass,
  label,
  market,
  title,
}: {
  accentClass: string;
  label: string;
  market?: StorefrontMarket;
  title: string;
}) {
  const copy = usePublicCopy();

  if (!market) {
    return (
      <div className={`public-promo-card ${accentClass}`}>
        <div className="public-promo-card__content">
          <div className="text-sm font-semibold uppercase tracking-[0.18em] text-white/70">{label}</div>
          <h3 className="mt-3 max-w-sm font-display text-4xl font-semibold tracking-[-0.05em] text-white">{title}</h3>
          <p className="mt-3 max-w-sm text-sm leading-7 text-white/75">{copy.thisSectionWaits}</p>
        </div>
      </div>
    );
  }

  return (
    <article className={`public-promo-card ${accentClass}`}>
      <div className="public-promo-card__content">
        <div className="text-sm font-semibold uppercase tracking-[0.18em] text-white/70">{label}</div>
        <h3 className="mt-3 max-w-sm font-display text-4xl font-semibold tracking-[-0.05em] text-white">{market.name}</h3>
        <p className="mt-3 max-w-sm text-sm leading-7 text-white/80">
          {market.active_promo ? formatPromoLabel(market.active_promo) : market.featured_badge || market.address || copy.openThisMarket}
        </p>

        <Button asChild className="mt-6 h-11 rounded-[16px] bg-white text-slate-950 hover:bg-white/90">
          <Link to={`/m/${market.id}`}>{copy.openMarket}</Link>
        </Button>
      </div>

      <div className="public-promo-card__badge">{market.code}</div>
    </article>
  );
}

export default function PublicMarketsPage() {
  const { t } = useI18n();
  const copy = usePublicCopy();
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [favoriteIds, setFavoriteIds] = useState<number[]>(() => loadFavoriteIds());
  const [recentMarketIds, setRecentMarketIds] = useState<number[]>(() => loadRecentlyViewedMarkets().map((market) => market.id));

  const marketsQ = useQuery({
    queryKey: ["public-markets"],
    queryFn: async () => (await api.get("/api/public/markets")).data as StorefrontMarket[],
  });

  const bannersQ = useQuery({
    queryKey: ["public-banners"],
    queryFn: async () => (await api.get("/api/public/banners")).data as MarketBanner[],
  });

  const allMarkets = marketsQ.data ?? [];
  const normalizedQuery = query.trim().toLowerCase();
  const categories = useMemo(
    () => Array.from(new Set(allMarkets.map((market) => market.category).filter(Boolean))) as string[],
    [allMarkets],
  );

  useEffect(() => {
    syncMeta("Smart Dispatch Marketplace", "Discover featured markets, active offers, and live delivery storefronts.");
  }, []);

  const filteredMarkets = useMemo(() => {
    return allMarkets.filter((market) => {
      const matchesQuery = !normalizedQuery || buildSearchText(market).includes(normalizedQuery);
      const matchesCategory = categoryFilter === "all" || market.category === categoryFilter;
      return matchesQuery && matchesCategory;
    });
  }, [allMarkets, categoryFilter, normalizedQuery]);

  const recentMarkets = useMemo(
    () =>
      recentMarketIds
        .map((marketId) => allMarkets.find((market) => market.id === marketId))
        .filter((market): market is StorefrontMarket => Boolean(market)),
    [allMarkets, recentMarketIds],
  );

  const favoriteMarkets = useMemo(
    () => filteredMarkets.filter((market) => favoriteIds.includes(market.id)),
    [favoriteIds, filteredMarkets],
  );

  const sections = useMemo<SectionDefinition[]>(() => {
    const discounted = filteredMarkets.filter((market) => Boolean(market.active_promo));
    const featured = filteredMarkets.filter((market) => market.is_featured || Boolean((market.featured_badge ?? "").trim()));
    const vip = filteredMarkets.filter((market) => (market.featured_badge ?? "").toLowerCase().includes("vip"));
    const staff = filteredMarkets.filter((market) => (market.featured_badge ?? "").toLowerCase().includes("staff"));
    const groupedIds = new Set([...discounted, ...featured, ...vip, ...staff].map((market) => market.id));
    const otherMarkets = filteredMarkets.filter((market) => !groupedIds.has(market.id));

    return [
      {
        id: "discounted-markets",
        title: copy.discountedMarkets,
        shortLabel: copy.discounts,
        icon: BadgePercent,
        accentClass: "public-section-icon-cyan",
        markets: discounted,
        emptyText: copy.noDiscountedMarkets,
      },
      {
        id: "featured-markets",
        title: copy.featuredMarkets,
        shortLabel: copy.featured,
        icon: Sparkles,
        accentClass: "public-section-icon-amber",
        markets: featured,
        emptyText: copy.noFeaturedMarkets,
      },
      {
        id: "vip-markets",
        title: copy.vipMarkets,
        shortLabel: "VIP",
        icon: Sparkles,
        accentClass: "public-section-icon-amber",
        markets: vip,
        emptyText: copy.noVipMarkets,
      },
      {
        id: "staff-markets",
        title: copy.staffPicks,
        shortLabel: copy.staff,
        icon: ShieldCheck,
        accentClass: "public-section-icon-emerald",
        markets: staff,
        emptyText: copy.noStaffPicks,
      },
      {
        id: "all-markets",
        title: copy.allMarkets,
        shortLabel: copy.markets,
        icon: Store,
        accentClass: "public-section-icon-slate",
        markets: otherMarkets,
        emptyText: copy.noMarkets,
      },
    ];
  }, [copy, filteredMarkets]);

  function handleToggleFavorite(marketId: number) {
    setFavoriteIds(toggleFavoriteMarket(marketId));
  }

  async function handleOpenMarket(market: StorefrontMarket, source: string) {
    setRecentMarketIds(rememberViewedMarket(market).map((entry) => entry.id));

    try {
      await api.post(`/api/public/markets/${market.id}/track-click`, {
        source,
        visitor_key: getVisitorKey(),
      });
    } catch {
      // Tracking failure should never block navigation.
    }
  }

  const discountedHero = sections[0]?.markets[0];
  const vipHero = sections[1]?.markets[0] ?? sections[2]?.markets[0] ?? sections[3]?.markets[0] ?? sections[4]?.markets[0];

  return (
    <div className="space-y-6">
      <section className="public-market-hero page-enter">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <div className="command-chip">{copy.discoverMarkets}</div>
            <h1 className="mt-4 font-display text-4xl font-semibold tracking-[-0.06em] text-slate-950 dark:text-white md:text-6xl">
              {copy.fasterMarketplace}
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-600 dark:text-slate-300">{copy.summary}</p>
          </div>

          <div className="w-full xl:max-w-md">
            <div className="public-search-shell">
              <Search className="h-4 w-4 text-slate-400" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={copy.searchPlaceholder}
                className="border-0 bg-transparent pl-0 text-slate-950 placeholder:text-slate-400 focus-visible:ring-0 dark:text-white dark:placeholder:text-slate-500"
              />
            </div>
          </div>
        </div>

        <div className="public-category-strip">
          <button
            type="button"
            className={`public-category-tile ${categoryFilter === "all" ? "public-section-icon-cyan" : "public-category-tile-muted"}`}
            onClick={() => setCategoryFilter("all")}
          >
            <span className="public-category-tile__label">All categories</span>
          </button>
          {categories.map((category) => (
            <button
              key={category}
              type="button"
              className={`public-category-tile ${categoryFilter === category ? "public-section-icon-emerald" : "public-category-tile-muted"}`}
              onClick={() => setCategoryFilter(category)}
            >
              <span className="public-category-tile__label">{category}</span>
            </button>
          ))}

          {sections.map((section) => {
            const Icon = section.icon;

            return (
              <a key={section.id} href={`#${section.id}`} className={`public-category-tile ${section.accentClass}`}>
                <span className="public-category-tile__icon">
                  <Icon className="h-5 w-5" />
                </span>
                <span className="public-category-tile__label">{section.title}</span>
              </a>
            );
          })}

          <div className="public-category-tile public-category-tile-muted">
            <span className="public-category-tile__icon">
              <Users className="h-5 w-5" />
            </span>
            <span className="public-category-tile__label">{t("public.openWorkspace")}</span>
          </div>
        </div>
      </section>

      {marketsQ.isLoading ? (
        <div className="public-empty-state">{t("public.loadingMarkets")}</div>
      ) : marketsQ.isError ? (
        <div className="public-empty-state text-rose-500 dark:text-rose-300">{t("public.failedMarkets")}</div>
      ) : (
        <>
          {!!bannersQ.data?.length && (
            <section className="public-promo-grid page-enter page-enter-delay-1">
              {bannersQ.data.slice(0, 2).map((banner) => (
                <article key={banner.id} className={`public-promo-card ${banner.theme === "warm" ? "public-promo-card-warm" : "public-promo-card-cyan"}`}>
                  <div className="public-promo-card__content">
                    <div className="text-sm font-semibold uppercase tracking-[0.18em] text-white/70">{banner.market?.name || "Campaign"}</div>
                    <h3 className="mt-3 max-w-sm font-display text-4xl font-semibold tracking-[-0.05em] text-white">{banner.title}</h3>
                    <p className="mt-3 max-w-sm text-sm leading-7 text-white/80">{banner.subtitle || copy.openThisMarket}</p>
                    {banner.cta_url && (
                      <Button asChild className="mt-6 h-11 rounded-[16px] bg-white text-slate-950 hover:bg-white/90">
                        <Link to={banner.cta_url}>{banner.cta_label || copy.openMarket}</Link>
                      </Button>
                    )}
                  </div>
                  <div className="public-promo-card__badge">{banner.theme}</div>
                </article>
              ))}
            </section>
          )}

          <section className="public-promo-grid page-enter page-enter-delay-1">
            <PromoShowcase accentClass="public-promo-card-cyan" label={copy.discountedNow} market={discountedHero} title={copy.freshDiscounts} />
            <PromoShowcase accentClass="public-promo-card-warm" label={copy.popularNow} market={vipHero} title={copy.curatedPicks} />
          </section>

          {favoriteMarkets.length > 0 && (
            <MarketRail
              id="favorite-markets"
              title="Favorites"
              shortLabel="Saved"
              icon={Sparkles}
              accentClass="public-section-icon-amber"
              markets={favoriteMarkets}
              emptyText="No favorite markets yet."
              favoriteIds={favoriteIds}
              onOpen={handleOpenMarket}
              onToggleFavorite={handleToggleFavorite}
            />
          )}

          {recentMarkets.length > 0 && (
            <MarketRail
              id="recent-markets"
              title="Recently viewed"
              shortLabel="Recent"
              icon={Store}
              accentClass="public-section-icon-slate"
              markets={recentMarkets}
              emptyText="No recent markets yet."
              favoriteIds={favoriteIds}
              onOpen={handleOpenMarket}
              onToggleFavorite={handleToggleFavorite}
            />
          )}

          {sections.map((section) => (
            <MarketRail
              key={section.id}
              {...section}
              favoriteIds={favoriteIds}
              onOpen={handleOpenMarket}
              onToggleFavorite={handleToggleFavorite}
            />
          ))}
        </>
      )}
    </div>
  );
}
