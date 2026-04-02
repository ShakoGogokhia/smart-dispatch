import { CalendarDays, Route, Timer, Truck } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type RouteStop = {
  id: number;
  order_id: number;
  sequence: number;
  status: string;
  eta?: string | null;
  dispatch_score?: number;
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
    queryKey: ["live-routes"],
    queryFn: async () => (await api.get("/api/live/routes")).data as RoutePlan[],
  });

  const routes = routesQ.data ?? [];

  return (
    <div className="grid gap-6">
      <div className="intro-panel">
        <h1 className="intro-title">Routes</h1>
      </div>

      {routesQ.isLoading ? (
        <Card className="rounded-[30px]">
          <CardContent className="p-8 text-sm theme-copy">Loading routes...</CardContent>
        </Card>
      ) : routesQ.isError ? (
        <Card className="rounded-[30px]">
          <CardContent className="status-bad m-6 rounded-[20px] border p-8 text-sm">Failed to load routes.</CardContent>
        </Card>
      ) : routes.length === 0 ? (
        <Card className="rounded-[30px]">
          <CardContent className="p-8 text-sm theme-copy">No routes are planned yet.</CardContent>
        </Card>
      ) : (
        routes.map((route) => (
          <Card key={route.id} className="rounded-[30px]">
            <CardHeader className="border-b border-zinc-200/80 dark:border-zinc-800">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <CardTitle className="font-display text-3xl">Route #{route.id}</CardTitle>
                  <div className="theme-copy mt-3 flex flex-wrap gap-3 text-sm">
                    <div className="status-chip status-neutral">
                      <Truck className="h-4 w-4" />
                      {route.driver?.user?.name || `Driver #${route.driver_id}`}
                    </div>
                    <div className="status-chip status-neutral">
                      <CalendarDays className="h-4 w-4" />
                      {route.route_date}
                    </div>
                    {route.planned_distance_km != null && (
                      <div className="status-chip status-neutral">
                        <Route className="h-4 w-4" />
                        {route.planned_distance_km} km
                      </div>
                    )}
                    {route.planned_duration_min != null && (
                      <div className="status-chip status-neutral">
                        <Timer className="h-4 w-4" />
                        {route.planned_duration_min} min
                      </div>
                    )}
                  </div>
                </div>
                <Badge className="status-chip rounded-full border-0 bg-cyan-600 px-4 py-2 text-white shadow-[0_14px_30px_rgba(8,145,178,0.2)]">
                  {route.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="table-shell">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Stop</TableHead>
                      <TableHead>Order</TableHead>
                      <TableHead>Address</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>ETA</TableHead>
                      <TableHead>Score</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(route.stops ?? []).map((stop) => (
                      <TableRow key={stop.id}>
                        <TableCell className="font-semibold">{stop.sequence}</TableCell>
                        <TableCell>{stop.order?.code || stop.order_id}</TableCell>
                        <TableCell>{stop.order?.dropoff_address || "No address set"}</TableCell>
                        <TableCell>{stop.status}</TableCell>
                        <TableCell>{formatDateTime(stop.eta)}</TableCell>
                        <TableCell>{stop.dispatch_score ?? "-"}</TableCell>
                      </TableRow>
                    ))}
                    {(route.stops ?? []).length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="py-8 text-center text-sm theme-copy">
                          No stops on this route yet.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
