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
import { usePreferences } from "@/src/providers/app-providers";
import type { DriverFeed, Order } from "@/src/types/api";
import type { RootStackParamList } from "@/src/types/navigation";

type DriverHubProps = NativeStackScreenProps<RootStackParamList, "DriverHub">;

const copy = {
  en: {
    title: "Driver Hub",
    subtitle: "Shift, offers, route-ready ETAs, and proof of delivery from one screen.",
    onlyDrivers: "This workspace is only available for driver accounts.",
    status: "Status",
    offers: "Offers",
    assigned: "Assigned",
    driverStatus: "Driver status",
    startShift: "Start shift",
    endShift: "End shift",
    sendLocation: "Send location ping",
    incomingOffers: "Incoming offers",
    assignedDeliveries: "Assigned deliveries",
    proofNote: "Proof note",
    proofPhoto: "Proof photo URL",
    markDelivered: "Mark delivered",
    markPickedUp: "Mark picked up",
  },
  ka: {
    title: "მძღოლის ჰაბი",
    subtitle: "ცვლა, შეთავაზებები, ETA და მიწოდების დადასტურება ერთ ეკრანზე.",
    onlyDrivers: "ეს სივრცე მხოლოდ მძღოლის ანგარიშებისთვისაა.",
    status: "სტატუსი",
    offers: "შეთავაზებები",
    assigned: "მინიჭებული",
    driverStatus: "მძღოლის სტატუსი",
    startShift: "ცვლის დაწყება",
    endShift: "ცვლის დასრულება",
    sendLocation: "ლოკაციის პინგი",
    incomingOffers: "შემომავალი შეთავაზებები",
    assignedDeliveries: "მინიჭებული მიწოდებები",
    proofNote: "დადასტურების ჩანაწერი",
    proofPhoto: "ფოტოს URL",
    markDelivered: "მიტანა",
    markPickedUp: "აყვანილია",
  },
} as const;

function DriverOrderCard({
  order,
  language,
  actions,
}: {
  order: Order;
  language: "en" | "ka";
  actions?: React.ReactNode;
}) {
  return (
    <SectionCard title={order.code} subtitle={order.dropoff_address || "No address set"} right={<Pill>{formatOrderStatus(order.status, language)}</Pill>}>
      <HelperText>Customer: {order.customer_name || order.customer?.name || "Unknown"}</HelperText>
      <HelperText>Phone: {order.customer_phone || "Not provided"}</HelperText>
      {order.total != null ? <HelperText>Total: {formatMoney(order.total, language)}</HelperText> : null}
      <HelperText>ETA: {formatDateTime(order.eta_summary?.estimated_delivery_at, language)}</HelperText>
      {actions}
    </SectionCard>
  );
}

export function DriverHubScreen({ navigation }: DriverHubProps) {
  const access = useProtectedAccess("DriverHub");
  const { language } = usePreferences();
  const text = copy[language];
  const queryClient = useQueryClient();
  const [lat, setLat] = useState("41.7151");
  const [lng, setLng] = useState("44.8271");
  const [proofNote, setProofNote] = useState("");
  const [proofPhoto, setProofPhoto] = useState("");
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
      action === "delivered"
        ? (await api.post(`/api/driver/orders/${orderId}/delivered`, { proof_note: proofNote || null, proof_photo_url: proofPhoto || null })).data
        : (await api.post(`/api/driver/orders/${orderId}/${action}`)).data,
    onSuccess: async () => {
      setProofNote("");
      setProofPhoto("");
      await refreshQueries();
    },
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
      <AppShell navigation={navigation} screenName="DriverHub" title={text.title} subtitle={text.subtitle}>
        <EmptyBlock message={text.onlyDrivers} />
      </AppShell>
    );
  }

  const activeShift = feedQ.data?.driver?.active_shift;
  const driverStatus = feedQ.data?.driver?.status ?? "OFFLINE";

  return (
    <AppShell navigation={navigation} screenName="DriverHub" title={text.title} subtitle={text.subtitle}>
      <StatGrid>
        <StatCard label={text.status} value={driverStatus} />
        <StatCard label={text.offers} value={(feedQ.data?.offered_orders ?? []).length} />
        <StatCard label={text.assigned} value={(feedQ.data?.assigned_orders ?? []).length} />
      </StatGrid>

      <SectionCard title={text.driverStatus} subtitle={activeShift ? `Shift started ${formatDateTime(activeShift.started_at, language)}` : "No active shift"}>
        <View style={styles.row}>
          <AppButton onPress={() => startShiftM.mutate()} disabled={!!activeShift || startShiftM.isPending}>
            {text.startShift}
          </AppButton>
          <AppButton variant="secondary" onPress={() => endShiftM.mutate()} disabled={!activeShift || endShiftM.isPending}>
            {text.endShift}
          </AppButton>
        </View>
        <InputField label="Latitude" value={lat} onChangeText={setLat} keyboardType="numeric" />
        <InputField label="Longitude" value={lng} onChangeText={setLng} keyboardType="numeric" />
        <AppButton variant="secondary" onPress={() => pingM.mutate()} disabled={pingM.isPending}>
          {text.sendLocation}
        </AppButton>
        {mutationError ? <HelperText tone="danger">{mutationError}</HelperText> : null}
      </SectionCard>

      <SectionCard title={text.incomingOffers}>
        {feedQ.isLoading ? (
          <LoadingBlock message="Loading driver feed..." />
        ) : (
          <View style={uiStyles.listGap}>
            {(feedQ.data?.offered_orders ?? []).map((order) => (
              <DriverOrderCard
                key={order.id}
                order={order}
                language={language}
                actions={
                  <View style={styles.row}>
                    <AppButton compact onPress={() => actionM.mutate({ orderId: order.id, action: "accept" })}>Accept</AppButton>
                    <AppButton variant="secondary" compact onPress={() => actionM.mutate({ orderId: order.id, action: "decline" })}>Decline</AppButton>
                  </View>
                }
              />
            ))}
          </View>
        )}
      </SectionCard>

      <SectionCard title={text.assignedDeliveries}>
        <InputField label={text.proofNote} value={proofNote} onChangeText={setProofNote} />
        <InputField label={text.proofPhoto} value={proofPhoto} onChangeText={setProofPhoto} />
        <View style={uiStyles.listGap}>
          {(feedQ.data?.assigned_orders ?? []).map((order) => (
            <DriverOrderCard
              key={order.id}
              order={order}
              language={language}
              actions={
                <View style={styles.row}>
                  {order.status === "ASSIGNED" ? (
                    <AppButton compact onPress={() => actionM.mutate({ orderId: order.id, action: "picked-up" })}>
                      {text.markPickedUp}
                    </AppButton>
                  ) : null}
                  {order.status === "PICKED_UP" ? (
                    <AppButton compact onPress={() => actionM.mutate({ orderId: order.id, action: "delivered" })}>
                      {text.markDelivered}
                    </AppButton>
                  ) : null}
                </View>
              }
            />
          ))}
        </View>
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
