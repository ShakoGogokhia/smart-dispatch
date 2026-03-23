import { BarChart3, CheckCircle2, Package2, Route, XCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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
      <div className="rounded-[30px] bg-[linear-gradient(135deg,_rgba(20,184,166,0.18),_rgba(255,255,255,0.96)),linear-gradient(180deg,_#fbfffe_0%,_#f0fbf7_100%)] p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Analytics</div>
            <h1 className="font-display mt-2 text-4xl font-semibold tracking-tight text-slate-950">
              Operational performance snapshot
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              Summary cards are mapped to the current backend response from
              `/api/analytics/summary`.
            </p>
          </div>
          <Button variant="secondary" className="w-fit rounded-2xl" onClick={() => summaryQ.refetch()}>
            Refresh analytics
          </Button>
        </div>
      </div>

      {summaryQ.isLoading ? (
        <Card className="rounded-[30px]">
          <CardContent className="p-8 text-sm text-slate-600">Loading analytics...</CardContent>
        </Card>
      ) : summaryQ.isError || !summary ? (
        <Card className="rounded-[30px]">
          <CardContent className="p-8 text-sm text-red-700">
            Failed to load analytics from `/api/analytics/summary`.
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-5">
            <StatCard title="Total orders" value={summary.orders.total} icon={Package2} tone="amber" />
            <StatCard title="Delivered" value={summary.orders.delivered} icon={CheckCircle2} tone="emerald" />
            <StatCard title="Failed" value={summary.orders.failed} icon={XCircle} tone="red" />
            <StatCard title="Cancelled" value={summary.orders.cancelled} icon={BarChart3} tone="slate" />
            <StatCard title="Routes planned" value={summary.routes_planned} icon={Route} tone="teal" />
          </div>

          <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
            <Card className="rounded-[30px]">
              <CardHeader>
                <CardTitle className="font-display text-2xl">Delivery rate</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4">
                <div className="text-6xl font-semibold tracking-tight text-slate-950">{deliveredRate}%</div>
                <div className="text-sm text-slate-600">
                  Percentage of delivered orders in the selected summary range.
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-teal-500"
                    style={{ width: `${Math.min(deliveredRate, 100)}%` }}
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-[30px]">
              <CardHeader>
                <CardTitle className="font-display text-2xl">Summary range</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 text-sm text-slate-600">
                <div className="rounded-[24px] bg-slate-50 p-4">
                  From <span className="font-semibold text-slate-950">{summary.range.from}</span> to{" "}
                  <span className="font-semibold text-slate-950">{summary.range.to}</span>
                </div>
                <div className="rounded-[24px] bg-slate-50 p-4">
                  The backend currently reports totals, delivered, failed, cancelled, and planned
                  routes. This page mirrors that exact contract.
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
  tone: "amber" | "emerald" | "red" | "slate" | "teal";
}) {
  const toneMap: Record<typeof tone, string> = {
    amber: "from-amber-100 to-orange-50 text-amber-900",
    emerald: "from-emerald-100 to-emerald-50 text-emerald-900",
    red: "from-red-100 to-rose-50 text-red-900",
    slate: "from-slate-100 to-slate-50 text-slate-900",
    teal: "from-teal-100 to-cyan-50 text-teal-900",
  };

  return (
    <Card className={`rounded-[30px] bg-gradient-to-br ${toneMap[tone]}`}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm text-slate-500">{title}</div>
            <div className="mt-3 text-4xl font-semibold tracking-tight">{value}</div>
          </div>
          <div className="rounded-2xl bg-white/70 p-3">
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
