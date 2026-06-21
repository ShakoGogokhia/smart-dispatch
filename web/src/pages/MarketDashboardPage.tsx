import { AlertTriangle, BadgeDollarSign, PackageOpen, Star, Store } from "lucide-react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import type { MarketDashboardSummary } from "@/types/api";

export default function MarketDashboardPage() {
  const { marketId } = useParams();
  const dashboardQ = useQuery({
    queryKey: ["market-dashboard", marketId],
    queryFn: async () => (await api.get(`/api/markets/${marketId}/dashboard`)).data as MarketDashboardSummary,
    enabled: !!marketId,
  });

  const data = dashboardQ.data;

  return (
    <div className="grid gap-6">
      <div className="intro-panel">
        <h1 className="intro-title">Market dashboard</h1>
      </div>

      {dashboardQ.isLoading ? (
        <Card className="rounded-[30px]"><CardContent className="p-8 text-sm theme-copy">Loading dashboard...</CardContent></Card>
      ) : !data ? (
        <Card className="rounded-[30px]"><CardContent className="p-8 text-sm status-bad">Unable to load dashboard.</CardContent></Card>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <MarketMetric icon={Store} label="Orders" value={String(data.summary.orders)} />
            <MarketMetric icon={BadgeDollarSign} label="Revenue" value={formatMoney(data.summary.revenue)} />
            <MarketMetric icon={PackageOpen} label="Ready" value={String(data.summary.ready_orders)} />
            <MarketMetric icon={AlertTriangle} label="Stock alerts" value={String(data.summary.low_stock_count)} />
          </div>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
            <Card className="rounded-[30px]">
              <CardHeader><CardTitle className="text-2xl">Top items</CardTitle></CardHeader>
              <CardContent className="grid gap-3">
                {data.top_items.length === 0 ? (
                  <div className="rounded-[22px] border border-slate-200 p-5 text-sm theme-copy dark:border-slate-800">No sales in this range.</div>
                ) : data.top_items.map((item) => (
                  <div key={`${item.item_id}-${item.name}`} className="rounded-[22px] border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="font-semibold">{item.name}</div>
                        <div className="mt-1 text-sm theme-copy">{item.qty_sold} sold</div>
                      </div>
                      <Badge className="status-chip status-good">{formatMoney(item.revenue)}</Badge>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <div className="grid gap-6">
              <Card className="rounded-[30px]">
                <CardHeader><CardTitle className="text-2xl">Stock warnings</CardTitle></CardHeader>
                <CardContent className="grid gap-3">
                  {data.stock_warnings.slice(0, 6).map((item) => (
                    <div key={item.id} className="rounded-[20px] border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-300/15 dark:bg-amber-300/10 dark:text-amber-100">
                      <div className="font-semibold">{item.name}</div>
                      <div className="mt-1">Stock {item.stock_qty} / threshold {item.low_stock_threshold}</div>
                    </div>
                  ))}
                  {data.stock_warnings.length === 0 && <div className="text-sm theme-copy">No low-stock warnings.</div>}
                </CardContent>
              </Card>

              <Card className="rounded-[30px]">
                <CardHeader><CardTitle className="text-2xl">Ratings</CardTitle></CardHeader>
                <CardContent className="grid gap-3">
                  <MarketRating label="Market" value={data.rating_trends.market_average} count={data.rating_trends.market_count} />
                  <MarketRating label="Items" value={data.rating_trends.item_average} count={data.rating_trends.item_count} />
                </CardContent>
              </Card>
            </div>
          </div>

          <Card className="rounded-[30px]">
            <CardHeader><CardTitle className="text-2xl">Promo performance</CardTitle></CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {data.promo_performance.map((promo) => (
                <div key={promo.id} className="rounded-[22px] border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
                  <div className="font-semibold">{promo.code}</div>
                  <div className="mt-2 text-sm theme-copy">{promo.uses} uses{promo.max_uses ? ` / ${promo.max_uses}` : ""}</div>
                </div>
              ))}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function MarketMetric({ icon: Icon, label, value }: { icon: typeof Store; label: string; value: string }) {
  return (
    <Card className="rounded-[28px]">
      <CardContent className="p-5">
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
          <Icon className="h-4 w-4" />
          {label}
        </div>
        <div className="mt-4 text-3xl font-semibold tracking-[-0.05em]">{value}</div>
      </CardContent>
    </Card>
  );
}

function MarketRating({ label, value, count }: { label: string; value?: number | null; count: number }) {
  return (
    <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <Star className="h-4 w-4 text-amber-500" />
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold">{value ? Number(value).toFixed(1) : "-"}</div>
      <div className="mt-1 text-sm theme-copy">{count} reviews</div>
    </div>
  );
}
