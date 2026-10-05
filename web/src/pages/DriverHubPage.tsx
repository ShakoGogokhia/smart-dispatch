import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowDown,
  Banknote,
  CheckCircle2,
  Clock3,
  Inbox,
  MapPin,
  MapPinned,
  Navigation,
  PackageCheck,
  Phone,
  Power,
  Route,
  Store,
  Truck,
  Wallet,
  XCircle,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AxiosError } from "axios";

import { api } from "@/lib/api";
import { formatDateTime, formatMoney, formatOrderStatus } from "@/lib/format";
import { useMe } from "@/lib/useMe";
import { cn } from "@/lib/utils";
import type { Order } from "@/types/api";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { StatCard, StatGrid } from "@/components/app/stat-card";
import { StatusBadge, toneForStatus } from "@/components/app/status-badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";

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
  potentialEarning: "Potential earning",
  distance: "Distance",
  weather: "Weather",
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

function RouteSummary({ order }: { order: Order }) {
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

function OrderDetails({ order }: { order: Order }) {
  const compensation = order.driver_compensation;
  return (
    <div className="grid gap-3">
      <RouteSummary order={order} />

      {compensation?.earning_amount != null ? (
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
      ) : null}

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
    </div>
  );
}

function OrderHeading({ order }: { order: Order }) {
  return (
    <>
      <CardDescription>{order.market?.code || text.ordersTitle}</CardDescription>
      <CardTitle className="text-lg tabular-nums">{order.code}</CardTitle>
      <CardAction className="flex flex-col items-end gap-1.5">
        <StatusBadge tone={toneForStatus(order.status)} dot>
          {formatOrderStatus(order.status)}
        </StatusBadge>
        {order.total != null ? <span className="text-sm font-semibold tabular-nums">{formatMoney(order.total)}</span> : null}
      </CardAction>
    </>
  );
}

function ContactLinks({ order }: { order: Order }) {
  const hasCoords = Boolean(Number(order.dropoff_lat) && Number(order.dropoff_lng));
  const navigateHref = hasCoords
    ? `https://www.google.com/maps/dir/?api=1&destination=${order.dropoff_lat},${order.dropoff_lng}`
    : order.dropoff_address
      ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(order.dropoff_address)}`
      : null;

  if (!navigateHref && !order.customer_phone) return null;

  return (
    <div className="grid grid-cols-2 gap-2">
      {navigateHref ? (
        <Button asChild variant="outline" size="lg">
          <a href={navigateHref} target="_blank" rel="noreferrer">
            <Navigation />
            Navigate
          </a>
        </Button>
      ) : null}
      {order.customer_phone ? (
        <Button asChild variant="outline" size="lg">
          <a href={`tel:${order.customer_phone}`}>
            <Phone />
            Call
          </a>
        </Button>
      ) : null}
    </div>
  );
}

export default function DriverHubPage() {
  const meQ = useMe();
  const queryClient = useQueryClient();
  const [lat, setLat] = useState("41.7151");
  const [lng, setLng] = useState("44.8271");
  const [proofSignature, setProofSignature] = useState("");
  const [proofPhoto, setProofPhoto] = useState<File | null>(null);
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
    mutationFn: async ({ orderId, action }: { orderId: number; action: string }) => {
      if (action === "delivered" && proofPhoto) {
        const formData = new FormData();
        formData.append("proof_photo", proofPhoto);
        if (proofSignature) formData.append("proof_signature_name", proofSignature);
        return (await api.post(`/api/driver/orders/${orderId}/delivered`, formData)).data;
      }

      return (
        await api.post(`/api/driver/orders/${orderId}/${action}`, action === "delivered" ? { proof_signature_name: proofSignature || null } : undefined)
      ).data;
    },
    onSuccess: async () => {
      setProofPhoto(null);
      await refreshQueries();
    },
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
      <div className="space-y-6">
        <PageHeader title={text.title} />
        <EmptyState icon={Truck} title="Driver access only" description={text.onlyDrivers} />
      </div>
    );
  }

  const transactions = feedQ.data?.driver?.transactions ?? [];
  const isOnline = Boolean(activeShift);

  return (
    <div className="space-y-6">
      <PageHeader
        title={text.title}
        description="Go online to receive delivery offers, accept jobs and update each delivery as you go."
      />

      <Card className={cn(isOnline && "border-success/40")}>
        <CardHeader>
          <CardTitle>{text.statusTitle}</CardTitle>
          <CardDescription>
            {activeShift ? `Shift started ${formatDateTime(activeShift.started_at)}` : text.noActiveShift}
          </CardDescription>
          <CardAction>
            <StatusBadge tone={toneForStatus(driverStatus)} dot>
              {driverStatus}
            </StatusBadge>
          </CardAction>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="flex items-center gap-3 rounded-lg border bg-muted/30 p-3">
            <span
              className={cn(
                "flex size-10 shrink-0 items-center justify-center rounded-full",
                isOnline ? "bg-success/15 text-success" : "bg-muted text-muted-foreground",
              )}
            >
              <Power className="size-5" />
            </span>
            <div className="min-w-0">
              <div className="text-xs text-muted-foreground">{text.currentState}</div>
              <div className="font-semibold">{isOnline ? "You're online and can receive offers" : "You're offline"}</div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Button size="lg" className="h-12 text-base" onClick={() => startShiftM.mutate()} disabled={!!activeShift || startShiftM.isPending}>
              {startShiftM.isPending ? <Spinner /> : <Clock3 />}
              {startShiftM.isPending ? text.starting : `Go online (${text.startShift.toLowerCase()})`}
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="h-12 text-base"
              onClick={() => endShiftM.mutate()}
              disabled={!activeShift || endShiftM.isPending}
            >
              {endShiftM.isPending ? <Spinner /> : <Power />}
              {endShiftM.isPending ? text.ending : `Go offline (${text.endShift.toLowerCase()})`}
            </Button>
          </div>

          {mutationError ? (
            <Alert variant="destructive">
              <AlertCircle />
              <AlertDescription>{mutationError}</AlertDescription>
            </Alert>
          ) : null}
        </CardContent>
      </Card>

      <StatGrid>
        <StatCard label={text.currentBalance} value={formatMoney(feedQ.data?.driver?.balance ?? 0)} icon={Wallet} tone="success" />
        <StatCard label={text.totalEarned} value={formatMoney(feedQ.data?.driver?.total_earned ?? 0)} icon={Banknote} tone="primary" />
        <StatCard label={text.offersLive} value={offeredOrders.length} icon={Inbox} tone={offeredOrders.length ? "warning" : "default"} />
        <StatCard label={text.activeDrops} value={assignedOrders.length} icon={Route} tone="info" />
      </StatGrid>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="min-w-0 space-y-4">
          <div>
            <h2 className="text-base font-semibold">{text.incomingOffers}</h2>
            <p className="text-sm text-muted-foreground">{text.offerExpiresSoon}</p>
          </div>
          {offeredOrders.length === 0 ? (
            <EmptyState
              icon={Inbox}
              title={text.noOffers}
              description={isOnline ? "New offers appear here automatically. Keep this page open." : "Go online to start receiving offers."}
            />
          ) : (
            offeredOrders.map((order) => {
              const secondsRemaining = getOfferSecondsRemaining(order.offer_sent_at, nowMs);
              const isExpired = secondsRemaining === 0;
              const isUrgent = !isExpired && secondsRemaining <= 60;

              return (
                <Card key={order.id} className="border-primary ring-2 ring-primary/20">
                  <CardHeader>
                    <OrderHeading order={order} />
                  </CardHeader>
                  <CardContent className="grid gap-4">
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
                        className={cn(
                          isExpired && "bg-destructive/20",
                          isUrgent && "bg-warning/25 [&>[data-slot=progress-indicator]]:bg-warning",
                        )}
                      />
                      {isExpired ? <div className="text-xs">{text.offerExpired}</div> : null}
                    </div>
                    <OrderDetails order={order} />
                  </CardContent>
                  <CardFooter className="grid grid-cols-2 gap-3">
                    <Button
                      size="lg"
                      className="h-12 text-base"
                      onClick={() => actionM.mutate({ orderId: order.id, action: "accept" })}
                      disabled={actionM.isPending || isExpired}
                    >
                      <CheckCircle2 />
                      {text.accept}
                    </Button>
                    <Button
                      size="lg"
                      variant="outline"
                      className="h-12 text-base"
                      onClick={() => actionM.mutate({ orderId: order.id, action: "decline" })}
                      disabled={actionM.isPending || isExpired}
                    >
                      <XCircle />
                      {text.decline}
                    </Button>
                  </CardFooter>
                </Card>
              );
            })
          )}
        </section>

        <section className="min-w-0 space-y-4">
          <div>
            <h2 className="text-base font-semibold">{text.assignedDeliveries}</h2>
            <p className="text-sm text-muted-foreground">Pick up the order, then mark it delivered with proof.</p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Proof of delivery</CardTitle>
              <CardDescription>Attached when you tap "{text.markDelivered}".</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="proof-signature">{text.proofSignature}</Label>
                <Input
                  id="proof-signature"
                  placeholder="Name of the person who received it"
                  value={proofSignature}
                  onChange={(event) => setProofSignature(event.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="proof-photo">Proof photo</Label>
                <Input id="proof-photo" type="file" accept="image/*" onChange={(event) => setProofPhoto(event.target.files?.[0] ?? null)} />
              </div>
            </CardContent>
          </Card>

          {assignedOrders.length === 0 ? (
            <EmptyState icon={PackageCheck} title={text.noAssigned} description="Accepted offers show up here as active deliveries." />
          ) : (
            assignedOrders.map((order) => (
              <Card key={order.id}>
                <CardHeader>
                  <OrderHeading order={order} />
                </CardHeader>
                <CardContent className="grid gap-4">
                  <OrderDetails order={order} />
                  <ContactLinks order={order} />
                </CardContent>
                {order.status === "ASSIGNED" || order.status === "PICKED_UP" ? (
                  <CardFooter>
                    {order.status === "ASSIGNED" && (
                      <Button
                        size="lg"
                        className="h-12 w-full text-base"
                        onClick={() => actionM.mutate({ orderId: order.id, action: "picked-up" })}
                        disabled={actionM.isPending}
                      >
                        <PackageCheck />
                        {text.markPickedUp}
                      </Button>
                    )}
                    {order.status === "PICKED_UP" && (
                      <Button
                        size="lg"
                        className="h-12 w-full text-base"
                        onClick={() => actionM.mutate({ orderId: order.id, action: "delivered" })}
                        disabled={actionM.isPending}
                      >
                        <MapPinned />
                        {text.markDelivered}
                      </Button>
                    )}
                  </CardFooter>
                ) : null}
              </Card>
            ))
          )}
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <Card>
          <CardHeader>
            <CardTitle>{text.sendLocation}</CardTitle>
            <CardDescription>Share your position so dispatch can see where you are.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="ping-lat">{text.latitude}</Label>
                <Input id="ping-lat" inputMode="decimal" value={lat} onChange={(event) => setLat(event.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="ping-lng">{text.longitude}</Label>
                <Input id="ping-lng" inputMode="decimal" value={lng} onChange={(event) => setLng(event.target.value)} />
              </div>
            </div>
            <Button variant="outline" size="lg" onClick={() => pingM.mutate()} disabled={pingM.isPending}>
              {pingM.isPending ? <Spinner /> : <Navigation />}
              {pingM.isPending ? text.sending : text.sendPing}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{text.recentEarnings}</CardTitle>
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
