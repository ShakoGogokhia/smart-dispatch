import { Search, Timer, Truck } from "lucide-react";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { formatDateTime, formatOrderStatus } from "@/lib/format";
import type { DispatchInsight, Order, Paginated } from "@/types/api";

export default function DispatchConsolePage() {
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const ordersQ = useQuery({
    queryKey: ["dispatch-orders"],
    queryFn: async () => (await api.get("/api/orders")).data as Paginated<Order>,
    refetchInterval: 8000,
  });
  const insightQ = useQuery({
    queryKey: ["dispatch-insight", selectedOrderId],
    queryFn: async () => (await api.get(`/api/dispatch/orders/${selectedOrderId}/insights`)).data as DispatchInsight,
    enabled: selectedOrderId != null,
    refetchInterval: selectedOrderId ? 8000 : false,
  });
  const dispatchOrders = useMemo(
    () => (ordersQ.data?.data ?? []).filter((order) => ["READY_FOR_PICKUP", "OFFERED", "ASSIGNED", "PICKED_UP"].includes(order.status)),
    [ordersQ.data?.data],
  );

  return (
    <div className="grid gap-6">
      <div className="intro-panel">
        <h1 className="intro-title">Dispatch console</h1>
      </div>

      <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
        <Card className="rounded-[30px]">
          <CardHeader><CardTitle className="text-2xl">Driver-flow orders</CardTitle></CardHeader>
          <CardContent className="grid gap-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input className="h-12 rounded-[18px] pl-11" placeholder="Select an order below" readOnly />
            </div>
            {dispatchOrders.map((order) => (
              <button
                key={order.id}
                type="button"
                onClick={() => setSelectedOrderId(order.id)}
                className={`rounded-[22px] border p-4 text-left transition ${selectedOrderId === order.id ? "border-cyan-300 bg-cyan-50 dark:border-cyan-400/30 dark:bg-cyan-400/10" : "border-slate-200 bg-slate-50 hover:bg-white dark:border-slate-800 dark:bg-slate-900"}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold">{order.code}</div>
                    <div className="mt-1 text-sm theme-copy">{order.dropoff_address ?? "No address"}</div>
                  </div>
                  <Badge className="status-chip status-neutral">{formatOrderStatus(order.status)}</Badge>
                </div>
              </button>
            ))}
          </CardContent>
        </Card>

        <Card className="rounded-[30px]">
          <CardHeader><CardTitle className="text-2xl">Assignment reasoning</CardTitle></CardHeader>
          <CardContent>
            {!selectedOrderId ? (
              <div className="rounded-[24px] border border-slate-200 p-8 text-sm theme-copy dark:border-slate-800">Choose an order to see driver candidates, offer timeout, declines, and suggested assignment.</div>
            ) : insightQ.isLoading ? (
              <div className="p-8 text-sm theme-copy">Loading insights...</div>
            ) : !insightQ.data ? (
              <div className="p-8 text-sm status-bad">Unable to load insights.</div>
            ) : (
              <div className="grid gap-5">
                <div className="grid gap-3 md:grid-cols-3">
                  <InsightStat icon={Truck} label="Suggested" value={insightQ.data.suggested_driver?.driver_name ?? "No eligible driver"} />
                  <InsightStat icon={Timer} label="Offer expires" value={formatDateTime(insightQ.data.offer_expires_at)} />
                  <InsightStat icon={Truck} label="Current offer" value={insightQ.data.current_offer?.driver_name ?? "None"} />
                </div>

                <div className="grid gap-3">
                  {insightQ.data.candidates.map((candidate) => (
                    <div key={candidate.driver_id} className="rounded-[22px] border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div>
                          <div className="font-semibold">{candidate.driver_name}</div>
                          <div className="mt-1 text-sm theme-copy">
                            {candidate.distance_km ?? "-"} km - {candidate.remaining_capacity} capacity left - {candidate.active_assigned_orders} active
                          </div>
                          {candidate.reasons.length > 0 && <div className="mt-2 text-sm text-amber-700 dark:text-amber-100">{candidate.reasons.join(", ")}</div>}
                        </div>
                        <Badge className={`status-chip ${candidate.eligible ? "status-good" : "status-warn"}`}>{candidate.eligible ? "Eligible" : "Review"}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function InsightStat({ icon: Icon, label, value }: { icon: typeof Truck; label: string; value: string }) {
  return (
    <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
        <Icon className="h-4 w-4" />
        {label}
      </div>
      <div className="mt-3 text-sm font-semibold">{value}</div>
    </div>
  );
}
