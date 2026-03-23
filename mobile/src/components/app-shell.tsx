import { useEffect, useMemo, useState } from "react";
import type { PropsWithChildren } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";

import { AppButton, AppModal, HeroCard, Pill, Screen, SectionCard, SettingRow, usePalette } from "@/src/components/ui";
import { api } from "@/src/lib/api";
import { getActiveMarketId, setActiveMarketId } from "@/src/lib/storage";
import { useAuth, usePreferences } from "@/src/providers/app-providers";
import { useMe } from "@/src/lib/use-me";
import type { MarketLite } from "@/src/types/api";
import type { ProtectedRouteName } from "@/src/types/navigation";

type AppShellProps = PropsWithChildren<{
  navigation: any;
  screenName: ProtectedRouteName;
  title: string;
  subtitle: string;
  marketId?: string;
}>;

type NavEntry = {
  label: string;
  name: ProtectedRouteName;
  params?: Record<string, unknown>;
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
    ? [{ label: "Orders", name: "Orders" }]
    : [
        ...(isDriver ? [{ label: "Driver Hub", name: "DriverHub" as const }] : []),
        { label: "Orders", name: "Orders" },
        { label: "Routes", name: "Routes" },
        { label: "Live Map", name: "LiveMap" },
        { label: "Analytics", name: "Analytics" },
        {
          label: isAdmin ? "Markets" : "My Markets",
          name: isAdmin ? "Markets" : "MyMarkets",
        },
        ...(currentMarketId
          ? [
              { label: "Market Settings", name: "MarketSettings" as const, params: { marketId: currentMarketId } },
              { label: "Market Items", name: "MarketItems" as const, params: { marketId: currentMarketId } },
              { label: "Promo Codes", name: "MarketPromoCodes" as const, params: { marketId: currentMarketId } },
            ]
          : []),
        ...(isAdmin
          ? [
              { label: "Drivers", name: "Drivers" as const },
              { label: "Users", name: "Users" as const },
            ]
          : []),
      ];

  async function handleLogout() {
    await signOut();
    navigation.reset({
      index: 0,
      routes: [{ name: "PublicMarkets" }],
    });
  }

  return (
    <Screen>
      <HeroCard eyebrow="Workspace" title={title} subtitle={subtitle}>
        <View style={styles.heroTopRow}>
          <View style={styles.heroMeta}>
            <Text style={[styles.metaLabel, { color: palette.muted }]}>Signed in as</Text>
            <Text style={[styles.metaValue, { color: palette.text }]}>{meQ.data?.name || "Workspace member"}</Text>
          </View>
          <AppButton variant="secondary" compact onPress={() => setMenuOpen(true)}>
            Menu
          </AppButton>
        </View>

        <View style={styles.pillRow}>
          {roles.map((role: string) => (
            <Pill key={role}>{role}</Pill>
          ))}
          {currentMarket ? <Pill tone="success">{currentMarket.code}</Pill> : null}
        </View>
      </HeroCard>

      {children}

      <AppModal visible={menuOpen} title="Workspace" onClose={() => setMenuOpen(false)}>
        <View style={styles.modalSection}>
          <Text style={[styles.sectionTitle, { color: palette.text }]}>Account</Text>
          <SectionCard>
            <Text style={[styles.sectionLead, { color: palette.text }]}>{meQ.data?.name || "Workspace member"}</Text>
            <View style={styles.pillRow}>
              {roles.map((role: string) => (
                <Pill key={role}>{role}</Pill>
              ))}
            </View>
          </SectionCard>
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
