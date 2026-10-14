import { useState } from "react";
import { Marker, Polyline } from "react-leaflet";
import {
  Camera,
  Check,
  CheckCircle2,
  Clock3,
  ChevronDown,
  Hourglass,
  MapPin,
  MapPinned,
  Maximize2,
  Minimize2,
  Navigation,
  PackageCheck,
  Phone,
  Store,
  UserRound,
} from "lucide-react";

import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { MapView } from "@/components/app/map-view";
import { formatDuration, haversineKm, useRoadRoute } from "@/lib/routing";
import { makeDotIcon, toLatLng } from "@/components/operations/map-markers";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";

import { resolveStep, STEP_ACTION, STEP_SHORT_LABEL, type DriverOrder, type DriverPing, type DriverStep } from "./types";

export type DeliveryProof = {
  signatureName: string;
  note: string;
  photo: File | null;
};

const STEPS = ["Go to market", "Pick up", "Go to customer", "Deliver"] as const;

/** 1-based position in the 4-step progress bar. */
const STEP_INDEX: Record<DriverStep, number> = {
  offer: 0,
  to_pickup: 1,
  waiting_ready: 2,
  pickup: 2,
  to_dropoff: 3,
  handover: 4,
  done: 5,
};

const pickupIcon = makeDotIcon("bg-primary", { size: 26, selected: true });
const dropoffIcon = makeDotIcon("bg-success", { size: 26, selected: true });
const driverIcon = makeDotIcon("bg-info", { size: 18 });

function isPickupPhase(step: DriverStep) {
  return step === "to_pickup" || step === "waiting_ready" || step === "pickup";
}

function pickupPoint(order: DriverOrder) {
  return toLatLng(order.pickup_lat, order.pickup_lng) ?? toLatLng(order.market?.lat, order.market?.lng);
}

