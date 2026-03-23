import { ArrowRight, Clock3, MapPin, ShoppingBasket, Store } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { api } from "@/lib/api";
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
  const marketsQ = useQuery({
    queryKey: ["public-markets"],
    queryFn: async () => (await api.get("/api/public/markets")).data as Market[],
  });

  const markets = marketsQ.data ?? [];

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(251,191,36,0.28),_transparent_22%),radial-gradient(circle_at_bottom_right,_rgba(45,212,191,0.20),_transparent_28%),linear-gradient(180deg,_#071120_0%,_#11203b_34%,_#f7f1e8_34%,_#f7f1e8_100%)] px-4 py-5 md:px-6">
      <div className="mx-auto max-w-7xl">
        <header className="grid gap-6 rounded-[36px] border border-white/10 bg-slate-950/78 p-7 text-white shadow-[0_28px_70px_rgba(15,23,42,0.4)] backdrop-blur md:p-10 lg:grid-cols-[1.2fr_0.8fr]">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200">
              <Store className="h-4 w-4 text-amber-300" />
              Order from active markets
            </div>
            <h1 className="font-display mt-6 max-w-3xl text-4xl font-semibold tracking-tight md:text-6xl">
              A polished storefront for every market connected to Smart Dispatch.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-slate-300 md:text-lg">
              Browse available markets, open their item catalogs, fill your cart, and send
              orders straight into the dispatch workflow.
            </p>
            <div className="mt-8 flex flex-wrap gap-3 text-sm text-slate-200">
              <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2">
                Public catalog browsing
              </div>
              <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2">
                Cart persistence per market
              </div>
              <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2">
                Dispatch-ready checkout
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-1">
            <div className="rounded-[28px] border border-white/10 bg-white/6 p-5">
              <ShoppingBasket className="h-5 w-5 text-amber-300" />
              <div className="mt-4 text-3xl font-semibold">{markets.length}</div>
              <div className="mt-1 text-sm text-slate-300">Active markets available now</div>
            </div>
            <div className="rounded-[28px] border border-white/10 bg-white/6 p-5">
              <MapPin className="h-5 w-5 text-teal-300" />
              <div className="mt-4 text-xl font-semibold">Location-aware delivery inputs</div>
              <div className="mt-1 text-sm text-slate-300">
                Checkout captures address and coordinates for dispatch.
              </div>
            </div>
            <div className="rounded-[28px] border border-white/10 bg-white/6 p-5">
              <Clock3 className="h-5 w-5 text-orange-300" />
              <div className="mt-4 text-xl font-semibold">Designed for fast handoff</div>
              <div className="mt-1 text-sm text-slate-300">
                The public flow moves cleanly into the authenticated workspace.
              </div>
            </div>
          </div>
        </header>

        <section className="mt-8">
          <div className="mb-5 flex items-end justify-between gap-4">
            <div>
              <h2 className="section-heading">Available markets</h2>
              <p className="mt-2 text-sm text-slate-600">
                Customers can browse publicly. Staff can sign in for operational tools.
              </p>
            </div>
            <Button asChild variant="secondary" className="hidden rounded-2xl md:inline-flex">
              <Link to="/login">Open staff workspace</Link>
            </Button>
          </div>

          {marketsQ.isLoading ? (
            <div className="glass-panel p-8 text-sm text-slate-600">Loading markets...</div>
          ) : marketsQ.isError ? (
            <div className="glass-panel p-8 text-sm text-red-700">
              Could not load markets from `/api/public/markets`.
            </div>
          ) : (
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {markets.map((market) => (
                <Card
                  key={market.id}
                  className="overflow-hidden rounded-[30px] border-white/30 bg-white/82 shadow-[0_24px_60px_rgba(15,23,42,0.10)]"
                >
                  <CardContent className="p-0">
                    <div className="bg-[linear-gradient(135deg,_rgba(251,191,36,0.22),_rgba(255,255,255,0)),linear-gradient(180deg,_#fffefb_0%,_#fff8ef_100%)] p-6">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="text-xs uppercase tracking-[0.24em] text-slate-500">
                            {market.code}
                          </div>
                          <h3 className="mt-2 font-display text-2xl font-semibold tracking-tight text-slate-950">
                            {market.name}
                          </h3>
                        </div>
                        <div className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">
                          {market.is_active ? "Open" : "Closed"}
                        </div>
                      </div>
                      <div className="mt-5 flex items-start gap-2 text-sm text-slate-600">
                        <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                        <span>{market.address || "Address not provided yet"}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-6">
                      <p className="max-w-[16rem] text-sm leading-6 text-slate-600">
                        Browse available items, collect discounts, and start checkout when you are
                        ready.
                      </p>
                      <Button asChild className="rounded-2xl">
                        <Link to={`/m/${market.id}`}>
                          Open market
                          <ArrowRight className="ml-2 h-4 w-4" />
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
