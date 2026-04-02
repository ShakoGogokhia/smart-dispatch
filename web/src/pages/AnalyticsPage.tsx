import {
  CheckCircle2,
  Clock3,
  Package2,
  Route,
  Star,
  TrendingUp,
  TriangleAlert,
  RefreshCcw,
  BarChart3,
  Activity,
  DollarSign,
  Truck,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import type { AnalyticsSummary } from "@/types/api";

const copy = {
  board: "Analytics board",
  title: "Operational performance in a cleaner, more advanced layout.",
  intro:
    "Track top metrics, market results, delivery trends, and driver performance in a sharper and easier-to-read dashboard.",
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
  loading: "Loading analytics...",
  revenue: "Revenue",
  rating: "Avg rating",
  assigned: "Assigned",
};

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

  return (
    <div className="grid gap-6">
      <section className="relative overflow-hidden rounded-[28px] border border-slate-200/70 bg-gradient-to-br from-white via-slate-50 to-cyan-50/70 p-6 shadow-[0_10px_40px_rgba(15,23,42,0.08)] dark:border-white/10 dark:from-slate-950 dark:via-slate-900 dark:to-slate-900">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-16 -right-10 h-44 w-44 rounded-full bg-cyan-400/10 blur-3xl" />
          <div className="absolute -bottom-20 -left-10 h-52 w-52 rounded-full bg-sky-400/10 blur-3xl" />
        </div>

        <div className="relative grid gap-6 xl:grid-cols-[1.25fr_0.95fr]">
          <div className="space-y-5">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-700 dark:border-cyan-400/20 dark:bg-cyan-400/10 dark:text-cyan-200">
              <BarChart3 className="h-3.5 w-3.5" />
              {text.board}
            </div>

            <div className="space-y-3">
              <h1 className="text-3xl font-semibold tracking-[-0.04em] text-slate-950 dark:text-white md:text-4xl">
                {text.title}
              </h1>
              <p className="max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">
                {text.intro}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button
                variant="secondary"
                className="h-11 rounded-xl border border-slate-200 bg-white px-5 text-slate-900 shadow-sm hover:bg-slate-50 dark:border-white/10 dark:bg-white/10 dark:text-white dark:hover:bg-white/15"
                onClick={() => summaryQ.refetch()}
              >
                <RefreshCcw className="mr-2 h-4 w-4" />
                {text.refresh}
              </Button>

              <div className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white/80 px-4 py-2 text-sm text-slate-600 shadow-sm dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
                <Activity className="h-4 w-4 text-cyan-600 dark:text-cyan-300" />
                Live operational overview
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <HeroMetric
              title={text.deliveryRate}
              value={`${deliveredRate}%`}
              icon={TrendingUp}
              hint="Completed successfully"
            />
            <HeroMetric
              title={text.onTimeRate}
              value={summary?.on_time_rate != null ? `${summary.on_time_rate}%` : "-"}
              icon={Clock3}
              hint="Delivered on schedule"
            />
          </div>
        </div>
      </section>

      {summaryQ.isLoading ? (
        <Card className="overflow-hidden rounded-[24px] border border-slate-200/70 shadow-sm dark:border-white/10 dark:bg-slate-900/70">
          <CardContent className="flex items-center gap-3 p-8 text-sm text-slate-700 dark:text-slate-300">
            <div className="h-3 w-3 animate-pulse rounded-full bg-cyan-500" />
            {text.loading}
          </CardContent>
        </Card>
      ) : summaryQ.isError || !summary ? (
        <Card className="overflow-hidden rounded-[24px] border border-rose-200/70 bg-rose-50/80 shadow-sm dark:border-rose-400/20 dark:bg-rose-500/10">
          <CardContent className="p-8 text-sm font-medium text-rose-700 dark:text-rose-100">
            {text.noData}
          </CardContent>
        </Card>
      ) : (
        <>
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <StatCard title={text.totalOrders} value={summary.orders.total} icon={Package2} tone="light" />
            <StatCard title={text.delivered} value={summary.orders.delivered} icon={CheckCircle2} tone="green" />
            <StatCard title={text.failed} value={summary.orders.failed} icon={TriangleAlert} tone="red" />
            <StatCard title={text.cancelled} value={summary.orders.cancelled} icon={Clock3} tone="sand" />
            <StatCard title={text.routesPlanned} value={summary.routes_planned} icon={Route} tone="dark" />
          </section>

          <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
            <Card className="rounded-[24px] border border-slate-200/70 shadow-sm dark:border-white/10 dark:bg-slate-900/70">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-lg font-semibold tracking-[-0.03em] text-slate-950 dark:text-white">
                      {text.trend}
                    </CardTitle>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      {text.from} {summary.range.from} {text.to} {summary.range.to}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-slate-100 p-3 text-slate-700 dark:bg-white/10 dark:text-slate-100">
                    <TrendingUp className="h-5 w-5" />
                  </div>
                </div>
              </CardHeader>

              <CardContent className="grid gap-3">
                {(summary.trend ?? []).map((entry) => {
                  const rate = entry.total > 0 ? Math.round((entry.delivered / entry.total) * 100) : 0;

                  return (
                    <div
                      key={entry.date}
                      className="rounded-[20px] border border-slate-200/70 bg-gradient-to-r from-white to-slate-50 p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md dark:border-white/10 dark:from-white/5 dark:to-white/[0.03]"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="space-y-2">
                          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                            {entry.date}
                          </div>
                          <div className="text-base font-semibold text-slate-900 dark:text-white">
                            {entry.total} total - {entry.delivered} delivered
                          </div>
                          <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-200">
                              {rate}% success
                            </span>
                            <span className="rounded-full bg-rose-50 px-2.5 py-1 text-rose-700 dark:bg-rose-400/10 dark:text-rose-200">
                              {entry.cancelled} cancelled
                            </span>
                          </div>
                        </div>

                        <div className="min-w-[140px]">
                          <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-white/10">
                            <div
                              className="h-full rounded-full bg-slate-900 dark:bg-white"
                              style={{ width: `${Math.min(rate, 100)}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            <Card className="rounded-[24px] border border-slate-200/70 shadow-sm dark:border-white/10 dark:bg-slate-900/70">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-3">
                  <CardTitle className="text-lg font-semibold tracking-[-0.03em] text-slate-950 dark:text-white">
                    {text.funnel}
                  </CardTitle>
                  <div className="rounded-2xl bg-slate-100 p-3 text-slate-700 dark:bg-white/10 dark:text-slate-100">
                    <Activity className="h-5 w-5" />
                  </div>
                </div>
              </CardHeader>

              <CardContent className="grid gap-3">
                {Object.entries(summary.funnel ?? {}).map(([key, value]) => (
                  <div
                    key={key}
                    className="flex items-center justify-between rounded-[18px] border border-slate-200/70 bg-slate-50 px-4 py-3 text-sm shadow-sm dark:border-white/10 dark:bg-white/[0.04]"
                  >
                    <span className="font-medium capitalize text-slate-600 dark:text-slate-300">
                      {key.replaceAll("_", " ")}
                    </span>
                    <span className="text-base font-semibold text-slate-950 dark:text-white">{value}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </section>

          <section className="grid gap-6 xl:grid-cols-2">
            <Card className="rounded-[24px] border border-slate-200/70 shadow-sm dark:border-white/10 dark:bg-slate-900/70">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-3">
                  <CardTitle className="text-lg font-semibold tracking-[-0.03em] text-slate-950 dark:text-white">
                    {text.byMarket}
                  </CardTitle>
                  <div className="rounded-2xl bg-slate-100 p-3 text-slate-700 dark:bg-white/10 dark:text-slate-100">
                    <DollarSign className="h-5 w-5" />
                  </div>
                </div>
              </CardHeader>

              <CardContent className="grid gap-3">
                {(summary.by_market ?? []).map((entry) => {
                  const marketRate = entry.orders > 0 ? Math.round((entry.delivered / entry.orders) * 100) : 0;

                  return (
                    <div
                      key={entry.market_id}
                      className="rounded-[20px] border border-slate-200/70 bg-gradient-to-r from-white to-slate-50 p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md dark:border-white/10 dark:from-white/5 dark:to-white/[0.03]"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="space-y-2">
                          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                            {entry.market_code}
                          </div>
                          <div className="text-base font-semibold text-slate-900 dark:text-white">
                            {entry.market_name}
                          </div>
                          <div className="text-sm text-slate-600 dark:text-slate-300">
                            {entry.orders} orders - {entry.delivered} delivered
                          </div>
                          <div className="inline-flex rounded-full bg-cyan-50 px-2.5 py-1 text-xs font-semibold text-cyan-700 dark:bg-cyan-400/10 dark:text-cyan-200">
                            {marketRate}% delivery rate
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                            {text.revenue}
                          </div>
                          <div className="mt-2 text-lg font-semibold text-slate-900 dark:text-white">
                            {formatMoney(entry.revenue)}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            <Card className="rounded-[24px] border border-slate-200/70 shadow-sm dark:border-white/10 dark:bg-slate-900/70">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-3">
                  <CardTitle className="text-lg font-semibold tracking-[-0.03em] text-slate-950 dark:text-white">
                    {text.byDriver}
                  </CardTitle>
                  <div className="rounded-2xl bg-slate-100 p-3 text-slate-700 dark:bg-white/10 dark:text-slate-100">
                    <Truck className="h-5 w-5" />
                  </div>
                </div>
              </CardHeader>

              <CardContent className="grid gap-3">
                {(summary.by_driver ?? []).map((entry) => {
                  const driverRate = entry.assigned > 0 ? Math.round((entry.delivered / entry.assigned) * 100) : 0;

                  return (
                    <div
                      key={entry.driver_id}
                      className="rounded-[20px] border border-slate-200/70 bg-gradient-to-r from-white to-slate-50 p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md dark:border-white/10 dark:from-white/5 dark:to-white/[0.03]"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="space-y-2">
                          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                            {text.assigned}
                          </div>
                          <div className="text-base font-semibold text-slate-900 dark:text-white">
                            {entry.driver_name}
                          </div>
                          <div className="text-sm text-slate-600 dark:text-slate-300">
                            {entry.assigned} assigned - {entry.delivered} delivered - {entry.failed} failed
                          </div>
                          <div className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:bg-white/10 dark:text-slate-200">
                            {driverRate}% completion
                          </div>
                        </div>

                        <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-sm font-semibold text-amber-700 dark:border-amber-300/15 dark:bg-amber-300/10 dark:text-amber-200">
                          <Star className="h-4 w-4 fill-current" />
                          {entry.avg_rating || "-"}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </section>
        </>
      )}
    </div>
  );
}

function HeroMetric({
  title,
  value,
  icon: Icon,
  hint,
}: {
  title: string;
  value: string;
  icon: typeof TrendingUp;
  hint?: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-[24px] border border-slate-200/70 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.06)] dark:border-white/10 dark:bg-white/[0.05]">
      <div className="absolute right-0 top-0 h-24 w-24 rounded-full bg-cyan-400/10 blur-2xl" />

      <div className="relative flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
            {title}
          </div>
          <div className="mt-3 text-5xl font-semibold tracking-[-0.06em] text-slate-950 dark:text-white">
            {value}
          </div>
          {hint ? (
            <div className="mt-3 text-sm text-slate-600 dark:text-slate-300">{hint}</div>
          ) : null}
        </div>

        <div className="flex h-12 w-12 items-center justify-center rounded-[18px] bg-cyan-50 text-cyan-700 shadow-sm dark:bg-cyan-300/12 dark:text-cyan-100">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  icon: Icon,
  tone = "light",
}: {
  title: string;
  value: number;
  icon: typeof Package2;
  tone?: "light" | "green" | "red" | "sand" | "dark";
}) {
  const toneMap: Record<typeof tone, string> = {
    light:
      "border-slate-200/70 bg-white text-slate-950 dark:border-white/10 dark:bg-white/[0.05] dark:text-white",
    green:
      "border-emerald-200/70 bg-emerald-50/90 text-emerald-950 dark:border-emerald-300/15 dark:bg-emerald-300/10 dark:text-white",
    red:
      "border-rose-200/70 bg-rose-50/90 text-rose-950 dark:border-rose-300/15 dark:bg-rose-300/10 dark:text-white",
    sand:
      "border-amber-200/70 bg-amber-50/90 text-amber-950 dark:border-amber-300/15 dark:bg-amber-300/10 dark:text-white",
    dark: "border-slate-900 bg-slate-950 text-white dark:border-slate-800 dark:bg-slate-900",
  };

  const iconTone =
    tone === "dark"
      ? "bg-white/10 text-white border-white/10"
      : "bg-white text-slate-700 border-slate-200/80 dark:bg-white/10 dark:text-slate-100 dark:border-white/10";

  const labelTone = tone === "dark" ? "text-slate-300" : "text-slate-500 dark:text-slate-400";

  return (
    <div
      className={`rounded-[24px] border p-5 shadow-[0_10px_30px_rgba(15,23,42,0.05)] transition-all hover:-translate-y-0.5 hover:shadow-md ${toneMap[tone]}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className={`text-xs font-semibold uppercase tracking-[0.18em] ${labelTone}`}>
            {title}
          </div>
          <div className="mt-3 text-5xl font-semibold tracking-[-0.06em]">{value}</div>
        </div>

        <div
          className={`flex h-12 w-12 items-center justify-center rounded-[18px] border shadow-sm ${iconTone}`}
        >
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}