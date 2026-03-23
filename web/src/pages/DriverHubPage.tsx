import { useMemo, useState } from "react";
import { CheckCircle2, Clock3, MapPinned, Navigation, PackageCheck, XCircle } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AxiosError } from "axios";

import { api } from "@/lib/api";
import { formatDateTime, formatMoney } from "@/lib/format";
import { useMe } from "@/lib/useMe";
import type { Order } from "@/types/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type DriverFeed = {
  driver: {
    id: number;
    status: string;
    active_shift?: { id: number; started_at: string } | null;
    latest_ping?: { lat: number | string; lng: number | string; updated_at?: string } | null;
  };
  offered_orders: Order[];
  assigned_orders: Order[];
};

function getErrorMessage(error: unknown) {
  if (!error) return null;
  const axiosError = error as AxiosError<{ message?: string }>;
  return axiosError.response?.data?.message ?? (error as Error | null)?.message ?? null;
}

function OrderCard({
  order,
  actions,
}: {
  order: Order;
  actions?: React.ReactNode;
}) {
  return (
    <div className="rounded-[26px] border border-slate-200/80 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-slate-500">{order.market?.code || "Order"}</div>
          <div className="font-display mt-2 text-2xl font-semibold text-slate-950">{order.code}</div>
          <div className="mt-2 text-sm text-slate-600">{order.dropoff_address || "No delivery address"}</div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary" className="rounded-full">{order.status}</Badge>
          {order.total != null && <Badge className="rounded-full">{formatMoney(order.total)}</Badge>}
        </div>
      </div>

      <div className="mt-4 grid gap-2 text-sm text-slate-600">
        <div>Customer: {order.customer_name || order.customer?.name || "Unknown"}</div>
        <div>Phone: {order.customer_phone || "Not provided"}</div>
        {order.notes && <div>Notes: {order.notes}</div>}
        {order.items?.length ? (
          <div>
            Items: {order.items.map((item) => `${item.name} x${item.qty}`).join(", ")}
          </div>
        ) : null}
      </div>

      {actions ? <div className="mt-5 flex flex-wrap gap-3">{actions}</div> : null}
    </div>
  );
}

