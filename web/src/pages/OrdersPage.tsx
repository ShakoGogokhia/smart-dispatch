import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Order, Paginated } from "@/types/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";

export default function OrdersPage() {
  const qc = useQueryClient();
  const [dropoff_address, setDropoffAddress] = useState("Tbilisi Center");
  const [dropoff_lat, setLat] = useState("41.7151");
  const [dropoff_lng, setLng] = useState("44.8271");

  const ordersQ = useQuery({
    queryKey: ["orders"],
    queryFn: async () => {
      const res = await api.get("/api/orders");
      return res.data as Paginated<Order>;
    },
  });

  const createM = useMutation({
    mutationFn: async () => {
      await api.post("/orders", {
        dropoff_lat: Number(dropoff_lat),
        dropoff_lng: Number(dropoff_lng),
        dropoff_address,
        priority: 2,
        size: 1,
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["orders"] }),
  });

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Create Order</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid md:grid-cols-3 gap-4">
            <div className="grid gap-2 md:col-span-1">
              <Label>Dropoff address</Label>
              <Input value={dropoff_address} onChange={(e) => setDropoffAddress(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>Lat</Label>
              <Input value={dropoff_lat} onChange={(e) => setLat(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>Lng</Label>
              <Input value={dropoff_lng} onChange={(e) => setLng(e.target.value)} />
            </div>
          </div>
          <Button onClick={() => createM.mutate()} disabled={createM.isPending} className="w-fit">
            {createM.isPending ? "Creating..." : "Create"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Orders</CardTitle>
        </CardHeader>
        <CardContent>
          {ordersQ.isLoading && <div>Loading...</div>}
          {ordersQ.error && <div className="text-red-600">Failed to load orders</div>}

          {ordersQ.data && (
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
                {ordersQ.data.data.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell className="font-medium">{o.code}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{o.status}</Badge>
                    </TableCell>
                    <TableCell>{o.dropoff_address ?? "-"}</TableCell>
                    <TableCell>{new Date(o.created_at).toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}