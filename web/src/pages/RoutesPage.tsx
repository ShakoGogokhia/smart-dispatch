import { CalendarDays, Route, Timer, Truck } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  const { t } = useI18n();
  const routesQ = useQuery({
    queryKey: ["live-routes"],
    queryFn: async () => (await api.get("/api/live/routes")).data as RoutePlan[],
  });

  const routes = routesQ.data ?? [];

  return (
    <div className="grid gap-6">
      <div className="intro-panel">
        <div className="section-kicker">{t("nav.routes")}</div>
        <h1 className="intro-title">{t("routes.title")}</h1>
        <p className="intro-copy">{t("routes.introCopy")}</p>
      </div>

      {routesQ.isLoading ? (
        <Card className="rounded-[30px]">
          <CardContent className="p-8 text-sm text-slate-600">{t("routes.loading")}</CardContent>
        </Card>
      ) : routesQ.isError ? (
        <Card className="rounded-[30px]">
          <CardContent className="p-8 text-sm text-red-700">{t("routes.failed")}</CardContent>
        </Card>
      ) : routes.length === 0 ? (
        <Card className="rounded-[30px]">
          <CardContent className="p-8 text-sm text-slate-600">{t("routes.empty")}</CardContent>
        </Card>
      ) : (
        routes.map((route) => (
          <Card key={route.id} className="rounded-[30px]">
            <CardHeader className="border-b border-slate-100">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <CardTitle className="font-display text-3xl">
                    {t("routes.routeNumber", { id: route.id })}
                  </CardTitle>
                  <div className="mt-3 flex flex-wrap gap-3 text-sm text-slate-600">
                    <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5">
                      <Truck className="h-4 w-4" />
                      {route.driver?.user?.name || t("routes.driverNumber", { id: route.driver_id })}
                    </div>
                    <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5">
                      <CalendarDays className="h-4 w-4" />
                      {route.route_date}
                    </div>
                    {route.planned_distance_km != null && (
                      <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5">
                        <Route className="h-4 w-4" />
                        {t("routes.distanceKm", { value: route.planned_distance_km })}
                      </div>
                    )}
                    {route.planned_duration_min != null && (
                      <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5">
                        <Timer className="h-4 w-4" />
                        {t("routes.durationMin", { value: route.planned_duration_min })}
                      </div>
                    )}
                  </div>
                </div>
                <Badge className="rounded-full border-0 bg-slate-950 px-4 py-2 text-white shadow-none">
                  {route.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="overflow-hidden rounded-[24px] border border-slate-200/80">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("routes.stop")}</TableHead>
                      <TableHead>{t("routes.order")}</TableHead>
                      <TableHead>{t("routes.address")}</TableHead>
                      <TableHead>{t("common.status")}</TableHead>
                      <TableHead>{t("routes.eta")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(route.stops ?? []).map((stop) => (
                      <TableRow key={stop.id}>
                        <TableCell className="font-semibold">{stop.sequence}</TableCell>
                        <TableCell>{stop.order?.code || stop.order_id}</TableCell>
                        <TableCell>{stop.order?.dropoff_address || t("orders.noAddress")}</TableCell>
                        <TableCell>{stop.status}</TableCell>
                        <TableCell>{formatDateTime(stop.eta)}</TableCell>
                      </TableRow>
                    ))}
                    {(route.stops ?? []).length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="py-8 text-center text-sm text-slate-500">
                          {t("routes.noStops")}
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
