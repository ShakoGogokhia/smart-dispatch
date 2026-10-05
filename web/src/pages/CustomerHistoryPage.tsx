import { useMemo, useState } from "react";
import {
  CheckCircle2,
  ChevronDown,
  CreditCard,
  MapPin,
  PackageSearch,
  ReceiptText,
  RotateCcw,
  Search,
  ShoppingBag,
  Star,
  Wallet,
  WalletCards,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { toast } from "sonner";

import { EmptyState } from "@/components/app/empty-state";
import { LoadingState } from "@/components/app/loading-state";
import { PageHeader } from "@/components/app/page-header";
import { StatCard, StatGrid } from "@/components/app/stat-card";
import { StatusBadge, toneForStatus, humanizeStatus } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { api } from "@/lib/api";
import { formatDateTime, formatMoney, formatOrderStatus, toNumber } from "@/lib/format";
import type { Order, Paginated } from "@/types/api";

type StatusFilter = "all" | "active" | "delivered" | "cancelled";

export default function CustomerHistoryPage() {
  const queryClient = useQueryClient();
  const historyQ = useQuery({
    queryKey: ["customer-history"],
    queryFn: async () => (await api.get("/api/customer/orders/history")).data as Paginated<Order>,
  });
  const reorderM = useMutation({
    mutationFn: async (orderId: number) => (await api.post(`/api/orders/${orderId}/reorder`)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["customer-history"] }),
  });
  const paymentM = useMutation({
    mutationFn: async ({ orderId, method }: { orderId: number; method: "mock_card" | "cash_on_delivery" }) =>
      (await api.post(`/api/orders/${orderId}/payment/simulate`, { method })).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["customer-history"] }),
  });

  const orders = useMemo(() => historyQ.data?.data ?? [], [historyQ.data]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const stats = useMemo(() => {
    const delivered = orders.filter((order) => (order.status ?? "").toUpperCase() === "DELIVERED").length;
    const cancelled = orders.filter((order) => ["CANCELLED", "FAILED"].includes((order.status ?? "").toUpperCase())).length;
    const spent = orders.reduce((sum, order) => sum + toNumber(order.total ?? 0), 0);
    return { delivered, cancelled, active: orders.length - delivered - cancelled, spent };
  }, [orders]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return orders.filter((order) => {
      const status = (order.status ?? "").toUpperCase();
      const isDone = status === "DELIVERED";
      const isStopped = status === "CANCELLED" || status === "FAILED";
      if (statusFilter === "delivered" && !isDone) return false;
      if (statusFilter === "cancelled" && !isStopped) return false;
      if (statusFilter === "active" && (isDone || isStopped)) return false;
      if (!term) return true;
      return [order.code, order.market?.name, order.dropoff_address].some((value) => (value ?? "").toLowerCase().includes(term));
    });
  }, [orders, search, statusFilter]);

  function pay(orderId: number, method: "mock_card" | "cash_on_delivery") {
    paymentM.mutate(
      { orderId, method },
      {
        onSuccess: () => toast.success(method === "mock_card" ? "Card payment recorded" : "Cash on delivery selected"),
        onError: () => toast.error("Could not update the payment"),
      },
    );
  }

  function reorder(orderId: number) {
    reorderM.mutate(orderId, {
      onSuccess: () => toast.success("Order placed again"),
      onError: () => toast.error("Could not reorder"),
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Order history"
        description="All your past and current orders, with receipts, payments and quick reorder."
        actions={
          <Button variant="outline" asChild>
            <Link to="/track">
              <PackageSearch />
              Track an order
            </Link>
          </Button>
        }
      />

      {historyQ.isLoading ? (
        <LoadingState rows={4} />
      ) : orders.length === 0 ? (
        <EmptyState
          icon={ShoppingBag}
          title="No orders yet"
          description="When you place an order it will show up here with its receipt and status."
          action={
            <Button asChild>
              <Link to="/">Browse markets</Link>
            </Button>
          }
        />
      ) : (
        <>
          <StatGrid>
            <StatCard label="Total orders" value={orders.length} icon={ShoppingBag} tone="primary" onClick={() => setStatusFilter("all")} active={statusFilter === "all"} />
            <StatCard label="In progress" value={stats.active} icon={PackageSearch} tone="info" onClick={() => setStatusFilter("active")} active={statusFilter === "active"} />
            <StatCard label="Delivered" value={stats.delivered} icon={CheckCircle2} tone="success" onClick={() => setStatusFilter("delivered")} active={statusFilter === "delivered"} />
            <StatCard label="Total spent" value={formatMoney(stats.spent)} icon={Wallet} hint="Across the orders shown" />
          </StatGrid>

          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by order code, market or address" className="pl-9" aria-label="Search orders" />
            </div>
            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as StatusFilter)}>
              <SelectTrigger className="w-full sm:w-48" aria-label="Filter by status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="active">In progress</SelectItem>
                <SelectItem value="delivered">Delivered</SelectItem>
                <SelectItem value="cancelled">Cancelled / failed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {filtered.length === 0 ? (
            <EmptyState
              icon={Search}
              title="No matching orders"
              description="Try a different search or status filter."
              action={
                <Button
                  variant="outline"
                  onClick={() => {
                    setSearch("");
                    setStatusFilter("all");
                  }}
                >
                  Clear filters
                </Button>
              }
            />
          ) : (
            <div className="grid gap-4">
              {filtered.map((order) => {
                const receiptItems = order.receipt?.items ?? [];
                const itemCount = receiptItems.reduce((sum, item) => sum + (item.qty ?? 0), 0);
                const paymentStatus = order.receipt?.payment?.status ?? "pending";
                const isPaid = paymentStatus === "paid";
                const refundStatus = order.refund_summary?.status ?? "none";

                return (
                  <Card key={order.id}>
                    <CardHeader>
                      <CardTitle className="flex flex-wrap items-center gap-2">
                        <span className="font-mono">{order.code}</span>
                        <StatusBadge tone={toneForStatus(order.status)} dot>
                          {formatOrderStatus(order.status)}
                        </StatusBadge>
                      </CardTitle>
                      <CardDescription className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span>{order.market?.name ?? "Direct order"}</span>
                        <span aria-hidden>·</span>
                        <span>{formatDateTime(order.created_at)}</span>
                        {itemCount > 0 ? (
                          <>
                            <span aria-hidden>·</span>
                            <span>
                              {itemCount} {itemCount === 1 ? "item" : "items"}
                            </span>
                          </>
                        ) : null}
                      </CardDescription>
                      <CardAction className="text-right">
                        <div className="text-lg font-semibold tabular-nums">{formatMoney(order.total ?? 0)}</div>
                        <div className="text-xs text-muted-foreground">Total</div>
                      </CardAction>
                    </CardHeader>

                    <CardContent className="grid gap-4">
                      <div className="grid gap-3 sm:grid-cols-3">
                        <InfoTile icon={ReceiptText} label="Receipt" value={order.receipt?.number ?? "Pending"} />
                        <InfoTile
                          icon={CreditCard}
                          label="Payment"
                          value={
                            <StatusBadge tone={toneForStatus(paymentStatus)}>
                              {humanizeStatus(paymentStatus)}
                            </StatusBadge>
                          }
                          hint={order.receipt?.payment?.reference ?? undefined}
                        />
                        <InfoTile
                          icon={Star}
                          label="Rating"
                          value={
                            order.rating_summary?.rating ? (
                              <span className="inline-flex items-center gap-1">
                                <Star className="size-4 fill-warning text-warning" />
                                {order.rating_summary.rating}/5
                              </span>
                            ) : (
                              "Not rated"
                            )
                          }
                        />
                      </div>

                      {order.dropoff_address ? (
                        <div className="flex items-start gap-2 text-sm text-muted-foreground">
                          <MapPin className="mt-0.5 size-4 shrink-0" />
                          <span className="min-w-0 break-words">{order.dropoff_address}</span>
                        </div>
                      ) : null}

                      <Collapsible>
                        <CollapsibleTrigger asChild>
                          <Button variant="ghost" size="sm" className="group -ml-2">
                            <ChevronDown className="transition-transform group-data-[state=open]:rotate-180" />
                            View receipt
                          </Button>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="mt-2 grid gap-2 rounded-lg border bg-muted/30 p-4 text-sm">
                            {receiptItems.length === 0 ? (
                              <div className="text-muted-foreground">No receipt items yet.</div>
                            ) : (
                              receiptItems.map((item, index) => (
                                <div key={`${item.name}-${index}`} className="flex justify-between gap-3">
                                  <span className="min-w-0">
                                    {item.name} <span className="text-muted-foreground">× {item.qty}</span>
                                  </span>
                                  <span className="tabular-nums">{formatMoney(item.line_total ?? 0)}</span>
                                </div>
                              ))
                            )}
                            <Separator className="my-1" />
                            <div className="flex justify-between gap-3">
                              <span className="text-muted-foreground">Refund</span>
                              <span className="font-medium">{humanizeStatus(refundStatus)}</span>
                            </div>
                            <div className="flex justify-between gap-3">
                              <span className="text-muted-foreground">Payment</span>
                              <span className="min-w-0 text-right font-medium break-all">
                                {humanizeStatus(paymentStatus)}
                                {order.receipt?.payment?.reference ? ` - ${order.receipt.payment.reference}` : ""}
                              </span>
                            </div>
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    </CardContent>

                    <CardFooter className="flex-wrap gap-2 border-t">
                      <Button size="sm" asChild>
                        <Link to={`/track/${encodeURIComponent(order.code)}`}>
                          <PackageSearch />
                          Track
                        </Link>
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => reorder(order.id)} disabled={!order.actions?.can_reorder || reorderM.isPending}>
                        <RotateCcw />
                        Reorder
                      </Button>
                      <div className="flex flex-wrap gap-2 sm:ml-auto">
                        <Button size="sm" variant="ghost" onClick={() => pay(order.id, "mock_card")} disabled={paymentM.isPending || isPaid}>
                          <CreditCard />
                          Pay by card (test)
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => pay(order.id, "cash_on_delivery")} disabled={paymentM.isPending || isPaid}>
                          <WalletCards />
                          Cash on delivery
                        </Button>
                      </div>
                    </CardFooter>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function InfoTile({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof ReceiptText;
  label: string;
  value: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border bg-muted/30 p-3">
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Icon className="size-3.5" />
        {label}
      </div>
      <div className="mt-1 text-sm font-semibold">{value}</div>
      {hint ? <div className="mt-0.5 truncate text-xs text-muted-foreground">{hint}</div> : null}
    </div>
  );
}
