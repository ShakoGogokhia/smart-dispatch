import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useParams } from "react-router-dom";
import {
  AlertCircle,
  Check,
  Clock3,
  Copy,
  History,
  MapPin,
  PackageSearch,
  RefreshCw,
  Search,
  Store,
  Truck,
  UserRound,
  X,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { MapContainer, Marker, TileLayer } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { toast } from "sonner";

import { EmptyState } from "@/components/app/empty-state";
import { OrderStatusBadge, StatusBadge, humanizeStatus, toneForStatus } from "@/components/app/status-badge";
import { StorefrontHeader } from "@/components/app/storefront-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { api } from "@/lib/api";
import { formatDateTime, formatOrderStatus } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { TrackingPayload } from "@/types/api";

export default function OrderTrackingPage() {
  const params = useParams();
  const [draftCode, setDraftCode] = useState(params.code ?? "");
  const [code, setCode] = useState(params.code ?? "");

  const trackingQ = useQuery({
    queryKey: ["public-tracking", code],
    queryFn: async () => (await api.get(`/api/public/track/${encodeURIComponent(code)}`)).data as TrackingPayload,
    enabled: code.trim().length > 0,
    refetchInterval: code ? 10000 : false,
    retry: false,
  });

  const order = trackingQ.data;
  const driverPosition = order?.driver?.latest_ping;
  const mapCenter = useMemo<[number, number] | null>(() => {
    if (driverPosition) return [Number(driverPosition.lat), Number(driverPosition.lng)];
    if (order?.dropoff_lat && order?.dropoff_lng) return [Number(order.dropoff_lat), Number(order.dropoff_lng)];
    return null;
  }, [driverPosition, order?.dropoff_lat, order?.dropoff_lng]);

  const statusUpper = (order?.status ?? "").toUpperCase();
  const isStopped = statusUpper === "CANCELLED" || statusUpper === "FAILED";
  const isDelivered = statusUpper === "DELIVERED";

  const searchForm = (
    <form
      className="flex w-full gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        setCode(draftCode.trim());
      }}
    >
      <div className="relative min-w-0 flex-1">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={draftCode}
          onChange={(event) => setDraftCode(event.target.value)}
          placeholder="ORD-000001"
          aria-label="Order code"
          className="pl-9"
        />
      </div>
      <Button type="submit">Track</Button>
    </form>
  );

  async function copyCode(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      toast.success("Order code copied");
    } catch {
      toast.error("Could not copy the order code");
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <StorefrontHeader />

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 md:py-8">
        {!code ? (
          <div className="mx-auto max-w-xl py-6 md:py-12">
            <Card>
              <CardHeader className="items-center text-center">
                <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <PackageSearch className="size-6" />
                </div>
                <CardTitle className="text-xl">Track your order</CardTitle>
                <CardDescription>
                  Enter the order code from your confirmation to see progress, ETA, driver details and the live map.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-2">
                {searchForm}
                <p className="text-xs text-muted-foreground">Order codes look like ORD-000001.</p>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div className="min-w-0">
                <h1 className="text-xl font-semibold tracking-tight md:text-2xl">Track order</h1>
                <p className="mt-1 text-sm text-muted-foreground">Progress updates automatically every 10 seconds.</p>
              </div>
              <div className="w-full md:max-w-sm">{searchForm}</div>
            </div>

            {trackingQ.isLoading ? (
              <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
                <div className="grid gap-6">
                  <Skeleton className="h-40 rounded-xl" />
                  <Skeleton className="h-80 rounded-xl" />
                </div>
                <div className="grid gap-6">
                  <Skeleton className="h-80 rounded-xl" />
                  <Skeleton className="h-40 rounded-xl" />
                </div>
              </div>
            ) : trackingQ.isError || !order ? (
              <EmptyState
                icon={PackageSearch}
                title="No order found"
                description={`We could not find an order with the code "${code}". Check the code and try again.`}
              />
            ) : (
              <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
                <div className="grid min-w-0 gap-6">
                  {/* Status hero */}
                  <Card>
                    <CardContent className="grid gap-5">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="text-xs font-medium text-muted-foreground">Order</div>
                          <div className="mt-0.5 flex items-center gap-1">
                            <span className="truncate font-mono text-lg font-semibold">{order.code}</span>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon-sm" aria-label="Copy order code" onClick={() => copyCode(order.code)}>
                                  <Copy />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Copy code</TooltipContent>
                            </Tooltip>
                          </div>
                          <div className="mt-3">
                            <StatusBadge tone={toneForStatus(order.status)} dot className="px-3 py-1 text-sm">{formatOrderStatus(order.status)}</StatusBadge>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          {trackingQ.isFetching ? <RefreshCw className="size-3.5 animate-spin" /> : <span className="size-2 rounded-full bg-success" />}
                          Live
                        </div>
                      </div>

                      {isStopped ? (
                        <Alert variant="destructive">
                          <AlertCircle />
                          <AlertTitle>This order was {statusUpper === "FAILED" ? "not delivered" : "cancelled"}</AlertTitle>
                          <AlertDescription>Contact the market if you have questions about this order.</AlertDescription>
                        </Alert>
                      ) : null}

                      <div className="grid gap-3 sm:grid-cols-3">
                        <HeroStat
                          icon={Clock3}
                          label={isDelivered ? "Delivered" : "Estimated delivery"}
                          value={formatDateTime(order.eta_summary?.estimated_delivery_at)}
                          extra={order.eta_summary?.is_late ? <StatusBadge tone="warning">Running late</StatusBadge> : null}
                        />
                        <HeroStat icon={Store} label="Market" value={order.market?.name ?? "Direct order"} />
                        <HeroStat icon={Truck} label="Driver" value={order.driver?.name ?? "Waiting for driver"} />
                      </div>
                    </CardContent>
                  </Card>

                  {/* Timeline */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Progress</CardTitle>
                      <CardDescription>Each step is checked off as your order moves along.</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {(order.timeline ?? []).length === 0 ? (
                        <EmptyState compact icon={History} title="No progress yet" description="Steps will appear once the market receives your order." />
                      ) : (
                        <ol className="relative">
                          {(() => {
                            const steps = order.timeline ?? [];
                            const firstPending = steps.findIndex((step) => !step.done);
                            return steps.map((step, index) => {
                              const isLast = index === steps.length - 1;
                              const isCurrent = index === firstPending;
                              const failedHere = isStopped && isCurrent;
                              return (
                                <li key={step.key} className="relative flex gap-4 pb-6 last:pb-0">
                                  {!isLast ? (
                                    <span
                                      aria-hidden
                                      className={cn("absolute top-8 left-[15px] h-[calc(100%-2rem)] w-0.5", step.done ? "bg-primary" : "bg-border")}
                                    />
                                  ) : null}
                                  <span
                                    className={cn(
                                      "relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full border-2 text-xs font-semibold tabular-nums",
                                      step.done && "border-primary bg-primary text-primary-foreground",
                                      !step.done && failedHere && "border-destructive bg-destructive text-destructive-foreground",
                                      !step.done && !failedHere && isCurrent && "border-primary bg-background text-primary",
                                      !step.done && !failedHere && !isCurrent && "border-border bg-background text-muted-foreground",
                                    )}
                                  >
                                    {step.done ? <Check className="size-4" /> : failedHere ? <X className="size-4" /> : index + 1}
                                  </span>
                                  <div className="min-w-0 flex-1 pt-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span className={cn("text-sm font-medium", !step.done && !isCurrent && "text-muted-foreground")}>{step.label}</span>
                                      {step.done ? (
                                        <StatusBadge tone="success">Done</StatusBadge>
                                      ) : failedHere ? (
                                        <StatusBadge tone="destructive">{humanizeStatus(order.status)}</StatusBadge>
                                      ) : isCurrent ? (
                                        <StatusBadge tone="info">In progress</StatusBadge>
                                      ) : (
                                        <StatusBadge tone="neutral">Pending</StatusBadge>
                                      )}
                                    </div>
                                    <div className="mt-0.5 text-xs text-muted-foreground">{step.at ? formatDateTime(step.at) : "Not yet"}</div>
                                  </div>
                                </li>
                              );
                            });
                          })()}
                        </ol>
                      )}
                    </CardContent>
                  </Card>

                  {/* Delivery summary */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Delivery details</CardTitle>
                      <CardDescription>Where the order is coming from and going to.</CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-3 sm:grid-cols-2">
                      <AddressBlock icon={Store} label="Pickup" title={order.market?.name ?? "Direct order"} value={order.pickup_address ?? order.market?.address} />
                      <AddressBlock icon={MapPin} label="Drop-off" title="Delivery address" value={order.dropoff_address} />
                      {order.created_at ? (
                        <div className="text-xs text-muted-foreground sm:col-span-2">Placed {formatDateTime(order.created_at)}</div>
                      ) : null}
                    </CardContent>
                  </Card>
                </div>

                <div className="grid min-w-0 gap-6">
                  {/* Map */}
                  <Card className="gap-0 overflow-hidden py-0">
                    <div className="flex items-center justify-between gap-3 px-4 py-3">
                      <div className="text-sm font-semibold">Live map</div>
                      {driverPosition?.updated_at ? (
                        <span className="text-xs text-muted-foreground">Updated {formatDateTime(driverPosition.updated_at)}</span>
                      ) : null}
                    </div>
                    {mapCenter ? (
                      <div className="h-[320px] border-t">
                        <MapContainer center={mapCenter} zoom={13} style={{ height: "100%", width: "100%" }}>
                          <TileLayer attribution="&copy; OpenStreetMap" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                          {driverPosition && <Marker position={[Number(driverPosition.lat), Number(driverPosition.lng)]} />}
                          {order.dropoff_lat && order.dropoff_lng && <Marker position={[Number(order.dropoff_lat), Number(order.dropoff_lng)]} />}
                        </MapContainer>
                      </div>
                    ) : (
                      <div className="border-t p-4">
                        <EmptyState compact icon={MapPin} title="Map not available yet" description="The map appears once location data is available." />
                      </div>
                    )}
                  </Card>

                  {/* Driver */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Your driver</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {order.driver ? (
                        <div className="flex items-center gap-3">
                          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                            <UserRound className="size-5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-medium">{order.driver.name ?? "Driver"}</div>
                            <div className="text-xs text-muted-foreground">
                              {driverPosition ? "Sharing live location" : "Location not shared yet"}
                            </div>
                          </div>
                          {order.driver.status ? <OrderStatusBadge status={order.driver.status} /> : null}
                        </div>
                      ) : (
                        <EmptyState compact icon={Truck} title="Waiting for driver" description="A driver will be assigned once the market prepares your order." />
                      )}
                    </CardContent>
                  </Card>

                  {/* Events */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Latest events</CardTitle>
                      <CardDescription>The five most recent updates.</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {(order.events ?? []).length === 0 ? (
                        <p className="text-sm text-muted-foreground">No events yet.</p>
                      ) : (
                        <ul className="grid gap-3">
                          {(order.events ?? []).slice(-5).reverse().map((event) => (
                            <li key={event.id} className="flex items-start gap-3 text-sm">
                              <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" />
                              <div className="min-w-0">
                                <div className="font-medium">{humanizeStatus(event.type)}</div>
                                <div className="text-xs text-muted-foreground">{formatDateTime(event.created_at)}</div>
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

function HeroStat({ icon: Icon, label, value, extra }: { icon: typeof Clock3; label: string; value: string; extra?: ReactNode }) {
  return (
    <div className="rounded-lg border bg-muted/30 p-3">
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Icon className="size-3.5" />
        {label}
      </div>
      <div className="mt-1 truncate text-sm font-semibold">{value}</div>
      {extra ? <div className="mt-1.5">{extra}</div> : null}
    </div>
  );
}

function AddressBlock({ icon: Icon, label, title, value }: { icon: typeof Clock3; label: string; title: string; value?: string | null }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border bg-muted/30 p-3">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-background text-muted-foreground">
        <Icon className="size-4" />
      </div>
      <div className="min-w-0">
        <div className="text-xs font-medium text-muted-foreground">{label}</div>
        <div className="truncate text-sm font-medium">{title}</div>
        <div className="text-sm text-muted-foreground break-words">{value || "Not provided"}</div>
      </div>
    </div>
  );
}
