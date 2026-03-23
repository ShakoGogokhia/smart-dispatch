import { useMemo, useState } from "react";
import { PackagePlus, Search } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AxiosError } from "axios";

import { api } from "@/lib/api";
import { formatDateTime, formatMoney, getOrderStatusTone } from "@/lib/format";
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
  return status?.trim() || "UNKNOWN";
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
            Review your market orders, current delivery status, item list, and assigned driver information.
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
                    <div>Driver: {order.assigned_driver?.user?.name || order.offered_driver?.user?.name || "Waiting for assignment"}</div>
                    {order.items?.length ? (
                      <div>Items: {order.items.map((item) => `${item.name} x${item.qty}`).join(", ")}</div>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    );
  }

  const createError = getErrorMessage(createOrderM.error);

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
                      </TableRow>
                    ))}
                    {filteredOrders.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="py-8 text-center text-sm text-slate-500">
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
