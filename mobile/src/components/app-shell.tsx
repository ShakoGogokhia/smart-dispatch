import { useEffect, useMemo, useState } from "react";
import type { PropsWithChildren } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";

import {
  AppText,
  Avatar,
  Badge,
  Button,
  IconButton,
  ListItem,
  PageHeader,
  Screen,
  SegmentedControl,
  Separator,
  Sheet,
  ThemePanel,
  ThemeToggle,
  useColors,
  withAlpha,
  type IconName,
} from "@/src/components/ui";
import { api } from "@/src/lib/api";
import { formatDateTime } from "@/src/lib/format";
import { getActiveMarketId, setActiveMarketId } from "@/src/lib/storage";
import { useAuth, usePreferences } from "@/src/providers/app-providers";
import { useMe } from "@/src/lib/use-me";
import type { MarketLite, NotificationRecord } from "@/src/types/api";
import type { ProtectedRouteName, RootStackParamList } from "@/src/types/navigation";

type AppShellProps = PropsWithChildren<{
  navigation: any;
  screenName: ProtectedRouteName;
  title: string;
  subtitle: string;
  marketId?: string;
}>;

type NavEntry = {
  label: string;
  name: keyof RootStackParamList;
  params?: Record<string, unknown>;
  icon: IconName;
  mobileLabel?: string;
};

type NavSection = { title: string; items: NavEntry[] };

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  owner: "Owner",
  staff: "Staff",
  customer: "Customer",
  driver: "Driver",
};

