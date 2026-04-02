import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Clock3, MapPinned, Navigation, PackageCheck, XCircle } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AxiosError } from "axios";

import { api } from "@/lib/api";
import { formatDateTime, formatMoney, formatOrderStatus } from "@/lib/format";
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
    balance?: number | string;
    total_earned?: number | string;
    active_shift?: { id: number; started_at: string } | null;
    latest_ping?: { lat: number | string; lng: number | string; updated_at?: string } | null;
    transactions?: Array<{
      id: number;
      amount: number | string;
      distance_km?: number | string | null;
      weather_condition?: string | null;
      created_at?: string;
      description?: string | null;
    }>;
  };
  offered_orders: Order[];
  assigned_orders: Order[];
};

const OFFER_TIMEOUT_SECONDS = 300;

const text = {
  ordersTitle: "Orders",
  noAddress: "No address set",
  customer: "Customer",
  unknown: "Unknown",
  phone: "Phone",
  notProvided: "Not provided",
  deliveryNotes: "Delivery notes",
  items: "Items",
  onlyDrivers: "Only drivers can view this page.",
  title: "Driver hub",
  statusTitle: "Driver status",
  currentState: "Current state",
  noActiveShift: "No active shift",
  startShift: "Start shift",
  starting: "Starting...",
  endShift: "End shift",
  ending: "Ending...",
  sendLocation: "Send location",
  latitude: "Latitude",
  longitude: "Longitude",
  sendPing: "Send ping",
  sending: "Sending...",
  currentBalance: "Current balance",
  totalEarned: "Total earned",
  recentEarnings: "Recent earnings",
  delivered: "Delivered",
  offersLive: "Offers live",
  activeDrops: "Active drops",
  noEarnings: "No earnings yet.",
  deliveryEarning: "Delivery earning",
  incomingOffers: "Incoming offers",
  noOffers: "No offers right now.",
  timeLeftToAccept: "Time left to accept",
  offerExpired: "Time expired. This offer is being reassigned.",
  offerExpiresSoon: "If the timer runs out, the order is automatically offered to another driver.",
  accept: "Accept",
  decline: "Decline",
  assignedDeliveries: "Assigned deliveries",
  proofSignature: "Proof signature",
  noAssigned: "No assigned deliveries yet.",
  markPickedUp: "Mark picked up",
  markDelivered: "Mark delivered",
} as const;

function getErrorMessage(error: unknown) {
  if (!error) return null;
  const axiosError = error as AxiosError<{ message?: string }>;
  return axiosError.response?.data?.message ?? (error as Error | null)?.message ?? null;
}

function getOfferSecondsRemaining(offerSentAt: string | null | undefined, nowMs: number) {
  if (!offerSentAt) {
    return OFFER_TIMEOUT_SECONDS;
  }

  const sentAtMs = new Date(offerSentAt).getTime();
  if (Number.isNaN(sentAtMs)) {
    return OFFER_TIMEOUT_SECONDS;
  }

  return Math.max(0, OFFER_TIMEOUT_SECONDS - Math.floor((nowMs - sentAtMs) / 1000));
}

