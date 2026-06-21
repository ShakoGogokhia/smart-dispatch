import { CreditCard, Clock3, ReceiptText, RotateCcw, Star, WalletCards } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import { formatDateTime, formatMoney, formatOrderStatus } from "@/lib/format";
import type { Order, Paginated } from "@/types/api";

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

  const orders = historyQ.data?.data ?? [];

  return (
    <div className="grid gap-6">
      <div className="intro-panel">
        <h1 className="intro-title">Order history</h1>
      </div>

      {historyQ.isLoading ? (
        <Card className="rounded-[30px]"><CardContent className="p-8 text-sm theme-copy">Loading history...</CardContent></Card>
      ) : orders.length === 0 ? (
        <Card className="rounded-[30px]"><CardContent className="p-8 text-sm theme-copy">No orders yet.</CardContent></Card>
      ) : (
        <div className="grid gap-5">
          {orders.map((order) => (
            <Card key={order.id} className="rounded-[30px]">
              <CardHeader>
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <CardTitle className="text-2xl">{order.code}</CardTitle>
                    <div className="mt-2 text-sm theme-copy">{order.market?.name ?? "Direct order"}</div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge className="status-chip status-neutral">{formatOrderStatus(order.status)}</Badge>
                    <Badge className="status-chip status-good">{formatMoney(order.total ?? 0)}</Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="grid gap-4">
                <div className="grid gap-3 md:grid-cols-3">
                  <HistoryStat icon={Clock3} label="Placed" value={formatDateTime(order.created_at)} />
                  <HistoryStat icon={ReceiptText} label="Receipt" value={order.receipt?.number ?? "Pending"} />
                  <HistoryStat icon={Star} label="Rating" value={order.rating_summary?.rating ? `${order.rating_summary.rating}/5` : "Not rated"} />
                </div>
                <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
                  <div className="text-sm font-semibold text-slate-950 dark:text-white">Receipt</div>
                  <div className="mt-3 grid gap-2 text-sm theme-copy">
                    {(order.receipt?.items ?? []).map((item, index) => (
                      <div key={`${item.name}-${index}`} className="flex justify-between gap-3">
                        <span>{item.name} x{item.qty}</span>
                        <span>{formatMoney(item.line_total ?? 0)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 text-sm font-semibold">Refund: {order.refund_summary?.status ?? "none"}</div>
                  <div className="mt-2 text-sm theme-copy">
                    Payment: {order.receipt?.payment?.status ?? "pending"}
                    {order.receipt?.payment?.reference ? ` - ${order.receipt.payment.reference}` : ""}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" onClick={() => paymentM.mutate({ orderId: order.id, method: "mock_card" })} disabled={paymentM.isPending || order.receipt?.payment?.status === "paid"}>
                    <CreditCard className="h-4 w-4" />
                    Mock card
                  </Button>
                  <Button variant="secondary" onClick={() => paymentM.mutate({ orderId: order.id, method: "cash_on_delivery" })} disabled={paymentM.isPending || order.receipt?.payment?.status === "paid"}>
                    <WalletCards className="h-4 w-4" />
                    Cash
                  </Button>
                  <Button variant="secondary" onClick={() => reorderM.mutate(order.id)} disabled={!order.actions?.can_reorder || reorderM.isPending}>
                    <RotateCcw className="h-4 w-4" />
                    Reorder
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function HistoryStat({ icon: Icon, label, value }: { icon: typeof Clock3; label: string; value: string }) {
  return (
    <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
        <Icon className="h-4 w-4" />
        {label}
      </div>
      <div className="mt-3 text-sm font-semibold">{value}</div>
    </div>
  );
}
