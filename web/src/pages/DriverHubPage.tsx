import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowDown,
  Banknote,
  CheckCircle2,
  Clock3,
  Inbox,
  MapPin,
  LocateFixed,
  Power,
  Route,
  Store,
  Truck,
  Wallet,
  XCircle,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AxiosError } from "axios";
import { toast } from "sonner";

import { useLiveLocation } from "@/hooks/use-live-location";
import { api } from "@/lib/api";
import { formatDateTime, formatMoney, formatOrderStatus } from "@/lib/format";
import { useMe } from "@/lib/useMe";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { StatCard, StatGrid } from "@/components/app/stat-card";
import { StatusBadge, toneForStatus } from "@/components/app/status-badge";
import { CurrentDelivery, NextDeliveryCard, type DeliveryProof } from "@/components/driver/current-delivery";
import { OfferMap } from "@/components/driver/offer-map";
import { resolveStep, type DriverFeed, type DriverOrder, type DriverPing, type DriverStep } from "@/components/driver/types";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";

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
  potentialEarning: "Potential earning",
  distance: "Distance",
  weather: "Weather",
  onlyDrivers: "Only drivers can view this page.",
  title: "Driver hub",
  noActiveShift: "No active shift",
  starting: "Starting...",
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
  newOffer: "New delivery offer",
  timeLeftToAccept: "Time left to accept",
  offerExpired: "Time expired. This offer is being reassigned.",
  offerExpiresSoon: "If the timer runs out, the order is automatically offered to another driver.",
  accept: "Accept",
  decline: "Decline",
  nextDeliveries: "Next deliveries",
} as const;

const ACTION_SUCCESS: Record<string, string> = {
  accept: "Offer accepted. Head to the market.",
  decline: "Offer declined.",
  "arrived-pickup": "Checked in at the market.",
  "picked-up": "Picked up. Now go to the customer.",
  "arrived-dropoff": "Checked in at the customer.",
  delivered: "Delivered! Great job.",
};

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

function RouteSummary({ order }: { order: DriverOrder }) {
  return (
    <div className="grid gap-1 rounded-lg border bg-muted/30 p-3">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Store className="size-3.5" />
        </span>
        <div className="min-w-0">
          <div className="text-xs text-muted-foreground">Pickup</div>
          <div className="text-sm font-medium break-words">
            {order.pickup_address || order.market?.name || order.market?.code || text.noAddress}
          </div>
        </div>
      </div>
      <div className="flex w-7 justify-center text-muted-foreground">
        <ArrowDown className="size-3.5" />
      </div>
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-success/15 text-success">
          <MapPin className="size-3.5" />
        </span>
        <div className="min-w-0">
          <div className="text-xs text-muted-foreground">Dropoff</div>
          <div className="text-sm font-medium break-words">{order.dropoff_address || text.noAddress}</div>
        </div>
      </div>
    </div>
  );
}

function OfferEarnings({ order }: { order: DriverOrder }) {
  const compensation = order.driver_compensation;
  if (compensation?.earning_amount == null) return null;
  return (
    <div className="grid grid-cols-3 gap-2">
      <div className="min-w-0 rounded-lg border bg-success/10 p-3">
        <div className="truncate text-xs text-muted-foreground">{text.potentialEarning}</div>
        <div className="truncate text-lg font-semibold tabular-nums text-success">{formatMoney(compensation.earning_amount)}</div>
      </div>
      <div className="min-w-0 rounded-lg border bg-muted/30 p-3">
        <div className="truncate text-xs text-muted-foreground">{text.distance}</div>
        <div className="truncate text-lg font-semibold tabular-nums">{compensation.distance_km ?? 0} km</div>
      </div>
      <div className="min-w-0 rounded-lg border bg-muted/30 p-3">
        <div className="truncate text-xs text-muted-foreground">{text.weather}</div>
        <div className="truncate text-sm font-medium capitalize">{compensation.weather_condition || "clear"}</div>
        <div className="text-xs text-muted-foreground tabular-nums">x{compensation.weather_multiplier ?? 1}</div>
      </div>
    </div>
  );
}

