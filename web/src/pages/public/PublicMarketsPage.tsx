import {
  ArrowRight,
  Clock3,
  MapPin,
  ShoppingBasket,
  Sparkles,
  Store,
  Truck,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

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
    <div className="relative min-h-screen overflow-hidden px-4 py-5 md:px-6 md:py-6">
      <div className="aurora-orb left-[6%] top-[7%] h-44 w-44 bg-orange-400/24" />
      <div className="aurora-orb right-[8%] top-[20%] h-56 w-56 bg-teal-400/18 [animation-delay:1.2s]" />
      <div className="aurora-orb bottom-[8%] left-[42%] h-40 w-40 bg-amber-200/18 [animation-delay:2.1s]" />

      <div className="relative mx-auto max-w-7xl">
        <header className="hero-surface animated-enter px-6 py-7 md:px-10 md:py-10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(255,255,255,0.12),_transparent_28%),linear-gradient(135deg,_rgba(255,176,86,0.16),_transparent_40%)]" />

          <div className="relative grid gap-8 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="animated-enter animated-enter-delay-1">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/7 px-4 py-2 text-sm text-slate-100">
                <Sparkles className="h-4 w-4 text-amber-300" />
                {t("public.badge")}
              </div>

              <h1 className="font-display mt-6 max-w-3xl text-4xl font-bold tracking-[-0.05em] md:text-6xl xl:text-7xl">
                {t("public.heroTitle")}
              </h1>

              <p className="mt-5 max-w-2xl text-base leading-7 text-slate-300 md:text-lg">
                {t("public.heroText")}
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                {[t("public.feature.catalog"), t("public.feature.cart"), t("public.feature.checkout")].map((feature) => (
                  <div
                    key={feature}
                    className="rounded-full border border-white/10 bg-white/6 px-4 py-2 text-sm text-slate-100 backdrop-blur"
                  >
                    {feature}
                  </div>
                ))}
              </div>

              <div className="mt-8 flex flex-wrap gap-3">
                <Button asChild className="h-12 rounded-2xl px-6 text-base">
                  <Link to={markets[0] ? `/m/${markets[0].id}` : "/"}>
                    {t("public.openMarket")}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild variant="secondary" className="h-12 rounded-2xl border-0 bg-white/10 px-6 text-white hover:bg-white/16">
                  <Link to="/login">{t("public.staffWorkspace")}</Link>
                </Button>
              </div>

              <div className="mt-8 flex gap-2">
                <Button
                  variant={language === "ka" ? "default" : "secondary"}
                  className="rounded-2xl"
                  onClick={() => setLanguage("ka")}
                >
                  {t("lang.ka")}
                </Button>
                <Button
                  variant={language === "en" ? "default" : "secondary"}
                  className="rounded-2xl"
                  onClick={() => setLanguage("en")}
                >
                  {t("lang.en")}
                </Button>
              </div>
            </div>

            <div className="animated-enter animated-enter-delay-2 grid gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="metric-card relative overflow-hidden">
                  <div className="absolute right-4 top-4 rounded-2xl bg-white/10 p-3">
                    <ShoppingBasket className="h-5 w-5 text-amber-300" />
                  </div>
                  <div className="text-sm uppercase tracking-[0.24em] text-slate-400">{t("public.availableMarkets")}</div>
                  <div className="mt-4 text-4xl font-bold text-white">{markets.length}</div>
                  <div className="mt-2 text-sm leading-6 text-slate-300">
                    Browse nearby storefronts and jump straight into ordering.
                  </div>
                </div>

                <div className="metric-card relative overflow-hidden">
                  <div className="absolute right-4 top-4 rounded-2xl bg-white/10 p-3">
                    <Clock3 className="h-5 w-5 text-teal-300" />
                  </div>
                  <div className="text-sm uppercase tracking-[0.24em] text-slate-400">Live ready</div>
                  <div className="mt-4 text-4xl font-bold text-white">{activeMarkets}</div>
                  <div className="mt-2 text-sm leading-6 text-slate-300">
                    Active markets can move from catalog to dispatch without extra friction.
                  </div>
                </div>
              </div>

              <div className="rounded-[30px] border border-white/10 bg-white/6 p-5">
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl bg-white/10 p-3">
                    <Truck className="h-5 w-5 text-orange-300" />
                  </div>
                  <div>
                    <div className="text-sm uppercase tracking-[0.24em] text-slate-400">Flow</div>
                    <div className="font-display text-2xl font-bold text-white">Browse to doorstep</div>
                  </div>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  {[
                    { icon: Store, title: "Choose market", text: "Jump into any storefront without losing speed." },
                    { icon: ShoppingBasket, title: "Build cart", text: "Keep quantities, discounts, and intent visible." },
                    { icon: MapPin, title: "Hand off cleanly", text: "Location context carries into the delivery flow." },
                  ].map((item) => {
                    const Icon = item.icon;
                    return (
                      <div key={item.title} className="rounded-[24px] border border-white/8 bg-black/10 p-4">
                        <Icon className="h-5 w-5 text-white" />
                        <div className="mt-4 font-semibold text-white">{item.title}</div>
                        <div className="mt-2 text-sm leading-6 text-slate-300">{item.text}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </header>

        <section className="mt-8">
          <div className="animated-enter animated-enter-delay-3 mb-5 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="section-heading">{t("public.availableMarkets")}</h2>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600 md:text-base">
                {t("public.availableMarketsText")}
              </p>
            </div>
            <div className="rounded-full border border-slate-200/80 bg-white/75 px-4 py-2 text-sm text-slate-700 shadow-sm backdrop-blur">
              {activeMarkets} active now
            </div>
          </div>

          {marketsQ.isLoading ? (
            <div className="glass-panel p-8 text-sm text-slate-600">{t("public.loadingMarkets")}</div>
          ) : marketsQ.isError ? (
            <div className="glass-panel p-8 text-sm text-red-700">{t("public.failedMarkets")}</div>
          ) : (
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {markets.map((market, index) => (
                <Card
                  key={market.id}
                  className={`mesh-card animated-enter ${index % 3 === 1 ? "animated-enter-delay-1" : index % 3 === 2 ? "animated-enter-delay-2" : ""}`}
                >
                  <CardContent className="p-0">
                    <div className="relative overflow-hidden p-6">
                      <div className="absolute right-0 top-0 h-28 w-28 rounded-full bg-orange-200/35 blur-3xl" />
                      <div className="relative flex items-start justify-between gap-4">
                        <div>
                          <div className="text-xs uppercase tracking-[0.24em] text-slate-500">{market.code}</div>
                          <h3 className="font-display mt-2 text-3xl font-bold tracking-[-0.04em] text-slate-950">
                            {market.name}
                          </h3>
                        </div>
                        <div
                          className={[
                            "rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em]",
                            market.is_active
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-slate-100 text-slate-500",
                          ].join(" ")}
                        >
                          {market.is_active ? t("public.open") : t("public.closed")}
                        </div>
                      </div>

                      <div className="mt-6 flex items-start gap-2 text-sm leading-6 text-slate-600">
                        <MapPin className="mt-1 h-4 w-4 shrink-0 text-slate-400" />
                        <span>{market.address || "Address coming soon"}</span>
                      </div>
                    </div>

                    <div className="border-t border-slate-200/70 p-6">
                      <div className="mb-5 rounded-[24px] bg-slate-950 px-4 py-4 text-white">
                        <div className="text-xs uppercase tracking-[0.24em] text-slate-400">Experience</div>
                        <div className="mt-2 text-sm leading-6 text-slate-300">
                          Fast catalog browsing, saved cart state, and a smoother route into checkout.
                        </div>
                      </div>

                      <Button asChild className="group h-12 w-full rounded-2xl">
                        <Link to={`/m/${market.id}`}>
                          {t("public.openMarket")}
                          <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                        </Link>
                      </Button>
                    </div>
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