export function AppShell({ children, navigation, screenName, title, subtitle, marketId }: AppShellProps) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { signOut } = useAuth();
  const { language, setLanguage } = usePreferences();
  const meQ = useMe(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [storedMarketId, setStoredMarketId] = useState("");

  const user = meQ.data;
  const roles: string[] = user?.roles ?? [];
  const isAdmin = roles.includes("admin");
  const isDriver = roles.includes("driver");
  const isCustomerOnly =
    roles.includes("customer") && !roles.some((role: string) => ["admin", "owner", "staff", "driver"].includes(role));

  const myMarketsQ = useQuery({
    queryKey: ["my-markets-lite"],
    queryFn: async () => (await api.get("/api/my/markets")).data as MarketLite[],
    enabled: !!user && !isCustomerOnly,
    retry: false,
  });

  const notificationsQ = useQuery({
    queryKey: ["notifications"],
    queryFn: async () => (await api.get("/api/notifications")).data as NotificationRecord[],
    enabled: !!user,
    refetchInterval: 15000,
  });

  const notifications = notificationsQ.data ?? [];
  const unreadCount = notifications.filter((item) => !item.read_at).length;

  useEffect(() => {
    let active = true;

    async function loadCurrentMarket() {
      const nextMarketId = marketId || (await getActiveMarketId());

      if (!active) {
        return;
      }

      setStoredMarketId(nextMarketId);
    }

    void loadCurrentMarket();

    return () => {
      active = false;
    };
  }, [marketId, screenName]);

  useEffect(() => {
    if (marketId) {
      void setActiveMarketId(marketId);
    }
  }, [marketId]);

  const autoMarketId = myMarketsQ.data?.length === 1 ? String(myMarketsQ.data[0].id) : "";
  const currentMarketId = marketId || storedMarketId || autoMarketId;
  const currentMarket = useMemo(
    () => myMarketsQ.data?.find((entry) => String(entry.id) === currentMarketId) ?? null,
    [currentMarketId, myMarketsQ.data],
  );

  const sections: NavSection[] = isCustomerOnly
    ? [
        {
          title: "Shop",
          items: [
            { label: "Browse markets", name: "PublicMarkets", icon: "storefront-outline", mobileLabel: "Markets" },
            { label: "Track order", name: "OrderTracking", icon: "navigate-outline", mobileLabel: "Track" },
            { label: "My orders", name: "Orders", icon: "cube-outline", mobileLabel: "Orders" },
          ],
        },
      ]
    : [
        {
          title: "Shop",
          items: [
            { label: "Browse markets", name: "PublicMarkets", icon: "storefront-outline", mobileLabel: "Shop" },
            { label: "Track order", name: "OrderTracking", icon: "navigate-outline", mobileLabel: "Track" },
          ],
        },
        ...(isDriver
          ? [
              {
                title: "Driver",
                items: [
                  { label: "Driver hub", name: "DriverHub" as const, icon: "car-outline" as const, mobileLabel: "Driver" },
                  { label: "Earnings", name: "DriverEarnings" as const, icon: "wallet-outline" as const, mobileLabel: "Earn" },
                ],
              },
            ]
          : []),
        {
          title: "Operations",
          items: [
            { label: "Orders", name: "Orders", icon: "cube-outline", mobileLabel: "Orders" },
            { label: "Routes", name: "Routes", icon: "git-branch-outline", mobileLabel: "Routes" },
            { label: "Live map", name: "LiveMap", icon: "map-outline", mobileLabel: "Map" },
            { label: "Analytics", name: "Analytics", icon: "bar-chart-outline", mobileLabel: "Stats" },
          ],
        },
        {
          title: currentMarket ? currentMarket.name : "Markets",
          items: [
            { label: isAdmin ? "All markets" : "My markets", name: isAdmin ? "Markets" : "MyMarkets", icon: "storefront-outline", mobileLabel: "Markets" },
            ...(currentMarketId
              ? [
                  { label: "Products", name: "MarketItems" as const, params: { marketId: currentMarketId }, icon: "basket-outline" as const },
                  { label: "Promo codes", name: "MarketPromoCodes" as const, params: { marketId: currentMarketId }, icon: "pricetag-outline" as const },
                  { label: "Market settings", name: "MarketSettings" as const, params: { marketId: currentMarketId }, icon: "settings-outline" as const },
                ]
              : []),
          ],
        },
        ...(isAdmin
          ? [
              {
                title: "Admin",
                items: [
                  { label: "Drivers", name: "Drivers" as const, icon: "people-circle-outline" as const },
                  { label: "Users", name: "Users" as const, icon: "people-outline" as const },
                ],
              },
            ]
          : []),
      ];

  const navEntries = sections.flatMap((section) => section.items);
  const find = (name: keyof RootStackParamList) => navEntries.find((entry) => entry.name === name);

  const bottomNav = (
    isCustomerOnly
      ? [find("PublicMarkets"), find("Orders"), find("OrderTracking")]
      : [find("PublicMarkets"), find("Orders"), isDriver ? find("DriverHub") : find("Routes"), find("LiveMap"), find(isAdmin ? "Markets" : "MyMarkets")]
  ).filter((entry): entry is NavEntry => Boolean(entry));

  function go(entry: NavEntry) {
    setMenuOpen(false);
    navigation.navigate(entry.name, entry.params);
  }

  function switchMarket(market: MarketLite) {
    void setActiveMarketId(String(market.id));
    setStoredMarketId(String(market.id));
    setMenuOpen(false);
    navigation.navigate("MarketItems", { marketId: String(market.id) });
  }

  async function handleLogout() {
    setMenuOpen(false);
    await signOut();
    navigation.reset({
      index: 0,
      routes: [{ name: "PublicMarkets" }],
    });
  }

  const topBar = (
    <View style={[styles.topBar, { backgroundColor: c.background, borderBottomColor: c.border }]}>
      <IconButton icon="menu-outline" onPress={() => setMenuOpen(true)} accessibilityLabel="Open menu" />
      <View style={styles.topTitle}>
        <Text numberOfLines={1} style={[styles.topTitleText, { color: c.foreground }]}>
          {title}
        </Text>
        {currentMarket ? (
          <Text numberOfLines={1} style={[styles.topSubtitle, { color: c.mutedForeground }]}>
            {currentMarket.name}
          </Text>
        ) : null}
      </View>
      <IconButton icon="notifications-outline" onPress={() => setNotificationsOpen(true)} accessibilityLabel={`Notifications, ${unreadCount} unread`} badge={unreadCount} />
      <ThemeToggle />
      <Pressable onPress={() => setMenuOpen(true)} accessibilityLabel="Account menu" style={styles.avatarButton}>
        <Avatar name={user?.name} uri={user?.profile_photo_url} size={30} />
      </Pressable>
    </View>
  );

  return (
    <Screen scroll={false} header={topBar} contentStyle={styles.noPad}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={[styles.content, { paddingBottom: 96 + insets.bottom }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <PageHeader title={title} description={subtitle} />
        {children}
      </ScrollView>

      <View
        style={[
          styles.bottomNav,
          { backgroundColor: withAlpha(c.background, 0.96), borderTopColor: c.border, paddingBottom: Math.max(insets.bottom, 8) },
        ]}
      >
        {bottomNav.map((entry) => {
          const active = entry.name === screenName;
          return (
            <Pressable
              key={entry.name}
              onPress={() => navigation.navigate(entry.name, entry.params)}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              style={styles.bottomItem}
            >
              <View style={[styles.bottomIconWrap, active && { backgroundColor: withAlpha(c.primary, 0.12) }]}>
                <Ionicons name={active ? (entry.icon.replace("-outline", "") as IconName) : entry.icon} size={20} color={active ? c.primary : c.mutedForeground} />
              </View>
              <Text numberOfLines={1} style={[styles.bottomLabel, { color: active ? c.primary : c.mutedForeground }]}>
                {entry.mobileLabel ?? entry.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Sheet visible={menuOpen} title="Smart Dispatch" description="Workspace navigation" onClose={() => setMenuOpen(false)}>
        <Pressable
          onPress={() => {
            setMenuOpen(false);
            navigation.navigate("Profile");
          }}
          style={[styles.accountCard, { borderColor: c.border, backgroundColor: c.card }]}
        >
          <Avatar name={user?.name} uri={user?.profile_photo_url} size={42} />
          <View style={styles.flex}>
            <AppText variant="heading" numberOfLines={1}>{user?.name || "Workspace member"}</AppText>
            <AppText variant="caption" numberOfLines={1}>{user?.email || ""}</AppText>
            <View style={styles.badgeRow}>
              {roles.map((role) => (
                <Badge key={role} tone="primary">{ROLE_LABELS[role] ?? role}</Badge>
              ))}
            </View>
          </View>
          <Ionicons name="chevron-forward" size={16} color={c.mutedForeground} />
        </Pressable>

        {!isCustomerOnly && (myMarketsQ.data?.length ?? 0) > 1 ? (
          <View style={styles.section}>
            <AppText variant="caption" style={styles.sectionTitle}>Switch market</AppText>
            {(myMarketsQ.data ?? []).map((market) => (
              <ListItem
                key={market.id}
                title={market.name}
                description={market.code}
                icon="storefront-outline"
                active={String(market.id) === currentMarketId}
                onPress={() => switchMarket(market)}
              />
            ))}
          </View>
        ) : null}

        {sections.map((section) => (
          <View key={section.title} style={styles.section}>
            <AppText variant="caption" style={styles.sectionTitle}>{section.title.toUpperCase()}</AppText>
            {section.items.map((entry) => (
              <ListItem
                key={`${entry.name}-${entry.label}`}
                title={entry.label}
                icon={entry.icon}
                active={screenName === entry.name}
                onPress={() => go(entry)}
              />
            ))}
          </View>
        ))}

        <Separator />

        <View style={styles.section}>
          <AppText variant="caption" style={styles.sectionTitle}>PREFERENCES</AppText>
          <SegmentedControl
            value={language}
            onChange={(next) => void setLanguage(next)}
            options={[
              { value: "en", label: "English" },
              { value: "ka", label: "ქართული" },
            ]}
          />
          <ThemePanel />
        </View>

        <Button variant="outline" icon="log-out-outline" onPress={() => void handleLogout()} fullWidth>
          Sign out
        </Button>
      </Sheet>

      <Sheet visible={notificationsOpen} title="Notifications" description={`${unreadCount} unread`} onClose={() => setNotificationsOpen(false)}>
        {notifications.length === 0 ? (
          <View style={styles.emptyNotice}>
            <Ionicons name="notifications-off-outline" size={22} color={c.mutedForeground} />
            <AppText variant="small" tone="muted">You&apos;re all caught up.</AppText>
          </View>
        ) : (
          notifications.slice(0, 20).map((entry) => (
            <View key={entry.id} style={[styles.noticeRow, { borderBottomColor: c.border }]}>
              <View style={[styles.noticeDot, { backgroundColor: entry.read_at ? "transparent" : c.primary }]} />
              <View style={styles.flex}>
                <AppText variant="label">{entry.title}</AppText>
                <AppText variant="small" tone="muted">{entry.message}</AppText>
                {entry.created_at ? <AppText variant="caption">{formatDateTime(entry.created_at, language)}</AppText> : null}
              </View>
            </View>
          ))
        )}
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  noPad: { paddingHorizontal: 0, paddingTop: 0, paddingBottom: 0, gap: 0 },
  topBar: {
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    paddingHorizontal: 8,
    borderBottomWidth: StyleSheet.hairlineWidth * 2,
  },
  topTitle: { flex: 1, minWidth: 0, paddingHorizontal: 4 },
  topTitleText: { fontSize: 16, fontWeight: "600" },
  topSubtitle: { fontSize: 12, marginTop: 1 },
  avatarButton: { paddingHorizontal: 6 },
  content: { paddingHorizontal: 16, paddingTop: 16, gap: 16 },
  bottomNav: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    borderTopWidth: StyleSheet.hairlineWidth * 2,
    paddingTop: 6,
    paddingHorizontal: 6,
  },
  bottomItem: { flex: 1, minWidth: 0, alignItems: "center", gap: 2, paddingVertical: 2 },
  bottomIconWrap: { width: 52, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  bottomLabel: { fontSize: 11, fontWeight: "500" },
  accountCard: { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderRadius: 14, padding: 12 },
  badgeRow: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 6 },
  section: { gap: 2 },
  sectionTitle: { fontWeight: "600", letterSpacing: 0.6, paddingHorizontal: 10, paddingBottom: 4 },
  emptyNotice: { alignItems: "center", gap: 8, paddingVertical: 24 },
  noticeRow: { flexDirection: "row", gap: 10, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth * 2 },
  noticeDot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
});