function OfferCustomerDetails({ order }: { order: DriverOrder }) {
  return (
    <dl className="grid gap-2 text-sm sm:grid-cols-2">
      <div className="min-w-0">
        <dt className="text-xs text-muted-foreground">{text.customer}</dt>
        <dd className="truncate font-medium">{order.customer_name || order.customer?.name || text.unknown}</dd>
      </div>
      <div className="min-w-0">
        <dt className="text-xs text-muted-foreground">{text.phone}</dt>
        <dd className="truncate font-medium">{order.customer_phone || text.notProvided}</dd>
      </div>
      {order.notes ? (
        <div className="min-w-0 sm:col-span-2">
          <dt className="text-xs text-muted-foreground">{text.deliveryNotes}</dt>
          <dd className="break-words">{order.notes}</dd>
        </div>
      ) : null}
      {order.items?.length ? (
        <div className="min-w-0 sm:col-span-2">
          <dt className="text-xs text-muted-foreground">{text.items}</dt>
          <dd className="break-words">
            {order.items
              .map((item) => {
                const combo = item.combo_offer?.name ? ` [combo: ${item.combo_offer.name}]` : "";
                const removed = (item.removed_ingredients ?? []).length ? ` (without ${(item.removed_ingredients ?? []).join(", ")})` : "";
                return `${item.name} x${item.qty}${combo}${removed}`;
              })
              .join(", ")}
          </dd>
        </div>
      ) : null}
    </dl>
  );
}

function OfferCard({
  order,
  nowMs,
  compact,
  pending,
  onAction,
  driverLocation,
}: {
  order: DriverOrder;
  nowMs: number;
  compact: boolean;
  driverLocation?: DriverPing;
  pending: boolean;
  onAction: (orderId: number, action: string) => void;
}) {
  const secondsRemaining = getOfferSecondsRemaining(order.offer_sent_at, nowMs);
  const isExpired = secondsRemaining === 0;
  const isUrgent = !isExpired && secondsRemaining <= 60;

  return (
    <Card className="border-primary ring-2 ring-primary/20">
      <CardHeader>
        <CardDescription>
          {text.newOffer} · {order.market?.name || order.market?.code || text.ordersTitle}
        </CardDescription>
        <CardTitle className="text-lg tabular-nums">{order.code}</CardTitle>
        <CardAction className="flex flex-col items-end gap-1.5">
          <StatusBadge tone={toneForStatus(order.status)} dot>
            {formatOrderStatus(order.status)}
          </StatusBadge>
          {order.total != null ? <span className="text-sm font-semibold tabular-nums">{formatMoney(order.total)}</span> : null}
        </CardAction>
      </CardHeader>
      <CardContent className="grid gap-4">
        <OfferMap order={order} driverLocation={driverLocation} className={compact ? "h-48" : undefined} />
        <div
          className={cn(
            "grid gap-2 rounded-lg border p-3",
            isExpired ? "bg-destructive/10 text-destructive" : isUrgent ? "bg-warning/15" : "bg-muted/30",
          )}
        >
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium">{text.timeLeftToAccept}</span>
            <span className="font-mono text-xl font-semibold tabular-nums">{formatCountdown(secondsRemaining)}</span>
          </div>
          <Progress
            value={(secondsRemaining / OFFER_TIMEOUT_SECONDS) * 100}
            className={cn(isExpired && "bg-destructive/20", isUrgent && "bg-warning/25 [&>[data-slot=progress-indicator]]:bg-warning")}
          />
          <div className="text-xs">{isExpired ? text.offerExpired : text.offerExpiresSoon}</div>
        </div>
        <OfferEarnings order={order} />
        <RouteSummary order={order} />
        {compact ? null : <OfferCustomerDetails order={order} />}
      </CardContent>
      <CardFooter className="grid grid-cols-[2fr_1fr] gap-3">
        <Button size="lg" className="h-14 text-base" onClick={() => onAction(order.id, "accept")} disabled={pending || isExpired}>
          <CheckCircle2 />
          {text.accept}
        </Button>
        <Button
          size="lg"
          variant="outline"
          className="h-14 text-base"
          onClick={() => onAction(order.id, "decline")}
          disabled={pending || isExpired}
        >
          <XCircle />
          {text.decline}
        </Button>
      </CardFooter>
    </Card>
  );
}

const DRIVER_STATUS_LABEL: Record<string, string> = {
  ONLINE: "Online",
  ON_ROUTE: "On a delivery",
  OFFLINE: "Offline",
  BREAK: "On break",
};

