import {
  AlertTriangle,
  BadgeDollarSign,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  ExternalLink,
  Package,
  PackageOpen,
  Receipt,
  Settings,
  Star,
  Store,
  TicketPercent,
  TrendingUp,
} from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { PageHeader } from "@/components/app/page-header";
import { StatCard, StatGrid } from "@/components/app/stat-card";
import { EmptyState } from "@/components/app/empty-state";
import { LoadingState } from "@/components/app/loading-state";
import { StatusBadge } from "@/components/app/status-badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { api } from "@/lib/api";
import { formatDateTime, formatMoney, toNumber } from "@/lib/format";
import type { MarketDashboardSummary } from "@/types/api";

export default function MarketDashboardPage() {
  const { marketId } = useParams();
  const dashboardQ = useQuery({
    queryKey: ["market-dashboard", marketId],
    queryFn: async () => (await api.get(`/api/markets/${marketId}/dashboard`)).data as MarketDashboardSummary,
    enabled: !!marketId,
  });

  const data = dashboardQ.data;
  const orders = data?.summary.orders ?? 0;
  const revenue = toNumber(data?.summary.revenue);
  const avgOrder = orders > 0 ? revenue / orders : 0;
  const maxItemRevenue = Math.max(1, ...(data?.top_items ?? []).map((item) => toNumber(item.revenue)));

  return (
    <div className="space-y-6">
      <PageHeader
        title={data?.market.name ? `${data.market.name} dashboard` : "Market dashboard"}
        description={
          data?.range
            ? `Sales, stock and promotion performance from ${formatDateTime(data.range.from)} to ${formatDateTime(data.range.to)}.`
            : "Sales, stock and promotion performance for this market."
        }
        breadcrumbs={[{ label: "My markets", to: "/my-markets" }, { label: data?.market.name ?? "Dashboard" }]}
        actions={
          marketId ? (
            <>
              <Button asChild variant="outline">
                <Link to={`/markets/${marketId}/items`}>
                  <Package />
                  Products
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link to={`/markets/${marketId}`}>
                  <Settings />
                  Settings
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link to={`/m/${marketId}`} target="_blank" rel="noreferrer">
                  <ExternalLink />
                  Storefront
                </Link>
              </Button>
            </>
          ) : null
        }
      />

      {dashboardQ.isLoading ? (
        <LoadingState rows={4} />
      ) : !data ? (
        <Alert variant="destructive">
          <AlertDescription>Unable to load dashboard.</AlertDescription>
        </Alert>
      ) : (
        <>
          <StatGrid>
            <StatCard icon={Store} label="Orders" value={data.summary.orders} tone="primary" />
            <StatCard icon={BadgeDollarSign} label="Revenue" value={formatMoney(data.summary.revenue)} tone="success" />
            <StatCard icon={Receipt} label="Average order" value={formatMoney(avgOrder)} hint="Revenue / orders" />
            <StatCard icon={Clock3} label="Pending orders" value={data.summary.pending_orders} tone="warning" />
            <StatCard icon={PackageOpen} label="Ready" value={data.summary.ready_orders} tone="info" />
            <StatCard icon={CheckCircle2} label="Delivered" value={data.summary.delivered_orders} tone="success" />
            <StatCard
              icon={AlertTriangle}
              label="Stock alerts"
              value={data.summary.low_stock_count}
              tone={data.summary.low_stock_count > 0 ? "destructive" : "default"}
            />
            <StatCard icon={ClipboardCheck} label="Pending approvals" value={data.summary.pending_approvals} />
          </StatGrid>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
            <Card>
              <CardHeader>
                <CardTitle>Top items</CardTitle>
                <CardDescription>Best sellers by revenue in this period.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3">
                {data.top_items.length === 0 ? (
                  <EmptyState compact icon={TrendingUp} title="No sales in this range" description="Top-selling items will appear here once orders come in." />
                ) : (
                  data.top_items.map((item, index) => (
                    <div key={`${item.item_id}-${item.name}`} className="grid gap-2 rounded-lg border bg-muted/30 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-semibold tabular-nums text-muted-foreground">
                            {index + 1}
                          </span>
                          <div className="min-w-0">
                            <div className="truncate font-medium">{item.name}</div>
                            <div className="text-xs text-muted-foreground tabular-nums">{item.qty_sold} sold</div>
                          </div>
                        </div>
                        <div className="shrink-0 font-semibold tabular-nums">{formatMoney(item.revenue)}</div>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-chart-1" style={{ width: `${(toNumber(item.revenue) / maxItemRevenue) * 100}%` }} />
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <div className="grid content-start gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Stock warnings</CardTitle>
                  <CardDescription>Items at or below their low-stock threshold.</CardDescription>
                  {marketId ? (
                    <CardAction>
                      <Button asChild variant="ghost" size="sm">
                        <Link to={`/markets/${marketId}/inventory-alerts`}>View all</Link>
                      </Button>
                    </CardAction>
                  ) : null}
                </CardHeader>
                <CardContent className="grid gap-3">
                  {data.stock_warnings.length === 0 ? (
                    <EmptyState compact icon={CheckCircle2} title="No low-stock warnings" />
                  ) : (
                    data.stock_warnings.slice(0, 6).map((item) => {
                      const out = item.stock_qty <= 0;
                      const pct = item.low_stock_threshold > 0 ? Math.min(100, (item.stock_qty / item.low_stock_threshold) * 100) : 0;
                      return (
                        <div key={item.id} className="grid gap-2 rounded-lg border bg-muted/30 p-3">
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0 truncate text-sm font-medium">{item.name}</div>
                            <StatusBadge tone={out ? "destructive" : "warning"}>{out ? "Out of stock" : "Low"}</StatusBadge>
                          </div>
                          <Progress
                            value={pct}
                            className={out ? "bg-destructive/15 [&>[data-slot=progress-indicator]]:bg-destructive" : "bg-warning/20 [&>[data-slot=progress-indicator]]:bg-warning"}
                          />
                          <div className="text-xs text-muted-foreground tabular-nums">
                            Stock {item.stock_qty} / threshold {item.low_stock_threshold}
                          </div>
                        </div>
                      );
                    })
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Ratings</CardTitle>
                  <CardDescription>Average customer review scores.</CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-3">
                  <MarketRating label="Market" value={data.rating_trends.market_average} count={data.rating_trends.market_count} />
                  <MarketRating label="Items" value={data.rating_trends.item_average} count={data.rating_trends.item_count} />
                </CardContent>
              </Card>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Promo performance</CardTitle>
              <CardDescription>How often each promo code has been used.</CardDescription>
              {marketId ? (
                <CardAction>
                  <Button asChild variant="ghost" size="sm">
                    <Link to={`/markets/${marketId}/promo-codes`}>Manage</Link>
                  </Button>
                </CardAction>
              ) : null}
            </CardHeader>
            <CardContent>
              {data.promo_performance.length === 0 ? (
                <EmptyState compact icon={TicketPercent} title="No promo codes yet" description="Create a promo code to start tracking usage." />
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {data.promo_performance.map((promo) => (
                    <div key={promo.id} className="grid gap-2 rounded-lg border bg-muted/30 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="truncate font-mono text-sm font-semibold">{promo.code}</div>
                        <StatusBadge tone={promo.is_active ? "success" : "neutral"}>{promo.is_active ? "Active" : "Inactive"}</StatusBadge>
                      </div>
                      <div className="text-sm text-muted-foreground tabular-nums">
                        {promo.uses} uses{promo.max_uses ? ` / ${promo.max_uses}` : ""}
                      </div>
                      {promo.max_uses ? <Progress value={Math.min(100, (promo.uses / promo.max_uses) * 100)} /> : null}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function MarketRating({ label, value, count }: { label: string; value?: number | null; count: number }) {
  return (
    <div className="rounded-lg border bg-muted/30 p-3">
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Star className="size-3.5 fill-warning text-warning" />
        {label}
      </div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value ? Number(value).toFixed(1) : "-"}</div>
      <div className="text-xs text-muted-foreground">{count} reviews</div>
    </div>
  );
}
