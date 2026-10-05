import { AlertCircle, CalendarDays, ChevronDown, Clock, MapPin, Route, Timer, Truck } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import { EmptyState } from "@/components/app/empty-state";
import { LoadingState } from "@/components/app/loading-state";
import { PageHeader } from "@/components/app/page-header";
import { OrderStatusBadge } from "@/components/app/status-badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { api } from "@/lib/api";
import { formatDateTime } from "@/lib/format";

type RouteStop = {
  id: number;
  order_id: number;
  sequence: number;
  status: string;
  eta?: string | null;
  dispatch_score?: number;
  dispatch_reason?: {
    priority?: number;
    size?: number;
    weather_condition?: string;
    leg_to_pickup_km?: number;
    leg_to_dropoff_km?: number;
    time_window_penalty?: number;
    ready_time_penalty?: number;
  } | null;
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
  const totalStops = routes.reduce((sum, route) => sum + (route.stops?.length ?? 0), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Routes"
        description={
          routes.length > 0
            ? `${routes.length} planned route${routes.length === 1 ? "" : "s"} with ${totalStops} stop${totalStops === 1 ? "" : "s"}. Expand a route to see its stops in delivery order.`
            : "Planned driver routes and the order of their stops."
        }
      />

      {routesQ.isLoading ? (
        <LoadingState rows={3} />
      ) : routesQ.isError ? (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertTitle>Failed to load routes</AlertTitle>
          <AlertDescription>Something went wrong while fetching route plans. Reload the page to try again.</AlertDescription>
        </Alert>
      ) : routes.length === 0 ? (
        <EmptyState icon={Route} title="No routes are planned yet" description="Routes appear here once orders are dispatched and assigned to drivers." />
      ) : (
        <div className="grid gap-4">
          {routes.map((route, index) => (
            <RouteCard key={route.id} route={route} defaultOpen={index === 0} />
          ))}
        </div>
      )}
    </div>
  );
}

function RouteCard({ route, defaultOpen }: { route: RoutePlan; defaultOpen: boolean }) {
  const stops = route.stops ?? [];

  return (
    <Collapsible defaultOpen={defaultOpen} asChild>
      <Card className="gap-4">
        <CardHeader>
          <CardTitle className="text-base font-semibold">Route #{route.id}</CardTitle>
          <CardDescription className="flex flex-wrap gap-x-4 gap-y-1.5">
            <span className="inline-flex items-center gap-1.5">
              <Truck className="size-4" />
              {route.driver?.user?.name || `Driver #${route.driver_id}`}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="size-4" />
              {route.route_date}
            </span>
            <span className="inline-flex items-center gap-1.5 tabular-nums">
              <MapPin className="size-4" />
              {stops.length} stop{stops.length === 1 ? "" : "s"}
            </span>
            {route.planned_distance_km != null && (
              <span className="inline-flex items-center gap-1.5 tabular-nums">
                <Route className="size-4" />
                {route.planned_distance_km} km
              </span>
            )}
            {route.planned_duration_min != null && (
              <span className="inline-flex items-center gap-1.5 tabular-nums">
                <Timer className="size-4" />
                {route.planned_duration_min} min
              </span>
            )}
          </CardDescription>
          <CardAction>
            <OrderStatusBadge status={route.status} />
          </CardAction>
        </CardHeader>

        <CardContent className="grid gap-3">
          <CollapsibleTrigger asChild>
            <Button variant="outline" size="sm" className="group w-fit">
              <ChevronDown className="transition-transform group-data-[state=open]:rotate-180" />
              <span className="group-data-[state=open]:hidden">Show stops</span>
              <span className="hidden group-data-[state=open]:inline">Hide stops</span>
            </Button>
          </CollapsibleTrigger>

          <CollapsibleContent>
            {stops.length === 0 ? (
              <EmptyState compact icon={MapPin} title="No stops on this route yet" />
            ) : (
              <ol className="grid gap-2">
                {stops.map((stop) => (
                  <li key={stop.id} className="flex gap-3 rounded-lg border bg-muted/30 p-3">
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground tabular-nums">
                      {stop.sequence}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold">{stop.order?.code || `Order #${stop.order_id}`}</div>
                          <div className="mt-0.5 truncate text-xs text-muted-foreground">{stop.order?.dropoff_address || "No address set"}</div>
                        </div>
                        <OrderStatusBadge status={stop.status} />
                      </div>
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <Clock className="size-3.5" />
                          ETA {formatDateTime(stop.eta)}
                        </span>
                        <span className="tabular-nums">
                          Score <span className="font-semibold text-foreground">{stop.dispatch_score ?? "-"}</span>
                        </span>
                        {stop.dispatch_reason ? (
                          <span className="tabular-nums">
                            Priority {stop.dispatch_reason.priority ?? "-"} · {stop.dispatch_reason.leg_to_pickup_km ?? 0} km to pickup · {stop.dispatch_reason.weather_condition ?? "clear"}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </CollapsibleContent>
        </CardContent>
      </Card>
    </Collapsible>
  );
}
