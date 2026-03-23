import { useMemo, useState } from "react";
import { PackagePlus, Search } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/lib/api";
import { formatDateTime, getOrderStatusTone } from "@/lib/format";
import type { Order, Paginated } from "@/types/api";
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

export default function OrdersPage() {
  const queryClient = useQueryClient();
  const [dropoffAddress, setDropoffAddress] = useState("Tbilisi Center");
  const [dropoffLat, setDropoffLat] = useState("41.7151");
  const [dropoffLng, setDropoffLng] = useState("44.8271");
  const [search, setSearch] = useState("");

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
      const code = order.code.toLowerCase();
      const address = (order.dropoff_address ?? "").toLowerCase();
      const status = order.status.toLowerCase();
      return code.includes(text) || address.includes(text) || status.includes(text);
    });
  }, [ordersQ.data?.data, search]);

  return (
    <div className="grid gap-6">
      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <Card className="rounded-[30px] bg-[linear-gradient(135deg,_rgba(251,191,36,0.16),_rgba(255,255,255,0.96)),linear-gradient(180deg,_#fffefc_0%,_#fff7eb_100%)]">
          <CardHeader>
            <CardTitle className="font-display text-3xl">Create an order</CardTitle>
            <p className="text-sm text-slate-600">
              Manual order creation for dispatch testing and operational entry.
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

            <Button
              className="h-12 rounded-2xl"
              onClick={() => createOrderM.mutate()}
              disabled={createOrderM.isPending}
            >
              <PackagePlus className="mr-2 h-4 w-4" />
              {createOrderM.isPending ? "Creating..." : "Create order"}
            </Button>
          </CardContent>
        </Card>

        <Card className="rounded-[30px]">
          <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle className="font-display text-3xl">Order queue</CardTitle>
              <p className="mt-1 text-sm text-slate-600">
                Search by order code, address, or current status.
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
              <div className="text-sm text-red-700">Failed to load orders from `/api/orders`.</div>
            ) : (
              <div className="overflow-hidden rounded-[24px] border border-slate-200/80">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Code</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Dropoff</TableHead>
                      <TableHead>Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredOrders.map((order) => (
                      <TableRow key={order.id}>
                        <TableCell className="font-semibold text-slate-950">{order.code}</TableCell>
                        <TableCell>
                          <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusBadgeClass(order.status)}`}>
                            {order.status}
                          </span>
                        </TableCell>
                        <TableCell>{order.dropoff_address || "No address set"}</TableCell>
                        <TableCell>{formatDateTime(order.created_at)}</TableCell>
                      </TableRow>
                    ))}
                    {filteredOrders.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="py-8 text-center text-sm text-slate-500">
                          No orders match your search.
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