export default function DriverHubPage() {
  const meQ = useMe();
  const queryClient = useQueryClient();
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
    refetchInterval: 5000,
    enabled: (meQ.data?.roles ?? []).includes("driver"),
  });

  // Online drivers share live location every 10 s (same as the mobile app).
  const refreshFeed = useCallback(() => void queryClient.invalidateQueries({ queryKey: ["driver-feed"] }), [queryClient]);
  const live = useLiveLocation(Boolean(feedQ.data?.driver?.active_shift), refreshFeed);

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

  const actionM = useMutation({
    mutationFn: async ({ orderId, action, proof }: { orderId: number; action: string; proof?: DeliveryProof }) => {
      if (action === "delivered") {
        if (proof?.photo) {
          const formData = new FormData();
          formData.append("proof_photo", proof.photo);
          if (proof.signatureName) formData.append("proof_signature_name", proof.signatureName);
          if (proof.note) formData.append("proof_note", proof.note);
          return (await api.post(`/api/driver/orders/${orderId}/delivered`, formData)).data;
        }
        return (
          await api.post(`/api/driver/orders/${orderId}/delivered`, {
            proof_signature_name: proof?.signatureName || null,
            proof_note: proof?.note || null,
          })
        ).data;
      }

      return (await api.post(`/api/driver/orders/${orderId}/${action}`)).data;
    },
    onSuccess: async (_data, { action }) => {
      const message = ACTION_SUCCESS[action];
      if (message) toast.success(message);
      await refreshQueries();
    },
    onError: async (error) => {
      toast.error(getErrorMessage(error) ?? "Something went wrong. Please try again.");
      // The order may have moved on (e.g. offer expired) — refresh to show the real state.
      await refreshQueries();
    },
  });

  const runAction = (orderId: number, action: string, proof?: DeliveryProof) => actionM.mutate({ orderId, action, proof });

  const activeShift = feedQ.data?.driver?.active_shift;
  const driverStatus = feedQ.data?.driver?.status ?? meQ.data?.driver?.status ?? "OFFLINE";
  const offeredOrders = useMemo(() => feedQ.data?.offered_orders ?? [], [feedQ.data?.offered_orders]);
  const assignedOrders = useMemo(() => feedQ.data?.assigned_orders ?? [], [feedQ.data?.assigned_orders]);
  const [currentOrder, ...nextOrders] = assignedOrders;

  // Tell the driver as soon as the market hands the order over (detected via polling).
  const previousSteps = useRef<Map<number, DriverStep>>(new Map());
  useEffect(() => {
    const next = new Map<number, DriverStep>();
    for (const order of assignedOrders) {
      const step = resolveStep(order);
      if (previousSteps.current.get(order.id) === "waiting_ready" && step === "pickup") {
        toast.success(`${order.code} is ready — pick it up.`);
      }
      next.set(order.id, step);
    }
    previousSteps.current = next;
  }, [assignedOrders]);

  const shiftError = getErrorMessage(startShiftM.error) || getErrorMessage(endShiftM.error);

  if (!(meQ.data?.roles ?? []).includes("driver")) {
    return (
      <div className="space-y-6">
        <PageHeader title={text.title} />
        <EmptyState icon={Truck} title="Driver access only" description={text.onlyDrivers} />
      </div>
    );
  }

  const transactions = feedQ.data?.driver?.transactions ?? [];
  const isOnline = Boolean(activeShift);
  const shiftPending = startShiftM.isPending || endShiftM.isPending;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title={text.title} description="Your current job, one step at a time." />

      {/* 1. Shift status (compact) */}
      <Card className={cn("py-4", isOnline && "border-success/40")}>
        <CardContent className="grid gap-3 px-4">
          <div className="flex flex-wrap items-center gap-3">
            <span
              className={cn(
                "flex size-10 shrink-0 items-center justify-center rounded-full",
                isOnline ? "bg-success/15 text-success" : "bg-muted text-muted-foreground",
              )}
            >
              <Power className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 font-semibold">
                {isOnline ? "You're online" : "You're offline"}
                <StatusBadge tone={toneForStatus(driverStatus)} dot>
                  {DRIVER_STATUS_LABEL[driverStatus] ?? driverStatus}
                </StatusBadge>
              </div>
              <div className="text-xs text-muted-foreground">
                {activeShift ? `Shift started ${formatDateTime(activeShift.started_at)}` : text.noActiveShift}
              </div>
            </div>
            {isOnline ? (
              <Button variant="outline" onClick={() => endShiftM.mutate()} disabled={shiftPending}>
                {endShiftM.isPending ? <Spinner /> : <Power />}
                {endShiftM.isPending ? text.ending : "Go offline"}
              </Button>
            ) : (
              <Button onClick={() => startShiftM.mutate()} disabled={shiftPending}>
                {startShiftM.isPending ? <Spinner /> : <Clock3 />}
                {startShiftM.isPending ? text.starting : "Go online"}
              </Button>
            )}
          </div>
          {isOnline ? (
            <p
              className={cn(
                "flex items-center gap-1.5 text-xs",
                live.status === "on" ? "text-success" : live.status === "denied" || live.status === "unavailable" ? "text-destructive" : "text-muted-foreground",
              )}
            >
              <LocateFixed className="size-3.5 shrink-0" />
              {live.status === "on"
                ? "Live location on — shared every 10 seconds. New orders arrive when you're close to finishing the current one."
                : live.status === "denied"
                  ? "Location permission is blocked. Allow it in the browser so dispatch can send you nearby orders."
                  : live.status === "unavailable"
                    ? "Couldn't read your location. Check that location services are on."
                    : "Turning on live location…"}
            </p>
          ) : null}
          {shiftError ? (
            <Alert variant="destructive">
              <AlertCircle />
              <AlertDescription>{shiftError}</AlertDescription>
            </Alert>
          ) : null}
        </CardContent>
      </Card>

      {/* 2. Incoming offers (compact when a delivery is already in progress) */}
      {offeredOrders.length ? (
        <section className="space-y-3">
          {offeredOrders.map((order) => (
            <OfferCard
              key={order.id}
              order={order}
              nowMs={nowMs}
              compact={Boolean(currentOrder)}
              driverLocation={feedQ.data?.driver?.latest_ping}
              pending={actionM.isPending}
              onAction={runAction}
            />
          ))}
        </section>
      ) : null}

      {/* 3. Current delivery + queue */}
      {currentOrder ? (
        <section className="space-y-4">
          <CurrentDelivery
            key={currentOrder.id}
            order={currentOrder}
            ping={feedQ.data?.driver?.latest_ping}
            pending={actionM.isPending}
            onAction={runAction}
          />
          {nextOrders.length ? (
            <div className="space-y-2">
              <h2 className="text-sm font-semibold text-muted-foreground">{text.nextDeliveries}</h2>
              {nextOrders.map((order) => (
                <NextDeliveryCard key={order.id} order={order} />
              ))}
            </div>
          ) : null}
        </section>
      ) : null}

      {/* 4. Nothing to do */}
      {!currentOrder && !offeredOrders.length ? (
        feedQ.isLoading ? (
          <div className="flex justify-center py-14">
            <Spinner className="size-6" />
          </div>
        ) : (
          <EmptyState
            icon={isOnline ? Inbox : Power}
            title="No active deliveries"
            description={isOnline ? "Stay online — new offers will appear here." : "Go online to start receiving offers."}
          />
        )
      ) : null}

      {/* 5. Stats and tools */}
      <Separator />

      <StatGrid>
        <StatCard label={text.currentBalance} value={formatMoney(feedQ.data?.driver?.balance ?? 0)} icon={Wallet} tone="success" />
        <StatCard label={text.totalEarned} value={formatMoney(feedQ.data?.driver?.total_earned ?? 0)} icon={Banknote} tone="primary" />
        <StatCard label={text.offersLive} value={offeredOrders.length} icon={Inbox} tone={offeredOrders.length ? "warning" : "default"} />
        <StatCard label={text.activeDrops} value={assignedOrders.length} icon={Route} tone="info" />
      </StatGrid>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{text.recentEarnings}</CardTitle>
            <CardDescription>
              {text.delivered}: <span className="tabular-nums">{transactions.length}</span>
            </CardDescription>
          </CardHeader>
          <CardContent>
            {transactions.length === 0 ? (
              <EmptyState compact icon={Banknote} title={text.noEarnings} description="Complete a delivery to see earnings here." />
            ) : (
              <div className="grid">
                {transactions.map((transaction, index) => (
                  <div key={transaction.id}>
                    {index > 0 ? <Separator /> : null}
                    <div className="flex items-center justify-between gap-3 py-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{transaction.description || text.deliveryEarning}</div>
                        <div className="text-xs text-muted-foreground">
                          {transaction.distance_km ?? 0} km · {transaction.weather_condition || "clear"} · {formatDateTime(transaction.created_at)}
                        </div>
                      </div>
                      <Badge variant="outline" className="shrink-0 border-transparent bg-success/15 tabular-nums text-success">
                        {formatMoney(transaction.amount)}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