function directionsHref(point: [number, number] | null, address: string | null | undefined) {
  if (point) return `https://www.google.com/maps/dir/?api=1&destination=${point[0]},${point[1]}`;
  if (address) return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`;
  return null;
}

function Stepper({ step }: { step: DriverStep }) {
  const current = STEP_INDEX[step];
  return (
    <ol className="grid grid-cols-4 gap-1" aria-label="Delivery progress">
      {STEPS.map((label, index) => {
        const position = index + 1;
        const done = position < current;
        const active = position === current;
        return (
          <li key={label} className="relative flex flex-col items-center gap-1.5 text-center" aria-current={active ? "step" : undefined}>
            {index > 0 ? (
              <span
                aria-hidden
                className={cn("absolute top-4 right-1/2 h-0.5 w-full -translate-y-1/2", position <= current ? "bg-primary" : "bg-border")}
              />
            ) : null}
            <span
              className={cn(
                "relative z-10 flex size-8 items-center justify-center rounded-full border-2 text-sm font-semibold tabular-nums",
                done && "border-primary bg-primary text-primary-foreground",
                active && "border-primary bg-background text-primary ring-4 ring-primary/20",
                !done && !active && "border-border bg-background text-muted-foreground",
              )}
            >
              {done ? <Check className="size-4" /> : position}
            </span>
            <span className={cn("text-xs leading-tight", active ? "font-semibold text-foreground" : "text-muted-foreground")}>{label}</span>
          </li>
        );
      })}
    </ol>
  );
}

function Instruction({ order, step }: { order: DriverOrder; step: DriverStep }) {
  const marketName = order.market?.name || order.market?.code || "the market";
  const pickupAddress = order.pickup_address || order.market?.address;
  const customerName = order.customer_name || order.customer?.name || "the customer";

  const content: Record<DriverStep, { icon: typeof Store; tone: string; title: string; address?: string | null; hint: string }> = {
    offer: { icon: Store, tone: "bg-muted text-muted-foreground", title: "New offer", hint: "" },
    to_pickup: {
      icon: Store,
      tone: "bg-primary/10 text-primary",
      title: `Go to ${marketName}`,
      address: pickupAddress,
      hint: "Tap \"I've arrived\" when you're at the market.",
    },
    waiting_ready: {
      icon: Hourglass,
      tone: "bg-warning/15 text-warning animate-pulse",
      title: "Waiting for the market to prepare the order",
      address: pickupAddress,
      hint: "You'll be able to pick it up as soon as it's ready.",
    },
    pickup: {
      icon: PackageCheck,
      tone: "bg-success/15 text-success",
      title: "The order is ready — pick it up",
      address: pickupAddress,
      hint: "Take the order from the market, then tap \"Picked up the order\".",
    },
    to_dropoff: {
      icon: MapPin,
      tone: "bg-primary/10 text-primary",
      title: `Deliver to ${customerName}`,
      address: order.dropoff_address,
      hint: "Tap \"I've arrived\" at the address.",
    },
    handover: {
      icon: UserRound,
      tone: "bg-success/15 text-success",
      title: "Hand the order to the customer",
      address: order.dropoff_address,
      hint: "Then tap \"Delivered\".",
    },
    done: { icon: CheckCircle2, tone: "bg-success/15 text-success", title: "Delivered", hint: "" },
  };

  const { icon: Icon, tone, title, address, hint } = content[step];

  return (
    <div className={cn("flex items-start gap-4 rounded-xl border p-4", step === "pickup" && "border-success/40 bg-success/5")}>
      <span className={cn("flex size-12 shrink-0 items-center justify-center rounded-full", tone)}>
        <Icon className="size-6" />
      </span>
      <div className="min-w-0 space-y-1">
        <h3 className="text-xl font-semibold leading-tight text-balance">{title}</h3>
        {address ? <p className="text-sm font-medium break-words">{address}</p> : null}
        {hint ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            {step === "waiting_ready" ? <Spinner className="size-3.5" /> : null}
            {hint}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function DestinationMap({ order, step, ping }: { order: DriverOrder; step: DriverStep; ping: DriverPing | undefined }) {
  const toPickup = isPickupPhase(step);
  const destination = toPickup ? pickupPoint(order) : toLatLng(order.dropoff_lat, order.dropoff_lng);
  const driver = ping ? toLatLng(ping.lat, ping.lng) : null;

  if (!destination) {
    return (
      <div className="flex h-[240px] items-center justify-center rounded-xl border border-dashed text-sm text-muted-foreground">
        No map location for this address.
      </div>
    );
  }

  return <RouteToDestination order={order} toPickup={toPickup} destination={destination} driver={driver} />;
}

/** Real road route (OSRM) from the driver to the current stop, with distance, drive time and a bigger-map toggle. */
function RouteToDestination({
  order,
  toPickup,
  destination,
  driver,
}: {
  order: DriverOrder;
  toPickup: boolean;
  destination: [number, number];
  driver: [number, number] | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const route = useRoadRoute([driver, destination]);
  const path = route.data?.points ?? (driver ? [driver, destination] : null);
  const fit = route.data?.points ?? (driver ? [destination, driver] : [destination]);
  const km = route.data?.distanceKm ?? (driver ? haversineKm(driver, destination) : null);

  return (
    <div className={cn("relative overflow-hidden rounded-xl border transition-[height]", expanded ? "h-[520px]" : "h-[260px]")}>
      {/* Remount when the destination changes so the map re-fits to the new leg. */}
      <MapView key={`${order.id}-${toPickup ? "pickup" : "dropoff"}-${route.data ? "road" : "line"}`} center={destination} zoom={14} fitTo={fit}>
        {path ? (
          <Polyline positions={path} pathOptions={{ className: "stroke-primary", weight: 5, opacity: 0.9, dashArray: route.data ? undefined : "6 8" }} />
        ) : null}
        <Marker position={destination} icon={toPickup ? pickupIcon : dropoffIcon} />
        {driver ? <Marker position={driver} icon={driverIcon} /> : null}
      </MapView>
      {km != null ? (
        <div className="pointer-events-none absolute top-2 left-2 z-[1000] flex flex-wrap gap-1.5">
          <span className="flex h-7 items-center gap-1.5 rounded-full border bg-card/95 px-2.5 text-xs font-semibold tabular-nums shadow-sm backdrop-blur">
            <Navigation className="size-3.5" />
            {km.toFixed(1)} km
          </span>
          {route.data ? (
            <span className="flex h-7 items-center gap-1.5 rounded-full border bg-card/95 px-2.5 text-xs font-semibold tabular-nums shadow-sm backdrop-blur">
              <Clock3 className="size-3.5" />
              {formatDuration(route.data.durationMin)} drive
            </span>
          ) : null}
        </div>
      ) : null}
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        className="absolute top-2 right-2 z-[1000] bg-card/95 shadow-sm"
        onClick={() => setExpanded((v) => !v)}
        aria-label={expanded ? "Make the map smaller" : "Make the map bigger"}
      >
        {expanded ? <Minimize2 /> : <Maximize2 />}
      </Button>
    </div>
  );
}

function OrderDetailsSection({ order }: { order: DriverOrder }) {
  const [open, setOpen] = useState(false);
  const earning = order.driver_compensation?.earning_amount;

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="rounded-xl border">
      <CollapsibleTrigger asChild>
        <button type="button" className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-medium">
          <span>
            Order details <span className="text-muted-foreground tabular-nums">· {order.code}</span>
          </span>
          <ChevronDown className={cn("size-4 text-muted-foreground transition-transform", open && "rotate-180")} />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="grid gap-3 border-t px-4 py-3 text-sm">
          {order.items?.length ? (
            <ul className="grid gap-1.5">
              {order.items.map((item) => {
                const removed = item.removed_ingredients ?? [];
                return (
                  <li key={item.id} className="flex items-start justify-between gap-3">
                    <span className="min-w-0 break-words">
                      {item.name}
                      {item.combo_offer?.name ? <span className="text-muted-foreground"> · combo: {item.combo_offer.name}</span> : null}
                      {removed.length ? <span className="text-muted-foreground"> · without {removed.join(", ")}</span> : null}
                    </span>
                    <span className="shrink-0 font-medium tabular-nums">×{item.qty}</span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-muted-foreground">No items listed.</p>
          )}

          <dl className="grid grid-cols-2 gap-2 border-t pt-3">
            <div className="min-w-0">
              <dt className="text-xs text-muted-foreground">Customer</dt>
              <dd className="truncate font-medium">{order.customer_name || order.customer?.name || "Unknown"}</dd>
            </div>
            <div className="min-w-0">
              <dt className="text-xs text-muted-foreground">Phone</dt>
              <dd className="truncate font-medium">{order.customer_phone || "Not provided"}</dd>
            </div>
            {order.total != null ? (
              <div>
                <dt className="text-xs text-muted-foreground">Order total</dt>
                <dd className="font-medium tabular-nums">{formatMoney(order.total)}</dd>
              </div>
            ) : null}
            {earning != null ? (
              <div>
                <dt className="text-xs text-muted-foreground">Your earning</dt>
                <dd className="font-medium tabular-nums text-success">
                  {formatMoney(earning)}
                  {order.driver_compensation?.distance_km != null ? (
                    <span className="text-muted-foreground"> · {order.driver_compensation.distance_km} km</span>
                  ) : null}
                </dd>
              </div>
            ) : null}
            {order.notes ? (
              <div className="col-span-2 min-w-0">
                <dt className="text-xs text-muted-foreground">Delivery notes</dt>
                <dd className="break-words">{order.notes}</dd>
              </div>
            ) : null}
          </dl>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function ProofSection({ proof, onChange }: { proof: DeliveryProof; onChange: (next: DeliveryProof) => void }) {
  const [open, setOpen] = useState(false);
  const filled = Boolean(proof.signatureName || proof.note || proof.photo);

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="rounded-xl border">
      <CollapsibleTrigger asChild>
        <button type="button" className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-medium">
          <span className="flex items-center gap-2">
            <Camera className="size-4 text-muted-foreground" />
            Add proof (optional)
            {filled ? <Badge variant="secondary">Added</Badge> : null}
          </span>
          <ChevronDown className={cn("size-4 text-muted-foreground transition-transform", open && "rotate-180")} />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="grid gap-4 border-t px-4 py-3 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="proof-signature">Received by</Label>
            <Input
              id="proof-signature"
              placeholder="Name of the person who received it"
              value={proof.signatureName}
              onChange={(event) => onChange({ ...proof, signatureName: event.target.value })}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="proof-photo">Photo</Label>
            <Input
              id="proof-photo"
              type="file"
              accept="image/*"
              onChange={(event) => onChange({ ...proof, photo: event.target.files?.[0] ?? null })}
            />
          </div>
          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="proof-note">Note</Label>
            <Textarea
              id="proof-note"
              rows={2}
              placeholder="e.g. Left with the concierge"
              value={proof.note}
              onChange={(event) => onChange({ ...proof, note: event.target.value })}
            />
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

const ACTION_LABEL: Partial<Record<DriverStep, { label: string; icon: typeof Store }>> = {
  to_pickup: { label: "I've arrived at the market", icon: Store },
  pickup: { label: "Picked up the order", icon: PackageCheck },
  to_dropoff: { label: "I've arrived at the customer", icon: MapPinned },
  handover: { label: "Delivered", icon: CheckCircle2 },
};

/** The driver's current job: progress, one plain instruction, a map and ONE action. */
export function CurrentDelivery({
  order,
  ping,
  pending,
  onAction,
}: {
  order: DriverOrder;
  ping: DriverPing | undefined;
  pending: boolean;
  onAction: (orderId: number, action: string, proof?: DeliveryProof) => void;
}) {
  const [proof, setProof] = useState<DeliveryProof>({ signatureName: "", note: "", photo: null });
  const step = resolveStep(order);
  const action = STEP_ACTION[step];
  const actionMeta = ACTION_LABEL[step];
  const toPickup = isPickupPhase(step);

  const navigateHref = toPickup
    ? directionsHref(pickupPoint(order), order.pickup_address || order.market?.address)
    : directionsHref(toLatLng(order.dropoff_lat, order.dropoff_lng), order.dropoff_address);
  const phone = !toPickup ? order.customer_phone : null;

  return (
    <Card className="border-primary/40">
      <CardHeader>
        <CardDescription>Current delivery · {order.market?.name || order.market?.code || "Order"}</CardDescription>
        <CardTitle className="text-lg tabular-nums">{order.code}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <Stepper step={step} />
        <Instruction order={order} step={step} />
        <DestinationMap order={order} step={step} ping={ping} />

        {navigateHref || phone ? (
          <div className={cn("grid gap-2", navigateHref && phone && "grid-cols-2")}>
            {navigateHref ? (
              <Button asChild variant="outline" size="lg">
                <a href={navigateHref} target="_blank" rel="noreferrer">
                  <Navigation />
                  Navigate
                </a>
              </Button>
            ) : null}
            {phone ? (
              <Button asChild variant="outline" size="lg">
                <a href={`tel:${phone}`}>
                  <Phone />
                  Call
                </a>
              </Button>
            ) : null}
          </div>
        ) : null}

        {step === "handover" ? <ProofSection proof={proof} onChange={setProof} /> : null}
        <OrderDetailsSection order={order} />
      </CardContent>
      <CardFooter>
        {action && actionMeta ? (
          <Button
            size="lg"
            className="h-14 w-full text-base"
            disabled={pending}
            onClick={() => onAction(order.id, action, step === "handover" ? proof : undefined)}
          >
            {pending ? <Spinner /> : <actionMeta.icon />}
            {actionMeta.label}
          </Button>
        ) : step === "waiting_ready" ? (
          <Button size="lg" variant="secondary" className="h-14 w-full text-base" disabled>
            <Spinner />
            Waiting for the market…
          </Button>
        ) : null}
      </CardFooter>
    </Card>
  );
}

/** Compact card for queued assigned orders after the current one. */
export function NextDeliveryCard({ order }: { order: DriverOrder }) {
  const step = resolveStep(order);
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border bg-card p-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium tabular-nums">{order.code}</span>
          <Badge variant="outline">{STEP_SHORT_LABEL[step]}</Badge>
        </div>
        <div className="truncate text-sm text-muted-foreground">
          {order.market?.name || order.market?.code || "Market"} → {order.dropoff_address || "No address set"}
        </div>
      </div>
      {order.driver_compensation?.earning_amount != null ? (
        <span className="shrink-0 text-sm font-semibold tabular-nums text-success">{formatMoney(order.driver_compensation.earning_amount)}</span>
      ) : null}
    </div>
  );
}
