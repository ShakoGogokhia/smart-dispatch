import { AlertCircle, CheckCircle2, ClipboardList, MapPin, Search, Timer, Truck, UserCheck, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { EmptyState } from "@/components/app/empty-state";
import { LoadingState } from "@/components/app/loading-state";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge, toneForStatus } from "@/components/app/status-badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { api } from "@/lib/api";
import { formatDateTime, formatOrderStatus } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { DispatchInsight, Order, Paginated } from "@/types/api";

export default function DispatchConsolePage() {
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
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
  const visibleOrders = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return dispatchOrders;
    return dispatchOrders.filter((order) =>
      [order.code, order.dropoff_address, order.market?.name, order.customer_name].some((value) => String(value ?? "").toLowerCase().includes(term)),
    );
  }, [dispatchOrders, search]);

  const counts = useMemo(() => {
    const result = { ready: 0, offered: 0, assigned: 0, picked: 0 };
    for (const order of dispatchOrders) {
      if (order.status === "READY_FOR_PICKUP") result.ready += 1;
      else if (order.status === "OFFERED") result.offered += 1;
      else if (order.status === "ASSIGNED") result.assigned += 1;
      else if (order.status === "PICKED_UP") result.picked += 1;
    }
    return result;
  }, [dispatchOrders]);

  const selectedOrder = dispatchOrders.find((order) => order.id === selectedOrderId) ?? insightQ.data?.order ?? null;
  const insight = insightQ.data;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dispatch console"
        description="Orders moving through the driver flow. Pick an order to see which drivers can take it and why."
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <MiniStat label="Ready for pickup" value={counts.ready} />
        <MiniStat label="Offer sent" value={counts.offered} />
        <MiniStat label="Driver assigned" value={counts.assigned} />
        <MiniStat label="Picked up" value={counts.picked} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
        <Card className="gap-4">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Driver-flow orders</CardTitle>
            <CardDescription>Ready, offered, assigned and picked-up orders. Refreshes every 8 seconds.</CardDescription>
            <CardAction>
              <StatusBadge tone="neutral">{dispatchOrders.length}</StatusBadge>
            </CardAction>
          </CardHeader>
          <CardContent className="grid gap-3">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Search code, address, market..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                aria-label="Search orders"
              />
            </div>

            {ordersQ.isLoading ? (
              <LoadingState rows={4} />
            ) : ordersQ.isError ? (
              <Alert variant="destructive">
                <AlertCircle />
                <AlertTitle>Could not load orders</AlertTitle>
                <AlertDescription>Check your connection; the list retries automatically.</AlertDescription>
              </Alert>
            ) : visibleOrders.length === 0 ? (
              <EmptyState
                compact
                icon={ClipboardList}
                title={dispatchOrders.length === 0 ? "No orders in the driver flow" : "No matching orders"}
                description={dispatchOrders.length === 0 ? "Orders appear here once a market marks them ready for pickup." : "Try a different search term."}
              />
            ) : (
              <ScrollArea className="lg:h-[calc(100svh-22rem)] lg:min-h-[360px]">
                <div className="grid gap-2 lg:pr-3">
                  {visibleOrders.map((order) => {
                    const selected = selectedOrderId === order.id;
                    const driverName = order.assigned_driver?.user?.name ?? order.offered_driver?.user?.name;
                    return (
                      <button
                        key={order.id}
                        type="button"
                        onClick={() => setSelectedOrderId(order.id)}
                        aria-pressed={selected}
                        className={cn(
                          "rounded-lg border p-3 text-left transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
                          selected ? "border-primary bg-primary/5" : "bg-card hover:bg-muted/50",
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold">{order.code}</div>
                            <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                              <MapPin className="size-3.5 shrink-0" />
                              <span className="truncate">{order.dropoff_address ?? "No address"}</span>
                            </div>
                            {driverName ? (
                              <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                                <Truck className="size-3.5 shrink-0" />
                                <span className="truncate">{driverName}</span>
                              </div>
                            ) : null}
                          </div>
                          <StatusBadge tone={toneForStatus(order.status)} dot className="shrink-0">
                            {formatOrderStatus(order.status)}
                          </StatusBadge>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        <Card className="gap-4">
          <CardHeader>
            <CardTitle className="text-base font-semibold">
              Assignment reasoning{selectedOrder ? <span className="text-muted-foreground"> · {selectedOrder.code}</span> : null}
            </CardTitle>
            <CardDescription>Driver candidates, offer timeout, declines and the suggested assignment for the selected order.</CardDescription>
          </CardHeader>
          <CardContent>
            {!selectedOrderId ? (
              <EmptyState
                icon={UserCheck}
                title="No order selected"
                description="Choose an order on the left to see driver candidates, offer timeout, declines, and the suggested assignment."
              />
            ) : insightQ.isLoading ? (
              <LoadingState rows={3} />
            ) : !insight ? (
              <Alert variant="destructive">
                <AlertCircle />
                <AlertTitle>Unable to load insights</AlertTitle>
                <AlertDescription>We couldn't fetch dispatch insights for this order. It will retry automatically.</AlertDescription>
              </Alert>
            ) : (
              <div className="grid gap-6">
                <div className="grid gap-3 sm:grid-cols-3">
                  <InsightStat icon={Truck} label="Suggested driver" value={insight.suggested_driver?.driver_name ?? "No eligible driver"} highlight={Boolean(insight.suggested_driver)} />
                  <InsightStat icon={Timer} label="Offer expires" value={formatDateTime(insight.offer_expires_at)} />
                  <InsightStat icon={UserCheck} label="Current offer" value={insight.current_offer?.driver_name ?? "None"} />
                </div>

                <div className="grid gap-3">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="flex items-center gap-2 text-sm font-semibold">
                      <Users className="size-4 text-muted-foreground" />
                      Driver candidates
                    </h3>
                    <span className="text-xs text-muted-foreground tabular-nums">{insight.candidates.length} drivers</span>
                  </div>
                  {insight.candidates.length === 0 ? (
                    <EmptyState compact icon={Users} title="No candidates" description="No drivers are currently available for this order." />
                  ) : (
                    insight.candidates.map((candidate) => {
                      const suggested = insight.suggested_driver?.driver_id === candidate.driver_id;
                      return (
                        <div key={candidate.driver_id} className={cn("rounded-lg border p-3", suggested ? "border-primary/50 bg-primary/5" : "bg-muted/30")}>
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                                {candidate.driver_name}
                                {suggested ? <StatusBadge tone="primary">Suggested</StatusBadge> : null}
                              </div>
                              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground tabular-nums">
                                <span>{candidate.distance_km ?? "-"} km away</span>
                                <span>{candidate.remaining_capacity} capacity left</span>
                                <span>{candidate.active_assigned_orders} active orders</span>
                              </div>
                              {candidate.reasons.length > 0 && (
                                <div className="mt-2 flex items-start gap-1.5 text-xs text-warning">
                                  <AlertCircle className="mt-px size-3.5 shrink-0" />
                                  <span>{candidate.reasons.join(", ")}</span>
                                </div>
                              )}
                            </div>
                            <StatusBadge tone={candidate.eligible ? "success" : "warning"} dot className="shrink-0">
                              {candidate.eligible ? "Eligible" : "Review"}
                            </StatusBadge>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border bg-card px-4 py-3 shadow-xs">
      <div className="truncate text-xs font-medium text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function InsightStat({ icon: Icon, label, value, highlight = false }: { icon: LucideIcon; label: string; value: string; highlight?: boolean }) {
  return (
    <div className={cn("rounded-lg border p-3", highlight ? "border-success/40 bg-success/10" : "bg-muted/30")}>
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        {highlight ? <CheckCircle2 className="size-4 text-success" /> : <Icon className="size-4" />}
        {label}
      </div>
      <div className="mt-2 truncate text-sm font-semibold">{value}</div>
    </div>
  );
}
