import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import { AppButton, EmptyBlock, HelperText, InputField, LoadingBlock, Pill, Screen, SectionCard, StatCard, StatGrid } from "@/src/components/ui";
import { api } from "@/src/lib/api";
import { formatDateTime, formatOrderStatus } from "@/src/lib/format";
import type { RootStackParamList } from "@/src/types/navigation";

type TrackingProps = NativeStackScreenProps<RootStackParamList, "OrderTracking">;

type TrackingPayload = {
  code: string;
  status: string;
  dropoff_address?: string | null;
  eta_summary?: { estimated_delivery_at?: string | null; promised_at?: string | null; is_late?: boolean };
  market?: { name?: string | null; code?: string | null } | null;
  driver?: { name?: string | null; status?: string | null; latest_ping?: { updated_at?: string | null } | null } | null;
  timeline?: { key: string; label: string; at?: string | null; done: boolean }[];
};

export function OrderTrackingScreen({ route, navigation }: TrackingProps) {
  const [draftCode, setDraftCode] = useState(route.params?.code ?? "");
  const [code, setCode] = useState(route.params?.code ?? "");
  const trackingQ = useQuery({
    queryKey: ["public-tracking", code],
    queryFn: async () => (await api.get(`/api/public/track/${encodeURIComponent(code)}`)).data as TrackingPayload,
    enabled: code.trim().length > 0,
    refetchInterval: code ? 10000 : false,
    retry: false,
  });
  const order = trackingQ.data;

  return (
    <Screen>
      <SectionCard title="Track order" subtitle="Enter an order code to see ETA, driver state, and timeline.">
        <InputField label="Order code" value={draftCode} onChangeText={setDraftCode} placeholder="ORD-000001" />
        <View style={styles.row}>
          <AppButton onPress={() => setCode(draftCode.trim())}>Track</AppButton>
          <AppButton variant="secondary" onPress={() => navigation.navigate("PublicMarkets")}>Markets</AppButton>
        </View>
      </SectionCard>

      {!code ? (
        <EmptyBlock message="Enter an order code to begin." />
      ) : trackingQ.isLoading ? (
        <LoadingBlock message="Loading tracking..." />
      ) : trackingQ.isError || !order ? (
        <EmptyBlock message="No order was found for that code." />
      ) : (
        <>
          <SectionCard title={order.code} subtitle={order.dropoff_address || "No address"} right={<Pill>{formatOrderStatus(order.status, "en")}</Pill>}>
            <StatGrid>
              <StatCard label="ETA" value={formatDateTime(order.eta_summary?.estimated_delivery_at, "en")} />
              <StatCard label="Market" value={order.market?.name || "Direct order"} />
              <StatCard label="Driver" value={order.driver?.name || "Waiting"} />
            </StatGrid>
            <HelperText>Promised: {formatDateTime(order.eta_summary?.promised_at, "en")}</HelperText>
            <HelperText>Driver status: {order.driver?.status || "-"}</HelperText>
            <HelperText>Last ping: {formatDateTime(order.driver?.latest_ping?.updated_at, "en")}</HelperText>
          </SectionCard>

          <SectionCard title="Timeline">
            {(order.timeline ?? []).map((step) => (
              <SectionCard key={step.key} title={step.label} subtitle={formatDateTime(step.at, "en")} right={<Pill tone={step.done ? "success" : "neutral"}>{step.done ? "Done" : "Pending"}</Pill>} />
            ))}
          </SectionCard>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
});
