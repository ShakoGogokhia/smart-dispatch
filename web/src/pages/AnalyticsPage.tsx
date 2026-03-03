import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type AnalyticsSummary = {
  orders_total: number;
  orders_new: number;
  orders_planned: number;
  orders_assigned: number;
  orders_delivered: number;
  orders_failed: number;
};

export default function AnalyticsPage() {
  const summaryQ = useQuery({
    queryKey: ["analytics-summary"],
    queryFn: async () => {
      const res = await api.get("/api/analytics/summary");
      return res.data as AnalyticsSummary;
    },
  });

  const s = summaryQ.data;

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Analytics</CardTitle>
        </CardHeader>
        <CardContent>
          {summaryQ.isLoading && <div>Loading...</div>}
          {summaryQ.error && (
            <div className="text-red-600">
              Failed to load analytics. (Do you have GET /api/analytics/summary?)
            </div>
          )}

          {s && (
            <div className="grid gap-4 md:grid-cols-3">
              <Stat title="Total Orders" value={s.orders_total} />
              <Stat title="NEW" value={s.orders_new} />
              <Stat title="PLANNED" value={s.orders_planned} />
              <Stat title="ASSIGNED" value={s.orders_assigned} />
              <Stat title="DELIVERED" value={s.orders_delivered} />
              <Stat title="FAILED" value={s.orders_failed} />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ title, value }: { title: string; value: number }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-semibold">{value}</div>
      </CardContent>
    </Card>
  );
}