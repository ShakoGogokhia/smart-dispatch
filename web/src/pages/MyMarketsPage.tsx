import { ArrowRight, Package, Settings, TicketPercent } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { api } from "@/lib/api";
import { setActiveMarketId } from "@/lib/cart";
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
  const marketsQ = useQuery({
    queryKey: ["my-markets"],
    queryFn: async () => (await api.get("/api/my/markets")).data as Market[],
  });

  const markets = marketsQ.data ?? [];

  return (
    <div className="grid gap-6">
      <div className="rounded-[30px] bg-[linear-gradient(135deg,_rgba(251,191,36,0.15),_rgba(255,255,255,0.95)),linear-gradient(180deg,_#fffefb_0%,_#f8f4ec_100%)] p-6">
        <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Markets</div>
        <h1 className="font-display mt-2 text-4xl font-semibold tracking-tight text-slate-950">
          Your assigned markets
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Choose a market to manage items, staff, and promo codes.
        </p>
      </div>

      {marketsQ.isLoading ? (
        <Card className="rounded-[30px]">
          <CardContent className="p-8 text-sm text-slate-600">Loading markets...</CardContent>
        </Card>
      ) : marketsQ.isError ? (
        <Card className="rounded-[30px]">
          <CardContent className="p-8 text-sm text-red-700">Failed to load your markets.</CardContent>
        </Card>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          {markets.map((market) => (
            <Card key={market.id} className="rounded-[30px]">
              <CardHeader>
                <div className="text-xs uppercase tracking-[0.24em] text-slate-500">{market.code}</div>
                <CardTitle className="font-display text-3xl">{market.name}</CardTitle>
                <p className="text-sm text-slate-600">{market.address || "No address provided"}</p>
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
                      Open settings
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
                      Manage items
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
                      Promo codes
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
          {markets.length === 0 && (
            <Card className="rounded-[30px]">
              <CardContent className="p-8 text-sm text-slate-600">
                No markets are currently assigned to your account.
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
