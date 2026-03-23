import { ArrowRight, Clock3, MapPin, ShoppingBasket, Store, Truck } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

type Market = {
  id: number;
  name: string;
  code: string;
  address?: string | null;
  is_active: boolean;
};

export default function PublicMarketsPage() {
  const { language, setLanguage, t } = useI18n();
  const marketsQ = useQuery({
    queryKey: ["public-markets"],
    queryFn: async () => (await api.get("/api/public/markets")).data as Market[],
  });

  const markets = marketsQ.data ?? [];
  const activeMarkets = markets.filter((market) => market.is_active).length;

  return (
    <div className="app-shell">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
          <section className="ink-panel page-enter p-6 md:p-10">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="command-chip">Public marketplace</div>
              <div className="flex gap-2">
                <Button
                  variant={language === "ka" ? "secondary" : "ghost"}
                  className="h-10 rounded-[16px] border-white/20 text-white hover:bg-white/10"
                  onClick={() => setLanguage("ka")}
                >
                  {t("lang.ka")}
                </Button>
                <Button
                  variant={language === "en" ? "secondary" : "ghost"}
                  className="h-10 rounded-[16px] border-white/20 text-white hover:bg-white/10"
                  onClick={() => setLanguage("en")}
                >
                  {t("lang.en")}
                </Button>
              </div>
            </div>

            <h1 className="font-display mt-8 max-w-4xl text-5xl font-semibold tracking-[-0.06em] text-white md:text-7xl">
              Pick a market. Build a cart. Hand the order into dispatch without friction.
            </h1>
            <p className="mt-5 max-w-3xl text-base leading-8 text-slate-300 md:text-lg">
              The storefront is rebuilt around a clearer catalog-first journey with a more editorial structure and less template-looking UI.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild className="h-12 px-6 text-base">
                <Link to={markets[0] ? `/m/${markets[0].id}` : "/"}>
                  {t("public.openMarket")}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="secondary" className="h-12 px-6 text-base">
                <Link to="/login">{t("public.staffWorkspace")}</Link>
              </Button>
            </div>
          </section>

          <section className="grid gap-4">
            <div className="metric-dark page-enter page-enter-delay-1">
              <div className="section-kicker text-slate-300">{t("public.availableMarkets")}</div>
              <div className="mt-3 font-display text-7xl font-semibold tracking-[-0.05em]">{markets.length}</div>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1">
              <div className="metric-block page-enter page-enter-delay-2">
                <Clock3 className="h-5 w-5" />
                <div className="mt-4 font-semibold text-slate-950">Active now</div>
                <div className="mt-2 text-sm leading-7 text-slate-600">{activeMarkets} live markets are currently open for ordering.</div>
              </div>
              <div className="metric-block page-enter page-enter-delay-3">
                <Truck className="h-5 w-5" />
                <div className="mt-4 font-semibold text-slate-950">Built for delivery handoff</div>
                <div className="mt-2 text-sm leading-7 text-slate-600">Cart and checkout are designed to carry location context cleanly into dispatch.</div>
              </div>
            </div>
          </section>
        </header>

        <section className="dashboard-card page-enter">
          <div className="grid gap-4 md:grid-cols-3">
            {[
              { icon: Store, title: "Choose market", text: "Start from a real storefront, not a generic list." },
              { icon: ShoppingBasket, title: "Build cart", text: "Quantities and price changes stay visible while browsing." },
              { icon: MapPin, title: "Deliver cleanly", text: "Address and order intent survive the entire flow." },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.title} className="metric-block">
                  <Icon className="h-5 w-5" />
                  <div className="mt-4 font-display text-2xl font-semibold tracking-[-0.04em] text-slate-950">{item.title}</div>
                  <div className="mt-2 text-sm leading-7 text-slate-600">{item.text}</div>
                </div>
              );
            })}
          </div>
        </section>

        <section>
          <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="section-kicker">{t("public.availableMarkets")}</div>
              <h2 className="section-title mt-2">Browse live storefronts</h2>
              <p className="section-copy mt-3 max-w-2xl">{t("public.availableMarketsText")}</p>
            </div>
            <div className="status-chip">{activeMarkets} active now</div>
          </div>

          {marketsQ.isLoading ? (
            <div className="dashboard-card p-8 text-sm text-slate-600">{t("public.loadingMarkets")}</div>
          ) : marketsQ.isError ? (
            <div className="dashboard-card p-8 text-sm text-red-700">{t("public.failedMarkets")}</div>
          ) : (
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {markets.map((market) => (
                <Card key={market.id} className="bg-[#fffaf0]">
                  <CardContent className="grid gap-5 p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="section-kicker">{market.code}</div>
                        <h3 className="font-display mt-2 text-4xl font-semibold tracking-[-0.05em] text-slate-950">{market.name}</h3>
                      </div>
                      <div className={`status-chip ${market.is_active ? "bg-[#dff3e8] text-emerald-900" : "bg-[#efe6d6] text-slate-600"}`}>
                        {market.is_active ? t("public.open") : t("public.closed")}
                      </div>
                    </div>

                    <div className="rounded-[20px] border-2 border-slate-950 bg-white p-4 text-sm leading-7 text-slate-700">
                      {market.address || "Address coming soon"}
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
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
