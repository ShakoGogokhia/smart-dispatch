import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import { AppShell } from "@/src/components/app-shell";
import {
  AppButton,
  EmptyBlock,
  HelperText,
  InputField,
  LoadingBlock,
  Pill,
  SectionCard,
  StatCard,
  StatGrid,
  uiStyles,
  usePalette,
} from "@/src/components/ui";
import { useProtectedAccess } from "@/src/hooks/use-protected-access";
import { api } from "@/src/lib/api";
import { getErrorMessage } from "@/src/lib/errors";
import { formatDateTime, formatMoney, formatOrderStatus } from "@/src/lib/format";
import { notifyIncomingOffer, prepareLocalNotifications } from "@/src/lib/notifications";
import { usePreferences } from "@/src/providers/app-providers";
import type { DriverFeed, Order } from "@/src/types/api";
import type { RootStackParamList } from "@/src/types/navigation";

type DriverHubProps = NativeStackScreenProps<RootStackParamList, "DriverHub">;

const copy = {
  en: {
    title: "Driver Hub",
    subtitle: "Incoming offers, live shift controls, and delivery proof in one mobile-first screen.",
    onlyDrivers: "This workspace is only available for driver accounts.",
    status: "Status",
    offers: "Offers",
    assigned: "Assigned",
    liveNow: "Live now",
    driverStatus: "Driver status",
    dispatchPulse: "Dispatch pulse",
    dispatchPulseCopy: "Stay online, share your location, and react quickly when fresh work lands.",
    startShift: "Start shift",
    endShift: "End shift",
    sendLocation: "Send location ping",
    locationTitle: "Location sync",
    locationCopy: "Keep dispatch updated so ETAs and live tracking stay accurate.",
    incomingOffers: "Incoming offers",
    incomingOffersCopy: "Fresh jobs appear here first. Accept quickly before the offer expires.",
    assignedDeliveries: "Assigned deliveries",
    assignedDeliveriesCopy: "Your current jobs with proof-of-delivery actions kept close by.",
    proofNote: "Proof note",
    proofPhoto: "Proof photo URL",
    proofSignature: "Proof signature",
    markDelivered: "Mark delivered",
    markPickedUp: "Mark picked up",
    accept: "Accept",
    decline: "Decline",
    latestOffer: "Latest offer",
    latestOfferCopy: "A new delivery just arrived with sound and vibration.",
    liveOfferReady: "Offer ready now",
    noOffers: "No live offers right now.",
    noAssigned: "No assigned deliveries yet.",
    activeShift: "Active shift",
    noActiveShift: "No active shift",
    lastPing: "Last ping",
    total: "Total",
    eta: "ETA",
    customer: "Customer",
    phone: "Phone",
    market: "Market",
    earningHint: "Potential earning",
    tapDismiss: "Dismiss",
  },
  ka: {
    title: "áƒ›áƒ«áƒ¦áƒáƒšáƒ˜áƒ¡ áƒ°áƒáƒ‘áƒ˜",
    subtitle: "áƒ¨áƒ”áƒ›áƒáƒ¡áƒ£áƒšáƒ˜ áƒ¨áƒ”áƒ—áƒáƒ•áƒáƒ–áƒ”áƒ‘áƒ”áƒ‘áƒ˜, áƒªáƒ•áƒšáƒ˜áƒ¡ áƒ™áƒáƒœáƒ¢áƒ áƒáƒšáƒ˜ áƒ“áƒ áƒ›áƒ˜áƒ¬áƒáƒ“áƒ”áƒ‘áƒ˜áƒ¡ áƒ“áƒáƒ“áƒáƒ¡áƒ¢áƒ£áƒ áƒ”áƒ‘áƒ áƒ”áƒ áƒ— áƒ›áƒáƒ‘áƒáƒ˜áƒš-áƒ”áƒ™áƒ áƒáƒœáƒ–áƒ”.",
    onlyDrivers: "áƒ”áƒ¡ áƒ¡áƒ˜áƒ•áƒ áƒªáƒ” áƒ›áƒ®áƒáƒšáƒáƒ“ áƒ›áƒ«áƒ¦áƒáƒšáƒ˜áƒ¡ áƒáƒœáƒ’áƒáƒ áƒ˜áƒ¨áƒ”áƒ‘áƒ˜áƒ¡áƒ—áƒ•áƒ˜áƒ¡áƒáƒ.",
    status: "áƒ¡áƒ¢áƒáƒ¢áƒ£áƒ¡áƒ˜",
    offers: "áƒ¨áƒ”áƒ—áƒáƒ•áƒáƒ–áƒ”áƒ‘áƒ”áƒ‘áƒ˜",
    assigned: "áƒ›áƒ˜áƒœáƒ˜áƒ­áƒ”áƒ‘áƒ£áƒšáƒ˜",
    liveNow: "áƒáƒ®áƒšáƒ",
    driverStatus: "áƒ›áƒ«áƒ¦áƒáƒšáƒ˜áƒ¡ áƒ¡áƒ¢áƒáƒ¢áƒ£áƒ¡áƒ˜",
    dispatchPulse: "áƒ“áƒ˜áƒ¡áƒžáƒ”áƒ¢áƒ©áƒ”áƒ áƒ˜áƒ¡ áƒ áƒ˜áƒ—áƒ›áƒ˜",
    dispatchPulseCopy: "áƒ“áƒáƒ áƒ©áƒ˜ áƒáƒœáƒšáƒáƒ˜áƒœ, áƒ’áƒáƒáƒ–áƒ˜áƒáƒ áƒ” áƒšáƒáƒ™áƒáƒªáƒ˜áƒ áƒ“áƒ áƒ¡áƒ¬áƒ áƒáƒ¤áƒáƒ“ áƒ’áƒáƒ˜áƒ¦áƒ” áƒáƒ®áƒáƒš áƒ¨áƒ”áƒ—áƒáƒ•áƒáƒ–áƒ”áƒ‘áƒ”áƒ‘áƒ–áƒ”.",
    startShift: "áƒªáƒ•áƒšáƒ˜áƒ¡ áƒ“áƒáƒ¬áƒ§áƒ”áƒ‘áƒ",
    endShift: "áƒªáƒ•áƒšáƒ˜áƒ¡ áƒ“áƒáƒ¡áƒ áƒ£áƒšáƒ”áƒ‘áƒ",
    sendLocation: "áƒšáƒáƒ™áƒáƒªáƒ˜áƒ˜áƒ¡ áƒžáƒ˜áƒœáƒ’áƒ˜",
    locationTitle: "áƒšáƒáƒ™áƒáƒªáƒ˜áƒ˜áƒ¡ áƒ¡áƒ˜áƒœáƒ¥áƒ˜",
    locationCopy: "áƒ“áƒ˜áƒ¡áƒžáƒ”áƒ¢áƒ©áƒ”áƒ áƒ¡ áƒ›áƒ˜áƒáƒ¬áƒáƒ“áƒ” áƒáƒ¥áƒ¢áƒ£áƒáƒšáƒ£áƒ áƒ˜ áƒ›áƒ“áƒ”áƒ‘áƒáƒ áƒ”áƒáƒ‘áƒ, áƒ áƒáƒ—áƒ ETA áƒ“áƒ áƒ¢áƒ áƒ”áƒ™áƒ˜áƒœáƒ’áƒ˜ áƒ¡áƒ¬áƒáƒ áƒ˜ áƒ“áƒáƒ áƒ©áƒ”áƒ¡.",
    incomingOffers: "áƒ¨áƒ”áƒ›áƒáƒ›áƒáƒ•áƒáƒšáƒ˜ áƒ¨áƒ”áƒ—áƒáƒ•áƒáƒ–áƒ”áƒ‘áƒ”áƒ‘áƒ˜",
    incomingOffersCopy: "áƒáƒ®áƒáƒšáƒ˜ áƒ¨áƒ”áƒ™áƒ•áƒ”áƒ—áƒ”áƒ‘áƒ˜ áƒžáƒ˜áƒ áƒ•áƒ”áƒšáƒáƒ“ áƒáƒ¥ áƒ©áƒœáƒ“áƒ”áƒ‘áƒ. áƒ“áƒ áƒáƒ£áƒšáƒáƒ“ áƒ“áƒáƒ”áƒ—áƒáƒœáƒ®áƒ›áƒ” áƒ¡áƒáƒœáƒáƒ› áƒ¨áƒ”áƒ—áƒáƒ•áƒáƒ–áƒ”áƒ‘áƒ áƒ’áƒáƒ¥áƒ áƒ”áƒ¡.",
    assignedDeliveries: "áƒ›áƒ˜áƒœáƒ˜áƒ­áƒ”áƒ‘áƒ£áƒšáƒ˜ áƒ›áƒ˜áƒ¬áƒáƒ“áƒ”áƒ‘áƒ”áƒ‘áƒ˜",
    assignedDeliveriesCopy: "áƒ›áƒ˜áƒ›áƒ“áƒ˜áƒœáƒáƒ áƒ” áƒ¨áƒ”áƒ™áƒ•áƒ”áƒ—áƒ”áƒ‘áƒ˜ áƒ“áƒ áƒ›áƒ˜áƒ¬áƒáƒ“áƒ”áƒ‘áƒ˜áƒ¡ áƒ“áƒáƒ“áƒáƒ¡áƒ¢áƒ£áƒ áƒ”áƒ‘áƒáƒ¡ áƒ¥áƒ›áƒ”áƒ“áƒ”áƒ‘áƒ”áƒ‘áƒ˜ áƒ”áƒ áƒ—áƒáƒ“.",
    proofNote: "áƒ“áƒáƒ“áƒáƒ¡áƒ¢áƒ£áƒ áƒ”áƒ‘áƒ˜áƒ¡ áƒ©áƒáƒœáƒáƒ¬áƒ”áƒ áƒ˜",
    proofPhoto: "áƒ¤áƒáƒ¢áƒáƒ¡ URL",
    proofSignature: "áƒ®áƒ”áƒšáƒ›áƒáƒ¬áƒ”áƒ áƒ",
    markDelivered: "áƒ›áƒ˜áƒ¢áƒáƒœáƒ",
    markPickedUp: "áƒáƒ§áƒ•áƒáƒœáƒ˜áƒšáƒ˜áƒ",
    accept: "áƒ“áƒáƒ—áƒáƒœáƒ®áƒ›áƒ”áƒ‘áƒ",
    decline: "áƒ£áƒáƒ áƒ§áƒáƒ¤áƒ",
    latestOffer: "áƒ‘áƒáƒšáƒ áƒ¨áƒ”áƒ—áƒáƒ•áƒáƒ–áƒ”áƒ‘áƒ",
    latestOfferCopy: "áƒáƒ®áƒáƒšáƒ˜ áƒ›áƒ˜áƒ¬áƒáƒ“áƒ”áƒ‘áƒ áƒ®áƒ›áƒáƒ— áƒ“áƒ áƒ•áƒ˜áƒ‘áƒ áƒáƒªáƒ˜áƒ˜áƒ— áƒ¨áƒ”áƒ›áƒáƒ•áƒ˜áƒ“áƒ.",
    liveOfferReady: "áƒ¨áƒ”áƒ—áƒáƒ•áƒáƒ–áƒ”áƒ‘áƒ áƒ›áƒ–áƒáƒ“ áƒáƒ áƒ˜áƒ¡",
    noOffers: "áƒáƒ®áƒšáƒ áƒªáƒáƒªáƒ®áƒáƒšáƒ˜ áƒ¨áƒ”áƒ—áƒáƒ•áƒáƒ–áƒ”áƒ‘áƒ áƒáƒ  áƒáƒ áƒ˜áƒ¡.",
    noAssigned: "áƒ›áƒ˜áƒœáƒ˜áƒ­áƒ”áƒ‘áƒ£áƒšáƒ˜ áƒ›áƒ˜áƒ¬áƒáƒ“áƒ”áƒ‘áƒ áƒ¯áƒ”áƒ  áƒáƒ  áƒáƒ áƒ˜áƒ¡.",
    activeShift: "áƒáƒ¥áƒ¢áƒ˜áƒ£áƒ áƒ˜ áƒªáƒ•áƒšáƒ",
    noActiveShift: "áƒáƒ¥áƒ¢áƒ˜áƒ£áƒ áƒ˜ áƒªáƒ•áƒšáƒ áƒáƒ  áƒáƒ áƒ˜áƒ¡",
    lastPing: "áƒ‘áƒáƒšáƒ áƒžáƒ˜áƒœáƒ’áƒ˜",
    total: "áƒ¯áƒáƒ›áƒ˜",
    eta: "ETA",
    customer: "áƒ›áƒáƒ›áƒ®áƒ›áƒáƒ áƒ”áƒ‘áƒ”áƒšáƒ˜",
    phone: "áƒ¢áƒ”áƒšáƒ”áƒ¤áƒáƒœáƒ˜",
    market: "áƒ‘áƒáƒ–áƒáƒ áƒ˜",
    earningHint: "áƒ¡áƒáƒ•áƒáƒ áƒáƒ£áƒ“áƒ áƒ¨áƒ”áƒ›áƒáƒ¡áƒáƒ•áƒáƒšáƒ˜",
    tapDismiss: "áƒ“áƒáƒ®áƒ£áƒ áƒ”",
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
    <SectionCard
      title={order.code}
      subtitle={order.dropoff_address || "No address set"}
      right={<Pill>{formatOrderStatus(order.status, language)}</Pill>}
    >
      <View style={styles.metaRow}>
        {order.market?.code ? <Pill tone="neutral">{order.market.code}</Pill> : null}
        {order.total != null ? <Pill tone="warning">{formatMoney(order.total, language)}</Pill> : null}
        {order.eta_summary?.estimated_delivery_at ? <Pill tone="success">{formatDateTime(order.eta_summary.estimated_delivery_at, language)}</Pill> : null}
      </View>

      <View style={styles.detailList}>
        <DetailLine label={language === "ka" ? copy.ka.customer : copy.en.customer} value={order.customer_name || order.customer?.name || "Unknown"} />
        <DetailLine label={language === "ka" ? copy.ka.phone : copy.en.phone} value={order.customer_phone || "Not provided"} />
        <DetailLine label={language === "ka" ? copy.ka.market : copy.en.market} value={order.market?.name || "Direct order"} />
        {order.driver_compensation?.earning_amount ? (
          <DetailLine
            label={language === "ka" ? copy.ka.earningHint : copy.en.earningHint}
            value={formatMoney(order.driver_compensation.earning_amount, language)}
            emphasize
          />
        ) : null}
      </View>

      {order.notes ? <HelperText>{order.notes}</HelperText> : null}
      {actions}
    </SectionCard>
  );
}

