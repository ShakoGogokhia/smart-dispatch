import { AlertCircle, CheckCircle2, Clock3, Package2, RefreshCcw, Route, Star, TrendingUp, TriangleAlert, XCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import { EmptyState } from "@/components/app/empty-state";
import { LoadingState } from "@/components/app/loading-state";
import { PageHeader } from "@/components/app/page-header";
import { StatCard } from "@/components/app/stat-card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import type { AnalyticsSummary } from "@/types/api";

const copy = {
  board: "Analytics",
  intro: "Track top metrics, market results, delivery trends and driver performance.",
  refresh: "Refresh",
  deliveryRate: "Delivery rate",
  onTimeRate: "On-time rate",
  totalOrders: "Total orders",
  delivered: "Delivered",
  failed: "Failed",
  cancelled: "Cancelled",
  routesPlanned: "Routes planned",
  trend: "Recent trend",
  byMarket: "By market",
  byDriver: "By driver",
  funnel: "Fulfillment funnel",
  from: "From",
  to: "To",
  noData: "No analytics data available.",
  revenue: "Revenue",
  rating: "Avg rating",
  assigned: "Assigned",
};

function Legend({ items }: { items: Array<{ label: string; color: string }> }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {items.map((item) => (
        <span key={item.label} className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm" style={{ background: item.color }} />
          {item.label}
        </span>
      ))}
    </div>
  );
}

function RankBadge({ rank }: { rank: number }) {
  return (
    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold tabular-nums text-muted-foreground">
      {rank}
    </span>
  );
}

