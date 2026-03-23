import { useMemo, useState } from "react";
import { PackagePlus, Search, Sparkles, Zap } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AxiosError } from "axios";
import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import "leaflet/dist/leaflet.css";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api } from "@/lib/api";
import { formatDateTime, formatMoney, formatOrderStatus, getOrderStatusTone } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { useMe } from "@/lib/useMe";
import type { Order, Paginated } from "@/types/api";

function statusBadgeClass(status: string) {
  switch (getOrderStatusTone(status)) {
    case "success":
      return "status-good";
    case "warning":
      return "status-warn";
    case "danger":
      return "status-bad";
    default:
      return "status-neutral";
  }
}

function getErrorMessage(error: unknown) {
  if (!error || typeof error !== "object") return null;
  const axiosError = error as AxiosError<{ message?: string }>;
  return axiosError.response?.data?.message ?? (error as Error | null)?.message ?? null;
}

function getStatusLabel(status?: string | null) {
  return formatOrderStatus(status);
}

function canShowCustomerTracking(order: Order) {
  return order.status === "PICKED_UP" && !!order.assigned_driver?.latest_ping;
}

function canManageMarketOrder(order: Order, isOpsUser: boolean) {
  return isOpsUser && !!order.market;
}

function CustomerOrderCard({ order }: { order: Order }) {
  const { t } = useI18n();

  return (
    <Card>
      <CardContent className="grid gap-5 p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="section-kicker">{order.market?.code || t("orders.title")}</div>
            <div className="font-display theme-ink mt-2 text-4xl font-semibold tracking-[-0.05em]">{order.code}</div>
            <div className="theme-muted mt-2 text-sm">{order.dropoff_address || t("orders.noAddress")}</div>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className={`status-chip ${statusBadgeClass(getStatusLabel(order.status))}`}>{getStatusLabel(order.status)}</span>
            {order.total != null && <Badge className="status-chip status-neutral">{formatMoney(order.total)}</Badge>}
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="metric-block py-4">
            <div className="section-kicker">{t("orders.placed")}</div>
            <div className="theme-ink mt-2 text-sm font-semibold">{formatDateTime(order.created_at)}</div>
          </div>
          <div className="metric-block py-4">
            <div className="section-kicker">{t("common.market")}</div>
            <div className="theme-ink mt-2 text-sm font-semibold">{order.market?.name || t("orders.unknownMarket")}</div>
          </div>
          <div className="metric-block py-4">
            <div className="section-kicker">{t("orders.pickup")}</div>
            <div className="theme-ink mt-2 text-sm font-semibold">{order.pickup_address || order.market?.address || t("orders.marketPickupPoint")}</div>
          </div>
          <div className="metric-block py-4">
            <div className="section-kicker">{t("common.driver")}</div>
            <div className="theme-ink mt-2 text-sm font-semibold">
              {order.assigned_driver?.user?.name || order.offered_driver?.user?.name || t("orders.waitingForAssignment")}
            </div>
          </div>
        </div>

        {order.items?.length ? (
          <div className="subpanel p-4 text-sm">
            <span className="theme-ink font-semibold">{t("orders.itemsLabel")}:</span>{" "}
            <span className="theme-copy">{order.items.map((item) => `${item.name} x${item.qty}`).join(", ")}</span>
          </div>
        ) : null}

        {canShowCustomerTracking(order) ? (
          <div className="grid gap-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="theme-ink font-semibold">{t("orders.liveDriverTracking")}</div>
                <div className="theme-muted text-sm">{t("orders.trackingAfterPickup")}</div>
              </div>
              <div className="status-chip status-good">{t("common.live")}</div>
            </div>
            <div className="map-frame h-[300px]">
              <MapContainer
                center={[Number(order.assigned_driver?.latest_ping?.lat), Number(order.assigned_driver?.latest_ping?.lng)]}
                zoom={13}
                style={{ height: "100%", width: "100%" }}
              >
                <TileLayer attribution="&copy; OpenStreetMap" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                <Marker position={[Number(order.assigned_driver?.latest_ping?.lat), Number(order.assigned_driver?.latest_ping?.lng)]}>
                  <Popup>
                    <div className="text-sm">
                      <div className="font-semibold">{order.assigned_driver?.user?.name || t("common.driver")}</div>
                      <div>
                        {t("common.updated")}{" "}
                        {formatDateTime(
                          order.assigned_driver?.latest_ping?.updated_at || order.assigned_driver?.latest_ping?.created_at,
                        )}
                      </div>
                    </div>
                  </Popup>
                </Marker>
                <Marker position={[Number(order.dropoff_lat), Number(order.dropoff_lng)]}>
                  <Popup>
                    <div className="text-sm">
                      <div className="font-semibold">{t("orders.deliveryAddress")}</div>
                      <div>{order.dropoff_address || t("orders.customerDestination")}</div>
                    </div>
                  </Popup>
                </Marker>
              </MapContainer>
            </div>
          </div>
        ) : (
          <div className="subpanel p-4 text-sm">
            <div className="theme-muted">{t("orders.trackingLater")}</div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function OrdersPage() {
  const meQ = useMe();
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [dropoffAddress, setDropoffAddress] = useState("Tbilisi Center");
  const [dropoffLat, setDropoffLat] = useState("41.7151");
  const [dropoffLng, setDropoffLng] = useState("44.8271");
  const [search, setSearch] = useState("");

  const roles = meQ.data?.roles ?? [];
  const isCustomerOnly =
    roles.includes("customer") && !roles.some((role: string) => ["admin", "owner", "staff", "driver"].includes(role));
  const isOpsUser = roles.some((role: string) => ["admin", "owner", "staff"].includes(role));

  const ordersQ = useQuery({
    queryKey: ["orders"],
    queryFn: async () => (await api.get("/api/orders")).data as Paginated<Order>,
    refetchInterval: isCustomerOnly ? 8000 : false,
  });

  const createOrderM = useMutation({
    mutationFn: async () =>
      api.post("/api/orders", {
        dropoff_lat: Number(dropoffLat),
        dropoff_lng: Number(dropoffLng),
        dropoff_address: dropoffAddress,
        priority: 2,
        size: 1,
        notes: "Manual ops order",
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["orders"] });
      setDropoffAddress("");
    },
  });

  const marketActionM = useMutation({
    mutationFn: async ({ orderId, action }: { orderId: number; action: "market-accept" | "mark-ready" }) =>
      (await api.post(`/api/orders/${orderId}/${action}`)).data,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
  });

  const filteredOrders = useMemo(() => {
    const orders = ordersQ.data?.data ?? [];
    const text = search.trim().toLowerCase();
    if (!text) return orders;

    return orders.filter((order) =>
      [order.code, order.dropoff_address ?? "", order.status, order.customer_name ?? "", order.market?.name ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(text),
    );
  }, [ordersQ.data?.data, search]);

  const createError = getErrorMessage(createOrderM.error);
  const marketActionError = getErrorMessage(marketActionM.error);
  const marketPendingCount = filteredOrders.filter((order) => order.status === "MARKET_PENDING").length;
  const driverFlowCount = filteredOrders.filter((order) =>
    ["READY_FOR_PICKUP", "OFFERED", "ASSIGNED", "PICKED_UP"].includes(order.status),
  ).length;
  const deliveredCount = filteredOrders.filter((order) => order.status === "DELIVERED").length;

  if (isCustomerOnly) {
    return (
      <div className="grid gap-6">
        <section className="hero-grid">
          <div className="hero-panel">
            <div className="command-chip">
              <Sparkles className="h-3.5 w-3.5" />
              {t("orders.customerDesk")}
            </div>
            <h1 className="font-display mt-5 text-5xl font-semibold tracking-[-0.06em] text-white md:text-6xl">
              {t("orders.customerHeroTitle")}
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-8 text-slate-300">
              {t("orders.customerHeroText")}
            </p>

            <div className="mt-8 data-grid">
              <div className="metric-block">
                <div className="section-kicker">{t("orders.ordersVisible")}</div>
                <div className="font-display theme-ink mt-3 text-5xl font-semibold tracking-[-0.05em]">{filteredOrders.length}</div>
              </div>
              <div className="metric-block">
                <div className="section-kicker">{t("orders.deliveredCount")}</div>
                <div className="font-display theme-ink mt-3 text-5xl font-semibold tracking-[-0.05em]">{deliveredCount}</div>
              </div>
              <div className="metric-block md:col-span-2">
                <div className="section-kicker">{t("orders.refreshMode")}</div>
                <div className="theme-copy mt-3 text-sm leading-7">
                  {t("orders.refreshCopy")}
                </div>
              </div>
            </div>
          </div>

          <div className="hero-stats">
            <div className="metric-dark">
              <div className="section-kicker">{t("orders.liveCount")}</div>
              <div className="mt-3 font-display text-7xl font-semibold tracking-[-0.05em]">{filteredOrders.length}</div>
            </div>
            <div className="frost-panel">
              <div className="theme-ink font-semibold">{t("orders.readableStatusPath")}</div>
              <div className="theme-copy mt-2 text-sm leading-7">
                {t("orders.readableStatusCopy")}
              </div>
            </div>
          </div>
        </section>

        {ordersQ.isLoading ? (
          <Card>
            <CardContent className="theme-copy p-8 text-sm">{t("orders.loadingCustomer")}</CardContent>
          </Card>
        ) : ordersQ.isError ? (
          <Card>
            <CardContent className="p-8 text-sm text-rose-700 dark:text-rose-100">{t("orders.failed")}</CardContent>
          </Card>
        ) : filteredOrders.length === 0 ? (
          <Card>
            <CardContent className="theme-copy p-8 text-sm">{t("orders.noneYet")}</CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {filteredOrders.map((order) => (
              <CustomerOrderCard key={order.id} order={order} />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      <section className="hero-grid">
        <div className="hero-panel">
          <div className="command-chip">
            <Zap className="h-3.5 w-3.5" />
            {t("orders.commandBoard")}
          </div>
          <h1 className="font-display mt-5 text-5xl font-semibold tracking-[-0.06em] text-white md:text-6xl">
            {t("orders.opsHeroTitle")}
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-8 text-slate-300">
            {t("orders.opsHeroText")}
          </p>

          <div className="mt-8 data-grid">
            <div className="metric-block">
              <div className="section-kicker">{t("orders.visibleOrders")}</div>
              <div className="font-display theme-ink mt-3 text-5xl font-semibold tracking-[-0.05em]">{filteredOrders.length}</div>
            </div>
            <div className="metric-block">
              <div className="section-kicker">{t("orders.marketPendingCount")}</div>
              <div className="font-display theme-ink mt-3 text-5xl font-semibold tracking-[-0.05em]">{marketPendingCount}</div>
            </div>
            <div className="metric-block">
              <div className="section-kicker">{t("orders.inDriverFlow")}</div>
              <div className="font-display theme-ink mt-3 text-5xl font-semibold tracking-[-0.05em]">{driverFlowCount}</div>
            </div>
            <div className="metric-block">
              <div className="section-kicker">{t("orders.deliveredCount")}</div>
              <div className="font-display theme-ink mt-3 text-5xl font-semibold tracking-[-0.05em]">{deliveredCount}</div>
            </div>
          </div>
        </div>

        <div className="grid gap-4">
          {isOpsUser && (
            <Card>
              <CardHeader>
                <CardTitle className="panel-title">{t("orders.createOpsOrder")}</CardTitle>
                <p className="panel-copy">{t("orders.createOpsText")}</p>
              </CardHeader>
              <CardContent className="grid gap-4">
                <div className="field-group">
                  <Label className="field-label">{t("orders.dropoffAddress")}</Label>
                  <Input value={dropoffAddress} onChange={(event) => setDropoffAddress(event.target.value)} className="input-shell" />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="field-group">
                    <Label className="field-label">{t("orders.latitude")}</Label>
                    <Input value={dropoffLat} onChange={(event) => setDropoffLat(event.target.value)} className="input-shell" />
                  </div>
                  <div className="field-group">
                    <Label className="field-label">{t("orders.longitude")}</Label>
                    <Input value={dropoffLng} onChange={(event) => setDropoffLng(event.target.value)} className="input-shell" />
                  </div>
                </div>

                {createError && <div className="rounded-[18px] border border-rose-300/20 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:bg-rose-300/12 dark:text-rose-100">{createError}</div>}
                {marketActionError && (
                  <div className="rounded-[18px] border border-rose-300/20 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:bg-rose-300/12 dark:text-rose-100">
                    {marketActionError}
                  </div>
                )}

                <Button className="h-12" onClick={() => createOrderM.mutate()} disabled={createOrderM.isPending}>
                  <PackagePlus className="h-4 w-4" />
                  {createOrderM.isPending ? t("orders.creating") : t("orders.createButton")}
                </Button>
              </CardContent>
            </Card>
          )}

          <div className="frost-panel">
            <div className="section-kicker">{t("orders.howToRead")}</div>
            <div className="theme-copy mt-3 text-sm leading-7">
              {t("orders.howToReadText")}
            </div>
          </div>
        </div>
      </section>

      <Card>
        <CardHeader className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <CardTitle className="panel-title">{t("orders.tableTitle")}</CardTitle>
            <p className="panel-copy mt-2">{t("orders.tableText")}</p>
          </div>
          <div className="relative w-full md:max-w-sm">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("orders.searchPlaceholder")} className="input-shell pl-11" />
          </div>
        </CardHeader>
        <CardContent>
          {ordersQ.isLoading ? (
            <div className="theme-copy text-sm">{t("orders.loading")}</div>
          ) : ordersQ.isError ? (
            <div className="text-sm text-rose-700 dark:text-rose-100">{t("orders.failed")}</div>
          ) : (
            <>
              <div className="table-desktop table-shell">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("orders.code")}</TableHead>
                      <TableHead>{t("common.status")}</TableHead>
                      <TableHead>{t("common.market")}</TableHead>
                      <TableHead>{t("common.customer")}</TableHead>
                      <TableHead>{t("common.driver")}</TableHead>
                      <TableHead>{t("common.total")}</TableHead>
                      <TableHead>{t("common.created")}</TableHead>
                      <TableHead>{t("common.actions")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredOrders.map((order) => (
                      <TableRow key={order.id}>
                        <TableCell className="theme-ink font-semibold">{order.code}</TableCell>
                        <TableCell>
                          <span className={`status-chip ${statusBadgeClass(getStatusLabel(order.status))}`}>{getStatusLabel(order.status)}</span>
                        </TableCell>
                        <TableCell>{order.market?.name || t("orders.directOrder")}</TableCell>
                        <TableCell>{order.customer_name || order.customer?.name || t("common.unknown")}</TableCell>
                        <TableCell>{order.assigned_driver?.user?.name || order.offered_driver?.user?.name || t("common.unassigned")}</TableCell>
                        <TableCell>{order.total != null ? formatMoney(order.total) : "-"}</TableCell>
                        <TableCell>{formatDateTime(order.created_at)}</TableCell>
                        <TableCell>
                          {canManageMarketOrder(order, isOpsUser) ? (
                            <div className="flex flex-wrap gap-2">
                              {order.status === "MARKET_PENDING" && (
                                <Button size="sm" onClick={() => marketActionM.mutate({ orderId: order.id, action: "market-accept" })} disabled={marketActionM.isPending}>
                                  {t("orders.accept")}
                                </Button>
                              )}
                              {order.status === "MARKET_ACCEPTED" && (
                                <Button size="sm" onClick={() => marketActionM.mutate({ orderId: order.id, action: "mark-ready" })} disabled={marketActionM.isPending}>
                                  {t("orders.markReady")}
                                </Button>
                              )}
                              {order.status === "READY_FOR_PICKUP" && <span className="data-pill">{t("orders.waitingForDriver")}</span>}
                              {["OFFERED", "ASSIGNED", "PICKED_UP", "DELIVERED"].includes(order.status) && (
                                <span className="data-pill">{t("orders.inDeliveryFlow")}</span>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-slate-500">-</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                    {filteredOrders.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={8} className="py-8 text-center text-sm text-slate-400">
                          {t("orders.noResults")}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              <div className="mobile-stack-table">
                {filteredOrders.map((order) => (
                  <div key={order.id} className="mobile-record">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="section-kicker">{order.market?.code || t("orders.title")}</div>
                        <div className="font-display theme-ink mt-2 text-3xl font-semibold tracking-[-0.04em]">{order.code}</div>
                      </div>
                      <span className={`status-chip ${statusBadgeClass(getStatusLabel(order.status))}`}>{getStatusLabel(order.status)}</span>
                    </div>

                    <div className="mobile-record-row">
                      <div className="mobile-record-label">{t("common.customer")}</div>
                      <div className="theme-copy max-w-[65%] text-right text-sm">{order.customer_name || order.customer?.name || t("common.unknown")}</div>
                    </div>
                    <div className="mobile-record-row">
                      <div className="mobile-record-label">{t("common.market")}</div>
                      <div className="theme-copy max-w-[65%] text-right text-sm">{order.market?.name || t("orders.directOrder")}</div>
                    </div>
                    <div className="mobile-record-row">
                      <div className="mobile-record-label">{t("common.driver")}</div>
                      <div className="theme-copy max-w-[65%] text-right text-sm">
                        {order.assigned_driver?.user?.name || order.offered_driver?.user?.name || t("common.unassigned")}
                      </div>
                    </div>
                    <div className="mobile-record-row">
                      <div className="mobile-record-label">{t("common.created")}</div>
                      <div className="theme-copy max-w-[65%] text-right text-sm">{formatDateTime(order.created_at)}</div>
                    </div>
                    <div className="mobile-record-row">
                      <div className="mobile-record-label">{t("common.total")}</div>
                      <div className="theme-copy max-w-[65%] text-right text-sm">{order.total != null ? formatMoney(order.total) : "-"}</div>
                    </div>

                    {canManageMarketOrder(order, isOpsUser) ? (
                      <div className="flex flex-wrap gap-2">
                        {order.status === "MARKET_PENDING" && (
                          <Button size="sm" onClick={() => marketActionM.mutate({ orderId: order.id, action: "market-accept" })} disabled={marketActionM.isPending}>
                            {t("orders.accept")}
                          </Button>
                        )}
                        {order.status === "MARKET_ACCEPTED" && (
                          <Button size="sm" onClick={() => marketActionM.mutate({ orderId: order.id, action: "mark-ready" })} disabled={marketActionM.isPending}>
                            {t("orders.markReady")}
                          </Button>
                        )}
                        {order.status === "READY_FOR_PICKUP" && <span className="data-pill">{t("orders.waitingForDriver")}</span>}
                        {["OFFERED", "ASSIGNED", "PICKED_UP", "DELIVERED"].includes(order.status) && <span className="data-pill">{t("orders.inDeliveryFlow")}</span>}
                      </div>
                    ) : null}
                  </div>
                ))}
                {filteredOrders.length === 0 && <div className="mobile-record theme-muted text-sm">{t("orders.noResults")}</div>}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
