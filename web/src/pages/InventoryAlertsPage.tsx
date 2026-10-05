import { CheckCircle2, EyeOff, Package, PackageX, TriangleAlert } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { PageHeader } from "@/components/app/page-header";
import { StatCard, StatGrid } from "@/components/app/stat-card";
import { EmptyState } from "@/components/app/empty-state";
import { LoadingState } from "@/components/app/loading-state";
import { StatusBadge } from "@/components/app/status-badge";
import { marketErrorMessage } from "@/components/markets/market-utils";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

type InventoryAlertPayload = {
  market_id: number;
  alerts: Array<{ id: number; name: string; sku: string; stock_qty: number; low_stock_threshold: number; is_active: boolean; severity: "low" | "out" }>;
};

export default function InventoryAlertsPage() {
  const { marketId } = useParams();
  const queryClient = useQueryClient();
  const alertsQ = useQuery({
    queryKey: ["inventory-alerts", marketId],
    queryFn: async () => (await api.get(`/api/markets/${marketId}/inventory-alerts`)).data as InventoryAlertPayload,
    enabled: !!marketId,
  });
  const hideM = useMutation({
    mutationFn: async () => (await api.post(`/api/markets/${marketId}/inventory-alerts/hide-out-of-stock`)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["inventory-alerts", marketId] }),
  });
  const alerts = alertsQ.data?.alerts ?? [];
  const outCount = alerts.filter((item) => item.severity === "out").length;
  const lowCount = alerts.length - outCount;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventory alerts"
        description="Products that are running low or have sold out. Restock them or hide sold-out items from customers."
        breadcrumbs={marketId ? [{ label: "Dashboard", to: `/markets/${marketId}/dashboard` }, { label: "Inventory alerts" }] : undefined}
        actions={
          <>
            {marketId ? (
              <Button asChild variant="outline">
                <Link to={`/markets/${marketId}/items`}>
                  <Package />
                  Manage products
                </Link>
              </Button>
            ) : null}
            <Button
              onClick={() =>
                hideM.mutate(undefined, {
                  onSuccess: () => toast.success("Out-of-stock items hidden"),
                  onError: (error) => toast.error(marketErrorMessage(error) ?? "Could not hide items"),
                })
              }
              disabled={hideM.isPending}
            >
              {hideM.isPending ? <Spinner /> : <EyeOff />}
              Hide out of stock
            </Button>
          </>
        }
      />

      <StatGrid className="md:grid-cols-3 xl:grid-cols-3">
        <StatCard label="Total alerts" value={alerts.length} icon={TriangleAlert} tone="primary" />
        <StatCard label="Out of stock" value={outCount} icon={PackageX} tone="destructive" />
        <StatCard label="Low stock" value={lowCount} icon={TriangleAlert} tone="warning" />
      </StatGrid>

      <Card>
        <CardHeader>
          <CardTitle>Low stock and out-of-stock items</CardTitle>
          <CardDescription>The bar shows current stock compared to each item's low-stock threshold.</CardDescription>
          {alerts.length ? (
            <CardAction>
              <StatusBadge tone={outCount ? "destructive" : "warning"}>{alerts.length} items</StatusBadge>
            </CardAction>
          ) : null}
        </CardHeader>
        <CardContent className="grid gap-3">
          {alertsQ.isLoading ? (
            <LoadingState rows={3} />
          ) : alertsQ.isError ? (
            <Alert variant="destructive">
              <AlertDescription>{marketErrorMessage(alertsQ.error)}</AlertDescription>
            </Alert>
          ) : alerts.length === 0 ? (
            <EmptyState icon={CheckCircle2} title="All products are well stocked" description="Inventory looks healthy. Items will appear here when they drop below their threshold." />
          ) : (
            alerts.map((item) => {
              const out = item.severity === "out";
              const pct = item.low_stock_threshold > 0 ? Math.min(100, (item.stock_qty / item.low_stock_threshold) * 100) : 0;

              return (
                <div key={item.id} className="flex flex-col gap-3 rounded-lg border bg-muted/30 p-4 md:flex-row md:items-center">
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    <div
                      className={cn(
                        "flex size-10 shrink-0 items-center justify-center rounded-lg",
                        out ? "bg-destructive/10 text-destructive" : "bg-warning/20 text-warning",
                      )}
                    >
                      {out ? <PackageX className="size-5" /> : <TriangleAlert className="size-5" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate font-medium">{item.name}</span>
                        <StatusBadge tone={out ? "destructive" : "warning"} dot>
                          {out ? "Out of stock" : "Low stock"}
                        </StatusBadge>
                        <StatusBadge tone="neutral">{item.is_active ? "Visible" : "Hidden"}</StatusBadge>
                      </div>
                      <div className="mt-0.5 truncate text-xs text-muted-foreground">
                        SKU {item.sku} - threshold {item.low_stock_threshold}
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-1.5 md:w-56">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">In stock</span>
                      <span className={cn("font-semibold tabular-nums", out ? "text-destructive" : "text-foreground")}>
                        {item.stock_qty} left
                      </span>
                    </div>
                    <Progress
                      value={pct}
                      aria-label={`${item.stock_qty} of ${item.low_stock_threshold}`}
                      className={out ? "bg-destructive/15 [&>[data-slot=progress-indicator]]:bg-destructive" : "bg-warning/20 [&>[data-slot=progress-indicator]]:bg-warning"}
                    />
                  </div>

                  {marketId ? (
                    <Button asChild variant="outline" size="sm" className="md:ml-2">
                      <Link to={`/markets/${marketId}/items`}>Restock</Link>
                    </Button>
                  ) : null}
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}
