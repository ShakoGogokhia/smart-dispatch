import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { PropsWithChildren } from "react";
import { BackHandler, FlatList, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import type { NativeScrollEvent, NativeSyntheticEvent } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";

import { Alert, AppText, Button, IconButton, radius, useColors, withAlpha, type IconName } from "@/src/components/ui";
import { api } from "@/src/lib/api";
import { getDefaultAuthedRoute, normalizeRoles } from "@/src/lib/session";
import { getStoredValue, setStoredValue } from "@/src/lib/storage";
import { navigationRef } from "@/src/navigation-ref";
import { useAuth } from "@/src/providers/app-providers";
import type { RootStackParamList } from "@/src/types/navigation";

/**
 * First-run product tour — the mobile version of the web WelcomeTour: the same screenshots and story,
 * swipeable full-screen pages, and one-tap sign-in with the demo accounts at the end.
 */

const SEEN_KEY = "sd-tour-seen";
const DEMO_PASSWORD = "123456";

type Step = { image: number; role: string; title: string; body: string; tryIt: string };

const STEPS: Step[] = [
  {
    image: require("../../assets/tour/home.jpg"),
    role: "Welcome",
    title: "Smart Dispatch in one minute",
    body: "A delivery platform with four connected roles: customers order from local markets, market owners prepare the orders, drivers deliver them, and admins dispatch everything in real time. The web and mobile apps share the same API.",
    tryIt: "Browse the markets on the home screen, no sign-in needed.",
  },
  {
    image: require("../../assets/tour/cust-history.jpg"),
    role: "Customer",
    title: "Order, pay and reorder",
    body: "Customers add items to the cart, check out with saved details, and see every order with its receipt, payment state and rating. Any past order can be reordered in one tap.",
    tryIt: "Sign in as the customer and open My orders.",
  },
  {
    image: require("../../assets/tour/track.jpg"),
    role: "Customer",
    title: "Live order tracking",
    body: "Each order has a tracking screen with a step-by-step timeline, the assigned driver and a live map. It refreshes on its own every few seconds.",
    tryIt: "Open Track order and enter DEMO-00005.",
  },
  {
    image: require("../../assets/tour/owner-dash.jpg"),
    role: "Market owner",
    title: "Run the market",
    body: "Owners manage products, stock, deals, promo codes, opening hours and their team. The market type unlocks the right tools, like 1+1 deals for food or specifications for auto parts.",
    tryIt: "Sign in as the market owner and open My markets.",
  },
  {
    image: require("../../assets/tour/driver-hub.jpg"),
    role: "Driver",
    title: "Accept and deliver",
    body: "Drivers go online to receive delivery offers with a countdown, accept or decline, mark pickup, and finish with proof of delivery. Earnings are tracked per shift.",
    tryIt: "Sign in as the driver — the Driver hub opens right away.",
  },
  {
    image: require("../../assets/tour/dispatch.jpg"),
    role: "Admin",
    title: "Dispatch with reasons",
    body: "Every order gets the best driver suggested with the reasons: distance, free capacity, active orders and earlier declines. Unanswered offers time out and move to the next driver.",
    tryIt: "Sign in as the admin and open Orders.",
  },
  {
    image: require("../../assets/tour/livemap.jpg"),
    role: "Admin",
    title: "Live map and operations",
    body: "Admins follow every driver on a live map with route history and stale-location alerts, and manage markets, users and drivers.",
    tryIt: "Sign in as the admin and open Live map.",
  },
];

const ACCOUNTS: Array<{ role: string; email: string; icon: IconName }> = [
  { role: "Customer", email: "customer@test.com", icon: "person-outline" },
  { role: "Market owner", email: "owner@test.com", icon: "storefront-outline" },
  { role: "Driver", email: "driver@test.com", icon: "car-outline" },
  { role: "Admin", email: "admin@test.com", icon: "shield-checkmark-outline" },
];

const TOTAL = STEPS.length + 1;

type TourContextValue = { openTour: () => void };
const TourContext = createContext<TourContextValue | null>(null);

/** Open the tour from anywhere (menu, home screen). */
export function useWelcomeTour() {
  const value = useContext(TourContext);
  if (!value) throw new Error("useWelcomeTour must be used inside <WelcomeTourProvider>");
  return value;
}

export function WelcomeTourProvider({ children }: PropsWithChildren) {
  const [visible, setVisible] = useState(false);

  // Show automatically the first time the app is opened. Wait until the first screen has settled:
  // on Android a Modal opened during the launch navigation can be swallowed.
  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    getStoredValue(SEEN_KEY)
      .then((seen) => {
        if (active && seen !== "1") timer = setTimeout(() => active && setVisible(true), 1200);
      })
      .catch(() => undefined);
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, []);

  const close = useCallback(() => {
    setVisible(false);
    void setStoredValue(SEEN_KEY, "1").catch(() => undefined);
  }, []);

  const value = useMemo<TourContextValue>(() => ({ openTour: () => setVisible(true) }), []);

  return (
    <TourContext.Provider value={value}>
      {children}
      {visible ? <WelcomeTour onClose={close} /> : null}
    </TourContext.Provider>
  );
}

