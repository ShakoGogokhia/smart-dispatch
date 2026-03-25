import { CheckCircle2, Clock3, Package2, Route, Star, TrendingUp, TriangleAlert } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import type { AnalyticsSummary } from "@/types/api";

const copy = {
  en: {
    board: "Analytics board",
    title: "Operational performance in a cleaner, easier-to-read layout.",
    intro: "The page now keeps the top metrics, trend movement, market breakdown, and driver performance in higher-contrast cards.",
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
  },
  ka: {
    board: "ანალიტიკის დაფა",
    title: "ოპერაციული შედეგები უფრო სუფთა და ადვილად წასაკითხ განლაგებაში.",
    intro: "გვერდი ახლა მთავარ მეტრიკებს, ტრენდს, ბაზრების ჭრილს და მძღოლების შედეგებს უფრო მკაფიო ბარათებში აჩვენებს.",
    refresh: "განახლება",
    deliveryRate: "მიწოდების მაჩვენებელი",
    onTimeRate: "დროულობის მაჩვენებელი",
    totalOrders: "ჯამური შეკვეთები",
    delivered: "მიწოდებული",
    failed: "ვერ შესრულდა",
    cancelled: "გაუქმებული",
    routesPlanned: "დაგეგმილი მარშრუტები",
    trend: "ბოლო ტრენდი",
    byMarket: "ბაზრების მიხედვით",
    byDriver: "მძღოლების მიხედვით",
    funnel: "შესრულების funnel",
    from: "დან",
    to: "მდე",
    noData: "ანალიტიკის მონაცემები ვერ მოიძებნა.",
    loading: "ანალიტიკა იტვირთება...",
    revenue: "შემოსავალი",
    rating: "საშ. შეფასება",
    assigned: "მინიჭებული",
  },
} as const;

export default function AnalyticsPage() {
  const { language } = useI18n();
  const text = copy[language];
  const summaryQ = useQuery({
    queryKey: ["analytics-summary"],
    queryFn: async () => (await api.get("/api/analytics/summary")).data as AnalyticsSummary,
  });

  const summary = summaryQ.data;
  const deliveredRate =
    summary && summary.orders.total > 0 ? Math.round((summary.orders.delivered / summary.orders.total) * 100) : 0;

  return (
    <div className="grid gap-6">
      <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="dashboard-card">
          <div className="command-chip">{text.board}</div>
          <h1 className="section-title mt-4">{text.title}</h1>
          <p className="section-copy mt-3 max-w-3xl">{text.intro}</p>
          <div className="mt-5">
            <Button variant="secondary" className="h-11" onClick={() => summaryQ.refetch()}>
              {text.refresh}
            </Button>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <HeroMetric title={text.deliveryRate} value={`${deliveredRate}%`} icon={TrendingUp} />
          <HeroMetric title={text.onTimeRate} value={summary?.on_time_rate != null ? `${summary.on_time_rate}%` : "-"} icon={Clock3} />
        </div>
      </section>

      {summaryQ.isLoading ? (
        <Card>
          <CardContent className="p-8 text-sm text-slate-700 dark:text-slate-300">{text.loading}</CardContent>
        </Card>
      ) : summaryQ.isError || !summary ? (
        <Card>
          <CardContent className="p-8 text-sm text-rose-700 dark:text-rose-100">{text.noData}</CardContent>
        </Card>
      ) : (
        <>
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <StatCard title={text.totalOrders} value={summary.orders.total} icon={Package2} />
            <StatCard title={text.delivered} value={summary.orders.delivered} icon={CheckCircle2} tone="green" />
            <StatCard title={text.failed} value={summary.orders.failed} icon={TriangleAlert} tone="red" />
            <StatCard title={text.cancelled} value={summary.orders.cancelled} icon={Clock3} tone="sand" />
            <StatCard title={text.routesPlanned} value={summary.routes_planned} icon={Route} tone="dark" />
          </section>

          <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
            <Card>
              <CardHeader>
                <CardTitle className="panel-title">{text.trend}</CardTitle>
                <p className="panel-copy">
                  {text.from} {summary.range.from} {text.to} {summary.range.to}
                </p>
              </CardHeader>
              <CardContent className="grid gap-3">
                {(summary.trend ?? []).map((entry) => (
                  <div key={entry.date} className="subpanel p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="section-kicker">{entry.date}</div>
                        <div className="theme-ink mt-2 font-semibold">
                          {entry.total} total • {entry.delivered} delivered
                        </div>
                      </div>
                      <span className="status-chip">{entry.cancelled} cancelled</span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="panel-title">{text.funnel}</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3">
                {Object.entries(summary.funnel ?? {}).map(([key, value]) => (
                  <div key={key} className="subpanel flex items-center justify-between px-4 py-3 text-sm">
                    <span className="theme-copy font-medium">{key.replaceAll("_", " ")}</span>
                    <span className="theme-ink font-semibold">{value}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </section>

          <section className="grid gap-6 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="panel-title">{text.byMarket}</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3">
                {(summary.by_market ?? []).map((entry) => (
                  <div key={entry.market_id} className="subpanel p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="section-kicker">{entry.market_code}</div>
                        <div className="theme-ink mt-2 font-semibold">{entry.market_name}</div>
                        <div className="theme-copy mt-2 text-sm">
                          {entry.orders} orders • {entry.delivered} delivered
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="section-kicker">{text.revenue}</div>
                        <div className="theme-ink mt-2 font-semibold">{formatMoney(entry.revenue)}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="panel-title">{text.byDriver}</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3">
                {(summary.by_driver ?? []).map((entry) => (
                  <div key={entry.driver_id} className="subpanel p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="section-kicker">{text.assigned}</div>
                        <div className="theme-ink mt-2 font-semibold">{entry.driver_name}</div>
                        <div className="theme-copy mt-2 text-sm">
                          {entry.assigned} assigned • {entry.delivered} delivered • {entry.failed} failed
                        </div>
                      </div>
                      <div className="status-chip">
                        <Star className="h-4 w-4" />
                        {entry.avg_rating || "-"}
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </section>
        </>
      )}
    </div>
  );
}

function HeroMetric({ title, value, icon: Icon }: { title: string; value: string; icon: typeof TrendingUp }) {
  return (
    <div className="dashboard-card">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="section-kicker">{title}</div>
          <div className="font-display theme-ink mt-3 text-5xl font-semibold tracking-[-0.05em]">{value}</div>
        </div>
        <div className="flex h-12 w-12 items-center justify-center rounded-[16px] bg-cyan-50 text-cyan-700 dark:bg-cyan-300/12 dark:text-cyan-100">
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
    light: "bg-white dark:bg-white/6",
    green: "bg-emerald-50 dark:bg-emerald-300/12",
    red: "bg-rose-50 dark:bg-rose-300/12",
    sand: "bg-amber-50 dark:bg-amber-300/12",
    dark: "bg-slate-950 text-white dark:bg-slate-900",
  };

  const iconTone =
    tone === "dark"
      ? "bg-amber-100 text-slate-950"
      : "bg-white text-slate-700 dark:bg-white/10 dark:text-slate-100";

  return (
    <div className={`metric-block ${toneMap[tone]}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className={`section-kicker ${tone === "dark" ? "text-slate-300" : ""}`}>{title}</div>
          <div className="mt-3 font-display text-5xl font-semibold tracking-[-0.05em]">{value}</div>
        </div>
        <div className={`flex h-12 w-12 items-center justify-center rounded-[16px] border border-slate-200/80 dark:border-white/10 ${iconTone}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}
