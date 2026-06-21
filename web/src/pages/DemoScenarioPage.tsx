import { DatabaseZap } from "lucide-react";
import { useMutation } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";

type DemoScenarioResult = {
  message: string;
  market_id: number;
  orders_created: number;
  items_ready: number;
  route_id: number;
};

export default function DemoScenarioPage() {
  const demoM = useMutation({
    mutationFn: async () => (await api.post("/api/demo/scenario")).data as DemoScenarioResult,
  });

  return (
    <div className="grid gap-6">
      <div className="intro-panel">
        <h1 className="intro-title">Demo scenario</h1>
      </div>

      <Card className="rounded-[30px]">
        <CardHeader>
          <CardTitle className="text-2xl">Generate a realistic demo workspace</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-5">
          <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5 text-sm leading-6 theme-copy dark:border-slate-800 dark:bg-slate-900">
            Creates demo users, market items, low-stock alerts, orders across the lifecycle, route stops, location pings, reviews, and a notification.
          </div>
          <div>
            <Button onClick={() => demoM.mutate()} disabled={demoM.isPending}>
              <DatabaseZap className="h-4 w-4" />
              {demoM.isPending ? "Generating..." : "Generate demo scenario"}
            </Button>
          </div>
          {demoM.data && (
            <div className="rounded-[24px] border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-900 dark:border-emerald-300/15 dark:bg-emerald-300/10 dark:text-emerald-100">
              {demoM.data.message} Market #{demoM.data.market_id}, {demoM.data.orders_created} orders, route #{demoM.data.route_id}.
            </div>
          )}
          {demoM.isError && (
            <div className="rounded-[24px] border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700 dark:border-rose-300/15 dark:bg-rose-300/10 dark:text-rose-100">
              Demo generation failed. Make sure you are signed in as an admin.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