export default function AnalyticsPage() {
  const text = copy;

  const summaryQ = useQuery({
    queryKey: ["analytics-summary"],
    queryFn: async () => (await api.get("/api/analytics/summary")).data as AnalyticsSummary,
  });

  const summary = summaryQ.data;

  const deliveredRate =
    summary && summary.orders.total > 0
      ? Math.round((summary.orders.delivered / summary.orders.total) * 100)
      : 0;

  const trend = summary?.trend ?? [];
  const maxTrend = Math.max(1, ...trend.map((entry) => entry.total));
  const funnelEntries = Object.entries(summary?.funnel ?? {});
  const maxFunnel = Math.max(1, ...funnelEntries.map(([, value]) => Number(value) || 0));
  const markets = [...(summary?.by_market ?? [])].sort((a, b) => Number(b.revenue) - Number(a.revenue));
  const drivers = [...(summary?.by_driver ?? [])].sort((a, b) => b.delivered - a.delivered);

  return (
    <div className="space-y-6">
      <PageHeader
        title={text.board}
        description={
          summary?.range ? `${text.intro} ${text.from} ${summary.range.from} ${text.to} ${summary.range.to}.` : text.intro
        }
        actions={
          <Button variant="outline" onClick={() => summaryQ.refetch()} disabled={summaryQ.isFetching}>
            <RefreshCcw className={summaryQ.isFetching ? "animate-spin" : undefined} />
            {text.refresh}
          </Button>
        }
      />

      {summaryQ.isLoading ? (
        <LoadingState rows={4} />
      ) : summaryQ.isError || !summary ? (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertTitle>{text.noData}</AlertTitle>
          <AlertDescription>Try refreshing in a moment.</AlertDescription>
        </Alert>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <StatCard label={text.deliveryRate} value={`${deliveredRate}%`} icon={TrendingUp} tone="success" hint="Orders completed successfully" />
            <StatCard
              label={text.onTimeRate}
              value={summary.on_time_rate != null ? `${summary.on_time_rate}%` : "-"}
              icon={Clock3}
              tone="info"
              hint="Delivered on schedule"
            />
          </div>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
            <StatCard label={text.totalOrders} value={summary.orders.total} icon={Package2} tone="primary" />
            <StatCard label={text.delivered} value={summary.orders.delivered} icon={CheckCircle2} tone="success" />
            <StatCard label={text.failed} value={summary.orders.failed} icon={TriangleAlert} tone="destructive" />
            <StatCard label={text.cancelled} value={summary.orders.cancelled} icon={XCircle} tone="warning" />
            <StatCard label={text.routesPlanned} value={summary.routes_planned} icon={Route} />
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
            <Card>
              <CardHeader>
                <CardTitle>{text.trend}</CardTitle>
                <CardDescription>Orders per day, split by outcome.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4">
                <Legend
                  items={[
                    { label: text.delivered, color: "var(--chart-2)" },
                    { label: text.cancelled, color: "var(--chart-5)" },
                    { label: "Other", color: "var(--chart-1)" },
                  ]}
                />
                {trend.length === 0 ? (
                  <EmptyState compact icon={TrendingUp} title="No trend data yet" />
                ) : (
                  <div className="grid gap-3">
                    {trend.map((entry) => {
                      const rate = entry.total > 0 ? Math.round((entry.delivered / entry.total) * 100) : 0;
                      const other = Math.max(0, entry.total - entry.delivered - entry.cancelled);
                      const pct = (value: number) => `${(value / maxTrend) * 100}%`;
                      return (
                        <div key={entry.date} className="grid gap-1.5">
                          <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-xs">
                            <span className="font-medium tabular-nums">{entry.date}</span>
                            <span className="text-muted-foreground tabular-nums">
                              {entry.total} total · {entry.delivered} delivered · {entry.cancelled} cancelled · {rate}% success
                            </span>
                          </div>
                          <div className="flex h-2.5 overflow-hidden rounded-full bg-muted">
                            <div style={{ width: pct(entry.delivered), background: "var(--chart-2)" }} />
                            <div style={{ width: pct(entry.cancelled), background: "var(--chart-5)" }} />
                            <div style={{ width: pct(other), background: "var(--chart-1)" }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{text.funnel}</CardTitle>
                <CardDescription>How many orders reached each stage.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3">
                {funnelEntries.length === 0 ? (
                  <EmptyState compact title="No funnel data" />
                ) : (
                  funnelEntries.map(([key, value]) => (
                    <div key={key} className="grid gap-1.5">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground capitalize">{key.replaceAll("_", " ")}</span>
                        <span className="font-semibold tabular-nums">{value}</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${((Number(value) || 0) / maxFunnel) * 100}%`, background: "var(--chart-3)" }}
                        />
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <Card className="gap-0 pb-0">
              <CardHeader className="pb-4">
                <CardTitle>{text.byMarket}</CardTitle>
                <CardDescription>Ranked by {text.revenue.toLowerCase()}.</CardDescription>
              </CardHeader>
              <CardContent className="px-0">
                {markets.length === 0 ? (
                  <EmptyState compact title="No market data" className="pb-6" />
                ) : (
                  <div className="divide-y border-t">
                    {markets.map((entry, index) => {
                      const marketRate = entry.orders > 0 ? Math.round((entry.delivered / entry.orders) * 100) : 0;
                      return (
                        <div key={entry.market_id} className="flex items-center gap-3 px-6 py-3">
                          <RankBadge rank={index + 1} />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-baseline gap-2">
                              <span className="truncate text-sm font-medium">{entry.market_name}</span>
                              <span className="shrink-0 text-xs text-muted-foreground">{entry.market_code}</span>
                            </div>
                            <div className="text-xs text-muted-foreground tabular-nums">
                              {entry.orders} orders · {entry.delivered} delivered · {marketRate}% delivery rate
                            </div>
                            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                              <div className="h-full rounded-full" style={{ width: `${marketRate}%`, background: "var(--chart-1)" }} />
                            </div>
                          </div>
                          <div className="shrink-0 text-right">
                            <div className="text-xs text-muted-foreground">{text.revenue}</div>
                            <div className="text-sm font-semibold tabular-nums">{formatMoney(entry.revenue)}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="gap-0 pb-0">
              <CardHeader className="pb-4">
                <CardTitle>{text.byDriver}</CardTitle>
                <CardDescription>Ranked by deliveries completed.</CardDescription>
              </CardHeader>
              <CardContent className="px-0">
                {drivers.length === 0 ? (
                  <EmptyState compact title="No driver data" className="pb-6" />
                ) : (
                  <div className="divide-y border-t">
                    {drivers.map((entry, index) => {
                      const driverRate = entry.assigned > 0 ? Math.round((entry.delivered / entry.assigned) * 100) : 0;
                      return (
                        <div key={entry.driver_id} className="flex items-center gap-3 px-6 py-3">
                          <RankBadge rank={index + 1} />
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-medium">{entry.driver_name}</div>
                            <div className="text-xs text-muted-foreground tabular-nums">
                              {entry.assigned} {text.assigned.toLowerCase()} · {entry.delivered} delivered · {entry.failed} failed ·{" "}
                              {driverRate}% completion
                            </div>
                            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                              <div className="h-full rounded-full" style={{ width: `${driverRate}%`, background: "var(--chart-2)" }} />
                            </div>
                          </div>
                          <div className="flex shrink-0 items-center gap-1 text-sm font-semibold tabular-nums" title={text.rating}>
                            <Star className="size-4 fill-warning text-warning" />
                            {entry.avg_rating || "-"}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