function formatCountdown(secondsRemaining: number) {
  const minutes = Math.floor(secondsRemaining / 60);
  const seconds = secondsRemaining % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function OrderCard({
  order,
  meta,
  actions,
}: {
  order: Order;
  meta?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="rounded-[26px] border border-slate-200/80 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-slate-500">{order.market?.code || text.ordersTitle}</div>
          <div className="font-display mt-2 text-2xl font-semibold text-slate-950">{order.code}</div>
          <div className="mt-2 text-sm text-slate-600">{order.dropoff_address || text.noAddress}</div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary" className="rounded-full">{formatOrderStatus(order.status)}</Badge>
          {order.total != null && <Badge className="rounded-full">{formatMoney(order.total)}</Badge>}
        </div>
      </div>

      <div className="mt-4 grid gap-2 text-sm text-slate-600">
        <div>{text.customer}: {order.customer_name || order.customer?.name || text.unknown}</div>
        <div>{text.phone}: {order.customer_phone || text.notProvided}</div>
        {order.notes && <div>{text.deliveryNotes}: {order.notes}</div>}
        {order.items?.length ? (
          <div>
            {text.items}: {order.items.map((item) => `${item.name} x${item.qty}`).join(", ")}
          </div>
        ) : null}
      </div>

      {meta ? <div className="mt-4">{meta}</div> : null}
      {actions ? <div className="mt-5 flex flex-wrap gap-3">{actions}</div> : null}
    </div>
  );
}

export default function DriverHubPage() {
  const meQ = useMe();
  const queryClient = useQueryClient();
  const [lat, setLat] = useState("41.7151");
  const [lng, setLng] = useState("44.8271");
  const [proofSignature, setProofSignature] = useState("");
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const timerId = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(timerId);
    };
  }, []);

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
      (
        await api.post(`/api/driver/orders/${orderId}/${action}`, action === "delivered" ? { proof_signature_name: proofSignature || null } : undefined)
      ).data,
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
          {text.onlyDrivers}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-6">
      <div className="intro-panel">
        <h1 className="intro-title">{text.title}</h1>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <Card className="rounded-[30px]">
          <CardHeader>
            <CardTitle className="font-display text-2xl">{text.statusTitle}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="rounded-[24px] bg-slate-950 p-5 text-white">
              <div className="text-sm text-slate-300">{text.currentState}</div>
              <div className="mt-2 text-3xl font-semibold">{driverStatus}</div>
              <div className="mt-2 text-sm text-slate-300">
                {activeShift ? `Shift started ${formatDateTime(activeShift.started_at)}` : text.noActiveShift}
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-[24px] bg-emerald-50 p-5 dark:bg-emerald-300/10">
                <div className="text-sm text-emerald-700 dark:text-emerald-100">{text.currentBalance}</div>
                <div className="mt-2 text-3xl font-semibold text-emerald-900 dark:text-white">
                  {formatMoney(feedQ.data?.driver?.balance ?? 0)}
                </div>
              </div>
              <div className="rounded-[24px] bg-cyan-50 p-5 dark:bg-cyan-300/10">
                <div className="text-sm text-cyan-700 dark:text-cyan-100">{text.totalEarned}</div>
                <div className="mt-2 text-3xl font-semibold text-cyan-900 dark:text-white">
                  {formatMoney(feedQ.data?.driver?.total_earned ?? 0)}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button onClick={() => startShiftM.mutate()} disabled={!!activeShift || startShiftM.isPending}>
                <Clock3 className="mr-2 h-4 w-4" />
                {startShiftM.isPending ? text.starting : text.startShift}
              </Button>
              <Button variant="secondary" onClick={() => endShiftM.mutate()} disabled={!activeShift || endShiftM.isPending}>
                {endShiftM.isPending ? text.ending : text.endShift}
              </Button>
            </div>

            <div className="grid gap-3 rounded-[24px] border border-slate-200/80 p-4">
              <div className="font-semibold text-slate-950">{text.sendLocation}</div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label>{text.latitude}</Label>
                  <Input value={lat} onChange={(event) => setLat(event.target.value)} className="rounded-2xl" />
                </div>
                <div className="grid gap-2">
                  <Label>{text.longitude}</Label>
                  <Input value={lng} onChange={(event) => setLng(event.target.value)} className="rounded-2xl" />
                </div>
              </div>
              <Button variant="secondary" onClick={() => pingM.mutate()} disabled={pingM.isPending}>
                <Navigation className="mr-2 h-4 w-4" />
                {pingM.isPending ? text.sending : text.sendPing}
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
              <CardTitle className="font-display text-2xl">{text.recentEarnings}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-[24px] bg-slate-50 p-4 text-sm">{text.delivered}: {feedQ.data?.driver?.transactions?.length ?? 0}</div>
                <div className="rounded-[24px] bg-slate-50 p-4 text-sm">{text.offersLive}: {offeredOrders.length}</div>
                <div className="rounded-[24px] bg-slate-50 p-4 text-sm">{text.activeDrops}: {assignedOrders.length}</div>
              </div>
              {(feedQ.data?.driver?.transactions ?? []).length === 0 ? (
                <div className="rounded-[24px] bg-slate-50 p-5 text-sm text-slate-600">{text.noEarnings}</div>
              ) : (
                (feedQ.data?.driver?.transactions ?? []).map((transaction) => (
                  <div key={transaction.id} className="rounded-[24px] border border-slate-200/80 bg-white p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="font-semibold text-slate-950">{transaction.description || text.deliveryEarning}</div>
                        <div className="mt-1 text-sm text-slate-500">
                          {transaction.distance_km ?? 0} km - {transaction.weather_condition || "clear"} - {formatDateTime(transaction.created_at)}
                        </div>
                      </div>
                      <Badge className="rounded-full">{formatMoney(transaction.amount)}</Badge>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="rounded-[30px]">
            <CardHeader>
              <CardTitle className="font-display text-2xl">{text.incomingOffers}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              {offeredOrders.length === 0 ? (
                <div className="rounded-[24px] bg-slate-50 p-5 text-sm text-slate-600">
                  {text.noOffers}
                </div>
              ) : (
                offeredOrders.map((order) => (
                  (() => {
                    const secondsRemaining = getOfferSecondsRemaining(order.offer_sent_at, nowMs);
                    const isExpired = secondsRemaining === 0;

                    return (
                      <OrderCard
                        key={order.id}
                        order={order}
                        meta={
                          <div className={`rounded-[20px] border px-4 py-3 text-sm ${isExpired ? "border-rose-200 bg-rose-50 text-rose-700" : secondsRemaining <= 60 ? "border-amber-200 bg-amber-50 text-amber-800" : "border-cyan-200 bg-cyan-50 text-cyan-800"}`}>
                            <div className="flex items-center justify-between gap-3">
                              <span className="font-semibold">
                                {text.timeLeftToAccept}
                              </span>
                              <span className="font-mono text-base font-semibold">{formatCountdown(secondsRemaining)}</span>
                            </div>
                            <div className="mt-1">
                              {isExpired ? text.offerExpired : text.offerExpiresSoon}
                            </div>
                          </div>
                        }
                        actions={
                          <>
                            <Button onClick={() => actionM.mutate({ orderId: order.id, action: "accept" })} disabled={actionM.isPending || isExpired}>
                              <CheckCircle2 className="mr-2 h-4 w-4" />
                              {text.accept}
                            </Button>
                            <Button
                              variant="secondary"
                              onClick={() => actionM.mutate({ orderId: order.id, action: "decline" })}
                              disabled={actionM.isPending || isExpired}
                            >
                              <XCircle className="mr-2 h-4 w-4" />
                              {text.decline}
                            </Button>
                          </>
                        }
                      />
                    );
                  })()
                ))
              )}
            </CardContent>
          </Card>

          <Card className="rounded-[30px]">
            <CardHeader>
              <CardTitle className="font-display text-2xl">{text.assignedDeliveries}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid gap-3 rounded-[24px] border border-slate-200/80 p-4">
                <div className="grid gap-2">
                  <Label>{text.proofSignature}</Label>
                  <Input value={proofSignature} onChange={(event) => setProofSignature(event.target.value)} className="rounded-2xl" />
                </div>
              </div>
              {assignedOrders.length === 0 ? (
                <div className="rounded-[24px] bg-slate-50 p-5 text-sm text-slate-600">
                  {text.noAssigned}
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
                            {text.markPickedUp}
                          </Button>
                        )}
                        {order.status === "PICKED_UP" && (
                          <Button onClick={() => actionM.mutate({ orderId: order.id, action: "delivered" })} disabled={actionM.isPending}>
                            <MapPinned className="mr-2 h-4 w-4" />
                            {text.markDelivered}
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
