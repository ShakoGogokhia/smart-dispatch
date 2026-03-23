import { BarChart3, CheckCircle2, Package2, Route, TrendingUp, XCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";

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
          <div className="command-chip">Analytics board</div>
          <h1 className="section-title mt-5">Operational performance, stripped down to the signals that matter.</h1>
          <p className="section-copy mt-4 max-w-3xl">
            This layout behaves more like a reporting board than a dashboard demo. It prioritizes strong labels,
            compact metrics, and a clear read of delivery health.
          </p>
          <div className="mt-6">
            <Button variant="secondary" className="h-12" onClick={() => summaryQ.refetch()}>
              Refresh analytics
            </Button>
          </div>
        </div>

        <div className="metric-dark page-enter page-enter-delay-1">
          <div className="section-kicker text-slate-300">Delivery rate</div>
          <div className="mt-3 font-display text-7xl font-semibold tracking-[-0.06em]">{deliveredRate}%</div>
          <div className="mt-4 h-4 rounded-full border border-white/20 bg-white/10 p-1">
            <div className="h-full rounded-full bg-[#ffd67d]" style={{ width: `${Math.min(deliveredRate, 100)}%` }} />
          </div>
          <div className="mt-4 text-sm leading-7 text-slate-300">
            Delivered orders divided by total orders in the currently reported backend range.
          </div>
        </div>
      </section>

      {summaryQ.isLoading ? (
        <Card>
          <CardContent className="p-8 text-sm text-slate-600">Loading analytics...</CardContent>
        </Card>
      ) : summaryQ.isError || !summary ? (
        <Card>
          <CardContent className="p-8 text-sm text-red-700">
            Failed to load analytics from `/api/analytics/summary`.
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <StatCard title="Total orders" value={summary.orders.total} icon={Package2} tone="light" />
            <StatCard title="Delivered" value={summary.orders.delivered} icon={CheckCircle2} tone="green" />
            <StatCard title="Failed" value={summary.orders.failed} icon={XCircle} tone="red" />
            <StatCard title="Cancelled" value={summary.orders.cancelled} icon={BarChart3} tone="sand" />
            <StatCard title="Routes planned" value={summary.routes_planned} icon={Route} tone="dark" />
          </div>

          <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
            <Card className="bg-[#efe6d6]">
              <CardHeader>
                <CardTitle className="font-display text-3xl font-semibold tracking-[-0.04em]">Reporting range</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 text-sm leading-7 text-slate-700">
                <div className="metric-block">
                  <div className="section-kicker">From</div>
                  <div className="mt-2 font-semibold text-slate-950">{summary.range.from}</div>
                </div>
                <div className="metric-block">
                  <div className="section-kicker">To</div>
                  <div className="mt-2 font-semibold text-slate-950">{summary.range.to}</div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="font-display text-3xl font-semibold tracking-[-0.04em]">Reading guide</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <div className="metric-block">
                  <TrendingUp className="h-5 w-5" />
                  <div className="mt-4 font-semibold text-slate-950">Fast summary first</div>
                  <div className="mt-2 text-sm leading-7 text-slate-600">
                    The board starts with rate and volume so the team can spot whether today is a fulfillment problem or a demand problem.
                  </div>
                </div>
                <div className="metric-block">
                  <BarChart3 className="h-5 w-5" />
                  <div className="mt-4 font-semibold text-slate-950">Backend contract preserved</div>
                  <div className="mt-2 text-sm leading-7 text-slate-600">
                    This page still mirrors the current `/api/analytics/summary` payload without inventing extra data.
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
    light: "bg-white",
    green: "bg-[#dff3e8]",
    red: "bg-[#f9ddd8]",
    sand: "bg-[#efe6d6]",
    dark: "bg-[#10313a] text-white",
  };

  return (
    <div className={`metric-block ${toneMap[tone]}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className={`section-kicker ${tone === "dark" ? "text-slate-300" : ""}`}>{title}</div>
          <div className="mt-3 font-display text-5xl font-semibold tracking-[-0.05em]">{value}</div>
        </div>
        <div
          className={`flex h-12 w-12 items-center justify-center rounded-[16px] border-2 border-slate-950 ${tone === "dark" ? "bg-[#fff4d7] text-slate-950" : "bg-white"}`}
        >
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}
