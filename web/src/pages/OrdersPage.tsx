import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Circle,
  ClipboardList,
  Clock3,
  Eye,
  MapPin,
  MessageSquareMore,
  MoreHorizontal,
  Navigation,
  PackageCheck,
  PackagePlus,
  Receipt,
  Search,
  Star,
  Store,
  Truck,
  Undo2,
  UserRound,
  Wallet,
  XCircle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AxiosError } from "axios";
import { MapContainer, Marker, TileLayer } from "react-leaflet";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import "leaflet/dist/leaflet.css";

import { EmptyState } from "@/components/app/empty-state";
import { LoadingState } from "@/components/app/loading-state";
import { PageHeader } from "@/components/app/page-header";
import { StatCard, StatGrid } from "@/components/app/stat-card";
import { StatusBadge, humanizeStatus, toneForStatus } from "@/components/app/status-badge";
import { makeDotIcon } from "@/components/operations/map-markers";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { formatDateTime, formatMoney, formatOrderStatus } from "@/lib/format";
import { useTheme } from "@/lib/theme";
import { useMe } from "@/lib/useMe";
import { cn } from "@/lib/utils";
import type { Order, Paginated } from "@/types/api";

function getErrorMessage(error: unknown) {
  if (!error || typeof error !== "object") return null;
  const axiosError = error as AxiosError<{ message?: string }>;
  return axiosError.response?.data?.message ?? (error as Error | null)?.message ?? null;
}

type StatusFilter = "all" | "pending" | "in_progress" | "delivered" | "cancelled";

const DRIVER_FLOW_STATUSES = ["READY_FOR_PICKUP", "OFFERED", "ASSIGNED", "PICKED_UP"];

const STATUS_GROUPS: Record<Exclude<StatusFilter, "all">, string[]> = {
  pending: ["MARKET_PENDING"],
  in_progress: ["MARKET_ACCEPTED", ...DRIVER_FLOW_STATUSES],
  delivered: ["DELIVERED"],
  cancelled: ["CANCELLED", "FAILED"],
};

const STATUS_FILTER_LABELS: Record<StatusFilter, string> = {
  all: "All statuses",
  pending: "Waiting for market",
  in_progress: "In progress",
  delivered: "Delivered",
  cancelled: "Cancelled / failed",
};

function matchesStatus(order: Order, filter: StatusFilter) {
  return filter === "all" || STATUS_GROUPS[filter].includes(order.status);
}

function driverNameOf(order: Order) {
  return order.assigned_driver?.user?.name || order.offered_driver?.user?.name || null;
}

function customerNameOf(order: Order) {
  return order.customer_name || order.customer?.name || "Unknown";
}

