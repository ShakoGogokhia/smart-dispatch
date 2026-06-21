import { Banknote, CalendarDays, PackageCheck, Wallet } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import { formatDateTime, formatMoney } from "@/lib/format";
import type { DriverEarningsSummary } from "@/types/api";

export default function DriverEarningsPage() {
  const earningsQ = useQuery({
    queryKey: ["driver-earnings"],
    queryFn: async () => (await api.get("/api/driver/earnings")).data as DriverEarningsSummary,
  });
  const data = earningsQ.data;

  return (
    <div className="grid gap-6">
      <div className="intro-panel">
        <h1 className="intro-title">Driver earnings</h1>
      </div>

      {earningsQ.isLoading ? (
        <Card className="rounded-[30px]"><CardContent className="p-8 text-sm theme-copy">Loading earnings...</CardContent></Card>
      ) : !data ? (
        <Card className="rounded-[30px]"><CardContent className="p-8 text-sm status-bad">Unable to load earnings.</CardContent></Card>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <EarningMetric icon={Wallet} label="Balance" value={formatMoney(data.totals.balance)} />
            <EarningMetric icon={Banknote} label="Period earnings" value={formatMoney(data.totals.period_earnings)} />
            <EarningMetric icon={PackageCheck} label="Deliveries" value={String(data.totals.period_deliveries)} />
            <EarningMetric icon={CalendarDays} label="Average drop" value={formatMoney(data.totals.average_delivery_earning)} />
          </div>

          <Card className="rounded-[30px]">
            <CardHeader><CardTitle className="text-2xl">Daily trend</CardTitle></CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-7">
              {data.daily.map((day) => (
                <div key={day.date} className="rounded-[22px] border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
                  <div className="text-xs theme-copy">{day.date.slice(5)}</div>
                  <div className="mt-3 text-xl font-semibold">{formatMoney(day.earnings)}</div>
                  <div className="mt-1 text-xs theme-copy">{day.deliveries} drops</div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="rounded-[30px]">
            <CardHeader><CardTitle className="text-2xl">Transactions</CardTitle></CardHeader>
            <CardContent className="grid gap-3">
              {data.transactions.length === 0 ? (
                <div className="rounded-[22px] border border-slate-200 p-5 text-sm theme-copy dark:border-slate-800">No transactions in this range.</div>
              ) : data.transactions.map((transaction) => (
                <div key={transaction.id} className="rounded-[22px] border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <div className="font-semibold">{transaction.description ?? "Driver transaction"}</div>
                      <div className="mt-1 text-sm theme-copy">{transaction.order?.code ?? "No order"} - {formatDateTime(transaction.created_at)}</div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge className="status-chip status-good">{formatMoney(transaction.amount)}</Badge>
                      <Badge className="status-chip status-neutral">{transaction.payout_status ?? "available"}</Badge>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function EarningMetric({ icon: Icon, label, value }: { icon: typeof Wallet; label: string; value: string }) {
  return (
    <Card className="rounded-[28px]">
      <CardContent className="p-5">
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
          <Icon className="h-4 w-4" />
          {label}
        </div>
        <div className="mt-4 text-3xl font-semibold tracking-[-0.05em]">{value}</div>
      </CardContent>
    </Card>
  );
}
