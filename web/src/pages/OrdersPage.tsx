import { useMemo, useState } from "react";
import { Clock3, MapPin, MessageSquareMore, PackagePlus, Search, Sparkles, Star, Truck, Undo2, UserRound, Wallet, XCircle, Zap } from "lucide-react";
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
import { useI18n } from "@/lib/i18n";
import { repairMojibake } from "@/lib/text";
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

const copy = {
  en: {
    customerDesk: "Customer order desk",
    customerHeroTitle: "Your ETA, proof of delivery, and reorder flow in one calm timeline.",
    customerHeroText: "Track the order state, inspect delivery proof, cancel early-stage orders, and rate completed deliveries without leaving the list.",
    commandBoard: "Orders command board",
    opsHeroTitle: "A cleaner dispatch board for intake, fulfillment, and customer follow-up.",
    opsHeroText: "Dispatch can now see ETA signals, open richer order detail, and hand customers a cleaner delivery experience.",
    createOpsOrder: "Create ops order",
    createOpsText: "Manual order intake for call center or dispatch scenarios.",
    detail: "Open detail",
    noAddress: "No address set",
    noOrders: "You have not placed any orders yet.",
    noResults: "No orders matched your search.",
    loading: "Loading orders...",
    failed: "Failed to load orders.",
    search: "Search orders",
    eta: "ETA",
    promised: "Promised",
    timeline: "Timeline",
    proof: "Delivery proof",
    rate: "Rate delivery",
    cancel: "Cancel order",
    reorder: "Reorder",
    reason: "Cancellation reason",
    feedback: "Feedback",
    rating: "Rating (1-5)",
    submit: "Submit",
    close: "Close",
    created: "Created",
    waitingForDriver: "Waiting for driver",
    inDeliveryFlow: "In delivery flow",
    marketPending: "Market pending",
    visibleOrders: "Visible orders",
    delivered: "Delivered",
    inDriverFlow: "In driver flow",
    late: "Late",
    proofMissing: "No delivery proof has been attached yet.",
    tracking: "Live driver tracking",
    trackingCopy: "Tracking appears after pickup so the timeline stays signal-first.",
    createdLabel: "Created",
    customer: "Customer",
    driver: "Driver",
    market: "Market",
    total: "Total",
  },
  ka: {
    customerDesk: "მომხმარებლის შეკვეთები",
    customerHeroTitle: "ETA, მიწოდების დადასტურება და ხელახალი შეკვეთა ერთ სუფთა timeline-ში.",
    customerHeroText: "ნახეთ შეკვეთის სტატუსი, დადასტურება, გააუქმეთ ადრეულ ეტაპზე და შეაფასეთ დასრულებული მიწოდება უშუალოდ ამ სიიდან.",
    commandBoard: "შეკვეთების დაფა",
    opsHeroTitle: "უფრო სუფთა დისპეტჩერის დაფა მიღებისთვის, შესრულებისთვის და მომხმარებელთან შემდგომი კომუნიკაციისთვის.",
    opsHeroText: "ოპერაციები ახლა ხედავს ETA-ს, დეტალურ შეკვეთას და მომხმარებლისთვის უკეთეს მიწოდების გამოცდილებას.",
    createOpsOrder: "ოპერატორის შეკვეთა",
    createOpsText: "ხელით მიღება ქოლ-ცენტრის ან დისპეტჩერის სცენარებისთვის.",
    detail: "დეტალის გახსნა",
    noAddress: "მისამართი არ არის მითითებული",
    noOrders: "ჯერ შეკვეთა არ გაგიკეთებიათ.",
    noResults: "შედეგი ვერ მოიძებნა.",
    loading: "შეკვეთები იტვირთება...",
    failed: "შეკვეთების ჩატვირთვა ვერ მოხერხდა.",
    search: "შეკვეთების ძებნა",
    eta: "ETA",
    promised: "დაპირებული დრო",
    timeline: "ტაიმლაინი",
    proof: "მიწოდების დადასტურება",
    rate: "მიწოდების შეფასება",
    cancel: "შეკვეთის გაუქმება",
    reorder: "ხელახლა შეკვეთა",
    reason: "გაუქმების მიზეზი",
    feedback: "კომენტარი",
    rating: "შეფასება (1-5)",
    submit: "გაგზავნა",
    close: "დახურვა",
    created: "შექმნილი",
    waitingForDriver: "მძღოლს ელოდება",
    inDeliveryFlow: "მიწოდების პროცესში",
    marketPending: "ბაზარს ელოდება",
    visibleOrders: "ხილული შეკვეთები",
    delivered: "მიწოდებული",
    inDriverFlow: "მძღოლის პროცესში",
    late: "აგვიანებს",
    proofMissing: "მიწოდების დადასტურება ჯერ არ არის დამატებული.",
    tracking: "მძღოლის ცოცხალი ტრეკინგი",
    trackingCopy: "ტრეკინგი ჩნდება აყვანის შემდეგ, რათა ეკრანი მკაფიო დარჩეს.",
    createdLabel: "შექმნილი",
    customer: "მომხმარებელი",
    driver: "მძღოლი",
    market: "ბაზარი",
    total: "ჯამი",
  },
} as const;

