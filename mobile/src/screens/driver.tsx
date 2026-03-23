import { useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import { AppShell } from "@/src/components/app-shell";
import { AppButton, EmptyBlock, HelperText, InputField, LoadingBlock, Pill, SectionCard, StatCard, StatGrid, uiStyles } from "@/src/components/ui";
import { useProtectedAccess } from "@/src/hooks/use-protected-access";
import { api } from "@/src/lib/api";
import { getErrorMessage } from "@/src/lib/errors";
import { formatDateTime, formatMoney, formatOrderStatus } from "@/src/lib/format";
import type { DriverFeed, Order } from "@/src/types/api";
import type { RootStackParamList } from "@/src/types/navigation";

type DriverHubProps = NativeStackScreenProps<RootStackParamList, "DriverHub">;

function DriverOrderCard({
  order,
  actions,
}: {
  order: Order;
  actions?: React.ReactNode;
}) {
  return (
    <SectionCard title={order.code} subtitle={order.dropoff_address || "No address set"} right={<Pill>{formatOrderStatus(order.status)}</Pill>}>
      <HelperText>Customer: {order.customer_name || order.customer?.name || "Unknown"}</HelperText>
      <HelperText>Phone: {order.customer_phone || "Not provided"}</HelperText>
      {order.total != null ? <HelperText>Total: {formatMoney(order.total, "en")}</HelperText> : null}
      {order.notes ? <HelperText>Notes: {order.notes}</HelperText> : null}
      {order.items?.length ? <HelperText>Items: {order.items.map((item) => `${item.name} x${item.qty}`).join(", ")}</HelperText> : null}
      {actions}
    </SectionCard>
  );
}

export function DriverHubScreen({ navigation }: DriverHubProps) {
  const access = useProtectedAccess("DriverHub");
  const queryClient = useQueryClient();
  const [lat, setLat] = useState("41.7151");
  const [lng, setLng] = useState("44.8271");
  const roles = access.me?.roles ?? [];
  const isDriver = roles.includes("driver");

  const feedQ = useQuery({
    queryKey: ["driver-feed"],
    queryFn: async () => (await api.get("/api/driver/orders/feed")).data as DriverFeed,
    refetchInterval: access.ready && isDriver ? 7000 : false,
    enabled: access.ready && isDriver,
  });

  const refreshQueries = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["driver-feed"] }),
      queryClient.invalidateQueries({ queryKey: ["orders"] }),
      queryClient.invalidateQueries({ queryKey: ["live-routes"] }),
      queryClient.invalidateQueries({ queryKey: ["live-locations"] }),
      queryClient.invalidateQueries({ queryKey: ["me"] }),
    ]);
  };

  const startShiftM = useMutation({
    mutationFn: async () => (await api.post("/api/shifts/start")).data,
    onSuccess: refreshQueries,
  });

  const endShiftM = useMutation({
    mutationFn: async () => (await api.post("/api/shifts/end")).data,
    onSuccess: refreshQueries,
  });

  const pingM = useMutation({
    mutationFn: async () => (await api.post("/api/tracking/ping", { lat: Number(lat), lng: Number(lng) })).data,
    onSuccess: refreshQueries,
  });

  const actionM = useMutation({
    mutationFn: async ({ orderId, action }: { orderId: number; action: string }) =>
      (await api.post(`/api/driver/orders/${orderId}/${action}`)).data,
    onSuccess: refreshQueries,
  });

  const mutationError = useMemo(
    () =>
      [startShiftM.error, endShiftM.error, pingM.error, actionM.error]
        .filter(Boolean)
        .map((error) => getErrorMessage(error, "Something went wrong"))
        .join("\n"),
    [actionM.error, endShiftM.error, pingM.error, startShiftM.error],
  );

  if (!access.ready) {
    return access.fallback;
  }

  if (!isDriver) {
    return (
      <AppShell navigation={navigation} screenName="DriverHub" title="Driver Hub" subtitle="Driver tools are only available to driver accounts.">
        <EmptyBlock message="This workspace is only available for driver accounts." />
      </AppShell>
    );
  }

  const activeShift = feedQ.data?.driver?.active_shift;
  const driverStatus = feedQ.data?.driver?.status ?? "OFFLINE";

  return (
    <AppShell navigation={navigation} screenName="DriverHub" title="Driver Hub" subtitle="Shift, offers, and assigned deliveries from one mobile screen.">
      <StatGrid>
        <StatCard label="Status" value={driverStatus} />
        <StatCard label="Offers" value={(feedQ.data?.offered_orders ?? []).length} />
        <StatCard label="Assigned" value={(feedQ.data?.assigned_orders ?? []).length} />
      </StatGrid>

      <SectionCard title="Driver status" subtitle={activeShift ? `Shift started ${formatDateTime(activeShift.started_at, "en")}` : "No active shift"}>
        <View style={styles.row}>
          <AppButton onPress={() => startShiftM.mutate()} disabled={!!activeShift || startShiftM.isPending}>
            {startShiftM.isPending ? "Starting..." : "Start shift"}
          </AppButton>
          <AppButton variant="secondary" onPress={() => endShiftM.mutate()} disabled={!activeShift || endShiftM.isPending}>
            {endShiftM.isPending ? "Ending..." : "End shift"}
          </AppButton>
        </View>
        <InputField label="Latitude" value={lat} onChangeText={setLat} keyboardType="numeric" />
        <InputField label="Longitude" value={lng} onChangeText={setLng} keyboardType="numeric" />
        <AppButton variant="secondary" onPress={() => pingM.mutate()} disabled={pingM.isPending}>
          {pingM.isPending ? "Sending..." : "Send location ping"}
        </AppButton>
        {mutationError ? <HelperText tone="danger">{mutationError}</HelperText> : null}
      </SectionCard>

      <SectionCard title="Incoming offers">
        {feedQ.isLoading ? (
          <LoadingBlock message="Loading driver feed..." />
        ) : (feedQ.data?.offered_orders ?? []).length === 0 ? (
          <HelperText>No active offers right now.</HelperText>
        ) : (
          <View style={uiStyles.listGap}>
            {(feedQ.data?.offered_orders ?? []).map((order) => (
              <DriverOrderCard
                key={order.id}
                order={order}
                actions={
                  <View style={styles.row}>
                    <AppButton compact onPress={() => actionM.mutate({ orderId: order.id, action: "accept" })}>
                      Accept
                    </AppButton>
                    <AppButton variant="secondary" compact onPress={() => actionM.mutate({ orderId: order.id, action: "decline" })}>
                      Decline
                    </AppButton>
                  </View>
                }
              />
            ))}
          </View>
        )}
      </SectionCard>

      <SectionCard title="Assigned deliveries">
        {(feedQ.data?.assigned_orders ?? []).length === 0 ? (
          <HelperText>No deliveries assigned yet.</HelperText>
        ) : (
          <View style={uiStyles.listGap}>
            {(feedQ.data?.assigned_orders ?? []).map((order) => (
              <DriverOrderCard
                key={order.id}
                order={order}
                actions={
                  <View style={styles.row}>
                    {order.status === "ASSIGNED" ? (
                      <AppButton compact onPress={() => actionM.mutate({ orderId: order.id, action: "picked-up" })}>
                        Mark picked up
                      </AppButton>
                    ) : null}
                    {order.status === "PICKED_UP" ? (
                      <AppButton compact onPress={() => actionM.mutate({ orderId: order.id, action: "delivered" })}>
                        Mark delivered
                      </AppButton>
                    ) : null}
                  </View>
                }
              />
            ))}
          </View>
        )}
      </SectionCard>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
});