export default function OrdersPage() {
  const meQ = useMe();
  const queryClient = useQueryClient();
  const { theme } = useTheme();

  const [dropoffAddress, setDropoffAddress] = useState("Tbilisi Center");
  const [dropoffLat, setDropoffLat] = useState("41.7151");
  const [dropoffLng, setDropoffLng] = useState("44.8271");
  const [search, setSearch] = useState("");
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [rating, setRating] = useState("5");
  const [feedback, setFeedback] = useState("");
  const [refundReason, setRefundReason] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [marketFilter, setMarketFilter] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [cancelTargetId, setCancelTargetId] = useState<number | null>(null);

  const roles = meQ.data?.roles ?? [];
  const isCustomerOnly =
    roles.includes("customer") &&
    !roles.some((role: string) => ["admin", "owner", "staff", "driver"].includes(role));
  const isOpsUser = roles.some((role: string) => ["admin", "owner", "staff"].includes(role));
  const isDriver = roles.includes("driver");

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

  // UI-only feedback helpers (toasts); the mutations themselves are unchanged.
  const notify = (success: string) => ({
    onSuccess: () => toast.success(success),
    onError: (error: unknown) => toast.error(getErrorMessage(error) || "Something went wrong."),
  });

  const acceptOrder = (orderId: number) => marketActionM.mutate({ orderId, action: "market-accept" }, notify("Order accepted"));
  const markReady = (orderId: number) => marketActionM.mutate({ orderId, action: "mark-ready" }, notify("Order marked ready for pickup"));
  const reorder = (orderId: number) => reorderM.mutate(orderId, notify("Order placed again"));
  const confirmCancel = () => {
    if (cancelTargetId == null) return;
    cancelM.mutate(cancelTargetId, notify("Cancellation requested"));
    setCancelTargetId(null);
  };

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

  const markets = useMemo(() => {
    const map = new Map<number, string>();
    for (const order of ordersQ.data?.data ?? []) {
      if (order.market) map.set(order.market.id, order.market.name);
    }
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [ordersQ.data?.data]);

  const visibleOrders = useMemo(
    () =>
      filteredOrders.filter(
        (order) => matchesStatus(order, statusFilter) && (marketFilter === "all" || String(order.market?.id ?? "") === marketFilter),
      ),
    [filteredOrders, statusFilter, marketFilter],
  );

  const deliveredCount = filteredOrders.filter((order) => order.status === "DELIVERED").length;
  const marketPendingCount = filteredOrders.filter((order) => order.status === "MARKET_PENDING").length;
  const driverFlowCount = filteredOrders.filter((order) => DRIVER_FLOW_STATUSES.includes(order.status)).length;
  const inProgressCount = filteredOrders.filter((order) => matchesStatus(order, "in_progress")).length;
  const cancelledCount = filteredOrders.filter((order) => matchesStatus(order, "cancelled")).length;

  const detailOrder = detailQ.data;

  const errorMessage =
    getErrorMessage(createOrderM.error) ||
    getErrorMessage(marketActionM.error) ||
    getErrorMessage(cancelM.error) ||
    getErrorMessage(reorderM.error) ||
    getErrorMessage(rateM.error) ||
    getErrorMessage(refundM.error);

  const toggleStatus = (value: StatusFilter) => setStatusFilter((current) => (current === value ? "all" : value));
  const filtersActive = search.trim() !== "" || statusFilter !== "all" || marketFilter !== "all";
  const clearFilters = () => {
    setSearch("");
    setStatusFilter("all");
    setMarketFilter("all");
  };

  const title = isCustomerOnly ? "My orders" : isDriver && !isOpsUser ? "My deliveries" : "Orders";
  const description = isCustomerOnly
    ? "Follow your orders as they move from the market to your door. This page refreshes automatically."
    : isDriver && !isOpsUser
      ? "Orders assigned or offered to you, with addresses, totals and delivery status."
      : "Review incoming orders, move them through the market and driver flow, and follow up with customers.";

  const actionsFor = (order: Order) => ({
    onOpenDetail: () => setSelectedOrderId(order.id),
    onAccept: () => acceptOrder(order.id),
    onMarkReady: () => markReady(order.id),
    pending: marketActionM.isPending && marketActionM.variables?.orderId === order.id,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title={title}
        description={description}
        actions={
          !isCustomerOnly && isOpsUser ? (
            <Button onClick={() => setCreateOpen(true)}>
              <PackagePlus />
              New order
            </Button>
          ) : undefined
        }
      />

      <StatGrid>
        <StatCard
          label={isCustomerOnly ? "Your orders" : "Visible orders"}
          value={filteredOrders.length}
          icon={ClipboardList}
          hint={statusFilter === "all" ? "Showing all" : "Click to show all"}
          onClick={() => setStatusFilter("all")}
          active={statusFilter === "all"}
        />
        <StatCard
          label="Waiting for market"
          value={marketPendingCount}
          icon={Store}
          tone="warning"
          hint="Needs market acceptance"
          onClick={() => toggleStatus("pending")}
          active={statusFilter === "pending"}
        />
        <StatCard
          label="In progress"
          value={inProgressCount}
          icon={Truck}
          tone="info"
          hint={`${driverFlowCount} in driver flow`}
          onClick={() => toggleStatus("in_progress")}
          active={statusFilter === "in_progress"}
        />
        <StatCard
          label="Delivered"
          value={deliveredCount}
          icon={PackageCheck}
          tone="success"
          hint={cancelledCount > 0 ? `${cancelledCount} cancelled / failed` : "With delivery proof"}
          onClick={() => toggleStatus("delivered")}
          active={statusFilter === "delivered"}
        />
      </StatGrid>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="relative min-w-0 flex-1 sm:min-w-64">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={isCustomerOnly ? "Search by order code or address" : "Search code, address, customer, market..."}
            className="pl-9"
            aria-label="Search orders"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as StatusFilter)}>
            <SelectTrigger className="w-full min-w-44 sm:w-auto" aria-label="Filter by status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(STATUS_FILTER_LABELS) as StatusFilter[]).map((key) => (
                <SelectItem key={key} value={key}>
                  {STATUS_FILTER_LABELS[key]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {!isCustomerOnly && markets.length > 1 ? (
            <Select value={marketFilter} onValueChange={setMarketFilter}>
              <SelectTrigger className="w-full min-w-44 sm:w-auto" aria-label="Filter by market">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All markets</SelectItem>
                {markets.map(([id, name]) => (
                  <SelectItem key={id} value={String(id)}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
          {filtersActive ? (
            <Button variant="ghost" onClick={clearFilters}>
              Clear filters
            </Button>
          ) : null}
        </div>
      </div>

      {errorMessage && (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertTitle>Action failed</AlertTitle>
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      )}

      {ordersQ.isLoading ? (
        <LoadingState rows={4} />
      ) : ordersQ.isError ? (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertTitle>Failed to load orders</AlertTitle>
          <AlertDescription>Check your connection and reload the page.</AlertDescription>
        </Alert>
      ) : visibleOrders.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title={
            isCustomerOnly && (ordersQ.data?.data ?? []).length === 0
              ? "You have not placed any orders yet."
              : "No orders matched your filters."
          }
          description={
            isCustomerOnly && (ordersQ.data?.data ?? []).length === 0
              ? "Browse markets and place your first order. It will show up here with live status."
              : "Try a different search term or clear the filters."
          }
          action={
            isCustomerOnly && (ordersQ.data?.data ?? []).length === 0 ? (
              <Button asChild>
                <Link to="/">Browse markets</Link>
              </Button>
            ) : filtersActive ? (
              <Button variant="outline" onClick={clearFilters}>
                Clear filters
              </Button>
            ) : undefined
          }
        />
      ) : isCustomerOnly ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {visibleOrders.map((order) => (
            <CustomerOrderCard
              key={order.id}
              order={order}
              onOpenDetail={() => setSelectedOrderId(order.id)}
              onCancel={() => setCancelTargetId(order.id)}
              onReorder={() => reorder(order.id)}
            />
          ))}
        </div>
      ) : (
        <>
          <Card className="hidden gap-0 overflow-hidden py-0 md:flex">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead className="pl-4">Order</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Market</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Driver</TableHead>
                    <TableHead>ETA</TableHead>
                    <TableHead className="pr-4 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleOrders.map((order) => (
                    <TableRow key={order.id} className="cursor-pointer" onClick={() => setSelectedOrderId(order.id)}>
                      <TableCell className="pl-4">
                        <div className="font-medium">{order.code}</div>
                        <div className="text-xs text-muted-foreground">{formatDateTime(order.created_at)}</div>
                      </TableCell>
                      <TableCell>
                        <div className="max-w-44 truncate">{customerNameOf(order)}</div>
                        <div className="max-w-44 truncate text-xs text-muted-foreground">{order.dropoff_address || "No address set"}</div>
                      </TableCell>
                      <TableCell className="max-w-40 truncate">{order.market?.name || "Direct order"}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        <div>{order.total != null ? formatMoney(order.total) : "-"}</div>
                        {order.items?.length ? (
                          <div className="text-xs text-muted-foreground">
                            {order.items.length} item{order.items.length === 1 ? "" : "s"}
                          </div>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap items-center gap-1">
                          <StatusBadgeFor status={order.status} />
                          {order.eta_summary?.is_late && <StatusBadge tone="destructive">Late</StatusBadge>}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-36 truncate">
                        {driverNameOf(order) ?? <span className="text-muted-foreground">Unassigned</span>}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{formatDateTime(order.eta_summary?.estimated_delivery_at)}</TableCell>
                      <TableCell className="pr-4" onClick={(event) => event.stopPropagation()}>
                        <OrderActionRow order={order} {...actionsFor(order)} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="border-t px-4 py-2.5 text-xs text-muted-foreground tabular-nums">
              Showing {visibleOrders.length} of {(ordersQ.data?.data ?? []).length} orders
            </div>
          </Card>

          <div className="grid gap-3 md:hidden">
            {visibleOrders.map((order) => (
              <Card key={order.id} className="gap-3 py-4">
                <CardHeader className="px-4">
                  <CardTitle className="text-base font-semibold">{order.code}</CardTitle>
                  <CardDescription className="truncate">{order.dropoff_address || "No address set"}</CardDescription>
                  <CardAction>
                    <StatusBadgeFor status={order.status} />
                  </CardAction>
                </CardHeader>
                <CardContent className="grid gap-1.5 px-4 text-sm">
                  <RecordRow label="Market" value={order.market?.name || "Direct order"} />
                  <RecordRow label="Customer" value={customerNameOf(order)} />
                  <RecordRow label="Driver" value={driverNameOf(order) ?? "Unassigned"} />
                  <RecordRow label="Total" value={order.total != null ? formatMoney(order.total) : "-"} />
                  <RecordRow label="ETA" value={formatDateTime(order.eta_summary?.estimated_delivery_at)} />
                  {order.eta_summary?.is_late && (
                    <div>
                      <StatusBadge tone="destructive">Late</StatusBadge>
                    </div>
                  )}
                </CardContent>
                <CardFooter className="px-4">
                  <OrderActionRow order={order} {...actionsFor(order)} stacked />
                </CardFooter>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* Create ops order */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create ops order</DialogTitle>
            <DialogDescription>Manual order intake for call center or dispatch scenarios.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="ops-dropoff-address">Dropoff address</Label>
              <Input id="ops-dropoff-address" value={dropoffAddress} onChange={(event) => setDropoffAddress(event.target.value)} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="ops-dropoff-lat">Latitude</Label>
                <Input id="ops-dropoff-lat" inputMode="decimal" value={dropoffLat} onChange={(event) => setDropoffLat(event.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="ops-dropoff-lng">Longitude</Label>
                <Input id="ops-dropoff-lng" inputMode="decimal" value={dropoffLng} onChange={(event) => setDropoffLng(event.target.value)} />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">Created with priority 2, size 1 and the note "Manual ops order".</p>
            {createOrderM.error ? (
              <Alert variant="destructive">
                <AlertCircle />
                <AlertDescription>{getErrorMessage(createOrderM.error)}</AlertDescription>
              </Alert>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() =>
                createOrderM.mutate(undefined, {
                  onSuccess: () => {
                    toast.success("Order created");
                    setCreateOpen(false);
                  },
                })
              }
              disabled={createOrderM.isPending}
            >
              <PackagePlus />
              {createOrderM.isPending ? "Creating..." : "Create order"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel confirmation (customer cards + detail) */}
      <AlertDialog open={cancelTargetId != null} onOpenChange={(open) => !open && setCancelTargetId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this order?</AlertDialogTitle>
            <AlertDialogDescription>
              We'll send a cancellation request to the market. Orders that are already on the way may not be cancellable.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="cancel-reason-confirm">Reason (optional)</Label>
            <Textarea
              id="cancel-reason-confirm"
              value={cancelReason}
              onChange={(event) => setCancelReason(event.target.value)}
              placeholder="Tell the market why you're cancelling"
              rows={3}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep order</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={confirmCancel}>
              Cancel order
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Order detail */}
      <Sheet open={selectedOrderId != null} onOpenChange={(open) => !open && setSelectedOrderId(null)}>
        <SheetContent className="w-full gap-0 sm:max-w-xl">
          <SheetHeader className="border-b p-5 pr-12">
            <div className="text-xs font-medium text-muted-foreground">{detailOrder?.market?.code || "Order"}</div>
            <SheetTitle className="text-lg">{detailOrder?.code || "Order detail"}</SheetTitle>
            <SheetDescription>{detailOrder?.dropoff_address || (detailOrder ? "No address set" : "Loading order...")}</SheetDescription>
            {detailOrder ? (
              <div className="flex flex-wrap gap-2 pt-1">
                <StatusBadgeFor status={detailOrder.status} />
                <StatusBadge tone="neutral">{detailOrder.total != null ? formatMoney(detailOrder.total) : "-"}</StatusBadge>
                {detailOrder.eta_summary?.is_late && <StatusBadge tone="destructive">Late</StatusBadge>}
              </div>
            ) : null}
          </SheetHeader>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            {detailOrder ? (
              <div className="grid gap-6 p-5">
                {detailOrder.eta_summary?.is_late && (
                  <Alert variant="destructive">
                    <AlertCircle />
                    <AlertTitle>This order needs attention.</AlertTitle>
                    <AlertDescription>ETA has slipped past the expected window.</AlertDescription>
                  </Alert>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <DetailStat icon={Clock3} label="ETA" value={formatDateTime(detailOrder.eta_summary?.estimated_delivery_at)} />
                  <DetailStat icon={Wallet} label="Total" value={detailOrder.total != null ? formatMoney(detailOrder.total) : "-"} />
                  <DetailStat icon={Truck} label="Driver" value={driverNameOf(detailOrder) || "Waiting for driver"} />
                  <DetailStat icon={UserRound} label="Customer" value={customerNameOf(detailOrder)} />
                </div>

                {!isCustomerOnly && (detailOrder.status === "MARKET_PENDING" || detailOrder.status === "MARKET_ACCEPTED") ? (
                  <div className="flex flex-wrap gap-2">
                    {detailOrder.status === "MARKET_PENDING" && (
                      <Button onClick={() => acceptOrder(detailOrder.id)} disabled={marketActionM.isPending}>
                        <CheckCircle2 />
                        Accept order
                      </Button>
                    )}
                    {detailOrder.status === "MARKET_ACCEPTED" && (
                      <Button onClick={() => markReady(detailOrder.id)} disabled={marketActionM.isPending}>
                        <PackageCheck />
                        Mark ready for pickup
                      </Button>
                    )}
                  </div>
                ) : null}

                <DetailSection title="Order progress" description="Tracking appears after pickup so the timeline stays signal-first.">
                  {(detailOrder.timeline ?? []).length === 0 ? (
                    <p className="text-sm text-muted-foreground">No timeline events yet.</p>
                  ) : (
                    <ol className="grid gap-0">
                      {(detailOrder.timeline ?? []).map((step, index, steps) => (
                        <li key={step.key} className="relative flex gap-3 pb-4 last:pb-0">
                          {index < steps.length - 1 ? (
                            <span className={cn("absolute top-6 bottom-0 left-[11px] w-px", step.done ? "bg-success/50" : "bg-border")} />
                          ) : null}
                          <span
                            className={cn(
                              "relative z-10 flex size-6 shrink-0 items-center justify-center rounded-full",
                              step.done ? "bg-success/15 text-success" : "bg-muted text-muted-foreground",
                            )}
                          >
                            {step.done ? <CheckCircle2 className="size-4" /> : <Circle className="size-3" />}
                          </span>
                          <div className="flex min-w-0 flex-1 flex-wrap items-start justify-between gap-x-3 gap-y-0.5">
                            <div className={cn("text-sm font-medium", !step.done && "text-muted-foreground")}>{step.label}</div>
                            <div className="text-xs text-muted-foreground">{step.done ? formatDateTime(step.at) : "Pending"}</div>
                          </div>
                        </li>
                      ))}
                    </ol>
                  )}
                </DetailSection>

                <DetailSection title="Delivery details">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <FlatDetailRow icon={Store} label="Market" value={detailOrder.market?.name || "Direct order"} />
                    <FlatDetailRow icon={Clock3} label="Created" value={formatDateTime(detailOrder.created_at)} />
                    <FlatDetailRow icon={MapPin} label="Dropoff" value={detailOrder.dropoff_address || "No address set"} fullWidth />
                    <FlatDetailRow icon={MapPin} label="Pickup" value={detailOrder.pickup_address || "No address set"} fullWidth />
                    <FlatDetailRow icon={MessageSquareMore} label="Notes" value={detailOrder.notes || "-"} fullWidth />
                  </div>
                </DetailSection>

                {detailOrder.assigned_driver?.latest_ping && detailOrder.status === "PICKED_UP" && (
                  <DetailSection title="Live driver tracking" description="Tracking appears after pickup so the timeline stays signal-first.">
                    <div className="h-[260px] overflow-hidden rounded-lg border">
                      <MapContainer
                        center={[
                          Number(detailOrder.assigned_driver.latest_ping.lat),
                          Number(detailOrder.assigned_driver.latest_ping.lng),
                        ]}
                        zoom={13}
                        style={{ height: "100%", width: "100%" }}
                      >
                        <TileLayer
                          attribution={theme === "dark" ? "&copy; OpenStreetMap &copy; CARTO" : "&copy; OpenStreetMap"}
                          url={
                            theme === "dark"
                              ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                              : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                          }
                        />
                        <Marker
                          position={[
                            Number(detailOrder.assigned_driver.latest_ping.lat),
                            Number(detailOrder.assigned_driver.latest_ping.lng),
                          ]}
                          icon={makeDotIcon("bg-primary")}
                        />
                        <Marker position={[Number(detailOrder.dropoff_lat), Number(detailOrder.dropoff_lng)]} icon={makeDotIcon("bg-success")} />
                      </MapContainer>
                    </div>
                    <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <span className="size-2.5 rounded-full bg-primary" /> Driver
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="size-2.5 rounded-full bg-success" /> Dropoff
                      </span>
                    </div>
                  </DetailSection>
                )}

                <DetailSection title="Receipt" description={detailOrder.receipt?.number || "Pending receipt"} icon={Receipt}>
                  <div className="grid gap-2 text-sm">
                    {(detailOrder.receipt?.items ?? []).map((item, index) => (
                      <div key={`${item.name}-${index}`} className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <span>
                            {item.name} <span className="text-muted-foreground">x{item.qty}</span>
                          </span>
                          {item.combo_offer ? <div className="text-xs text-muted-foreground">Combo: {item.combo_offer.name}</div> : null}
                          {(item.removed_ingredients ?? []).length > 0 ? (
                            <div className="text-xs text-muted-foreground">Without: {item.removed_ingredients?.join(", ")}</div>
                          ) : null}
                        </div>
                        <span className="shrink-0 tabular-nums">{formatMoney(item.line_total ?? 0)}</span>
                      </div>
                    ))}
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between text-sm font-semibold">
                    <span>Total</span>
                    <span className="tabular-nums">{formatMoney(detailOrder.receipt?.total ?? detailOrder.total ?? 0)}</span>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    {detailOrder.receipt?.payment?.method || detailOrder.receipt?.payment?.status ? (
                      <span>
                        Payment: {[detailOrder.receipt.payment.method, detailOrder.receipt.payment.status ? humanizeStatus(detailOrder.receipt.payment.status) : null]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    ) : null}
                    <span>Refund: {detailOrder.refund_summary?.status || "none"}</span>
                  </div>
                </DetailSection>

                <DetailSection title="Delivery proof">
                  {detailOrder.delivery_proof?.photo_url ? (
                    <img src={detailOrder.delivery_proof.photo_url} alt="Proof of delivery" className="h-60 w-full rounded-lg border object-cover" />
                  ) : null}
                  <div className="rounded-lg border bg-muted/30 p-3 text-sm">
                    {detailOrder.delivery_proof?.note || "No delivery proof has been attached yet."}
                    {detailOrder.delivery_proof?.signature_name ? ` | Signature: ${detailOrder.delivery_proof.signature_name}` : ""}
                  </div>
                </DetailSection>

                <DetailSection title="Rate delivery" description="Available once the order has been delivered." icon={Star}>
                  <div className="grid gap-4 sm:grid-cols-[120px_minmax(0,1fr)]">
                    <div className="grid gap-2">
                      <Label htmlFor="order-rating">Rating</Label>
                      <Select value={rating} onValueChange={setRating}>
                        <SelectTrigger id="order-rating" className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {["5", "4", "3", "2", "1"].map((value) => (
                            <SelectItem key={value} value={value}>
                              {value} / 5
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="order-feedback">Feedback</Label>
                      <Input id="order-feedback" value={feedback} onChange={(event) => setFeedback(event.target.value)} placeholder="How did it go?" />
                    </div>
                  </div>
                  <Button
                    className="w-fit"
                    onClick={() => rateM.mutate(detailOrder.id, notify("Thanks for your rating"))}
                    disabled={!detailOrder.actions?.can_rate || rateM.isPending}
                  >
                    <Star />
                    Submit rating
                  </Button>
                </DetailSection>

                <DetailSection title="Order changes" description="Reorder, cancel or request a refund. Buttons are enabled when the action is allowed for this order.">
                  <div className="grid gap-2">
                    <Label htmlFor="order-cancel-reason">Cancellation reason</Label>
                    <Input id="order-cancel-reason" value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} placeholder="Optional" />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="order-refund-reason">Refund reason</Label>
                    <Input
                      id="order-refund-reason"
                      value={refundReason}
                      onChange={(event) => setRefundReason(event.target.value)}
                      placeholder='Defaults to "Requested by customer"'
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" onClick={() => reorder(detailOrder.id)} disabled={!detailOrder.actions?.can_reorder || reorderM.isPending}>
                      <Undo2 />
                      Reorder
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => refundM.mutate(detailOrder.id, notify("Refund requested"))}
                      disabled={!detailOrder.actions?.can_request_refund || refundM.isPending}
                    >
                      <Wallet />
                      Request refund
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => setCancelTargetId(detailOrder.id)}
                      disabled={!detailOrder.actions?.can_cancel || cancelM.isPending}
                    >
                      <XCircle />
                      Cancel order
                    </Button>
                  </div>
                </DetailSection>
              </div>
            ) : detailQ.isError ? (
              <div className="p-5">
                <Alert variant="destructive">
                  <AlertCircle />
                  <AlertTitle>Could not load this order</AlertTitle>
                  <AlertDescription>Close the panel and try again.</AlertDescription>
                </Alert>
              </div>
            ) : (
              <div className="grid gap-3 p-5" aria-busy="true">
                <span className="sr-only">Loading order detail...</span>
                <div className="grid grid-cols-2 gap-3">
                  {Array.from({ length: 4 }, (_, i) => (
                    <Skeleton key={i} className="h-16 rounded-lg" />
                  ))}
                </div>
                <Skeleton className="h-40 rounded-lg" />
                <Skeleton className="h-32 rounded-lg" />
              </div>
            )}
          </div>

          <SheetFooter className="flex-row justify-end border-t p-4">
            {detailOrder && isCustomerOnly ? (
              <Button variant="outline" asChild>
                <Link to={`/track/${encodeURIComponent(detailOrder.code)}`}>
                  <Navigation />
                  Track order
                </Link>
              </Button>
            ) : null}
            <Button variant="secondary" onClick={() => setSelectedOrderId(null)}>
              Close
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function StatusBadgeFor({ status }: { status: string }) {
  return (
    <StatusBadge tone={toneForStatus(status)} dot>
      {formatOrderStatus(status)}
    </StatusBadge>
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
  const steps = order.timeline ?? [];
  const doneSteps = steps.filter((step) => step.done).length;

  return (
    <Card className="gap-4">
      <CardHeader>
        <div className="text-xs font-medium text-muted-foreground">{order.market?.name || order.market?.code || "Order"}</div>
        <CardTitle className="text-lg font-semibold">{order.code}</CardTitle>
        <CardDescription className="truncate">{order.dropoff_address || "No address set"}</CardDescription>
        <CardAction className="flex flex-col items-end gap-1.5">
          <StatusBadgeFor status={order.status} />
          {order.eta_summary?.is_late && <StatusBadge tone="destructive">Late</StatusBadge>}
        </CardAction>
      </CardHeader>

      <CardContent className="grid gap-4">
        <div className="grid grid-cols-2 gap-3">
          <InfoCard icon={Clock3} label="Created" value={formatDateTime(order.created_at)} />
          <InfoCard icon={Store} label="Market" value={order.market?.name || "-"} />
          <InfoCard icon={Truck} label="Driver" value={driverNameOf(order) || "Waiting for driver"} />
          <InfoCard icon={Wallet} label="ETA" value={formatDateTime(order.eta_summary?.estimated_delivery_at)} />
        </div>

        {steps.length > 0 ? (
          <div className="grid gap-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Progress</span>
              <span className="tabular-nums">
                {doneSteps} of {steps.length} steps
              </span>
            </div>
            <div className="grid gap-1.5">
              {steps.slice(0, 3).map((step) => (
                <div key={step.key} className="flex items-center justify-between gap-3 rounded-lg border bg-muted/30 px-3 py-2 text-sm">
                  <span className="flex min-w-0 items-center gap-2 font-medium">
                    {step.done ? <CheckCircle2 className="size-4 shrink-0 text-success" /> : <Circle className="size-4 shrink-0 text-muted-foreground" />}
                    <span className="truncate">{step.label}</span>
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">{formatDateTime(step.at)}</span>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </CardContent>

      <CardFooter className="flex flex-wrap gap-2">
        <Button asChild>
          <Link to={`/track/${encodeURIComponent(order.code)}`}>
            <Navigation />
            Track
          </Link>
        </Button>
        <Button variant="outline" onClick={onOpenDetail}>
          <Eye />
          Details
        </Button>
        <Button variant="outline" onClick={onReorder} disabled={!order.actions?.can_reorder}>
          <Undo2 />
          Reorder
        </Button>
        <Button variant="ghost" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={onCancel} disabled={!order.actions?.can_cancel}>
          <XCircle />
          Cancel
        </Button>
      </CardFooter>
    </Card>
  );
}

function InfoCard({ icon: Icon, label, value }: { icon?: LucideIcon; label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-lg border bg-muted/30 p-3">
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        {Icon ? <Icon className="size-3.5" /> : null}
        {label}
      </div>
      <div className="mt-1 truncate text-sm font-medium">{value}</div>
    </div>
  );
}

function RecordRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="min-w-0 truncate text-right">{value}</span>
    </div>
  );
}

function OrderActionRow({
  order,
  onOpenDetail,
  onAccept,
  onMarkReady,
  pending = false,
  stacked = false,
}: {
  order: Order;
  onOpenDetail: () => void;
  onAccept: () => void;
  onMarkReady: () => void;
  pending?: boolean;
  stacked?: boolean;
}) {
  const primary =
    order.status === "MARKET_PENDING" ? (
      <Button size="sm" onClick={onAccept} disabled={pending}>
        <CheckCircle2 />
        Accept
      </Button>
    ) : order.status === "MARKET_ACCEPTED" ? (
      <Button size="sm" onClick={onMarkReady} disabled={pending}>
        <PackageCheck />
        Mark ready
      </Button>
    ) : null;

  return (
    <div className={cn("flex items-center gap-2", stacked ? "w-full flex-wrap" : "justify-end")}>
      {primary}
      {stacked ? (
        <Button size="sm" variant="outline" onClick={onOpenDetail}>
          <Eye />
          Open detail
        </Button>
      ) : null}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="icon-sm" variant="ghost" aria-label={`More actions for ${order.code}`} className={cn(stacked && "ml-auto")}>
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuLabel className="text-xs text-muted-foreground">{order.code}</DropdownMenuLabel>
          <DropdownMenuItem onSelect={onOpenDetail}>
            <Eye />
            Open detail
          </DropdownMenuItem>
          {order.status === "MARKET_PENDING" || order.status === "MARKET_ACCEPTED" ? <DropdownMenuSeparator /> : null}
          {order.status === "MARKET_PENDING" && (
            <DropdownMenuItem onSelect={onAccept} disabled={pending}>
              <CheckCircle2 />
              Accept order
            </DropdownMenuItem>
          )}
          {order.status === "MARKET_ACCEPTED" && (
            <DropdownMenuItem onSelect={onMarkReady} disabled={pending}>
              <PackageCheck />
              Mark ready for pickup
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function DetailSection({
  title,
  description,
  icon: Icon,
  children,
}: {
  title: string;
  description?: string;
  icon?: LucideIcon;
  children: ReactNode;
}) {
  return (
    <section className="grid gap-3">
      <div>
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          {Icon ? <Icon className="size-4 text-muted-foreground" /> : null}
          {title}
        </h3>
        {description ? <p className="mt-0.5 text-xs text-muted-foreground">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

function DetailStat({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-lg border bg-muted/30 p-3">
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Icon className="size-3.5" />
        {label}
      </div>
      <div className="mt-1 truncate text-sm font-semibold">{value}</div>
    </div>
  );
}

function FlatDetailRow({
  icon: Icon,
  label,
  value,
  fullWidth = false,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  fullWidth?: boolean;
}) {
  return (
    <div className={cn("flex gap-3 rounded-lg border bg-muted/30 p-3", fullWidth && "sm:col-span-2")}>
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <div className="text-xs font-medium text-muted-foreground">{label}</div>
        <div className="mt-0.5 text-sm break-words">{value}</div>
      </div>
    </div>
  );
}
