import { useMemo, useState } from "react";
import { PackagePlus, Search } from "lucide-react";
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
import { useMe } from "@/lib/useMe";
import type { Order, Paginated } from "@/types/api";

function statusBadgeClass(status: string) {
  switch (getOrderStatusTone(status)) {
    case "success":
      return "bg-[#dff3e8] text-emerald-900";
    case "warning":
      return "bg-[#fff0c7] text-amber-950";
    case "danger":
      return "bg-[#f9ddd8] text-red-900";
    default:
      return "bg-[#efe6d6] text-slate-700";
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

export default function OrdersPage() {
  const meQ = useMe();
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

  if (isCustomerOnly) {
    return (
      <div className="grid gap-6">
        <section className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="dashboard-card">
            <div className="command-chip">Customer order desk</div>
            <h1 className="section-title mt-5">Everything you ordered, organized like a timeline instead of a ticket pile.</h1>
            <p className="section-copy mt-4">
              The customer view now leans into order clarity: status, market, items, and live driver tracking only when it becomes useful.
            </p>
          </div>
          <div className="metric-dark">
            <div className="section-kicker text-slate-300">Orders visible</div>
            <div className="mt-3 font-display text-7xl font-semibold tracking-[-0.06em]">{filteredOrders.length}</div>
            <div className="mt-4 text-sm leading-7 text-slate-300">This board refreshes automatically while you watch delivery progress.</div>
          </div>
        </section>

        {ordersQ.isLoading ? (
          <Card>
            <CardContent className="p-8 text-sm text-slate-600">Loading your orders...</CardContent>
          </Card>
        ) : ordersQ.isError ? (
          <Card>
            <CardContent className="p-8 text-sm text-red-700">Failed to load your orders.</CardContent>
          </Card>
        ) : filteredOrders.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-sm text-slate-600">You have not placed any orders yet.</CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {filteredOrders.map((order) => (
              <Card key={order.id} className="bg-[#fffaf0]">
                <CardContent className="grid gap-5 p-6">
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="section-kicker">{order.market?.code || "Order"}</div>
                      <div className="font-display mt-2 text-4xl font-semibold tracking-[-0.05em] text-slate-950">{order.code}</div>
                      <div className="mt-2 text-sm text-slate-600">{order.dropoff_address || "No delivery address"}</div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <span className={`status-chip ${statusBadgeClass(getStatusLabel(order.status))}`}>{getStatusLabel(order.status)}</span>
                      {order.total != null && <Badge className="status-chip bg-white text-slate-950">{formatMoney(order.total)}</Badge>}
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <div className="metric-block py-4">
                      <div className="section-kicker">Placed</div>
                      <div className="mt-2 text-sm font-semibold text-slate-950">{formatDateTime(order.created_at)}</div>
                    </div>
                    <div className="metric-block py-4">
                      <div className="section-kicker">Market</div>
                      <div className="mt-2 text-sm font-semibold text-slate-950">{order.market?.name || "Unknown market"}</div>
                    </div>
                    <div className="metric-block py-4">
                      <div className="section-kicker">Pickup</div>
                      <div className="mt-2 text-sm font-semibold text-slate-950">{order.pickup_address || order.market?.address || "Market pickup point"}</div>
                    </div>
                    <div className="metric-block py-4">
                      <div className="section-kicker">Driver</div>
                      <div className="mt-2 text-sm font-semibold text-slate-950">{order.assigned_driver?.user?.name || order.offered_driver?.user?.name || "Waiting for assignment"}</div>
                    </div>
                  </div>

                  {order.items?.length ? (
                    <div className="rounded-[22px] border-2 border-slate-950 bg-[#efe6d6] p-4 text-sm text-slate-700">
                      <span className="font-semibold text-slate-950">Items:</span> {order.items.map((item) => `${item.name} x${item.qty}`).join(", ")}
                    </div>
                  ) : null}

                  {canShowCustomerTracking(order) ? (
                    <div className="grid gap-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="font-semibold text-slate-950">Live driver tracking</div>
                          <div className="text-sm text-slate-600">This appears once the driver has picked up your order.</div>
                        </div>
                        <div className="status-chip bg-[#dff3e8] text-emerald-900">Live</div>
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
                                <div className="font-semibold">{order.assigned_driver?.user?.name || "Driver"}</div>
                                <div>
                                  Updated{" "}
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
                                <div className="font-semibold">Delivery address</div>
                                <div>{order.dropoff_address || "Customer destination"}</div>
                              </div>
                            </Popup>
                          </Marker>
                        </MapContainer>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-[22px] border-2 border-slate-950 bg-white p-4 text-sm text-slate-600">
                      Live map appears after pickup so the tracking view stays useful instead of noisy.
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
      <section className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
        {isOpsUser && (
          <Card className="bg-[#efe6d6]">
            <CardHeader>
              <CardTitle className="font-display text-4xl font-semibold tracking-[-0.05em]">Create ops order</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <p className="section-copy">Manual creation for dispatch or call-center use, now surfaced as a dedicated command block.</p>

              <div className="grid gap-2">
                <Label>Dropoff address</Label>
                <Input value={dropoffAddress} onChange={(event) => setDropoffAddress(event.target.value)} className="h-12" />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label>Latitude</Label>
                  <Input value={dropoffLat} onChange={(event) => setDropoffLat(event.target.value)} className="h-12" />
                </div>
                <div className="grid gap-2">
                  <Label>Longitude</Label>
                  <Input value={dropoffLng} onChange={(event) => setDropoffLng(event.target.value)} className="h-12" />
                </div>
              </div>

              {createError && <div className="rounded-[18px] border-2 border-red-700 bg-red-50 px-4 py-3 text-sm text-red-700">{createError}</div>}
              {marketActionError && <div className="rounded-[18px] border-2 border-red-700 bg-red-50 px-4 py-3 text-sm text-red-700">{marketActionError}</div>}

              <Button className="h-12" onClick={() => createOrderM.mutate()} disabled={createOrderM.isPending}>
                <PackagePlus className="h-4 w-4" />
                {createOrderM.isPending ? "Creating..." : "Create order"}
              </Button>
            </CardContent>
          </Card>
        )}

        <div className="dashboard-card">
          <div className="command-chip">Orders board</div>
          <h1 className="section-title mt-5">{isOpsUser ? "A dispatch table with faster visual triage." : "Orders"}</h1>
          <p className="section-copy mt-4">Search by code, customer, market, or status. The structure is flatter and denser so teams can scan actionability faster.</p>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <div className="metric-block py-4">
              <div className="section-kicker">Visible orders</div>
              <div className="mt-2 font-display text-4xl font-semibold tracking-[-0.05em]">{filteredOrders.length}</div>
            </div>
            <div className="metric-block py-4">
              <div className="section-kicker">Board mode</div>
              <div className="mt-2 text-sm font-semibold text-slate-950">{isOpsUser ? "Operations" : "Customer"}</div>
            </div>
            <div className="metric-block py-4">
              <div className="section-kicker">Search state</div>
              <div className="mt-2 text-sm font-semibold text-slate-950">{search ? "Filtered" : "All visible"}</div>
            </div>
          </div>
        </div>
      </section>

      <Card>
        <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle className="font-display text-4xl font-semibold tracking-[-0.05em]">Operations order table</CardTitle>
            <p className="mt-2 text-sm leading-7 text-slate-600">Compact actions, strong status labels, and lower visual noise.</p>
          </div>
          <div className="relative w-full md:max-w-sm">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search orders" className="h-12 pl-11" />
          </div>
        </CardHeader>
        <CardContent>
          {ordersQ.isLoading ? (
            <div className="text-sm text-slate-600">Loading orders...</div>
          ) : ordersQ.isError ? (
            <div className="text-sm text-red-700">Failed to load orders.</div>
          ) : (
            <div className="overflow-hidden rounded-[22px] border-2 border-slate-950">
              <Table>
                <TableHeader>
                  <TableRow className="bg-[#efe6d6]">
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
                    <TableRow key={order.id} className="bg-white">
                      <TableCell className="font-semibold text-slate-950">{order.code}</TableCell>
                      <TableCell>
                        <span className={`status-chip ${statusBadgeClass(getStatusLabel(order.status))}`}>{getStatusLabel(order.status)}</span>
                      </TableCell>
                      <TableCell>{order.market?.name || "Direct order"}</TableCell>
                      <TableCell>{order.customer_name || order.customer?.name || "Unknown"}</TableCell>
                      <TableCell>{order.assigned_driver?.user?.name || order.offered_driver?.user?.name || "Unassigned"}</TableCell>
                      <TableCell>{order.total != null ? formatMoney(order.total) : "-"}</TableCell>
                      <TableCell>{formatDateTime(order.created_at)}</TableCell>
                      <TableCell>
                        {canManageMarketOrder(order, isOpsUser) ? (
                          <div className="flex flex-wrap gap-2">
                            {order.status === "MARKET_PENDING" && (
                              <Button size="sm" onClick={() => marketActionM.mutate({ orderId: order.id, action: "market-accept" })} disabled={marketActionM.isPending}>
                                Accept
                              </Button>
                            )}
                            {order.status === "MARKET_ACCEPTED" && (
                              <Button size="sm" onClick={() => marketActionM.mutate({ orderId: order.id, action: "mark-ready" })} disabled={marketActionM.isPending}>
                                Mark ready
                              </Button>
                            )}
                            {order.status === "READY_FOR_PICKUP" && <span className="text-xs font-semibold text-emerald-800">Waiting for driver</span>}
                            {["OFFERED", "ASSIGNED", "PICKED_UP", "DELIVERED"].includes(order.status) && (
                              <span className="text-xs font-semibold text-slate-500">In delivery flow</span>
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
  );
}
