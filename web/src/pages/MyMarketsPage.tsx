import { ArrowRight, Package, Settings, TicketPercent } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { api } from "@/lib/api";
import { setActiveMarketId } from "@/lib/cart";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Market = {
  id: number;
  name: string;
  code: string;
  address?: string | null;
  is_active: boolean;
};

export default function MyMarketsPage() {
  const { t } = useI18n();
  const marketsQ = useQuery({
    queryKey: ["my-markets"],
    queryFn: async () => (await api.get("/api/my/markets")).data as Market[],
  });

  const markets = marketsQ.data ?? [];

  return (
    <div className="grid gap-6">
      <div className="rounded-[30px] bg-[linear-gradient(135deg,_rgba(251,191,36,0.15),_rgba(255,255,255,0.95)),linear-gradient(180deg,_#fffefb_0%,_#f8f4ec_100%)] p-6">
        <div className="text-xs uppercase tracking-[0.24em] text-slate-500">{t("nav.markets")}</div>
        <h1 className="font-display mt-2 text-4xl font-semibold tracking-tight text-slate-950">
          {t("markets.myTitle")}
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          {t("markets.myText")}
        </p>
      </div>

      {marketsQ.isLoading ? (
        <Card className="rounded-[30px]">
          <CardContent className="p-8 text-sm text-slate-600">{t("public.loadingMarkets")}</CardContent>
        </Card>
      ) : marketsQ.isError ? (
        <Card className="rounded-[30px]">
          <CardContent className="p-8 text-sm text-red-700">{t("public.failedMarkets")}</CardContent>
        </Card>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          {markets.map((market) => (
            <Card key={market.id} className="rounded-[30px]">
              <CardHeader>
                <div className="text-xs uppercase tracking-[0.24em] text-slate-500">{market.code}</div>
                <CardTitle className="font-display text-3xl">{market.name}</CardTitle>
                <p className="text-sm text-slate-600">{market.address || t("market.noAddress")}</p>
              </CardHeader>
              <CardContent className="grid gap-3">
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
              <CardContent className="p-8 text-sm text-slate-600">
                {t("markets.noAssigned")}
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
