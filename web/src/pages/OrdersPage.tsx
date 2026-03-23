import { useMemo, useState } from "react";
import { PackagePlus, Search } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AxiosError } from "axios";
import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import "leaflet/dist/leaflet.css";

import { api } from "@/lib/api";
import { formatDateTime, formatMoney, formatOrderStatus, getOrderStatusTone } from "@/lib/format";
import { useMe } from "@/lib/useMe";
import type { Order, Paginated } from "@/types/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

function statusBadgeClass(status: string) {
  switch (getOrderStatusTone(status)) {
    case "success":
      return "bg-emerald-50 text-emerald-700";
    case "warning":
      return "bg-amber-50 text-amber-800";
    case "danger":
      return "bg-red-50 text-red-700";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

function getErrorMessage(error: unknown) {
  if (!error || typeof error !== "object") {
    return null;
  }

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

export default function OrdersPage() {
  const meQ = useMe();
  const queryClient = useQueryClient();
  const [dropoffAddress, setDropoffAddress] = useState("Tbilisi Center");
  const [dropoffLat, setDropoffLat] = useState("41.7151");
  const [dropoffLng, setDropoffLng] = useState("44.8271");
  const [search, setSearch] = useState("");

  const roles = meQ.data?.roles ?? [];
  const isCustomerOnly = roles.includes("customer") && !roles.some((role: string) => ["admin", "owner", "staff", "driver"].includes(role));
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

    return orders.filter((order) => {
      const haystack = [
        order.code,
        order.dropoff_address ?? "",
        order.status,
        order.customer_name ?? "",
        order.market?.name ?? "",
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(text);
    });
  }, [ordersQ.data?.data, search]);

  if (isCustomerOnly) {
    return (
      <div className="grid gap-6">
        <div className="rounded-[30px] bg-[linear-gradient(135deg,_rgba(249,115,22,0.14),_rgba(255,255,255,0.96)),linear-gradient(180deg,_#fffefd_0%,_#fff7f2_100%)] p-6">
          <div className="text-xs uppercase tracking-[0.24em] text-slate-500">My orders</div>
          <h1 className="font-display mt-2 text-4xl font-semibold tracking-tight text-slate-950">
            Track everything you ordered
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            Review your market orders, current delivery status, item list, and live driver tracking after pickup.
          </p>
        </div>

        {ordersQ.isLoading ? (
          <Card className="rounded-[30px]">
            <CardContent className="p-8 text-sm text-slate-600">Loading your orders...</CardContent>
          </Card>
        ) : ordersQ.isError ? (
          <Card className="rounded-[30px]">
            <CardContent className="p-8 text-sm text-red-700">Failed to load your orders.</CardContent>
          </Card>
        ) : filteredOrders.length === 0 ? (
          <Card className="rounded-[30px]">
            <CardContent className="p-8 text-sm text-slate-600">You have not placed any orders yet.</CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {filteredOrders.map((order) => (
              <Card key={order.id} className="rounded-[30px]">
                <CardContent className="grid gap-4 p-6">
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="text-xs uppercase tracking-[0.24em] text-slate-500">{order.market?.code || "Order"}</div>
                      <div className="font-display mt-2 text-3xl font-semibold text-slate-950">{order.code}</div>
                      <div className="mt-2 text-sm text-slate-600">{order.dropoff_address || "No delivery address"}</div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusBadgeClass(getStatusLabel(order.status))}`}>
                        {getStatusLabel(order.status)}
                      </span>
                      {order.total != null && <Badge className="rounded-full">{formatMoney(order.total)}</Badge>}
                    </div>
                  </div>

                  <div className="grid gap-2 text-sm text-slate-600">
                    <div>Placed: {formatDateTime(order.created_at)}</div>
                    <div>Market: {order.market?.name || "Unknown market"}</div>
                    <div>Pickup: {order.pickup_address || order.market?.address || "Market pickup point"}</div>
                    <div>Driver: {order.assigned_driver?.user?.name || order.offered_driver?.user?.name || "Waiting for assignment"}</div>
                    {order.items?.length ? (
                      <div>Items: {order.items.map((item) => `${item.name} x${item.qty}`).join(", ")}</div>
                    ) : null}
                  </div>

                  {canShowCustomerTracking(order) ? (
                    <div className="grid gap-3 rounded-[24px] border border-emerald-200 bg-emerald-50/60 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-emerald-950">Live driver tracking</div>
                          <div className="text-xs text-emerald-800">
                            Showing live location because the driver already picked up your order.
                          </div>
                        </div>
                        <Badge className="rounded-full bg-emerald-600 text-white hover:bg-emerald-600">
                          Live
                        </Badge>
                      </div>

                      <div className="h-[280px] overflow-hidden rounded-[20px]">
                        <MapContainer
                          center={[Number(order.assigned_driver?.latest_ping?.lat), Number(order.assigned_driver?.latest_ping?.lng)]}
                          zoom={13}
                          style={{ height: "100%", width: "100%" }}
                        >
                          <TileLayer
                            attribution="&copy; OpenStreetMap"
                            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                          />
                          <Marker
                            position={[Number(order.assigned_driver?.latest_ping?.lat), Number(order.assigned_driver?.latest_ping?.lng)]}
                          >
                            <Popup>
                              <div className="text-sm">
                                <div className="font-semibold">{order.assigned_driver?.user?.name || "Driver"}</div>
                                <div>
                                  Updated{" "}
                                  {formatDateTime(
                                    order.assigned_driver?.latest_ping?.updated_at ||
                                      order.assigned_driver?.latest_ping?.created_at,
                                  )}
                                </div>
                              </div>
                            </Popup>
                          </Marker>
                          <Marker position={[Number(order.dropoff_lat), Number(order.dropoff_lng)]}>
                            <Popup>
                              <div className="text-sm">
                                <div className="font-semibold">Delivery address</div>
                                <div>{order.dropoff_address || "Customer destination"}</div>
                              </div>
                            </Popup>
                          </Marker>
                        </MapContainer>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                      Live map will appear only after the driver picks up your order from the market.
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    );
  }

  const createError = getErrorMessage(createOrderM.error);
  const marketActionError = getErrorMessage(marketActionM.error);

  return (
    <div className="grid gap-6">
      <div className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
        {isOpsUser && (
          <Card className="rounded-[30px] bg-[linear-gradient(135deg,_rgba(251,191,36,0.16),_rgba(255,255,255,0.96)),linear-gradient(180deg,_#fffefc_0%,_#fff7eb_100%)]">
            <CardHeader>
              <CardTitle className="font-display text-3xl">Create ops order</CardTitle>
              <p className="text-sm text-slate-600">
                Quick manual creation for dispatch or call-center use.
              </p>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid gap-2">
                <Label>Dropoff address</Label>
                <Input value={dropoffAddress} onChange={(event) => setDropoffAddress(event.target.value)} className="h-11 rounded-2xl" />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label>Latitude</Label>
                  <Input value={dropoffLat} onChange={(event) => setDropoffLat(event.target.value)} className="h-11 rounded-2xl" />
                </div>
                <div className="grid gap-2">
                  <Label>Longitude</Label>
                  <Input value={dropoffLng} onChange={(event) => setDropoffLng(event.target.value)} className="h-11 rounded-2xl" />
                </div>
              </div>

              {createError && <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{createError}</div>}
              {marketActionError && <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{marketActionError}</div>}

              <Button className="h-12 rounded-2xl" onClick={() => createOrderM.mutate()} disabled={createOrderM.isPending}>
                <PackagePlus className="mr-2 h-4 w-4" />
                {createOrderM.isPending ? "Creating..." : "Create order"}
              </Button>
            </CardContent>
          </Card>
        )}

        <Card className="rounded-[30px]">
          <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle className="font-display text-3xl">
                {isOpsUser ? "Operations order board" : "Orders"}
              </CardTitle>
              <p className="mt-1 text-sm text-slate-600">
                Search by code, customer, market, or status.
              </p>
            </div>
            <div className="relative w-full md:max-w-xs">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search orders"
                className="h-11 rounded-2xl pl-11"
              />
            </div>
          </CardHeader>
          <CardContent>
            {ordersQ.isLoading ? (
              <div className="text-sm text-slate-600">Loading orders...</div>
            ) : ordersQ.isError ? (
              <div className="text-sm text-red-700">Failed to load orders.</div>
            ) : (
              <div className="overflow-hidden rounded-[24px] border border-slate-200/80">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Code</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Market</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Driver</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredOrders.map((order) => (
                      <TableRow key={order.id}>
                        <TableCell className="font-semibold text-slate-950">{order.code}</TableCell>
                        <TableCell>
                          <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusBadgeClass(getStatusLabel(order.status))}`}>
                            {getStatusLabel(order.status)}
                          </span>
                        </TableCell>
                        <TableCell>{order.market?.name || "Direct order"}</TableCell>
                        <TableCell>{order.customer_name || order.customer?.name || "Unknown"}</TableCell>
                        <TableCell>
                          {order.assigned_driver?.user?.name || order.offered_driver?.user?.name || "Unassigned"}
                        </TableCell>
                        <TableCell>{order.total != null ? formatMoney(order.total) : "-"}</TableCell>
                        <TableCell>{formatDateTime(order.created_at)}</TableCell>
                        <TableCell>
                          {canManageMarketOrder(order, isOpsUser) ? (
                            <div className="flex flex-wrap gap-2">
                              {order.status === "MARKET_PENDING" && (
                                <Button
                                  size="sm"
                                  className="rounded-xl"
                                  onClick={() => marketActionM.mutate({ orderId: order.id, action: "market-accept" })}
                                  disabled={marketActionM.isPending}
                                >
                                  Accept
                                </Button>
                              )}
                              {order.status === "MARKET_ACCEPTED" && (
                                <Button
                                  size="sm"
                                  className="rounded-xl"
                                  onClick={() => marketActionM.mutate({ orderId: order.id, action: "mark-ready" })}
                                  disabled={marketActionM.isPending}
                                >
                                  Mark ready
                                </Button>
                              )}
                              {order.status === "READY_FOR_PICKUP" && (
                                <span className="text-xs font-medium text-emerald-700">Waiting for driver</span>
                              )}
                              {["OFFERED", "ASSIGNED", "PICKED_UP", "DELIVERED"].includes(order.status) && (
                                <span className="text-xs font-medium text-slate-500">In delivery flow</span>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400">-</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                    {filteredOrders.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={8} className="py-8 text-center text-sm text-slate-500">
                          No orders matched your search.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
