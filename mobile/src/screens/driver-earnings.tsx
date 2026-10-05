import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import { AppShell } from "@/src/components/app-shell";
import {
  Alert,
  AppText,
  Badge,
  Button,
  Card,
  EmptyState,
  LoadingBlock,
  Row,
  Separator,
  StatCard,
  StatGrid,
  humanizeStatus,
  radius,
  toneForStatus,
  useColors,
} from "@/src/components/ui";
import { useProtectedAccess } from "@/src/hooks/use-protected-access";
import { api } from "@/src/lib/api";
import { formatDateTime, formatMoney, toNumber } from "@/src/lib/format";
import { usePreferences } from "@/src/providers/app-providers";
import type { RootStackParamList } from "@/src/types/navigation";

type DriverEarningsProps = NativeStackScreenProps<RootStackParamList, "DriverEarnings">;

type DriverEarningsSummary = {
  range?: { from: string; to: string };
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
    type?: string | null;
    amount: number | string;
    description?: string | null;
    created_at?: string | null;
    payout_status?: string;
    order?: { code?: string | null } | null;
  }[];
};

const BAR_AREA = 120;

function AmountText({ amount }: { amount: number | string }) {
  const value = toNumber(amount);
  return (
    <AppText variant="label" tone={value >= 0 ? "success" : "destructive"} style={styles.amount}>
      {value > 0 ? "+" : ""}
      {formatMoney(amount, "en")}
    </AppText>
  );
}

export function DriverEarningsScreen({ navigation }: DriverEarningsProps) {
  const access = useProtectedAccess("DriverEarnings");
  const c = useColors();
  const { language } = usePreferences();
  const earningsQ = useQuery({
    queryKey: ["driver-earnings"],
    queryFn: async () => (await api.get("/api/driver/earnings")).data as DriverEarningsSummary,
    enabled: access.ready,
  });

  if (!access.ready) {
    return access.fallback;
  }

  const data = earningsQ.data;
  const maxDaily = Math.max(1, ...(data?.daily ?? []).map((day) => toNumber(day.earnings)));
  const subtitle = data?.range ? `Earnings between ${data.range.from} and ${data.range.to}.` : "What you've earned recently and your balance.";

  return (
    <AppShell navigation={navigation} screenName="DriverEarnings" title="Driver earnings" subtitle={subtitle}>
      {earningsQ.isLoading ? (
        <LoadingBlock message="Loading earnings..." rows={4} />
      ) : !data ? (
        <Alert tone="destructive" title="Unable to load earnings." description="Please try again in a moment."
          action={<Button size="sm" variant="outline" icon="refresh" onPress={() => void earningsQ.refetch()}>Try again</Button>}
        />
      ) : (
        <>
          <StatGrid>
            <StatCard icon="wallet-outline" tone="success" label="Balance" value={formatMoney(data.totals.balance, "en")} note={`Total earned ${formatMoney(data.totals.total_earned, "en")}`} />
            <StatCard icon="cash-outline" tone="primary" label="Period earnings" value={formatMoney(data.totals.period_earnings, "en")} />
            <StatCard icon="cube-outline" tone="info" label="Deliveries" value={data.totals.period_deliveries} note="In this period" />
            <StatCard icon="calendar-outline" label="Average drop" value={formatMoney(data.totals.average_delivery_earning, "en")} note="Per delivery" />
          </StatGrid>

          <Card title="Daily trend" description="Earnings and number of drops per day.">
            {data.daily.length === 0 ? (
              <EmptyState compact icon="calendar-outline" title="No daily data yet" />
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.bars}>
                {data.daily.map((day) => {
                  const height = Math.max(4, (toNumber(day.earnings) / maxDaily) * BAR_AREA);
                  return (
                    <View key={day.date} style={styles.barCol} accessibilityLabel={`${day.date}: ${formatMoney(day.earnings, "en")}, ${day.deliveries} drops`}>
                      <Text numberOfLines={1} style={[styles.barValue, { color: c.foreground }]}>{formatMoney(day.earnings, "en")}</Text>
                      <View style={[styles.barTrack, { backgroundColor: c.muted }]}>
                        <View style={[styles.bar, { height, backgroundColor: c.chart1 }]} />
                      </View>
                      <Text style={[styles.barLabel, { color: c.mutedForeground }]}>{day.date.slice(5)}</Text>
                      <Text style={[styles.barLabel, { color: c.mutedForeground }]}>{day.deliveries} drops</Text>
                    </View>
                  );
                })}
              </ScrollView>
            )}
          </Card>

          <Card title="Transactions" description="Every credit and payout in this range.">
            {data.transactions.length === 0 ? (
              <EmptyState compact icon="receipt-outline" title="No transactions in this range." description="Completed deliveries will appear here." />
            ) : (
              <View>
                {data.transactions.map((transaction, index) => {
                  const payout = transaction.payout_status || "available";
                  return (
                    <View key={transaction.id}>
                      {index > 0 ? <Separator /> : null}
                      <View style={styles.txRow}>
                        <Row justify="space-between" align="flex-start" gap={12}>
                          <View style={styles.flex}>
                            <AppText variant="label" numberOfLines={1}>{transaction.description || "Driver transaction"}</AppText>
                            <AppText variant="caption">
                              {transaction.order?.code || "No order"} · {formatDateTime(transaction.created_at, "en")}
                            </AppText>
                          </View>
                          <AmountText amount={transaction.amount} />
                        </Row>
                        <Row gap={6} wrap>
                          {transaction.type ? <Badge tone="neutral">{humanizeStatus(transaction.type, language)}</Badge> : null}
                          <Badge tone={toneForStatus(payout)}>{`Payout: ${humanizeStatus(payout, language)}`}</Badge>
                        </Row>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </Card>
        </>
      )}
    </AppShell>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  amount: { fontWeight: "600", fontVariant: ["tabular-nums"] },
  bars: { gap: 8, alignItems: "flex-end", paddingBottom: 4 },
  barCol: { width: 52, alignItems: "center", gap: 4 },
  barValue: { fontSize: 11, fontWeight: "500", fontVariant: ["tabular-nums"] },
  barTrack: { width: "100%", height: BAR_AREA, borderRadius: radius.md, justifyContent: "flex-end", overflow: "hidden" },
  bar: { width: "100%", borderRadius: radius.md },
  barLabel: { fontSize: 11, fontVariant: ["tabular-nums"] },
  txRow: { paddingVertical: 12, gap: 8 },
});
