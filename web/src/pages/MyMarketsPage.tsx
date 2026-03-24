import { ArrowRight, Package, Settings, Sparkles, TicketPercent } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { api } from "@/lib/api";
import { setActiveMarketId } from "@/lib/cart";
import { useI18n } from "@/lib/i18n";
import { formatMoney, toNumber } from "@/lib/format";
import type { StorefrontMarket } from "@/lib/storefront";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Market = StorefrontMarket;

export default function MyMarketsPage() {
  const { t } = useI18n();
  const marketsQ = useQuery({
    queryKey: ["my-markets"],
    queryFn: async () => (await api.get("/api/my/markets")).data as Market[],
  });

  const markets = marketsQ.data ?? [];
  const featuredCount = markets.filter((market) => market.is_featured).length;
  const promoCount = markets.filter((market) => market.active_promo).length;

  return (
    <div className="grid gap-6">
      <section className="intro-panel">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="command-chip">
              <Sparkles className="h-3.5 w-3.5" />
              {t("nav.markets")}
            </div>
            <h1 className="intro-title">{t("markets.myTitle")}</h1>
            <p className="intro-copy">{t("markets.myText")}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="status-chip">{markets.length} markets</span>
            <span className="status-chip">{featuredCount} promoted</span>
            <span className="status-chip">{promoCount} live offers</span>
          </div>
        </div>
      </section>

      {marketsQ.isLoading ? (
        <Card className="rounded-[30px]">
          <CardContent className="p-8 text-sm text-slate-600">{t("public.loadingMarkets")}</CardContent>
        </Card>
      ) : marketsQ.isError ? (
        <Card className="rounded-[30px]">
          <CardContent className="p-8 text-sm text-red-700">{t("public.failedMarkets")}</CardContent>
        </Card>
      ) : (
        <div className="grid gap-5 xl:grid-cols-2">
          {markets.map((market) => (
            <Card key={market.id} className={market.is_featured ? "market-card-featured rounded-[30px]" : "rounded-[30px]"}>
              <CardHeader>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="text-xs uppercase tracking-[0.24em] text-slate-500">{market.code}</div>
                  {market.is_featured && <span className="status-chip status-good">{market.featured_badge || "Promoted"}</span>}
                  {market.active_promo && <span className="status-chip status-warn">{market.active_promo.code}</span>}
                </div>
                <CardTitle className="font-display text-3xl">{market.name}</CardTitle>
                <p className="text-sm text-slate-600">{market.featured_headline || market.address || t("market.noAddress")}</p>
              </CardHeader>
              <CardContent className="grid gap-4">
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="subpanel p-4">
                    <div className="section-kicker">Visibility</div>
                    <div className="theme-ink mt-2 font-semibold">{market.is_active ? "Live storefront" : "Hidden storefront"}</div>
                  </div>
                  <div className="subpanel p-4">
                    <div className="section-kicker">Catalog</div>
                    <div className="theme-ink mt-2 font-semibold">{market.active_items_count ?? 0} visible items</div>
                  </div>
                  <div className="subpanel p-4">
                    <div className="section-kicker">Offer</div>
                    <div className="theme-ink mt-2 font-semibold">
                      {market.active_promo
                        ? market.active_promo.type === "percent"
                          ? `${toNumber(market.active_promo.value)}% off`
                          : `${formatMoney(market.active_promo.value)} off`
                        : "No live promo"}
                    </div>
                  </div>
                </div>

                <Button
                  asChild
                  className="justify-between rounded-2xl"
                  onClick={() => setActiveMarketId(String(market.id))}
                >
                  <Link to={`/markets/${market.id}`}>
                    <span className="inline-flex items-center gap-2">
                      <Settings className="h-4 w-4" />
                      {t("markets.openSettings")}
                    </span>
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>

                <div className="grid gap-3 md:grid-cols-2">
                  <Button
                    asChild
                    variant="secondary"
                    className="justify-start rounded-2xl"
                    onClick={() => setActiveMarketId(String(market.id))}
                  >
                    <Link to={`/markets/${market.id}/items`}>
                      <Package className="mr-2 h-4 w-4" />
                      {t("markets.manageItems")}
                    </Link>
                  </Button>
                  <Button
                    asChild
                    variant="secondary"
                    className="justify-start rounded-2xl"
                    onClick={() => setActiveMarketId(String(market.id))}
                  >
                    <Link to={`/markets/${market.id}/promo-codes`}>
                      <TicketPercent className="mr-2 h-4 w-4" />
                      {t("markets.managePromos")}
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
          {markets.length === 0 && (
            <Card className="rounded-[30px]">
              <CardContent className="p-8 text-sm text-slate-600">{t("markets.noAssigned")}</CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