function WelcomeTour({ onClose }: { onClose: () => void }) {
  const c = useColors();
  const { width } = useWindowDimensions();
  const { signIn } = useAuth();
  const listRef = useRef<FlatList<number>>(null);
  const [index, setIndex] = useState(0);
  const [signingIn, setSigningIn] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isLast = index === TOTAL - 1;

  // Android back button closes the tour.
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [onClose]);

  const pages = useMemo(() => Array.from({ length: TOTAL }, (_, i) => i), []);

  const goTo = (next: number) => {
    const target = Math.min(Math.max(next, 0), TOTAL - 1);
    listRef.current?.scrollToIndex({ index: target, animated: true });
    setIndex(target);
  };

  const onScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    setIndex(Math.round(event.nativeEvent.contentOffset.x / width));
  };

  async function signInAs(email: string) {
    setSigningIn(email);
    setError(null);
    try {
      const data = (await api.post("/api/login", { email, password: DEMO_PASSWORD })).data;
      await signIn(data.token);
      onClose();
      const routeName = getDefaultAuthedRoute(normalizeRoles(data?.user?.roles)) as keyof RootStackParamList;
      if (navigationRef.isReady()) {
        navigationRef.reset({ index: 0, routes: [{ name: routeName as never }] });
      }
    } catch {
      setError("Couldn't sign in. Make sure the backend is running (or the demo server is awake) and try again.");
      setSigningIn(null);
    }
  }

  const renderPage = ({ item: page }: { item: number }) => {
    if (page === STEPS.length) {
      return (
        <View style={[styles.page, { width }]}>
          <View style={styles.pageContent}>
            <AppText variant="caption" tone="primary" style={styles.eyebrow}>
              TRY IT YOURSELF
            </AppText>
            <AppText variant="title">Sign in with a demo account</AppText>
            <AppText variant="muted">
              Every account uses the password <Text style={[styles.mono, { color: c.foreground }]}>{DEMO_PASSWORD}</Text>. The demo data
              resets itself, so feel free to tap around and change things.
            </AppText>

            <View style={styles.accounts}>
              {ACCOUNTS.map((account) => (
                <Pressable
                  key={account.email}
                  disabled={signingIn !== null}
                  onPress={() => void signInAs(account.email)}
                  accessibilityRole="button"
                  accessibilityLabel={`Sign in as ${account.role}`}
                  style={({ pressed }) => [
                    styles.account,
                    { borderColor: c.border, backgroundColor: pressed ? c.accent : c.card },
                    signingIn !== null && signingIn !== account.email && styles.dimmed,
                  ]}
                >
                  <View style={[styles.accountIcon, { backgroundColor: withAlpha(c.primary, 0.12) }]}>
                    <Ionicons name={account.icon} size={20} color={c.primary} />
                  </View>
                  <View style={styles.flex}>
                    <AppText variant="label" style={styles.semibold}>
                      {account.role}
                    </AppText>
                    <Text numberOfLines={1} style={[styles.email, { color: c.mutedForeground }]}>
                      {account.email}
                    </Text>
                  </View>
                  <Ionicons
                    name={signingIn === account.email ? "hourglass-outline" : "log-in-outline"}
                    size={18}
                    color={c.mutedForeground}
                  />
                </Pressable>
              ))}
            </View>

            {error ? <Alert tone="destructive" title="Sign-in failed" description={error} /> : null}
          </View>
        </View>
      );
    }

    const step = STEPS[page];
    return (
      <View style={[styles.page, { width }]}>
        <View style={styles.pageContent}>
          <View style={[styles.shot, { borderColor: c.border, backgroundColor: c.muted }]}>
            <Image source={step.image} style={styles.shotImage} contentFit="cover" contentPosition="top" transition={150} />
          </View>
          <AppText variant="caption" tone="primary" style={styles.eyebrow}>
            {step.role.toUpperCase()}
          </AppText>
          <AppText variant="title">{step.title}</AppText>
          <AppText variant="muted" style={styles.body}>
            {step.body}
          </AppText>
          <View style={[styles.tryIt, { borderColor: c.border, backgroundColor: withAlpha(c.primary, 0.05) }]}>
            <Ionicons name="bulb-outline" size={16} color={c.primary} style={styles.tryIcon} />
            <Text style={[styles.tryText, { color: c.mutedForeground }]}>
              <Text style={[styles.semibold, { color: c.foreground }]}>Try it: </Text>
              {step.tryIt}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    // A full-screen overlay instead of <Modal>: on Android a Modal opened during launch can be swallowed.
    <View style={[StyleSheet.absoluteFill, styles.overlay, { backgroundColor: c.background }]}>
      <SafeAreaView style={[styles.flex, { backgroundColor: c.background }]}>
        <View style={[styles.header, { borderBottomColor: c.border }]}>
          <Ionicons name="compass-outline" size={18} color={c.mutedForeground} />
          <AppText variant="small" tone="muted" style={styles.flex}>
            Product tour
          </AppText>
          <AppText variant="small" tone="muted" style={styles.counter}>
            {index + 1} / {TOTAL}
          </AppText>
          <IconButton icon="close" onPress={onClose} accessibilityLabel="Close tour" size={36} />
        </View>

        <FlatList
          ref={listRef}
          data={pages}
          keyExtractor={(page) => String(page)}
          renderItem={renderPage}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={onScrollEnd}
          getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
          style={styles.flex}
        />

        <View style={[styles.footer, { borderTopColor: c.border }]}>
          <View style={styles.dots} accessibilityLabel={`Step ${index + 1} of ${TOTAL}`}>
            {pages.map((page) => (
              <Pressable
                key={page}
                onPress={() => goTo(page)}
                hitSlop={6}
                accessibilityLabel={`Go to step ${page + 1}`}
                style={[styles.dot, page === index ? [styles.dotActive, { backgroundColor: c.primary }] : { backgroundColor: c.border }]}
              />
            ))}
          </View>
          <View style={styles.actions}>
            {index === 0 ? (
              <Button variant="ghost" size="sm" onPress={onClose}>
                Skip
              </Button>
            ) : (
              <Button variant="ghost" size="sm" icon="arrow-back" onPress={() => goTo(index - 1)}>
                Back
              </Button>
            )}
            {isLast ? (
              <Button size="sm" onPress={onClose}>
                Explore on my own
              </Button>
            ) : (
              <Button size="sm" iconRight="arrow-forward" onPress={() => goTo(index + 1)}>
                Next
              </Button>
            )}
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  overlay: { zIndex: 1000, elevation: 1000 },
  semibold: { fontWeight: "600" },
  dimmed: { opacity: 0.5 },
  header: { flexDirection: "row", alignItems: "center", gap: 8, height: 52, paddingLeft: 16, paddingRight: 8, borderBottomWidth: StyleSheet.hairlineWidth * 2 },
  counter: { fontVariant: ["tabular-nums"] },
  page: { flex: 1 },
  pageContent: { padding: 20, gap: 10 },
  shot: { borderWidth: 1, borderRadius: radius.xl, overflow: "hidden", marginBottom: 8 },
  shotImage: { width: "100%", aspectRatio: 16 / 10 },
  eyebrow: { fontWeight: "600", letterSpacing: 0.8 },
  body: { lineHeight: 21 },
  tryIt: { flexDirection: "row", gap: 8, borderWidth: 1, borderRadius: radius.lg, padding: 12, marginTop: 4 },
  tryIcon: { marginTop: 1 },
  tryText: { flex: 1, fontSize: 13.5, lineHeight: 19 },
  mono: { fontFamily: "monospace", fontWeight: "600" },
  accounts: { gap: 10, marginTop: 8 },
  account: { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderRadius: radius.lg, padding: 12 },
  accountIcon: { width: 40, height: 40, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  email: { fontSize: 12, fontFamily: "monospace" },
  footer: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth * 2 },
  dots: { flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 1 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  dotActive: { width: 20 },
  actions: { flexDirection: "row", alignItems: "center", gap: 6 },
});
