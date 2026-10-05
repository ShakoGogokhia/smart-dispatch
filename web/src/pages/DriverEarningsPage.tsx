import { AlertCircle, Banknote, CalendarDays, PackageCheck, Receipt, Wallet } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import { EmptyState } from "@/components/app/empty-state";
import { LoadingState } from "@/components/app/loading-state";
import { PageHeader } from "@/components/app/page-header";
import { StatCard, StatGrid } from "@/components/app/stat-card";
import { StatusBadge, humanizeStatus, toneForStatus } from "@/components/app/status-badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api } from "@/lib/api";
import { formatDateTime, formatMoney, toNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { DriverEarningsSummary } from "@/types/api";

function AmountText({ amount }: { amount: number | string }) {
  const value = toNumber(amount);
  return (
    <span className={cn("font-semibold tabular-nums", value >= 0 ? "text-success" : "text-destructive")}>
      {value > 0 ? "+" : ""}
      {formatMoney(amount)}
    </span>
  );
}

export default function DriverEarningsPage() {
  const earningsQ = useQuery({
    queryKey: ["driver-earnings"],
    queryFn: async () => (await api.get("/api/driver/earnings")).data as DriverEarningsSummary,
  });
  const data = earningsQ.data;
  const maxDaily = Math.max(1, ...(data?.daily ?? []).map((day) => toNumber(day.earnings)));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Driver earnings"
        description={
          data?.range
            ? `What you've earned between ${data.range.from} and ${data.range.to}, and your available balance.`
            : "What you've earned recently and your available balance."
        }
      />

      {earningsQ.isLoading ? (
        <LoadingState rows={4} />
      ) : !data ? (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertTitle>Unable to load earnings.</AlertTitle>
          <AlertDescription>Please refresh the page or try again in a moment.</AlertDescription>
        </Alert>
      ) : (
        <>
          <StatGrid>
            <StatCard icon={Wallet} tone="success" label="Balance" value={formatMoney(data.totals.balance)} hint={`Total earned ${formatMoney(data.totals.total_earned)}`} />
            <StatCard icon={Banknote} tone="primary" label="Period earnings" value={formatMoney(data.totals.period_earnings)} />
            <StatCard icon={PackageCheck} tone="info" label="Deliveries" value={String(data.totals.period_deliveries)} hint="In this period" />
            <StatCard icon={CalendarDays} label="Average drop" value={formatMoney(data.totals.average_delivery_earning)} hint="Per delivery" />
          </StatGrid>

          <Card>
            <CardHeader>
              <CardTitle>Daily trend</CardTitle>
              <CardDescription>Earnings and number of drops per day.</CardDescription>
            </CardHeader>
            <CardContent>
              {data.daily.length === 0 ? (
                <EmptyState compact icon={CalendarDays} title="No daily data yet" />
              ) : (
                <div className="flex h-48 items-end gap-2 overflow-x-auto pb-1">
                  {data.daily.map((day) => {
                    const height = Math.max(4, (toNumber(day.earnings) / maxDaily) * 100);
                    return (
                      <div key={day.date} className="flex h-full min-w-10 flex-1 flex-col items-center gap-1.5">
                        <div className="text-[11px] font-medium tabular-nums">{formatMoney(day.earnings)}</div>
                        <div className="flex w-full flex-1 items-end rounded-md bg-muted">
                          <div
                            className="w-full rounded-md"
                            style={{ height: `${height}%`, background: "var(--chart-1)" }}
                            title={`${day.date}: ${formatMoney(day.earnings)} · ${day.deliveries} drops`}
                          />
                        </div>
                        <div className="text-[11px] text-muted-foreground tabular-nums">{day.date.slice(5)}</div>
                        <div className="text-[11px] text-muted-foreground tabular-nums">{day.deliveries} drops</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="gap-0 overflow-hidden py-0">
            <CardHeader className="border-b py-4">
              <CardTitle>Transactions</CardTitle>
              <CardDescription>Every credit and payout in this range.</CardDescription>
            </CardHeader>
            {data.transactions.length === 0 ? (
              <CardContent className="py-6">
                <EmptyState compact icon={Receipt} title="No transactions in this range." description="Completed deliveries will appear here." />
              </CardContent>
            ) : (
              <>
                <div className="hidden overflow-x-auto md:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="pl-6">Description</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Order</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Payout</TableHead>
                        <TableHead className="pr-6 text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.transactions.map((transaction) => (
                        <TableRow key={transaction.id}>
                          <TableCell className="pl-6 font-medium">{transaction.description ?? "Driver transaction"}</TableCell>
                          <TableCell>
                            <StatusBadge tone="neutral">{humanizeStatus(transaction.type)}</StatusBadge>
                          </TableCell>
                          <TableCell className="text-muted-foreground">{transaction.order?.code ?? "No order"}</TableCell>
                          <TableCell className="text-muted-foreground">{formatDateTime(transaction.created_at)}</TableCell>
                          <TableCell>
                            <StatusBadge tone={toneForStatus(transaction.payout_status ?? "available")}>
                              {humanizeStatus(transaction.payout_status ?? "available")}
                            </StatusBadge>
                          </TableCell>
                          <TableCell className="pr-6 text-right">
                            <AmountText amount={transaction.amount} />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <div className="divide-y md:hidden">
                  {data.transactions.map((transaction) => (
                    <div key={transaction.id} className="grid gap-2 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium">{transaction.description ?? "Driver transaction"}</div>
                          <div className="text-xs text-muted-foreground">
                            {transaction.order?.code ?? "No order"} · {formatDateTime(transaction.created_at)}
                          </div>
                        </div>
                        <AmountText amount={transaction.amount} />
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <StatusBadge tone="neutral">{humanizeStatus(transaction.type)}</StatusBadge>
                        <StatusBadge tone={toneForStatus(transaction.payout_status ?? "available")}>
                          {humanizeStatus(transaction.payout_status ?? "available")}
                        </StatusBadge>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
