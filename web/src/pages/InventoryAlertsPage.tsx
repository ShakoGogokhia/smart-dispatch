import { EyeOff, PackageX } from "lucide-react";
import { useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";

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

  return (
    <div className="grid gap-6">
      <div className="intro-panel">
        <h1 className="intro-title">Inventory alerts</h1>
      </div>

      <Card className="rounded-[30px]">
        <CardHeader>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <CardTitle className="text-2xl">Low stock and out-of-stock items</CardTitle>
            <Button onClick={() => hideM.mutate()} disabled={hideM.isPending}>
              <EyeOff className="h-4 w-4" />
              Hide out of stock
            </Button>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3">
          {alertsQ.isLoading ? (
            <div className="p-5 text-sm theme-copy">Loading alerts...</div>
          ) : alerts.length === 0 ? (
            <div className="rounded-[22px] border border-slate-200 p-5 text-sm theme-copy dark:border-slate-800">Inventory looks healthy.</div>
          ) : alerts.map((item) => (
            <div key={item.id} className="rounded-[22px] border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-[16px] bg-slate-950 text-white dark:bg-cyan-500/15 dark:text-cyan-100">
                    <PackageX className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="font-semibold">{item.name}</div>
                    <div className="mt-1 text-sm theme-copy">{item.sku} - threshold {item.low_stock_threshold}</div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge className={`status-chip ${item.severity === "out" ? "status-bad" : "status-warn"}`}>{item.stock_qty} left</Badge>
                  <Badge className="status-chip status-neutral">{item.is_active ? "Visible" : "Hidden"}</Badge>
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
