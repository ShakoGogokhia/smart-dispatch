import { useQuery } from "@tanstack/react-query";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import { AppShell } from "@/src/components/app-shell";
import { EmptyBlock, HelperText, LoadingBlock, Pill, SectionCard, StatCard, StatGrid } from "@/src/components/ui";
import { useProtectedAccess } from "@/src/hooks/use-protected-access";
import { api } from "@/src/lib/api";
import { formatDateTime, formatMoney } from "@/src/lib/format";
import type { RootStackParamList } from "@/src/types/navigation";

type DriverEarningsProps = NativeStackScreenProps<RootStackParamList, "DriverEarnings">;

type DriverEarningsSummary = {
  totals: {
    balance: number | string;
    total_earned: number | string;
    period_earnings: number;
    period_deliveries: number;
    average_delivery_earning: number;
  };
  daily: { date: string; earnings: number; deliveries: number }[];
  transactions: {
    id: number;
    amount: number | string;
    description?: string | null;
    created_at?: string | null;
    payout_status?: string;
    order?: { code?: string | null } | null;
  }[];
};

export function DriverEarningsScreen({ navigation }: DriverEarningsProps) {
  const access = useProtectedAccess("DriverEarnings");
  const earningsQ = useQuery({
    queryKey: ["driver-earnings"],
    queryFn: async () => (await api.get("/api/driver/earnings")).data as DriverEarningsSummary,
    enabled: access.ready,
  });

  if (!access.ready) {
    return access.fallback;
  }

  const data = earningsQ.data;

  return (
    <AppShell navigation={navigation} screenName="DriverEarnings" title="Driver earnings" subtitle="Daily earnings, delivery totals, payout status, and transaction detail.">
      {earningsQ.isLoading ? (
        <LoadingBlock message="Loading earnings..." />
      ) : !data ? (
        <EmptyBlock message="Unable to load earnings." />
      ) : (
        <>
          <StatGrid>
            <StatCard label="Balance" value={formatMoney(data.totals.balance, "en")} />
            <StatCard label="Period earnings" value={formatMoney(data.totals.period_earnings, "en")} />
            <StatCard label="Deliveries" value={data.totals.period_deliveries} />
            <StatCard label="Average" value={formatMoney(data.totals.average_delivery_earning, "en")} />
          </StatGrid>

          <SectionCard title="Daily trend">
            {data.daily.map((day) => (
              <SectionCard key={day.date} title={day.date} subtitle={`${formatMoney(day.earnings, "en")} - ${day.deliveries} deliveries`} />
            ))}
          </SectionCard>

          <SectionCard title="Transactions">
            {data.transactions.length === 0 ? (
              <EmptyBlock message="No transactions in this range." />
            ) : (
              data.transactions.map((transaction) => (
                <SectionCard key={transaction.id} title={transaction.description || "Driver transaction"} subtitle={`${transaction.order?.code || "No order"} - ${formatDateTime(transaction.created_at, "en")}`} right={<Pill tone="success">{formatMoney(transaction.amount, "en")}</Pill>}>
                  <HelperText>Payout: {transaction.payout_status || "available"}</HelperText>
                </SectionCard>
              ))
            )}
          </SectionCard>
        </>
      )}
    </AppShell>
  );
}
