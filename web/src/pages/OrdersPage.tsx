import { useMemo, useState } from "react";
import { MessageSquareMore, PackagePlus, Search, Sparkles, Star, Undo2, XCircle, Zap } from "lucide-react";
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

export default function OrdersPage() {
  const meQ = useMe();
  const { language } = useI18n();
  const text = copy[language];
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

          <div className="mt-8 data-grid">
            <Metric title={text.visibleOrders} value={filteredOrders.length} />
            <Metric title={text.marketPending} value={marketPendingCount} />
            <Metric title={text.inDriverFlow} value={driverFlowCount} />
            <Metric title={text.delivered} value={deliveredCount} />
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
        <div className="grid gap-4">
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
          <CardHeader>
            <CardTitle className="panel-title">Operations orders</CardTitle>
          </CardHeader>
          <CardContent>
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
                        <div className="flex flex-wrap gap-2">
                          <Button size="sm" variant="secondary" onClick={() => setSelectedOrderId(order.id)}>{text.detail}</Button>
                          {order.status === "MARKET_PENDING" && <Button size="sm" onClick={() => marketActionM.mutate({ orderId: order.id, action: "market-accept" })}>Accept</Button>}
                          {order.status === "MARKET_ACCEPTED" && <Button size="sm" onClick={() => marketActionM.mutate({ orderId: order.id, action: "mark-ready" })}>Mark ready</Button>}
                        </div>
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
        <DialogContent className="max-w-4xl rounded-[28px] border border-slate-200 bg-white p-0 dark:border-white/10 dark:bg-slate-950">
          <DialogHeader className="border-b border-slate-200 px-6 py-5 dark:border-white/10">
            <DialogTitle className="panel-title">{detailOrder?.code || "Order detail"}</DialogTitle>
            <DialogDescription>{detailOrder?.dropoff_address || text.noAddress}</DialogDescription>
          </DialogHeader>
          <div className="grid max-h-[80vh] gap-6 overflow-auto p-6 xl:grid-cols-[1.05fr_0.95fr]">
            <div className="grid gap-4">
              <div className="grid gap-4 md:grid-cols-2">
                <InfoCard label={text.eta} value={formatDateTime(detailOrder?.eta_summary?.estimated_delivery_at)} />
                <InfoCard label={text.promised} value={formatDateTime(detailOrder?.eta_summary?.promised_at)} />
              </div>

              <Card>
                <CardHeader><CardTitle>{text.timeline}</CardTitle></CardHeader>
                <CardContent className="grid gap-3">
                  {(detailOrder?.timeline ?? []).map((step) => (
                    <div key={step.key} className="flex items-start justify-between gap-3 rounded-[18px] border border-slate-200 px-4 py-3">
                      <div>
                        <div className="font-semibold text-slate-950">{step.label}</div>
                        <div className="text-sm text-slate-500">{formatDateTime(step.at)}</div>
                      </div>
                      <Badge className={`status-chip ${step.done ? "status-good" : "status-neutral"}`}>{step.done ? "Done" : "Pending"}</Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {detailOrder?.assigned_driver?.latest_ping && detailOrder?.status === "PICKED_UP" && (
                <div className="map-frame h-[320px]">
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
              )}
            </div>

            <div className="grid gap-4">
              <Card>
                <CardHeader><CardTitle>{text.proof}</CardTitle></CardHeader>
                <CardContent className="grid gap-3">
                  {detailOrder?.delivery_proof?.photo_url ? (
                    <img src={detailOrder.delivery_proof.photo_url} alt="Proof of delivery" className="h-52 w-full rounded-[20px] object-cover" />
                  ) : null}
                  <div className="text-sm text-slate-600">{detailOrder?.delivery_proof?.note || text.proofMissing}</div>
                  {detailOrder?.eta_summary?.is_late && <div className="status-chip status-bad">{text.late}</div>}
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle>{text.rate}</CardTitle></CardHeader>
                <CardContent className="grid gap-3">
                  <div className="field-group">
                    <Label className="field-label">{text.rating}</Label>
                    <Input value={rating} onChange={(event) => setRating(event.target.value)} className="input-shell" />
                  </div>
                  <div className="field-group">
                    <Label className="field-label">{text.feedback}</Label>
                    <Input value={feedback} onChange={(event) => setFeedback(event.target.value)} className="input-shell" />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button onClick={() => detailOrder && rateM.mutate(detailOrder.id)} disabled={!detailOrder?.actions?.can_rate || rateM.isPending}>
                      <Star className="h-4 w-4" />
                      {text.submit}
                    </Button>
                    <Button variant="secondary" onClick={() => detailOrder && reorderM.mutate(detailOrder.id)} disabled={!detailOrder?.actions?.can_reorder || reorderM.isPending}>
                      <Undo2 className="h-4 w-4" />
                      {text.reorder}
                    </Button>
                    <Button variant="secondary" onClick={() => detailOrder && cancelM.mutate(detailOrder.id)} disabled={!detailOrder?.actions?.can_cancel || cancelM.isPending}>
                      <XCircle className="h-4 w-4" />
                      {text.cancel}
                    </Button>
                  </div>
                  <div className="field-group">
                    <Label className="field-label">{text.reason}</Label>
                    <Input value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} className="input-shell" />
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
          <DialogFooter className="border-t border-slate-200 px-6 py-4 dark:border-white/10">
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
    <Card>
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
          <InfoCard label={text.createdLabel} value={formatDateTime(order.created_at)} />
          <InfoCard label={text.market} value={order.market?.name || "-"} />
          <InfoCard label={text.driver} value={order.assigned_driver?.user?.name || order.offered_driver?.user?.name || text.waitingForDriver} />
          <InfoCard label={text.eta} value={formatDateTime(order.eta_summary?.estimated_delivery_at)} />
        </div>

        <div className="grid gap-3">
          {(order.timeline ?? []).slice(0, 3).map((step) => (
            <div key={step.key} className="flex items-center justify-between rounded-[18px] border border-slate-200 px-4 py-3 text-sm">
              <span>{step.label}</span>
              <span className="text-slate-500">{formatDateTime(step.at)}</span>
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

function Metric({ title, value }: { title: string; value: number }) {
  return (
    <div className="metric-block">
      <div className="section-kicker">{title}</div>
      <div className="font-display theme-ink mt-3 text-5xl font-semibold tracking-[-0.05em]">{value}</div>
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric-block py-4">
      <div className="section-kicker">{label}</div>
      <div className="theme-ink mt-2 text-sm font-semibold">{value}</div>
    </div>
  );
}
