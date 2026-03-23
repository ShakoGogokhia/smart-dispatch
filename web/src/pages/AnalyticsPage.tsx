import { BarChart3, CheckCircle2, Package2, Route, TrendingUp, XCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

type AnalyticsSummary = {
  range: { from: string; to: string };
  orders: {
    total: number;
    delivered: number;
    failed: number;
    cancelled: number;
  };
  routes_planned: number;
};

export default function AnalyticsPage() {
  const { t } = useI18n();
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
      <section className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="dashboard-card page-enter">
          <div className="command-chip">{t("analytics.board")}</div>
          <h1 className="section-title mt-5">{t("analytics.titleLong")}</h1>
          <p className="section-copy mt-4 max-w-3xl">
            {t("analytics.heroText")}
          </p>
          <div className="mt-6">
            <Button variant="secondary" className="h-12" onClick={() => summaryQ.refetch()}>
              {t("analytics.refresh")}
            </Button>
          </div>
        </div>

        <div className="metric-dark page-enter page-enter-delay-1">
          <div className="section-kicker text-slate-300">{t("analytics.deliveryRate")}</div>
          <div className="mt-3 font-display text-7xl font-semibold tracking-[-0.06em]">{deliveredRate}%</div>
          <div className="mt-4 h-4 rounded-full border border-white/20 bg-white/10 p-1">
            <div className="h-full rounded-full bg-[#ffd67d]" style={{ width: `${Math.min(deliveredRate, 100)}%` }} />
          </div>
          <div className="mt-4 text-sm leading-7 text-slate-300">
            {t("analytics.deliveryRateText")}
          </div>
        </div>
      </section>

      {summaryQ.isLoading ? (
        <Card>
          <CardContent className="p-8 text-sm text-slate-600">{t("analytics.loading")}</CardContent>
        </Card>
      ) : summaryQ.isError || !summary ? (
        <Card>
          <CardContent className="p-8 text-sm text-red-700">{t("analytics.failed")}</CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <StatCard title={t("analytics.totalOrders")} value={summary.orders.total} icon={Package2} tone="light" />
            <StatCard title={t("analytics.delivered")} value={summary.orders.delivered} icon={CheckCircle2} tone="green" />
            <StatCard title={t("analytics.failedCount")} value={summary.orders.failed} icon={XCircle} tone="red" />
            <StatCard title={t("analytics.cancelled")} value={summary.orders.cancelled} icon={BarChart3} tone="sand" />
            <StatCard title={t("analytics.routesPlanned")} value={summary.routes_planned} icon={Route} tone="dark" />
          </div>

          <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
            <Card>
              <CardHeader>
                <CardTitle className="font-display text-3xl font-semibold tracking-[-0.04em]">{t("analytics.reportingRange")}</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 text-sm leading-7 text-slate-700">
                <div className="metric-block">
                  <div className="section-kicker">{t("common.from")}</div>
                  <div className="mt-2 font-semibold text-slate-950">{summary.range.from}</div>
                </div>
                <div className="metric-block">
                  <div className="section-kicker">{t("common.to")}</div>
                  <div className="mt-2 font-semibold text-slate-950">{summary.range.to}</div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="font-display text-3xl font-semibold tracking-[-0.04em]">{t("analytics.readingGuide")}</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <div className="metric-block">
                  <TrendingUp className="h-5 w-5" />
                  <div className="mt-4 font-semibold text-slate-950">{t("analytics.fastSummary")}</div>
                  <div className="mt-2 text-sm leading-7 text-slate-600">
                    {t("analytics.fastSummaryText")}
                  </div>
                </div>
                <div className="metric-block">
                  <BarChart3 className="h-5 w-5" />
                  <div className="mt-4 font-semibold text-slate-950">{t("analytics.backendContract")}</div>
                  <div className="mt-2 text-sm leading-7 text-slate-600">
                    {t("analytics.backendContractText")}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({
  title,
  value,
  icon: Icon,
  tone,
}: {
  title: string;
  value: number;
  icon: typeof Package2;
  tone: "light" | "green" | "red" | "sand" | "dark";
}) {
  const toneMap: Record<typeof tone, string> = {
    light: "bg-white dark:bg-white/6",
    green: "bg-emerald-50 dark:bg-emerald-300/12",
    red: "bg-rose-50 dark:bg-rose-300/12",
    sand: "bg-amber-50 dark:bg-amber-300/12",
    dark: "bg-slate-950 text-white dark:bg-slate-900",
  };

  return (
    <div className={`metric-block ${toneMap[tone]}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className={`section-kicker ${tone === "dark" ? "text-slate-300" : ""}`}>{title}</div>
          <div className="mt-3 font-display text-5xl font-semibold tracking-[-0.05em]">{value}</div>
        </div>
        <div
          className={`flex h-12 w-12 items-center justify-center rounded-[16px] border border-slate-200 dark:border-white/10 ${tone === "dark" ? "bg-amber-100 text-slate-950 dark:bg-amber-200" : "bg-white dark:bg-white/10"}`}
        >
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}
