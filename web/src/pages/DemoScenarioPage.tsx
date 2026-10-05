import { AlertCircle, CheckCircle2, DatabaseZap, TriangleAlert } from "lucide-react";
import { useMutation } from "@tanstack/react-query";

import { PageHeader } from "@/components/app/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { api } from "@/lib/api";

type DemoScenarioResult = {
  message: string;
  market_id: number;
  orders_created: number;
  items_ready: number;
  route_id: number;
};

const CREATES = [
  "Demo users",
  "Market items",
  "Low-stock alerts",
  "Orders across the lifecycle",
  "Route stops",
  "Location pings",
  "Reviews",
  "A notification",
];

export default function DemoScenarioPage() {
  const demoM = useMutation({
    mutationFn: async () => (await api.post("/api/demo/scenario")).data as DemoScenarioResult,
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Demo scenario" description="Fill the workspace with realistic sample data for demos and testing." />

      <Alert>
        <TriangleAlert />
        <AlertTitle>This writes real records to the database</AlertTitle>
        <AlertDescription>Run it only on a demo or test environment. Generated data shows up for every user.</AlertDescription>
      </Alert>

      <Card className="max-w-3xl">
        <CardHeader>
          <CardTitle>Generate a realistic demo workspace</CardTitle>
          <CardDescription>One click creates everything below so you can walk through the full order flow.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <ul className="grid gap-2 rounded-lg border bg-muted/30 p-4 text-sm sm:grid-cols-2">
            {CREATES.map((item) => (
              <li key={item} className="flex items-center gap-2">
                <CheckCircle2 className="size-4 shrink-0 text-muted-foreground" />
                {item}
              </li>
            ))}
          </ul>

          {demoM.data && (
            <div className="grid gap-2">
              <div className="flex items-center gap-2 text-sm font-medium text-success">
                <CheckCircle2 className="size-4" />
                {demoM.data.message}
              </div>
              <pre className="overflow-x-auto rounded-md bg-muted p-3 font-mono text-xs whitespace-pre-wrap">
                {[
                  `market_id      #${demoM.data.market_id}`,
                  `orders_created ${demoM.data.orders_created}`,
                  `items_ready    ${demoM.data.items_ready}`,
                  `route_id       #${demoM.data.route_id}`,
                ].join("\n")}
              </pre>
            </div>
          )}
          {demoM.isError && (
            <Alert variant="destructive">
              <AlertCircle />
              <AlertDescription>Demo generation failed. Make sure you are signed in as an admin.</AlertDescription>
            </Alert>
          )}
        </CardContent>
        <CardFooter>
          <Button onClick={() => demoM.mutate()} disabled={demoM.isPending}>
            {demoM.isPending ? <Spinner /> : <DatabaseZap />}
            {demoM.isPending ? "Generating..." : "Generate demo scenario"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
