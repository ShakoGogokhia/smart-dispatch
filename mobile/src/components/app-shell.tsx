import { useEffect, useMemo, useState } from "react";
import type { PropsWithChildren } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";

import { AppButton, AppModal, HeroCard, Pill, Screen, SectionCard, SettingRow, usePalette } from "@/src/components/ui";
import { api } from "@/src/lib/api";
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
  icon: keyof typeof Ionicons.glyphMap;
  mobileLabel?: string;
};

export function AppShell({ children, navigation, screenName, title, subtitle, marketId }: AppShellProps) {
  const palette = usePalette();
  const { signOut } = useAuth();
  const { language, setLanguage, theme, toggleTheme } = usePreferences();
  const meQ = useMe(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [storedMarketId, setStoredMarketId] = useState("");

  const roles = meQ.data?.roles ?? [];
  const isAdmin = roles.includes("admin");
  const isDriver = roles.includes("driver");
  const isCustomerOnly =
    roles.includes("customer") && !roles.some((role: string) => ["admin", "owner", "staff", "driver"].includes(role));

  const myMarketsQ = useQuery({
    queryKey: ["my-markets-lite"],
    queryFn: async () => (await api.get("/api/my/markets")).data as MarketLite[],
    enabled: !!meQ.data && !isCustomerOnly,
    retry: false,
  });

  const notificationsQ = useQuery({
    queryKey: ["notifications"],
    queryFn: async () => (await api.get("/api/notifications")).data as NotificationRecord[],
    enabled: !!meQ.data,
    refetchInterval: 15000,
  });

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

  const navEntries: NavEntry[] = isCustomerOnly
    ? [
        { label: "Browse markets", name: "PublicMarkets", icon: "storefront-outline", mobileLabel: "Markets" },
        { label: "Track order", name: "OrderTracking", icon: "navigate-outline", mobileLabel: "Track" },
        { label: "My orders", name: "Orders", icon: "cube-outline", mobileLabel: "Orders" },
      ]
    : [
        { label: "Browse markets", name: "PublicMarkets", icon: "storefront-outline", mobileLabel: "Order" },
        { label: "Track order", name: "OrderTracking", icon: "navigate-outline", mobileLabel: "Track" },
        ...(isDriver ? [{ label: "Driver Hub", name: "DriverHub" as const, icon: "car-outline" as const, mobileLabel: "Driver" }] : []),
        ...(isDriver ? [{ label: "Driver Earnings", name: "DriverEarnings" as const, icon: "wallet-outline" as const, mobileLabel: "Earn" }] : []),
        { label: "Orders", name: "Orders", icon: "cube-outline", mobileLabel: "Orders" },
        { label: "Routes", name: "Routes", icon: "git-branch-outline", mobileLabel: "Routes" },
        { label: "Live Map", name: "LiveMap", icon: "map-outline", mobileLabel: "Map" },
        { label: "Analytics", name: "Analytics", icon: "bar-chart-outline", mobileLabel: "Stats" },
        {
          label: isAdmin ? "Markets" : "My Markets",
          name: isAdmin ? "Markets" : "MyMarkets",
          icon: "storefront-outline",
          mobileLabel: "Markets",
        },
        ...(currentMarketId
          ? [
              { label: "Market Settings", name: "MarketSettings" as const, params: { marketId: currentMarketId }, icon: "settings-outline" as const },
              { label: "Market Items", name: "MarketItems" as const, params: { marketId: currentMarketId }, icon: "basket-outline" as const },
              { label: "Promo Codes", name: "MarketPromoCodes" as const, params: { marketId: currentMarketId }, icon: "pricetag-outline" as const },
            ]
          : []),
        ...(isAdmin
          ? [
              { label: "Drivers", name: "Drivers" as const, icon: "people-circle-outline" as const },
              { label: "Users", name: "Users" as const, icon: "people-outline" as const },
            ]
          : []),
      ];

  const bottomNav = isCustomerOnly
    ? navEntries.slice(0, 3)
    : [
        navEntries.find((entry) => entry.name === "PublicMarkets"),
        navEntries.find((entry) => entry.name === "Orders"),
        isDriver ? navEntries.find((entry) => entry.name === "DriverHub") : navEntries.find((entry) => entry.name === "Routes"),
        navEntries.find((entry) => entry.name === "LiveMap"),
      ].filter((entry): entry is NavEntry => Boolean(entry));

  async function handleLogout() {
    await signOut();
    navigation.reset({
      index: 0,
      routes: [{ name: "PublicMarkets" }],
    });
  }

  return (
    <Screen scroll={false}>
      <View style={styles.shellRoot}>
        <ScrollView
          style={styles.shellScroll}
          contentContainerStyle={styles.shellContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View
            style={[
              styles.mobileTopBar,
              {
                backgroundColor: `${palette.surface}ee`,
                borderColor: `${palette.border}bf`,
                shadowColor: palette.shadow,
              },
            ]}
          >
            <Pressable onPress={() => setMenuOpen(true)} style={[styles.iconButton, { backgroundColor: palette.surfaceMuted, borderColor: `${palette.border}cc` }]}>
              <Ionicons name="menu-outline" size={20} color={palette.text} />
            </Pressable>
            <View style={styles.mobileTopText}>
              <Text style={[styles.mobileTopKicker, { color: palette.muted }]}>Workspace</Text>
              <Text style={[styles.mobileTopTitle, { color: palette.text }]} numberOfLines={1}>
                {title}
              </Text>
            </View>
            <View style={[styles.unreadBadge, { backgroundColor: palette.dark ? `${palette.primary}24` : "#0f172a" }]}>
              <Text style={[styles.unreadText, { color: palette.dark ? palette.primaryStrong : "#ffffff" }]}>
                {notificationsQ.data?.filter((item) => !item.read_at).length ?? 0}
              </Text>
            </View>
          </View>

          <HeroCard eyebrow="Workspace" title={title} subtitle={subtitle}>
            <View style={styles.heroTopRow}>
              <View style={styles.heroMeta}>
                <Text style={[styles.metaLabel, { color: "rgba(255,255,255,0.58)" }]}>Signed in as</Text>
                <Text style={[styles.metaValue, { color: "#ffffff" }]}>{meQ.data?.name || "Workspace member"}</Text>
              </View>
              <View style={styles.heroButtonGroup}>
                <AppButton compact onPress={() => navigation.navigate("PublicMarkets")}>
                  Order
                </AppButton>
                <AppButton variant="secondary" compact onPress={() => setMenuOpen(true)}>
                  Menu
                </AppButton>
              </View>
            </View>

            <View style={styles.pillRow}>
              {roles.map((role: string) => (
                <Pill key={role}>{role}</Pill>
              ))}
              {currentMarket ? <Pill tone="success">{currentMarket.code}</Pill> : null}
              <Pill tone="warning">{notificationsQ.data?.filter((item) => !item.read_at).length ?? 0} unread</Pill>
            </View>
          </HeroCard>

          {children}

          <View style={styles.bottomSpacer} />
        </ScrollView>

      <View
        style={[
          styles.bottomNav,
          {
            backgroundColor: `${palette.surface}f4`,
            borderColor: `${palette.border}bf`,
            shadowColor: palette.shadow,
          },
        ]}
      >
        {bottomNav.map((entry) => {
          const active = entry.name === screenName;

          return (
            <Pressable
              key={entry.name}
              onPress={() => navigation.navigate(entry.name, entry.params)}
              style={[
                styles.bottomItem,
                active && {
                  backgroundColor: palette.dark ? `${palette.primary}24` : "#0f172a",
                },
              ]}
            >
              <Ionicons name={entry.icon} size={17} color={active ? (palette.dark ? palette.primaryStrong : "#ffffff") : palette.muted} />
              <Text style={[styles.bottomLabel, { color: active ? (palette.dark ? palette.primaryStrong : "#ffffff") : palette.muted }]} numberOfLines={1}>
                {entry.mobileLabel ?? entry.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      </View>

      <AppModal visible={menuOpen} title="Workspace" onClose={() => setMenuOpen(false)}>
        <View style={styles.modalSection}>
          <Text style={[styles.sectionTitle, { color: palette.text }]}>Account</Text>
          <SectionCard>
            <Text style={[styles.sectionLead, { color: palette.text }]}>{meQ.data?.name || "Workspace member"}</Text>
            <Text style={[styles.sectionHint, { color: palette.muted }]}>{meQ.data?.email || "No email loaded"}</Text>
            <View style={styles.pillRow}>
              {roles.map((role: string) => (
                <Pill key={role}>{role}</Pill>
              ))}
              {(meQ.data?.permissions ?? []).slice(0, 3).map((permission: string) => (
                <Pill key={permission}>{permission}</Pill>
              ))}
            </View>
          </SectionCard>
          <SettingRow
            label="Profile settings"
            value="Name, phone, address, password"
            onPress={() => {
              setMenuOpen(false);
              navigation.navigate("Profile");
            }}
          />
        </View>

        {currentMarket ? (
          <View style={styles.modalSection}>
            <Text style={[styles.sectionTitle, { color: palette.text }]}>Current market</Text>
            <SectionCard>
              <Text style={[styles.sectionLead, { color: palette.text }]}>{currentMarket.name}</Text>
              <Text style={[styles.sectionHint, { color: palette.muted }]}>{currentMarket.code}</Text>
            </SectionCard>
          </View>
        ) : null}

        <View style={styles.modalSection}>
          <Text style={[styles.sectionTitle, { color: palette.text }]}>Navigate</Text>
          {navEntries.map((entry) => (
            <SettingRow
              key={`${entry.name}-${entry.label}`}
              label={entry.label}
              value={screenName === entry.name ? "Current" : undefined}
              onPress={() => {
                setMenuOpen(false);
                navigation.navigate(entry.name, entry.params);
              }}
            />
          ))}
        </View>

        <View style={styles.modalSection}>
          <Text style={[styles.sectionTitle, { color: palette.text }]}>Notifications</Text>
          <SectionCard>
            {(notificationsQ.data ?? []).slice(0, 3).map((entry) => (
              <View key={entry.id} style={styles.noticeRow}>
                <Text style={[styles.sectionLead, { color: palette.text }]}>{entry.title}</Text>
                <Text style={[styles.sectionHint, { color: palette.muted }]}>{entry.message}</Text>
              </View>
            ))}
          </SectionCard>
        </View>

        <View style={styles.modalSection}>
          <Text style={[styles.sectionTitle, { color: palette.text }]}>Preferences</Text>
          <View style={styles.choiceRow}>
            <Pressable
              onPress={() => void setLanguage("en")}
              style={[
                styles.choice,
                {
                  backgroundColor: `${palette.surfaceMuted}ef`,
                  borderColor: `${palette.border}bf`,
                },
                language === "en" && { backgroundColor: `${palette.primary}1f`, borderColor: `${palette.primary}88` },
              ]}
            >
              <Text style={[styles.choiceText, { color: palette.text }]}>English</Text>
            </Pressable>
            <Pressable
              onPress={() => void setLanguage("ka")}
              style={[
                styles.choice,
                {
                  backgroundColor: `${palette.surfaceMuted}ef`,
                  borderColor: `${palette.border}bf`,
                },
                language === "ka" && { backgroundColor: `${palette.primary}1f`, borderColor: `${palette.primary}88` },
              ]}
            >
              <Text style={[styles.choiceText, { color: palette.text }]}>Georgian</Text>
            </Pressable>
          </View>
          <AppButton variant="secondary" onPress={() => void toggleTheme()}>
            Theme: {theme}
          </AppButton>
        </View>

        <View style={styles.modalSection}>
          <AppButton variant="danger" onPress={() => void handleLogout()}>
            Log out
          </AppButton>
        </View>
      </AppModal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  shellRoot: {
    flex: 1,
  },
  shellScroll: {
    flex: 1,
  },
  shellContent: {
    gap: 16,
  },
  mobileTopBar: {
    borderWidth: 1,
    borderRadius: 28,
    padding: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  mobileTopText: {
    flex: 1,
    minWidth: 0,
  },
  mobileTopKicker: {
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 1.8,
  },
  mobileTopTitle: {
    marginTop: 2,
    fontSize: 18,
    fontWeight: "900",
  },
  unreadBadge: {
    minWidth: 40,
    height: 40,
    borderRadius: 999,
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  unreadText: {
    fontSize: 13,
    fontWeight: "900",
  },
  bottomNav: {
    position: "absolute",
    left: 18,
    right: 18,
    bottom: 12,
    minHeight: 70,
    borderRadius: 24,
    borderWidth: 1,
    padding: 8,
    flexDirection: "row",
    gap: 6,
    shadowOpacity: 0.14,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 14 },
    elevation: 8,
  },
  bottomItem: {
    flex: 1,
    minWidth: 0,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    paddingHorizontal: 2,
    paddingVertical: 7,
  },
  bottomLabel: {
    fontSize: 10,
    fontWeight: "900",
  },
  bottomSpacer: {
    height: 82,
  },
  heroTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 16,
    marginTop: 6,
  },
  heroMeta: {
    flex: 1,
    gap: 4,
  },
  heroButtonGroup: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-end",
    gap: 8,
  },
  metaLabel: {
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  metaValue: {
    fontSize: 18,
    fontWeight: "800",
  },
  pillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 4,
  },
  modalSection: {
    gap: 10,
    marginBottom: 18,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "800",
  },
  sectionLead: {
    fontSize: 16,
    fontWeight: "800",
  },
  sectionHint: {
    fontSize: 13,
    lineHeight: 18,
  },
  noticeRow: {
    gap: 4,
    marginBottom: 10,
  },
  choiceRow: {
    flexDirection: "row",
    gap: 10,
  },
  choice: {
    flex: 1,
    minHeight: 46,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  choiceText: {
    fontSize: 14,
    fontWeight: "800",
  },
});