export function DriverHubScreen({ navigation }: DriverHubProps) {
  const access = useProtectedAccess("DriverHub");
  const { language } = usePreferences();
  const text = copy[language];
  const palette = usePalette();
  const queryClient = useQueryClient();
  const [lat, setLat] = useState("41.7151");
  const [lng, setLng] = useState("44.8271");
  const [proofNote, setProofNote] = useState("");
  const [proofPhoto, setProofPhoto] = useState("");
  const [proofSignature, setProofSignature] = useState("");
  const [latestOfferAlert, setLatestOfferAlert] = useState<Order | null>(null);
  const seenOfferIdsRef = useRef<Set<number> | null>(null);
  const alertTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const roles = access.me?.roles ?? [];
  const isDriver = roles.includes("driver");

  const feedQ = useQuery({
    queryKey: ["driver-feed"],
    queryFn: async () => (await api.get("/api/driver/orders/feed")).data as DriverFeed,
    refetchInterval: access.ready && isDriver ? 5000 : false,
    enabled: access.ready && isDriver,
  });

  useEffect(() => {
    void prepareLocalNotifications();

    return () => {
      if (alertTimeoutRef.current) {
        clearTimeout(alertTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const offers = feedQ.data?.offered_orders ?? [];
    const nextIds = new Set(offers.map((order) => order.id));

    if (seenOfferIdsRef.current == null) {
      seenOfferIdsRef.current = nextIds;
      return;
    }

    const newestOffer = offers.find((order) => !seenOfferIdsRef.current?.has(order.id));
    seenOfferIdsRef.current = nextIds;

    if (!newestOffer) {
      return;
    }

    setLatestOfferAlert(newestOffer);
    if (alertTimeoutRef.current) {
      clearTimeout(alertTimeoutRef.current);
    }
    alertTimeoutRef.current = setTimeout(() => {
      setLatestOfferAlert((current) => (current?.id === newestOffer.id ? null : current));
    }, 9000);

    void notifyIncomingOffer(newestOffer);
  }, [feedQ.data?.offered_orders]);

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
        ? (
            await api.post(`/api/driver/orders/${orderId}/delivered`, {
              proof_note: proofNote || null,
              proof_photo_url: proofPhoto || null,
              proof_signature_name: proofSignature || null,
            })
          ).data
        : (await api.post(`/api/driver/orders/${orderId}/${action}`)).data,
    onSuccess: async () => {
      setProofNote("");
      setProofPhoto("");
      setProofSignature("");
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
  const offeredOrders = feedQ.data?.offered_orders ?? [];
  const assignedOrders = feedQ.data?.assigned_orders ?? [];
  const lastPingAt = feedQ.data?.driver?.latest_ping?.updated_at;

  return (
    <AppShell navigation={navigation} screenName="DriverHub" title={text.title} subtitle={text.subtitle}>
      <StatGrid>
        <StatCard label={text.status} value={driverStatus} note={activeShift ? text.activeShift : text.noActiveShift} />
        <StatCard label={text.offers} value={offeredOrders.length} note={text.liveOfferReady} />
        <StatCard label={text.assigned} value={assignedOrders.length} note={text.assignedDeliveries} />
        <StatCard label={text.liveNow} value={lastPingAt ? formatDateTime(lastPingAt, language) : "-"} note={text.lastPing} />
      </StatGrid>

      {latestOfferAlert ? (
        <View
          style={[
            styles.alertPanel,
            {
              backgroundColor: `${palette.primary}18`,
              borderColor: `${palette.primary}66`,
              shadowColor: palette.shadow,
            },
          ]}
        >
          <View style={styles.alertHeader}>
            <View style={styles.alertText}>
              <Text style={[styles.alertEyebrow, { color: palette.primaryStrong }]}>{text.latestOffer}</Text>
              <Text style={[styles.alertTitle, { color: palette.text }]}>{latestOfferAlert.code}</Text>
              <Text style={[styles.alertCopy, { color: palette.muted }]}>{text.latestOfferCopy}</Text>
            </View>
            <Pressable onPress={() => setLatestOfferAlert(null)} style={[styles.dismissButton, { borderColor: `${palette.border}aa` }]}>
              <Text style={[styles.dismissButtonText, { color: palette.text }]}>{text.tapDismiss}</Text>
            </Pressable>
          </View>
          <View style={styles.metaRow}>
            <Pill tone="warning">{latestOfferAlert.total != null ? formatMoney(latestOfferAlert.total, language) : text.total}</Pill>
            <Pill tone="success">
              {latestOfferAlert.eta_summary?.estimated_delivery_at
                ? formatDateTime(latestOfferAlert.eta_summary.estimated_delivery_at, language)
                : text.eta}
            </Pill>
          </View>
          <HelperText>{latestOfferAlert.dropoff_address || "No address set"}</HelperText>
        </View>
      ) : null}

      <SectionCard title={text.dispatchPulse} subtitle={text.dispatchPulseCopy}>
        <View style={styles.actionTray}>
          <View style={[styles.actionPill, { backgroundColor: `${palette.surfaceMuted}ef`, borderColor: `${palette.border}bf` }]}>
            <Text style={[styles.actionPillLabel, { color: palette.muted }]}>{text.driverStatus}</Text>
            <Text style={[styles.actionPillValue, { color: palette.text }]}>{driverStatus}</Text>
          </View>
          <View style={[styles.actionPill, { backgroundColor: `${palette.surfaceMuted}ef`, borderColor: `${palette.border}bf` }]}>
            <Text style={[styles.actionPillLabel, { color: palette.muted }]}>{text.activeShift}</Text>
            <Text style={[styles.actionPillValue, { color: palette.text }]}>
              {activeShift ? formatDateTime(activeShift.started_at, language) : text.noActiveShift}
            </Text>
          </View>
        </View>

        <View style={styles.row}>
          <AppButton onPress={() => startShiftM.mutate()} disabled={!!activeShift || startShiftM.isPending}>
            {text.startShift}
          </AppButton>
          <AppButton variant="secondary" onPress={() => endShiftM.mutate()} disabled={!activeShift || endShiftM.isPending}>
            {text.endShift}
          </AppButton>
        </View>
      </SectionCard>

      <SectionCard title={text.locationTitle} subtitle={text.locationCopy}>
        <InputField label="Latitude" value={lat} onChangeText={setLat} keyboardType="numeric" />
        <InputField label="Longitude" value={lng} onChangeText={setLng} keyboardType="numeric" />
        <AppButton variant="secondary" onPress={() => pingM.mutate()} disabled={pingM.isPending}>
          {text.sendLocation}
        </AppButton>
        {mutationError ? <HelperText tone="danger">{mutationError}</HelperText> : null}
      </SectionCard>

      <SectionCard title={text.incomingOffers} subtitle={text.incomingOffersCopy}>
        {feedQ.isLoading ? (
          <LoadingBlock message="Loading driver feed..." />
        ) : offeredOrders.length === 0 ? (
          <EmptyBlock message={text.noOffers} />
        ) : (
          <View style={uiStyles.listGap}>
            {offeredOrders.map((order) => (
              <DriverOrderCard
                key={order.id}
                order={order}
                language={language}
                actions={
                  <View style={styles.row}>
                    <AppButton compact onPress={() => actionM.mutate({ orderId: order.id, action: "accept" })}>
                      {text.accept}
                    </AppButton>
                    <AppButton variant="secondary" compact onPress={() => actionM.mutate({ orderId: order.id, action: "decline" })}>
                      {text.decline}
                    </AppButton>
                  </View>
                }
              />
            ))}
          </View>
        )}
      </SectionCard>

      <SectionCard title={text.assignedDeliveries} subtitle={text.assignedDeliveriesCopy}>
        <View style={[styles.proofPanel, { backgroundColor: `${palette.surfaceMuted}ee`, borderColor: `${palette.border}bf` }]}>
          <InputField label={text.proofNote} value={proofNote} onChangeText={setProofNote} />
          <InputField label={text.proofPhoto} value={proofPhoto} onChangeText={setProofPhoto} />
          <InputField label={text.proofSignature} value={proofSignature} onChangeText={setProofSignature} />
        </View>

        {assignedOrders.length === 0 ? (
          <EmptyBlock message={text.noAssigned} />
        ) : (
          <View style={uiStyles.listGap}>
            {assignedOrders.map((order) => (
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
        )}
      </SectionCard>
    </AppShell>
  );
}

function DetailLine({
  label,
  value,
  emphasize = false,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
}) {
  const palette = usePalette();

  return (
    <View style={styles.detailLine}>
      <Text style={[styles.detailLabel, { color: palette.muted }]}>{label}</Text>
      <Text style={[styles.detailValue, { color: emphasize ? palette.primaryStrong : palette.text }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  detailList: {
    gap: 8,
  },
  detailLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.7,
    flex: 1,
  },
  detailValue: {
    flex: 1.2,
    fontSize: 14,
    fontWeight: "700",
    textAlign: "right",
  },
  alertPanel: {
    borderWidth: 1,
    borderRadius: 28,
    padding: 18,
    gap: 10,
    shadowOpacity: 0.16,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 },
    elevation: 5,
  },
  alertHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  alertText: {
    flex: 1,
    gap: 4,
  },
  alertEyebrow: {
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  alertTitle: {
    fontSize: 24,
    fontWeight: "900",
  },
  alertCopy: {
    fontSize: 14,
    lineHeight: 20,
  },
  dismissButton: {
    minHeight: 38,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  dismissButtonText: {
    fontSize: 12,
    fontWeight: "800",
  },
  actionTray: {
    gap: 10,
  },
  actionPill: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 4,
  },
  actionPillLabel: {
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  actionPillValue: {
    fontSize: 15,
    fontWeight: "800",
  },
  proofPanel: {
    borderWidth: 1,
    borderRadius: 22,
    padding: 14,
    gap: 12,
  },
});
