import { ArrowRight, MapPin, ShoppingBasket, Sparkles, Store, Truck } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import ThemeToggle from "@/components/ThemeToggle";
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
  const launchSteps = [
    { icon: Store, title: t("public.step.pickMarket.title"), text: t("public.step.pickMarket.text") },
    { icon: ShoppingBasket, title: t("public.step.buildCart.title"), text: t("public.step.buildCart.text") },
    { icon: Truck, title: t("public.step.handoff.title"), text: t("public.step.handoff.text") },
  ];

  return (
    <div className="app-shell">
      <div className="glow-orb left-[8%] top-28 h-40 w-40 bg-cyan-300/18" />
      <div className="glow-orb right-[10%] top-[28rem] h-48 w-48 bg-orange-300/18" />

      <div className="relative z-10 mx-auto max-w-7xl space-y-6">
        <header className="hero-grid">
          <section className="hero-panel page-enter">
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

            <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
              <div>
                <div className="section-kicker">{t("public.heroKicker")}</div>
                <h1 className="font-display mt-4 max-w-4xl text-5xl font-semibold tracking-[-0.07em] text-white md:text-7xl">
                  {t("public.heroTitle")}
                </h1>
                <p className="mt-5 max-w-3xl text-base leading-8 text-slate-300 md:text-lg">
                  {t("public.heroText")}
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
              </div>

              <div className="hero-mesh">
                <div className="section-kicker">{t("public.liveAvailability")}</div>
                <div className="mt-4 font-display text-6xl font-semibold tracking-[-0.06em] text-white">{activeMarkets}</div>
                <div className="mt-2 text-sm leading-7 text-slate-300">{t("public.readyForOrders")}</div>
                <div className="mt-5 grid gap-3">
                  <div className="metric-block py-4">
                    <div className="section-kicker">{t("public.totalStorefronts")}</div>
                    <div className="theme-ink mt-2 text-lg font-semibold">{markets.length}</div>
                  </div>
                  <div className="metric-block py-4">
                    <div className="section-kicker">{t("public.howItWorks")}</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {launchSteps.map((step) => (
                        <span key={step.title} className="data-pill">
                          {step.title}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <Card className="page-enter page-enter-delay-1">
            <CardContent className="grid gap-5 p-6">
              <div>
                <div className="section-kicker">{t("public.howItWorks")}</div>
                <div className="font-display theme-ink mt-2 text-3xl font-semibold tracking-[-0.04em]">
                  {t("public.threeSteps")}
                </div>
                <div className="theme-copy mt-2 text-sm leading-7">
                  {t("public.heroText")}
                </div>
              </div>

              <div className="metric-block">
                <div className="section-kicker">{t("public.openNow")}</div>
                <div className="font-display theme-ink mt-2 text-4xl font-semibold tracking-[-0.05em]">{activeMarkets}</div>
                <div className="theme-copy mt-2 text-sm">{t("public.readyForOrders")}</div>
              </div>

              <div className="grid gap-3">
                {launchSteps.map((item) => {
                  const Icon = item.icon;
                  return (
                    <div key={item.title} className="subpanel flex items-start gap-3 p-4">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] border border-slate-200/80 bg-white dark:border-white/10 dark:bg-white/6">
                        <Icon className="theme-icon h-4 w-4" />
                      </div>
                      <div>
                        <div className="theme-ink font-semibold">{item.title}</div>
                        <div className="theme-copy mt-1 text-sm leading-6">{item.text}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </header>

        <section>
          <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="section-kicker">{t("public.availableMarkets")}</div>
              <h2 className="section-title mt-2">{t("public.browseTitle")}</h2>
              <p className="section-copy mt-3 max-w-2xl">{t("public.availableMarketsText")}</p>
            </div>
            <div className="status-chip">{activeMarkets} {t("public.activeNow")}</div>
          </div>

          {marketsQ.isLoading ? (
            <div className="dashboard-card theme-copy p-8 text-sm">{t("public.loadingMarkets")}</div>
          ) : marketsQ.isError ? (
            <div className="dashboard-card p-8 text-sm text-rose-700 dark:text-rose-100">{t("public.failedMarkets")}</div>
          ) : (
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {markets.map((market) => (
                <Card key={market.id}>
                  <CardContent className="grid gap-5 p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="section-kicker">{market.code}</div>
                        <h3 className="font-display theme-ink mt-2 text-4xl font-semibold tracking-[-0.05em]">{market.name}</h3>
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