type PageCopy = Record<keyof (typeof copy)["en"], string>;

function getPageCopy(language: "en" | "ka"): PageCopy {
  const source = copy[language];
  if (language !== "ka") {
    return source;
  }

  return Object.fromEntries(Object.entries(source).map(([key, value]) => [key, repairMojibake(value)])) as PageCopy;
}

export default function OrdersPage() {
  const meQ = useMe();
  const { language } = useI18n();
  const text = getPageCopy(language);
  const queryClient = useQueryClient();
  const [dropoffAddress, setDropoffAddress] = useState("Tbilisi Center");
  const [dropoffLat, setDropoffLat] = useState("41.7151");
  const [dropoffLng, setDropoffLng] = useState("44.8271");
  const [search, setSearch] = useState("");
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [rating, setRating] = useState("5");
  const [feedback, setFeedback] = useState("");

  const roles = meQ.data?.roles ?? [];
  const isCustomerOnly =
    roles.includes("customer") && !roles.some((role: string) => ["admin", "owner", "staff", "driver"].includes(role));
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
    mutationFn: async (orderId: number) => (await api.post(`/api/orders/${orderId}/request-cancel`, { reason: cancelReason || null })).data,
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
  const driverFlowCount = filteredOrders.filter((order) => ["READY_FOR_PICKUP", "OFFERED", "ASSIGNED", "PICKED_UP"].includes(order.status)).length;
  const detailOrder = detailQ.data;

  const errorMessage =
    getErrorMessage(createOrderM.error) ||
    getErrorMessage(marketActionM.error) ||
    getErrorMessage(cancelM.error) ||
    getErrorMessage(reorderM.error) ||
    getErrorMessage(rateM.error);

  return (
    <div className="grid gap-6">
      <section className="hero-grid">
        <div className="hero-panel">
          <div className="command-chip">
            {isCustomerOnly ? <Sparkles className="h-3.5 w-3.5" /> : <Zap className="h-3.5 w-3.5" />}
            {isCustomerOnly ? text.customerDesk : text.commandBoard}
          </div>
          <h1 className="font-display mt-5 text-5xl font-semibold tracking-[-0.06em] text-white md:text-6xl">
            {isCustomerOnly ? text.customerHeroTitle : text.opsHeroTitle}
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-8 text-slate-300">
            {isCustomerOnly ? text.customerHeroText : text.opsHeroText}
          </p>

          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Metric title={text.visibleOrders} value={filteredOrders.length} helper={isCustomerOnly ? text.timeline : text.search} />
            <Metric title={text.marketPending} value={marketPendingCount} helper={text.market} />
            <Metric title={text.inDriverFlow} value={driverFlowCount} helper={text.driver} />
            <Metric title={text.delivered} value={deliveredCount} helper={text.proof} />
          </div>
        </div>

        <div className="grid gap-4">
          {!isCustomerOnly && isOpsUser && (
            <Card>
              <CardHeader>
                <CardTitle className="panel-title">{text.createOpsOrder}</CardTitle>
                <p className="panel-copy">{text.createOpsText}</p>
              </CardHeader>
              <CardContent className="grid gap-4">
                <div className="field-group">
                  <Label className="field-label">Address</Label>
                  <Input value={dropoffAddress} onChange={(event) => setDropoffAddress(event.target.value)} className="input-shell" />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="field-group">
                    <Label className="field-label">Latitude</Label>
                    <Input value={dropoffLat} onChange={(event) => setDropoffLat(event.target.value)} className="input-shell" />
                  </div>
                  <div className="field-group">
                    <Label className="field-label">Longitude</Label>
                    <Input value={dropoffLng} onChange={(event) => setDropoffLng(event.target.value)} className="input-shell" />
                  </div>
                </div>
                <Button className="h-12" onClick={() => createOrderM.mutate()} disabled={createOrderM.isPending}>
                  <PackagePlus className="h-4 w-4" />
                  {createOrderM.isPending ? "Creating..." : "Create order"}
                </Button>
              </CardContent>
            </Card>
          )}

          <div className="frost-panel p-5">
            <div className="section-kicker">{text.search}</div>
            <div className="relative mt-3">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={text.search} className="input-shell pl-11" />
            </div>
            {errorMessage && <div className="mt-4 rounded-[18px] border border-rose-300/20 bg-rose-50 px-4 py-3 text-sm text-rose-700">{errorMessage}</div>}
          </div>
        </div>
      </section>

      {ordersQ.isLoading ? (
        <Card><CardContent className="p-8 text-sm text-slate-600">{text.loading}</CardContent></Card>
      ) : ordersQ.isError ? (
        <Card><CardContent className="p-8 text-sm text-rose-700">{text.failed}</CardContent></Card>
      ) : filteredOrders.length === 0 ? (
        <Card><CardContent className="p-8 text-sm text-slate-600">{isCustomerOnly ? text.noOrders : text.noResults}</CardContent></Card>
      ) : isCustomerOnly ? (
        <div className="grid gap-5">
          {filteredOrders.map((order) => (
            <CustomerOrderCard
              key={order.id}
              order={order}
              text={text}
              onOpenDetail={() => setSelectedOrderId(order.id)}
              onCancel={() => cancelM.mutate(order.id)}
              onReorder={() => reorderM.mutate(order.id)}
            />
          ))}
        </div>
      ) : (
        <Card>
          <CardHeader className="border-b border-slate-200/80 dark:border-white/10">
            <CardTitle className="panel-title">Operations orders</CardTitle>
            <p className="panel-copy">Readable intake, owner review, and next-step actions in one place.</p>
          </CardHeader>
          <CardContent className="grid gap-5 pt-6">
            <div className="mobile-stack-table gap-5">
              {filteredOrders.map((order) => (
                <Card key={order.id} className="mobile-record border-slate-200/80 bg-white/96 py-0 shadow-[0_16px_38px_rgba(15,23,42,0.06)] dark:border-white/10 dark:bg-[#131d2b]">
                  <CardContent className="grid gap-4 p-5">
                    <div className="flex flex-col gap-3">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="section-kicker">{order.market?.code || "ORD"}</div>
                          <div className="theme-ink mt-2 text-xl font-semibold">{order.code}</div>
                          <div className="theme-muted mt-1 text-sm">{order.dropoff_address || text.noAddress}</div>
                        </div>
                        <span className={`status-chip ${statusBadgeClass(order.status)}`}>{formatOrderStatus(order.status)}</span>
                      </div>
                      <div className="mobile-record-row">
                        <span className="mobile-record-label">{text.market}</span>
                        <span className="theme-copy text-right">{order.market?.name || "Direct order"}</span>
                      </div>
                      <div className="mobile-record-row">
                        <span className="mobile-record-label">{text.customer}</span>
                        <span className="theme-copy text-right">{order.customer_name || order.customer?.name || "Unknown"}</span>
                      </div>
                      <div className="mobile-record-row">
                        <span className="mobile-record-label">{text.driver}</span>
                        <span className="theme-copy text-right">{order.assigned_driver?.user?.name || order.offered_driver?.user?.name || "Unassigned"}</span>
                      </div>
                      <div className="mobile-record-row">
                        <span className="mobile-record-label">{text.total}</span>
                        <span className="theme-copy text-right">{order.total != null ? formatMoney(order.total) : "-"}</span>
                      </div>
                      <div className="mobile-record-row">
                        <span className="mobile-record-label">{text.eta}</span>
                        <span className="theme-copy text-right">{formatDateTime(order.eta_summary?.estimated_delivery_at)}</span>
                      </div>
                    </div>

                    <OrderActionRow
                      order={order}
                      detailLabel={text.detail}
                      onOpenDetail={() => setSelectedOrderId(order.id)}
                      onAccept={() => marketActionM.mutate({ orderId: order.id, action: "market-accept" })}
                      onMarkReady={() => marketActionM.mutate({ orderId: order.id, action: "mark-ready" })}
                    />
                  </CardContent>
                </Card>
              ))}
            </div>
            <div className="table-desktop table-shell">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>{text.market}</TableHead>
                    <TableHead>{text.customer}</TableHead>
                    <TableHead>{text.driver}</TableHead>
                    <TableHead>{text.total}</TableHead>
                    <TableHead>{text.eta}</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOrders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="font-semibold">{order.code}</TableCell>
                      <TableCell><span className={`status-chip ${statusBadgeClass(order.status)}`}>{formatOrderStatus(order.status)}</span></TableCell>
                      <TableCell>{order.market?.name || "Direct order"}</TableCell>
                      <TableCell>{order.customer_name || order.customer?.name || "Unknown"}</TableCell>
                      <TableCell>{order.assigned_driver?.user?.name || order.offered_driver?.user?.name || "Unassigned"}</TableCell>
                      <TableCell>{order.total != null ? formatMoney(order.total) : "-"}</TableCell>
                      <TableCell>{formatDateTime(order.eta_summary?.estimated_delivery_at)}</TableCell>
                      <TableCell>
                        <OrderActionRow
                          order={order}
                          detailLabel={text.detail}
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
        <DialogContent className="grid-rows-[auto_minmax(0,1fr)_auto] gap-0 rounded-[30px] border border-slate-200/80 bg-[#f8f6f0] p-0 dark:border-white/10 dark:bg-[#0d1420]">
          <DialogHeader className="shrink-0 border-b border-slate-200 bg-white/92 px-6 py-5 text-left dark:border-white/10 dark:bg-[#131d2b]">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <div className="section-kicker">{detailOrder?.market?.code || "ORD"}</div>
                <DialogTitle className="panel-title mt-2">{detailOrder?.code || "Order detail"}</DialogTitle>
                <DialogDescription className="theme-copy mt-2 pr-10 text-sm leading-6">{detailOrder?.dropoff_address || text.noAddress}</DialogDescription>
              </div>
              {detailOrder ? (
                <div className="flex flex-wrap gap-2">
                  <Badge className={`status-chip ${statusBadgeClass(detailOrder.status)}`}>{formatOrderStatus(detailOrder.status)}</Badge>
                  <Badge className="status-chip status-neutral">{detailOrder.total != null ? formatMoney(detailOrder.total) : "-"}</Badge>
                  {detailOrder.eta_summary?.is_late && <Badge className="status-chip status-bad">{text.late}</Badge>}
                </div>
              ) : null}
            </div>
          </DialogHeader>
          <div className="min-h-0 overflow-y-auto overscroll-contain">
            {detailOrder ? (
              <div className="grid min-h-full gap-0 xl:grid-cols-[380px_minmax(0,1fr)]">
                <aside className="border-b border-slate-200 bg-white/94 p-5 xl:border-b-0 xl:border-r dark:border-white/10 dark:bg-[#131d2b]">
                  <div className="grid gap-4 xl:sticky xl:top-0">
                    <div className="grid gap-3">
                      <DetailStat icon={Clock3} label={text.eta} value={formatDateTime(detailOrder.eta_summary?.estimated_delivery_at)} />
                      <DetailStat icon={Wallet} label={text.total} value={detailOrder.total != null ? formatMoney(detailOrder.total) : "-"} />
                      <DetailStat icon={Truck} label={text.driver} value={detailOrder.assigned_driver?.user?.name || detailOrder.offered_driver?.user?.name || text.waitingForDriver} />
                      <DetailStat icon={UserRound} label={text.customer} value={detailOrder.customer_name || detailOrder.customer?.name || "Unknown"} />
                    </div>

                    <div className="rounded-[24px] border border-slate-200 bg-[#f7f4ec] p-4 dark:border-white/10 dark:bg-[#0f1825]">
                      <div className="section-kicker">{text.rate}</div>
                      <div className="mt-4 grid gap-4">
                        <div className="field-group">
                          <Label className="field-label">{text.rating}</Label>
                          <Input value={rating} onChange={(event) => setRating(event.target.value)} className="input-shell" />
                        </div>
                        <div className="field-group">
                          <Label className="field-label">{text.feedback}</Label>
                          <Input value={feedback} onChange={(event) => setFeedback(event.target.value)} className="input-shell" />
                        </div>
                        <div className="field-group">
                          <Label className="field-label">{text.reason}</Label>
                          <Input value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} className="input-shell" />
                        </div>
                        <div className="grid gap-2">
                          <Button onClick={() => rateM.mutate(detailOrder.id)} disabled={!detailOrder.actions?.can_rate || rateM.isPending}>
                            <Star className="h-4 w-4" />
                            {text.submit}
                          </Button>
                          <Button variant="secondary" onClick={() => reorderM.mutate(detailOrder.id)} disabled={!detailOrder.actions?.can_reorder || reorderM.isPending}>
                            <Undo2 className="h-4 w-4" />
                            {text.reorder}
                          </Button>
                          <Button variant="secondary" onClick={() => cancelM.mutate(detailOrder.id)} disabled={!detailOrder.actions?.can_cancel || cancelM.isPending}>
                            <XCircle className="h-4 w-4" />
                            {text.cancel}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </aside>

                <main className="grid gap-5 p-5 sm:p-6">
                  <section className="grid gap-4 lg:grid-cols-2">
                    <FlatDetailRow icon={MapPin} label={text.market} value={detailOrder.market?.name || "Direct order"} />
                    <FlatDetailRow icon={Clock3} label={text.createdLabel} value={formatDateTime(detailOrder.created_at)} />
                    <FlatDetailRow icon={MapPin} label="Dropoff" value={detailOrder.dropoff_address || text.noAddress} fullWidth />
                    <FlatDetailRow icon={MapPin} label="Pickup" value={detailOrder.pickup_address || text.noAddress} fullWidth />
                    <FlatDetailRow icon={MessageSquareMore} label="Notes" value={detailOrder.notes || "-"} fullWidth />
                  </section>

                  <section className="rounded-[28px] border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-[#131d2b]">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="section-kicker">{text.timeline}</div>
                        <h3 className="theme-ink mt-2 text-2xl font-semibold">Order progress</h3>
                      </div>
                      <div className="theme-muted max-w-sm text-right text-sm leading-6">{text.trackingCopy}</div>
                    </div>
                    <div className="mt-5 grid gap-3">
                      {(detailOrder.timeline ?? []).map((step, index) => (
                        <div key={step.key} className="grid gap-3 rounded-[20px] border border-slate-200 bg-[#f7f4ec] p-4 dark:border-white/10 dark:bg-[#0f1825] sm:grid-cols-[44px_minmax(0,1fr)_auto] sm:items-center">
                          <div className={`flex h-11 w-11 items-center justify-center rounded-full text-sm font-semibold ${step.done ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-300/12 dark:text-emerald-100" : "bg-slate-200 text-slate-700 dark:bg-white/10 dark:text-slate-200"}`}>
                            {index + 1}
                          </div>
                          <div className="min-w-0">
                            <div className="theme-ink text-base font-semibold">{step.label}</div>
                            <div className="theme-muted mt-1 text-sm">{formatDateTime(step.at)}</div>
                          </div>
                          <Badge className={`status-chip ${step.done ? "status-good" : "status-neutral"}`}>{step.done ? "Done" : "Pending"}</Badge>
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
                    <div className="rounded-[28px] border border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-[#131d2b]">
                      <div className="section-kicker">{text.proof}</div>
                      <h3 className="theme-ink mt-2 text-2xl font-semibold">Delivery proof</h3>
                      <div className="mt-5 grid gap-4">
                        {detailOrder.delivery_proof?.photo_url ? (
                          <img src={detailOrder.delivery_proof.photo_url} alt="Proof of delivery" className="h-72 w-full rounded-[24px] object-cover" />
                        ) : (
                          <div className="flex min-h-52 items-center justify-center rounded-[24px] border border-dashed border-slate-300 bg-[#f7f4ec] px-5 text-center text-sm text-slate-500 dark:border-white/12 dark:bg-[#0f1825] dark:text-slate-300">
                            {text.proofMissing}
                          </div>
                        )}
                        <div className="rounded-[20px] border border-slate-200 bg-[#f7f4ec] px-4 py-4 text-sm leading-7 text-slate-700 dark:border-white/10 dark:bg-[#0f1825] dark:text-slate-200">
                          {detailOrder.delivery_proof?.note || text.proofMissing}
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-5">
                      {detailOrder.assigned_driver?.latest_ping && detailOrder.status === "PICKED_UP" && (
                        <div className="rounded-[28px] border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-[#131d2b]">
                          <div className="section-kicker">{text.tracking}</div>
                          <div className="theme-muted mt-2 text-sm leading-6">{text.trackingCopy}</div>
                          <div className="map-frame mt-4 h-[260px]">
                            <MapContainer
                              center={[Number(detailOrder.assigned_driver.latest_ping.lat), Number(detailOrder.assigned_driver.latest_ping.lng)]}
                              zoom={13}
                              style={{ height: "100%", width: "100%" }}
                            >
                              <TileLayer attribution="&copy; OpenStreetMap" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                              <Marker position={[Number(detailOrder.assigned_driver.latest_ping.lat), Number(detailOrder.assigned_driver.latest_ping.lng)]} />
                              <Marker position={[Number(detailOrder.dropoff_lat), Number(detailOrder.dropoff_lng)]} />
                            </MapContainer>
                          </div>
                        </div>
                      )}
                      {detailOrder.eta_summary?.is_late && (
                        <div className="rounded-[24px] border border-rose-200 bg-rose-50 p-5 dark:border-rose-300/20 dark:bg-rose-300/10">
                          <div className="section-kicker text-rose-600 dark:text-rose-200">{text.late}</div>
                          <div className="mt-2 text-lg font-semibold text-rose-700 dark:text-rose-100">This order needs attention.</div>
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
                <div className="rounded-[24px] border border-slate-200 bg-white px-6 py-10 text-center text-sm text-slate-600 dark:border-white/10 dark:bg-[#131d2b] dark:text-slate-300">
                  Loading order detail...
                </div>
              </div>
            )}
          </div>
          <DialogFooter className="shrink-0 border-t border-slate-200 bg-slate-50/90 px-6 py-4 dark:border-white/10 dark:bg-white/4">
            <Button variant="secondary" onClick={() => setSelectedOrderId(null)}>{text.close}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CustomerOrderCard({
  order,
  text,
  onOpenDetail,
  onCancel,
  onReorder,
}: {
  order: Order;
  text: PageCopy;
  onOpenDetail: () => void;
  onCancel: () => void;
  onReorder: () => void;
}) {
  return (
    <Card className="border-slate-200/80 bg-white/98 shadow-[0_18px_44px_rgba(15,23,42,0.06)] dark:border-white/10 dark:bg-[#131d2b]">
      <CardContent className="grid gap-5 p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="section-kicker">{order.market?.code || "ORD"}</div>
            <div className="font-display theme-ink mt-2 text-4xl font-semibold tracking-[-0.05em]">{order.code}</div>
            <div className="theme-muted mt-2 text-sm">{order.dropoff_address || text.noAddress}</div>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className={`status-chip ${statusBadgeClass(order.status)}`}>{formatOrderStatus(order.status)}</span>
            {order.total != null && <Badge className="status-chip status-neutral">{formatMoney(order.total)}</Badge>}
            {order.eta_summary?.is_late && <Badge className="status-chip status-bad">{text.late}</Badge>}
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <InfoCard icon={Clock3} label={text.createdLabel} value={formatDateTime(order.created_at)} />
          <InfoCard icon={MapPin} label={text.market} value={order.market?.name || "-"} />
          <InfoCard icon={Truck} label={text.driver} value={order.assigned_driver?.user?.name || order.offered_driver?.user?.name || text.waitingForDriver} />
          <InfoCard icon={Wallet} label={text.eta} value={formatDateTime(order.eta_summary?.estimated_delivery_at)} />
        </div>

        <div className="grid gap-3">
          {(order.timeline ?? []).slice(0, 3).map((step) => (
            <div key={step.key} className="flex items-center justify-between rounded-[18px] border border-slate-200 bg-slate-50/70 px-4 py-3 text-sm dark:border-white/10 dark:bg-white/4">
              <span className="theme-ink font-medium">{step.label}</span>
              <span className="theme-muted">{formatDateTime(step.at)}</span>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={onOpenDetail}><MessageSquareMore className="h-4 w-4" />{text.detail}</Button>
          <Button variant="secondary" onClick={onReorder} disabled={!order.actions?.can_reorder}><Undo2 className="h-4 w-4" />{text.reorder}</Button>
          <Button variant="secondary" onClick={onCancel} disabled={!order.actions?.can_cancel}><XCircle className="h-4 w-4" />{text.cancel}</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function Metric({ title, value, helper }: { title: string; value: number; helper?: string }) {
  return (
    <div className="metric-block min-h-[132px] p-5">
      <div className="section-kicker">{title}</div>
      <div className="font-display theme-ink mt-3 text-5xl font-semibold tracking-[-0.05em]">{value}</div>
      {helper ? <div className="theme-muted mt-2 text-sm">{helper}</div> : null}
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
    <div className="metric-block py-4">
      <div className="flex items-center gap-2">
        {Icon ? <Icon className="h-4 w-4 text-cyan-700 dark:text-cyan-200" /> : null}
        <div className="section-kicker">{label}</div>
      </div>
      <div className="theme-ink mt-3 text-sm font-semibold leading-6">{value}</div>
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
      <Button size="sm" variant="secondary" onClick={onOpenDetail}>
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
    <div className="rounded-[24px] border border-slate-200 bg-[#f7f4ec] p-5 dark:border-white/10 dark:bg-[#0f1825]">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-cyan-700 dark:text-cyan-200" />
        <div className="section-kicker">{label}</div>
      </div>
      <div className="theme-ink mt-4 text-base font-semibold leading-7">{value}</div>
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
    <div className={`rounded-[24px] border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-[#131d2b] ${fullWidth ? "lg:col-span-2" : ""}`}>
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-cyan-700 dark:text-cyan-200" />
        <div className="section-kicker">{label}</div>
      </div>
      <div className="theme-ink mt-3 text-sm font-semibold leading-6">{value}</div>
    </div>
  );
}
