import { useMemo, useState } from "react";
import {
  Clock3,
  MapPin,
  MessageSquareMore,
  PackagePlus,
  Search,
  Star,
  Truck,
  Undo2,
  UserRound,
  Wallet,
  XCircle,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AxiosError } from "axios";
import { MapContainer, Marker, TileLayer } from "react-leaflet";
import "leaflet/dist/leaflet.css";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

export default function OrdersPage() {
  const meQ = useMe();
  const queryClient = useQueryClient();

  const [dropoffAddress, setDropoffAddress] = useState("Tbilisi Center");
  const [dropoffLat, setDropoffLat] = useState("41.7151");
  const [dropoffLng, setDropoffLng] = useState("44.8271");
  const [search, setSearch] = useState("");
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [rating, setRating] = useState("5");
  const [feedback, setFeedback] = useState("");
  const [refundReason, setRefundReason] = useState("");

  const roles = meQ.data?.roles ?? [];
  const isCustomerOnly =
    roles.includes("customer") &&
    !roles.some((role: string) => ["admin", "owner", "staff", "driver"].includes(role));
  const isOpsUser = roles.some((role: string) => ["admin", "owner", "staff"].includes(role));

  const ordersQ = useQuery({
    queryKey: ["orders"],
    queryFn: async () => (await api.get("/api/orders")).data as Paginated<Order>,
    refetchInterval: isCustomerOnly ? 8000 : false,
  });

  const detailQ = useQuery({
    queryKey: ["order-detail", selectedOrderId],
    queryFn: async () => (await api.get(`/api/orders/${selectedOrderId}`)).data as Order,
    enabled: selectedOrderId != null,
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
      await queryClient.invalidateQueries({ queryKey: ["order-detail"] });
    },
  });

  const cancelM = useMutation({
    mutationFn: async (orderId: number) =>
      (await api.post(`/api/orders/${orderId}/request-cancel`, { reason: cancelReason || null })).data,
    onSuccess: async () => {
      setCancelReason("");
      await queryClient.invalidateQueries({ queryKey: ["orders"] });
      await queryClient.invalidateQueries({ queryKey: ["order-detail"] });
    },
  });

  const reorderM = useMutation({
    mutationFn: async (orderId: number) => (await api.post(`/api/orders/${orderId}/reorder`)).data,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
  });

  const refundM = useMutation({
    mutationFn: async (orderId: number) =>
      (await api.post(`/api/orders/${orderId}/request-refund`, { reason: refundReason || "Requested by customer" }))
        .data,
    onSuccess: async () => {
      setRefundReason("");
      await queryClient.invalidateQueries({ queryKey: ["orders"] });
      await queryClient.invalidateQueries({ queryKey: ["order-detail"] });
    },
  });

  const rateM = useMutation({
    mutationFn: async (orderId: number) =>
      (await api.post(`/api/orders/${orderId}/rate`, { rating: Number(rating), feedback: feedback || null })).data,
    onSuccess: async () => {
      setRating("5");
      setFeedback("");
      await queryClient.invalidateQueries({ queryKey: ["orders"] });
      await queryClient.invalidateQueries({ queryKey: ["order-detail"] });
    },
  });

  const filteredOrders = useMemo(() => {
    const orders = ordersQ.data?.data ?? [];
    const query = search.trim().toLowerCase();
    if (!query) return orders;

    return orders.filter((order) =>
      [order.code, order.dropoff_address ?? "", order.status, order.customer_name ?? "", order.market?.name ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [ordersQ.data?.data, search]);

  const deliveredCount = filteredOrders.filter((order) => order.status === "DELIVERED").length;
  const marketPendingCount = filteredOrders.filter((order) => order.status === "MARKET_PENDING").length;
  const driverFlowCount = filteredOrders.filter((order) =>
    ["READY_FOR_PICKUP", "OFFERED", "ASSIGNED", "PICKED_UP"].includes(order.status),
  ).length;

  const detailOrder = detailQ.data;

  const errorMessage =
    getErrorMessage(createOrderM.error) ||
    getErrorMessage(marketActionM.error) ||
    getErrorMessage(cancelM.error) ||
    getErrorMessage(reorderM.error) ||
    getErrorMessage(rateM.error) ||
    getErrorMessage(refundM.error);

  return (
    <div className="grid gap-6">
      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_420px]">
        <div className="relative overflow-hidden rounded-[34px] border border-slate-200/70 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6 shadow-[0_25px_80px_rgba(0,0,0,0.22)] dark:border-slate-800">
          <div className="absolute -left-16 top-0 h-40 w-40 rounded-full bg-cyan-400/10 blur-3xl" />
          <div className="absolute -right-16 bottom-0 h-40 w-40 rounded-full bg-sky-500/10 blur-3xl" />

          <div className="relative">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-white/80">
              Orders workspace
            </div>

            <h1 className="mt-5 text-5xl font-semibold tracking-[-0.06em] text-white md:text-6xl">
              Orders
            </h1>

            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/70">
              Manage intake, delivery flow, proof of delivery, and customer follow-up in one clean workspace.
            </p>

            <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <Metric
                title="Visible orders"
                value={filteredOrders.length}
                helper={isCustomerOnly ? "Timeline" : "Search orders"}
              />
              <Metric title="Market pending" value={marketPendingCount} helper="Market" />
              <Metric title="In driver flow" value={driverFlowCount} helper="Driver" />
              <Metric title="Delivered" value={deliveredCount} helper="Delivery proof" />
            </div>
          </div>
        </div>

        <div className="grid gap-4">
          {!isCustomerOnly && isOpsUser && (
            <Card className="rounded-[30px] border border-slate-200/70 bg-white/85 shadow-[0_18px_50px_rgba(15,23,42,0.07)] backdrop-blur-sm dark:border-slate-800 dark:bg-slate-950/90 dark:shadow-[0_18px_50px_rgba(0,0,0,0.34)]">
              <CardHeader>
                <CardTitle className="text-xl font-semibold tracking-[-0.04em] text-slate-950 dark:text-white">
                  Create ops order
                </CardTitle>
                <p className="text-sm text-slate-500 dark:text-slate-300">
                  Manual order intake for call center or dispatch scenarios.
                </p>
              </CardHeader>

              <CardContent className="grid gap-4">
                <div className="grid gap-2">
                  <Label className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                    Address
                  </Label>
                  <Input
                    value={dropoffAddress}
                    onChange={(event) => setDropoffAddress(event.target.value)}
                    className="h-12 rounded-[18px] border-slate-200 bg-white text-slate-950 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                      Latitude
                    </Label>
                    <Input
                      value={dropoffLat}
                      onChange={(event) => setDropoffLat(event.target.value)}
                      className="h-12 rounded-[18px] border-slate-200 bg-white text-slate-950 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                      Longitude
                    </Label>
                    <Input
                      value={dropoffLng}
                      onChange={(event) => setDropoffLng(event.target.value)}
                      className="h-12 rounded-[18px] border-slate-200 bg-white text-slate-950 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                    />
                  </div>
                </div>

                <Button className="h-12 rounded-[18px]" onClick={() => createOrderM.mutate()} disabled={createOrderM.isPending}>
                  <PackagePlus className="h-4 w-4" />
                  {createOrderM.isPending ? "Creating..." : "Create order"}
                </Button>
              </CardContent>
            </Card>
          )}

          <div className="rounded-[30px] border border-slate-200/70 bg-white/85 p-5 shadow-[0_16px_40px_rgba(15,23,42,0.05)] backdrop-blur-sm dark:border-slate-800 dark:bg-slate-950/90 dark:shadow-[0_16px_40px_rgba(0,0,0,0.34)]">
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500">
              Search orders
            </div>

            <div className="relative mt-3">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search orders"
                className="h-12 rounded-[18px] border-slate-200 bg-white pl-11 text-slate-950 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              />
            </div>

            {errorMessage && (
              <div className="mt-4 rounded-[18px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-300/20 dark:bg-rose-300/10 dark:text-rose-100">
                {errorMessage}
              </div>
            )}
          </div>
        </div>
      </section>

      {ordersQ.isLoading ? (
        <Card className="rounded-[30px] border border-slate-200/70 bg-white/85 dark:border-slate-800 dark:bg-slate-950/90">
          <CardContent className="p-8 text-sm text-slate-600 dark:text-slate-300">
            Loading orders...
          </CardContent>
        </Card>
      ) : ordersQ.isError ? (
        <Card className="rounded-[30px] border border-slate-200/70 bg-white/85 dark:border-slate-800 dark:bg-slate-950/90">
          <CardContent className="p-8 text-sm text-rose-700 dark:text-rose-200">
            Failed to load orders.
          </CardContent>
        </Card>
      ) : filteredOrders.length === 0 ? (
        <Card className="rounded-[30px] border border-slate-200/70 bg-white/85 dark:border-slate-800 dark:bg-slate-950/90">
          <CardContent className="p-8 text-sm text-slate-600 dark:text-slate-300">
            {isCustomerOnly ? "You have not placed any orders yet." : "No orders matched your search."}
          </CardContent>
        </Card>
      ) : isCustomerOnly ? (
        <div className="grid gap-5">
          {filteredOrders.map((order) => (
            <CustomerOrderCard
              key={order.id}
              order={order}
              onOpenDetail={() => setSelectedOrderId(order.id)}
              onCancel={() => cancelM.mutate(order.id)}
              onReorder={() => reorderM.mutate(order.id)}
            />
          ))}
        </div>
      ) : (
        <Card className="rounded-[30px] border border-slate-200/70 bg-white/85 shadow-[0_18px_50px_rgba(15,23,42,0.07)] backdrop-blur-sm dark:border-slate-800 dark:bg-slate-950/90 dark:shadow-[0_18px_50px_rgba(0,0,0,0.34)]">
          <CardHeader className="border-b border-slate-200/80 dark:border-slate-800">
            <CardTitle className="text-xl font-semibold tracking-[-0.04em] text-slate-950 dark:text-white">
              Operations orders
            </CardTitle>
            <p className="text-sm text-slate-500 dark:text-slate-300">
              Readable intake, review, and next-step actions in one place.
            </p>
          </CardHeader>

          <CardContent className="grid gap-5 pt-6">
            <div className="mobile-stack-table gap-5">
              {filteredOrders.map((order) => (
                <Card
                  key={order.id}
                  className="mobile-record rounded-[28px] border-slate-200/80 bg-white/96 py-0 shadow-[0_16px_38px_rgba(15,23,42,0.06)] dark:border-slate-800 dark:bg-slate-900/90"
                >
                  <CardContent className="grid gap-4 p-5">
                    <div className="flex flex-col gap-3">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500">
                            {order.market?.code || "ORD"}
                          </div>
                          <div className="mt-2 text-xl font-semibold text-slate-950 dark:text-white">
                            {order.code}
                          </div>
                          <div className="mt-1 text-sm text-slate-500 dark:text-slate-300">
                            {order.dropoff_address || "No address set"}
                          </div>
                        </div>

                        <span className={`status-chip ${statusBadgeClass(order.status)}`}>
                          {formatOrderStatus(order.status)}
                        </span>
                      </div>

                      <div className="mobile-record-row">
                        <span className="mobile-record-label">Market</span>
                        <span className="text-right text-slate-700 dark:text-slate-200">
                          {order.market?.name || "Direct order"}
                        </span>
                      </div>

                      <div className="mobile-record-row">
                        <span className="mobile-record-label">Customer</span>
                        <span className="text-right text-slate-700 dark:text-slate-200">
                          {order.customer_name || order.customer?.name || "Unknown"}
                        </span>
                      </div>

                      <div className="mobile-record-row">
                        <span className="mobile-record-label">Driver</span>
                        <span className="text-right text-slate-700 dark:text-slate-200">
                          {order.assigned_driver?.user?.name || order.offered_driver?.user?.name || "Unassigned"}
                        </span>
                      </div>

                      <div className="mobile-record-row">
                        <span className="mobile-record-label">Total</span>
                        <span className="text-right text-slate-700 dark:text-slate-200">
                          {order.total != null ? formatMoney(order.total) : "-"}
                        </span>
                      </div>

                      <div className="mobile-record-row">
                        <span className="mobile-record-label">ETA</span>
                        <span className="text-right text-slate-700 dark:text-slate-200">
                          {formatDateTime(order.eta_summary?.estimated_delivery_at)}
                        </span>
                      </div>
                    </div>

                    <OrderActionRow
                      order={order}
                      detailLabel="Open detail"
                      onOpenDetail={() => setSelectedOrderId(order.id)}
                      onAccept={() => marketActionM.mutate({ orderId: order.id, action: "market-accept" })}
                      onMarkReady={() => marketActionM.mutate({ orderId: order.id, action: "mark-ready" })}
                    />
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="table-desktop overflow-hidden rounded-[24px] border border-slate-200/80 dark:border-slate-800">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/80 dark:bg-slate-900/80">
                    <TableHead>Code</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Market</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Driver</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>ETA</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {filteredOrders.map((order) => (
                    <TableRow key={order.id} className="dark:border-slate-800">
                      <TableCell className="font-semibold text-slate-950 dark:text-white">{order.code}</TableCell>
                      <TableCell>
                        <span className={`status-chip ${statusBadgeClass(order.status)}`}>
                          {formatOrderStatus(order.status)}
                        </span>
                      </TableCell>
                      <TableCell>{order.market?.name || "Direct order"}</TableCell>
                      <TableCell>{order.customer_name || order.customer?.name || "Unknown"}</TableCell>
                      <TableCell>
                        {order.assigned_driver?.user?.name || order.offered_driver?.user?.name || "Unassigned"}
                      </TableCell>
                      <TableCell>{order.total != null ? formatMoney(order.total) : "-"}</TableCell>
                      <TableCell>{formatDateTime(order.eta_summary?.estimated_delivery_at)}</TableCell>
                      <TableCell>
                        <OrderActionRow
                          order={order}
                          detailLabel="Open detail"
                          onOpenDetail={() => setSelectedOrderId(order.id)}
                          onAccept={() => marketActionM.mutate({ orderId: order.id, action: "market-accept" })}
                          onMarkReady={() => marketActionM.mutate({ orderId: order.id, action: "mark-ready" })}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={selectedOrderId != null} onOpenChange={(open) => !open && setSelectedOrderId(null)}>
        <DialogContent className="max-h-[92vh] overflow-hidden rounded-[30px] border border-slate-200/70 bg-white p-0 shadow-[0_25px_80px_rgba(15,23,42,0.12)] dark:border-slate-800 dark:bg-[#0b1220] dark:shadow-[0_25px_80px_rgba(0,0,0,0.45)]">
          <DialogHeader className="border-b border-slate-200/80 px-6 py-5 dark:border-slate-800">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500">
                  {detailOrder?.market?.code || "ORD"}
                </div>

                <DialogTitle className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-slate-950 dark:text-white">
                  {detailOrder?.code || "Order detail"}
                </DialogTitle>

                <DialogDescription className="mt-2 pr-10 text-sm leading-6 text-slate-500 dark:text-slate-300">
                  {detailOrder?.dropoff_address || "No address set"}
                </DialogDescription>
              </div>

              {detailOrder ? (
                <div className="flex flex-wrap gap-2">
                  <Badge className={`status-chip ${statusBadgeClass(detailOrder.status)}`}>
                    {formatOrderStatus(detailOrder.status)}
                  </Badge>
                  <Badge className="status-chip status-neutral">
                    {detailOrder.total != null ? formatMoney(detailOrder.total) : "-"}
                  </Badge>
                  {detailOrder.eta_summary?.is_late && <Badge className="status-chip status-bad">Late</Badge>}
                </div>
              ) : null}
            </div>
          </DialogHeader>

          <div className="min-h-0 overflow-y-auto overscroll-contain">
            {detailOrder ? (
              <div className="grid min-h-full gap-0 xl:grid-cols-[380px_minmax(0,1fr)]">
                <aside className="border-b border-slate-200 bg-slate-50/80 p-5 xl:border-b-0 xl:border-r dark:border-slate-800 dark:bg-[#101927]">
                  <div className="grid gap-4 xl:sticky xl:top-0">
                    <div className="grid gap-3">
                      <DetailStat
                        icon={Clock3}
                        label="ETA"
                        value={formatDateTime(detailOrder.eta_summary?.estimated_delivery_at)}
                      />
                      <DetailStat
                        icon={Wallet}
                        label="Total"
                        value={detailOrder.total != null ? formatMoney(detailOrder.total) : "-"}
                      />
                      <DetailStat
                        icon={Truck}
                        label="Driver"
                        value={
                          detailOrder.assigned_driver?.user?.name ||
                          detailOrder.offered_driver?.user?.name ||
                          "Waiting for driver"
                        }
                      />
                      <DetailStat
                        icon={UserRound}
                        label="Customer"
                        value={detailOrder.customer_name || detailOrder.customer?.name || "Unknown"}
                      />
                    </div>

                    <div className="rounded-[24px] border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/90">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500">
                        Rate delivery
                      </div>

                      <div className="mt-4 grid gap-4">
                        <div className="grid gap-2">
                          <Label className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                            Rating (1-5)
                          </Label>
                          <Input
                            value={rating}
                            onChange={(event) => setRating(event.target.value)}
                            className="h-11 rounded-[16px] border-slate-200 bg-white text-slate-950 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                          />
                        </div>

                        <div className="grid gap-2">
                          <Label className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                            Feedback
                          </Label>
                          <Input
                            value={feedback}
                            onChange={(event) => setFeedback(event.target.value)}
                            className="h-11 rounded-[16px] border-slate-200 bg-white text-slate-950 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                          />
                        </div>

                        <div className="grid gap-2">
                          <Label className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                            Cancellation reason
                          </Label>
                          <Input
                            value={cancelReason}
                            onChange={(event) => setCancelReason(event.target.value)}
                            className="h-11 rounded-[16px] border-slate-200 bg-white text-slate-950 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                          />
                        </div>

                        <div className="grid gap-2">
                          <Label className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                            Refund reason
                          </Label>
                          <Input
                            value={refundReason}
                            onChange={(event) => setRefundReason(event.target.value)}
                            className="h-11 rounded-[16px] border-slate-200 bg-white text-slate-950 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                          />
                        </div>

                        <div className="grid gap-2">
                          <Button
                            onClick={() => rateM.mutate(detailOrder.id)}
                            disabled={!detailOrder.actions?.can_rate || rateM.isPending}
                          >
                            <Star className="h-4 w-4" />
                            Submit
                          </Button>

                          <Button
                            variant="secondary"
                            onClick={() => reorderM.mutate(detailOrder.id)}
                            disabled={!detailOrder.actions?.can_reorder || reorderM.isPending}
                            className="dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:hover:bg-slate-800"
                          >
                            <Undo2 className="h-4 w-4" />
                            Reorder
                          </Button>

                          <Button
                            variant="secondary"
                            onClick={() => cancelM.mutate(detailOrder.id)}
                            disabled={!detailOrder.actions?.can_cancel || cancelM.isPending}
                            className="dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:hover:bg-slate-800"
                          >
                            <XCircle className="h-4 w-4" />
                            Cancel order
                          </Button>

                          <Button
                            variant="secondary"
                            onClick={() => refundM.mutate(detailOrder.id)}
                            disabled={!detailOrder.actions?.can_request_refund || refundM.isPending}
                            className="dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:hover:bg-slate-800"
                          >
                            Request refund
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </aside>

                <main className="grid gap-5 p-5 sm:p-6">
                  <section className="grid gap-4 lg:grid-cols-2">
                    <FlatDetailRow icon={MapPin} label="Market" value={detailOrder.market?.name || "Direct order"} />
                    <FlatDetailRow icon={Clock3} label="Created" value={formatDateTime(detailOrder.created_at)} />
                    <FlatDetailRow
                      icon={MapPin}
                      label="Dropoff"
                      value={detailOrder.dropoff_address || "No address set"}
                      fullWidth
                    />
                    <FlatDetailRow
                      icon={MapPin}
                      label="Pickup"
                      value={detailOrder.pickup_address || "No address set"}
                      fullWidth
                    />
                    <FlatDetailRow icon={MessageSquareMore} label="Notes" value={detailOrder.notes || "-"} fullWidth />
                  </section>

                  <section className="rounded-[28px] border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950/90">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500">
                          Timeline
                        </div>
                        <h3 className="mt-2 text-2xl font-semibold text-slate-950 dark:text-white">
                          Order progress
                        </h3>
                      </div>

                      <div className="max-w-sm text-right text-sm leading-6 text-slate-500 dark:text-slate-300">
                        Tracking appears after pickup so the timeline stays signal-first.
                      </div>
                    </div>

                    <div className="mt-5 grid gap-3">
                      {(detailOrder.timeline ?? []).map((step, index) => (
                        <div
                          key={step.key}
                          className="grid gap-3 rounded-[20px] border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900 sm:grid-cols-[44px_minmax(0,1fr)_auto] sm:items-center"
                        >
                          <div
                            className={`flex h-11 w-11 items-center justify-center rounded-full text-sm font-semibold ${
                              step.done
                                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-300/12 dark:text-emerald-100"
                                : "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-200"
                            }`}
                          >
                            {index + 1}
                          </div>

                          <div className="min-w-0">
                            <div className="text-base font-semibold text-slate-950 dark:text-white">{step.label}</div>
                            <div className="mt-1 text-sm text-slate-500 dark:text-slate-300">
                              {formatDateTime(step.at)}
                            </div>
                          </div>

                          <Badge className={`status-chip ${step.done ? "status-good" : "status-neutral"}`}>
                            {step.done ? "Done" : "Pending"}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
                    <div className="rounded-[28px] border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950/90">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500">
                        Delivery proof
                      </div>

                      <h3 className="mt-2 text-2xl font-semibold text-slate-950 dark:text-white">
                        Delivery proof
                      </h3>

                      <div className="mt-5 grid gap-4">
                        {detailOrder.delivery_proof?.photo_url ? (
                          <img
                            src={detailOrder.delivery_proof.photo_url}
                            alt="Proof of delivery"
                            className="h-72 w-full rounded-[24px] object-cover"
                          />
                        ) : (
                          <div className="flex min-h-52 items-center justify-center rounded-[24px] border border-dashed border-slate-300 bg-slate-50 px-5 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                            No delivery proof has been attached yet.
                          </div>
                        )}

                        <div className="rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-4 text-sm leading-7 text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">
                          {detailOrder.delivery_proof?.note || "No delivery proof has been attached yet."}
                          {detailOrder.delivery_proof?.signature_name
                            ? ` | Signature: ${detailOrder.delivery_proof.signature_name}`
                            : ""}
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-5">
                      <div className="rounded-[28px] border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950/90">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500">
                          Receipt
                        </div>

                        <div className="mt-2 text-sm text-slate-500 dark:text-slate-300">
                          {detailOrder.receipt?.number || "Pending receipt"}
                        </div>

                        <div className="mt-4 grid gap-2 text-sm text-slate-700 dark:text-slate-200">
                          {(detailOrder.receipt?.items ?? []).map((item, index) => (
                            <div key={`${item.name}-${index}`} className="flex items-start justify-between gap-3">
                              <div>
                                <span>
                                  {item.name} x{item.qty}
                                </span>

                                {item.combo_offer ? (
                                  <div className="text-xs text-slate-500 dark:text-slate-400">
                                    Combo: {item.combo_offer.name}
                                  </div>
                                ) : null}

                                {(item.removed_ingredients ?? []).length > 0 ? (
                                  <div className="text-xs text-slate-500 dark:text-slate-400">
                                    Without: {item.removed_ingredients?.join(", ")}
                                  </div>
                                ) : null}
                              </div>

                              <span>{formatMoney(item.line_total ?? 0)}</span>
                            </div>
                          ))}
                        </div>

                        <div className="mt-4 text-sm font-semibold text-slate-950 dark:text-white">
                          Total: {formatMoney(detailOrder.receipt?.total ?? detailOrder.total ?? 0)}
                        </div>

                        <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                          Refund: {detailOrder.refund_summary?.status || "none"}
                        </div>
                      </div>

                      {detailOrder.assigned_driver?.latest_ping && detailOrder.status === "PICKED_UP" && (
                        <div className="rounded-[28px] border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950/90">
                          <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500">
                            Live driver tracking
                          </div>

                          <div className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-300">
                            Tracking appears after pickup so the timeline stays signal-first.
                          </div>

                          <div className="mt-4 h-[260px] overflow-hidden rounded-[22px] border border-slate-200 dark:border-slate-800">
                            <MapContainer
                              center={[
                                Number(detailOrder.assigned_driver.latest_ping.lat),
                                Number(detailOrder.assigned_driver.latest_ping.lng),
                              ]}
                              zoom={13}
                              style={{ height: "100%", width: "100%" }}
                            >
                              <TileLayer
                                attribution="&copy; OpenStreetMap"
                                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                              />
                              <Marker
                                position={[
                                  Number(detailOrder.assigned_driver.latest_ping.lat),
                                  Number(detailOrder.assigned_driver.latest_ping.lng),
                                ]}
                              />
                              <Marker
                                position={[Number(detailOrder.dropoff_lat), Number(detailOrder.dropoff_lng)]}
                              />
                            </MapContainer>
                          </div>
                        </div>
                      )}

                      {detailOrder.eta_summary?.is_late && (
                        <div className="rounded-[24px] border border-rose-200 bg-rose-50 p-5 dark:border-rose-300/20 dark:bg-rose-300/10">
                          <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-rose-600 dark:text-rose-200">
                            Late
                          </div>
                          <div className="mt-2 text-lg font-semibold text-rose-700 dark:text-rose-100">
                            This order needs attention.
                          </div>
                          <div className="mt-1 text-sm leading-6 text-rose-700/80 dark:text-rose-100/80">
                            ETA has slipped past the expected window.
                          </div>
                        </div>
                      )}
                    </div>
                  </section>
                </main>
              </div>
            ) : (
              <div className="p-6">
                <div className="rounded-[24px] border border-slate-200 bg-white px-6 py-10 text-center text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-950/90 dark:text-slate-300">
                  Loading order detail...
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="border-t border-slate-200/80 px-6 py-4 dark:border-slate-800">
            <Button
              variant="secondary"
              onClick={() => setSelectedOrderId(null)}
              className="dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:hover:bg-slate-800"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CustomerOrderCard({
  order,
  onOpenDetail,
  onCancel,
  onReorder,
}: {
  order: Order;
  onOpenDetail: () => void;
  onCancel: () => void;
  onReorder: () => void;
}) {
  return (
    <Card className="rounded-[30px] border-slate-200/80 bg-white/98 shadow-[0_18px_44px_rgba(15,23,42,0.06)] dark:border-slate-800 dark:bg-slate-950/90">
      <CardContent className="grid gap-5 p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500">
              {order.market?.code || "ORD"}
            </div>
            <div className="mt-2 text-4xl font-semibold tracking-[-0.05em] text-slate-950 dark:text-white">
              {order.code}
            </div>
            <div className="mt-2 text-sm text-slate-500 dark:text-slate-300">
              {order.dropoff_address || "No address set"}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <span className={`status-chip ${statusBadgeClass(order.status)}`}>
              {formatOrderStatus(order.status)}
            </span>
            {order.total != null && <Badge className="status-chip status-neutral">{formatMoney(order.total)}</Badge>}
            {order.eta_summary?.is_late && <Badge className="status-chip status-bad">Late</Badge>}
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <InfoCard icon={Clock3} label="Created" value={formatDateTime(order.created_at)} />
          <InfoCard icon={MapPin} label="Market" value={order.market?.name || "-"} />
          <InfoCard
            icon={Truck}
            label="Driver"
            value={order.assigned_driver?.user?.name || order.offered_driver?.user?.name || "Waiting for driver"}
          />
          <InfoCard icon={Wallet} label="ETA" value={formatDateTime(order.eta_summary?.estimated_delivery_at)} />
        </div>

        <div className="grid gap-3">
          {(order.timeline ?? []).slice(0, 3).map((step) => (
            <div
              key={step.key}
              className="flex items-center justify-between rounded-[18px] border border-slate-200 bg-slate-50/70 px-4 py-3 text-sm dark:border-slate-800 dark:bg-slate-900"
            >
              <span className="font-medium text-slate-950 dark:text-white">{step.label}</span>
              <span className="text-slate-500 dark:text-slate-300">{formatDateTime(step.at)}</span>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            onClick={onOpenDetail}
            className="dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:hover:bg-slate-800"
          >
            <MessageSquareMore className="h-4 w-4" />
            Open detail
          </Button>

          <Button
            variant="secondary"
            onClick={onReorder}
            disabled={!order.actions?.can_reorder}
            className="dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:hover:bg-slate-800"
          >
            <Undo2 className="h-4 w-4" />
            Reorder
          </Button>

          <Button
            variant="secondary"
            onClick={onCancel}
            disabled={!order.actions?.can_cancel}
            className="dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:hover:bg-slate-800"
          >
            <XCircle className="h-4 w-4" />
            Cancel order
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function Metric({ title, value, helper }: { title: string; value: number; helper?: string }) {
  return (
    <div className="min-h-[132px] rounded-[24px] border border-white/10 bg-white/10 p-5 backdrop-blur-sm">
      <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/55">{title}</div>
      <div className="mt-3 text-5xl font-semibold tracking-[-0.05em] text-white">{value}</div>
      {helper ? <div className="mt-2 text-sm text-white/65">{helper}</div> : null}
    </div>
  );
}

function InfoCard({
  icon: Icon,
  label,
  value,
}: {
  icon?: typeof Clock3;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[22px] border border-slate-200 bg-slate-50/80 px-4 py-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center gap-2">
        {Icon ? <Icon className="h-4 w-4 text-cyan-700 dark:text-cyan-200" /> : null}
        <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500">
          {label}
        </div>
      </div>
      <div className="mt-3 text-sm font-semibold leading-6 text-slate-950 dark:text-white">{value}</div>
    </div>
  );
}

function OrderActionRow({
  order,
  detailLabel,
  onOpenDetail,
  onAccept,
  onMarkReady,
}: {
  order: Order;
  detailLabel: string;
  onOpenDetail: () => void;
  onAccept: () => void;
  onMarkReady: () => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button
        size="sm"
        variant="secondary"
        onClick={onOpenDetail}
        className="dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:hover:bg-slate-800"
      >
        {detailLabel}
      </Button>

      {order.status === "MARKET_PENDING" && (
        <Button size="sm" onClick={onAccept}>
          Accept
        </Button>
      )}

      {order.status === "MARKET_ACCEPTED" && (
        <Button size="sm" onClick={onMarkReady}>
          Mark ready
        </Button>
      )}
    </div>
  );
}

function DetailStat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Clock3;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[24px] border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900/90">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-cyan-700 dark:text-cyan-200" />
        <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500">
          {label}
        </div>
      </div>
      <div className="mt-4 text-base font-semibold leading-7 text-slate-950 dark:text-white">{value}</div>
    </div>
  );
}

function FlatDetailRow({
  icon: Icon,
  label,
  value,
  fullWidth = false,
}: {
  icon: typeof Clock3;
  label: string;
  value: string;
  fullWidth?: boolean;
}) {
  return (
    <div
      className={`rounded-[24px] border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950/90 ${
        fullWidth ? "lg:col-span-2" : ""
      }`}
    >
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-cyan-700 dark:text-cyan-200" />
        <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500">
          {label}
        </div>
      </div>
      <div className="mt-3 text-sm font-semibold leading-6 text-slate-950 dark:text-white">{value}</div>
    </div>
  );
}