export default function DriverHubPage() {
  const meQ = useMe();
  const queryClient = useQueryClient();
  const [lat, setLat] = useState("41.7151");
  const [lng, setLng] = useState("44.8271");

  const feedQ = useQuery({
    queryKey: ["driver-feed"],
    queryFn: async () => (await api.get("/api/driver/orders/feed")).data as DriverFeed,
    refetchInterval: 7000,
    enabled: (meQ.data?.roles ?? []).includes("driver"),
  });

  const refreshQueries = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["driver-feed"] }),
      queryClient.invalidateQueries({ queryKey: ["me"] }),
      queryClient.invalidateQueries({ queryKey: ["orders"] }),
      queryClient.invalidateQueries({ queryKey: ["live-routes"] }),
      queryClient.invalidateQueries({ queryKey: ["live-locations"] }),
    ]);
  };

  const startShiftM = useMutation({
    mutationFn: async () => (await api.post("/api/shifts/start")).data,
    onSuccess: refreshQueries,
  });

  const endShiftM = useMutation({
    mutationFn: async () => (await api.post("/api/shifts/end")).data,
    onSuccess: refreshQueries,
  });

  const pingM = useMutation({
    mutationFn: async () =>
      (await api.post("/api/tracking/ping", { lat: Number(lat), lng: Number(lng) })).data,
    onSuccess: refreshQueries,
  });

  const actionM = useMutation({
    mutationFn: async ({ orderId, action }: { orderId: number; action: string }) =>
      (await api.post(`/api/driver/orders/${orderId}/${action}`)).data,
    onSuccess: refreshQueries,
  });

  const activeShift = feedQ.data?.driver?.active_shift;
  const driverStatus = feedQ.data?.driver?.status ?? meQ.data?.driver?.status ?? "OFFLINE";
  const offeredOrders = feedQ.data?.offered_orders ?? [];
  const assignedOrders = feedQ.data?.assigned_orders ?? [];
  const mutationError = useMemo(
    () =>
      getErrorMessage(startShiftM.error) ||
      getErrorMessage(endShiftM.error) ||
      getErrorMessage(pingM.error) ||
      getErrorMessage(actionM.error),
    [actionM.error, endShiftM.error, pingM.error, startShiftM.error],
  );

  if (!(meQ.data?.roles ?? []).includes("driver")) {
    return (
      <Card className="rounded-[30px]">
        <CardContent className="p-8 text-sm text-slate-600">
          This workspace is only available for driver accounts.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-6">
      <div className="rounded-[30px] bg-[linear-gradient(135deg,_rgba(34,197,94,0.16),_rgba(255,255,255,0.96)),linear-gradient(180deg,_#fcfffd_0%,_#effaf3_100%)] p-6">
        <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Driver hub</div>
        <h1 className="font-display mt-2 text-4xl font-semibold tracking-tight text-slate-950">
          Shift, offers, and assigned deliveries
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
          Start a shift to become available, send location pings to stay inside the delivery area,
          accept or decline offers, and finish deliveries from one screen.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <Card className="rounded-[30px]">
          <CardHeader>
            <CardTitle className="font-display text-2xl">Driver status</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="rounded-[24px] bg-slate-950 p-5 text-white">
              <div className="text-sm text-slate-300">Current state</div>
              <div className="mt-2 text-3xl font-semibold">{driverStatus}</div>
              <div className="mt-2 text-sm text-slate-300">
                {activeShift ? `Shift started ${formatDateTime(activeShift.started_at)}` : "No active shift"}
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button onClick={() => startShiftM.mutate()} disabled={!!activeShift || startShiftM.isPending}>
                <Clock3 className="mr-2 h-4 w-4" />
                {startShiftM.isPending ? "Starting..." : "Start shift"}
              </Button>
              <Button variant="secondary" onClick={() => endShiftM.mutate()} disabled={!activeShift || endShiftM.isPending}>
                {endShiftM.isPending ? "Ending..." : "End shift"}
              </Button>
            </div>

            <div className="grid gap-3 rounded-[24px] border border-slate-200/80 p-4">
              <div className="font-semibold text-slate-950">Send location update</div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label>Latitude</Label>
                  <Input value={lat} onChange={(event) => setLat(event.target.value)} className="rounded-2xl" />
                </div>
                <div className="grid gap-2">
                  <Label>Longitude</Label>
                  <Input value={lng} onChange={(event) => setLng(event.target.value)} className="rounded-2xl" />
                </div>
              </div>
              <Button variant="secondary" onClick={() => pingM.mutate()} disabled={pingM.isPending}>
                <Navigation className="mr-2 h-4 w-4" />
                {pingM.isPending ? "Sending..." : "Send ping"}
              </Button>
            </div>

            {mutationError && (
              <div className="rounded-[20px] bg-red-50 px-4 py-3 text-sm text-red-700">
                {mutationError}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-6">
          <Card className="rounded-[30px]">
            <CardHeader>
              <CardTitle className="font-display text-2xl">Incoming offers</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              {offeredOrders.length === 0 ? (
                <div className="rounded-[24px] bg-slate-50 p-5 text-sm text-slate-600">
                  No active offers right now. Keep your shift active and send fresh location pings.
                </div>
              ) : (
                offeredOrders.map((order) => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    actions={
                      <>
                        <Button onClick={() => actionM.mutate({ orderId: order.id, action: "accept" })} disabled={actionM.isPending}>
                          <CheckCircle2 className="mr-2 h-4 w-4" />
                          Accept
                        </Button>
                        <Button
                          variant="secondary"
                          onClick={() => actionM.mutate({ orderId: order.id, action: "decline" })}
                          disabled={actionM.isPending}
                        >
                          <XCircle className="mr-2 h-4 w-4" />
                          Decline
                        </Button>
                      </>
                    }
                  />
                ))
              )}
            </CardContent>
          </Card>

          <Card className="rounded-[30px]">
            <CardHeader>
              <CardTitle className="font-display text-2xl">Assigned deliveries</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              {assignedOrders.length === 0 ? (
                <div className="rounded-[24px] bg-slate-50 p-5 text-sm text-slate-600">
                  No deliveries assigned yet.
                </div>
              ) : (
                assignedOrders.map((order) => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    actions={
                      <>
                        {order.status === "ASSIGNED" && (
                          <Button onClick={() => actionM.mutate({ orderId: order.id, action: "picked-up" })} disabled={actionM.isPending}>
                            <PackageCheck className="mr-2 h-4 w-4" />
                            Mark picked up
                          </Button>
                        )}
                        {order.status === "PICKED_UP" && (
                          <Button onClick={() => actionM.mutate({ orderId: order.id, action: "delivered" })} disabled={actionM.isPending}>
                            <MapPinned className="mr-2 h-4 w-4" />
                            Mark delivered
                          </Button>
                        )}
                      </>
                    }
                  />
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
