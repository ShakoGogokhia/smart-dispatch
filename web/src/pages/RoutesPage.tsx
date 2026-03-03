import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type RouteStop = {
  id: number;
  order_id: number;
  sequence: number;
  status: string;
  eta?: string | null;
  order?: { code: string; dropoff_address?: string | null };
};

type RoutePlan = {
  id: number;
  driver_id: number;
  route_date: string;
  status: string;
  planned_distance_km?: string | number | null;
  planned_duration_min?: string | number | null;
  driver?: { id: number; user?: { name: string } };
  stops?: RouteStop[];
};

export default function RoutesPage() {
  const routesQ = useQuery({
    queryKey: ["routes"],
    queryFn: async () => {
      const res = await api.get("/api/live/routes");
      return res.data as RoutePlan[];
    },
  });

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Routes</CardTitle>
        </CardHeader>
        <CardContent>
          {routesQ.isLoading && <div>Loading...</div>}
          {routesQ.error && (
            <div className="text-red-600">
              Failed to load routes. (Do you have GET /api/routes?)
            </div>
          )}

          {routesQ.data && routesQ.data.length === 0 && (
            <div className="text-sm text-muted-foreground">
              No routes yet. Run planning/commit on backend first.
            </div>
          )}

          {routesQ.data?.map((r) => (
            <Card key={r.id} className="mb-4">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">
                  Route #{r.id} — Driver {r.driver?.user?.name ?? r.driver_id}
                </CardTitle>
                <Badge variant="secondary">{r.status}</Badge>
              </CardHeader>
              <CardContent className="grid gap-3">
                <div className="text-sm text-muted-foreground">
                  Date: {r.route_date}
                  {r.planned_distance_km != null && ` • Distance: ${r.planned_distance_km}km`}
                  {r.planned_duration_min != null && ` • Duration: ${r.planned_duration_min}min`}
                </div>

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>Order</TableHead>
                      <TableHead>Address</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>ETA</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(r.stops ?? []).map((s) => (
                      <TableRow key={s.id}>
                        <TableCell className="font-medium">{s.sequence}</TableCell>
                        <TableCell>{s.order?.code ?? s.order_id}</TableCell>
                        <TableCell>{s.order?.dropoff_address ?? "-"}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{s.status}</Badge>
                        </TableCell>
                        <TableCell>{s.eta ? new Date(s.eta).toLocaleString() : "-"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}