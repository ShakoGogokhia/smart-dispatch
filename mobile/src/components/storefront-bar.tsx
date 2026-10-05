import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { Avatar, Button, IconButton, ThemeToggle, useColors } from "@/src/components/ui";
import { useMe } from "@/src/lib/use-me";
import { useAuth } from "@/src/providers/app-providers";

/** Smart Dispatch logo mark + wordmark (same as the web Brand). */
export function Brand({ onPress, compact = false }: { onPress?: () => void; compact?: boolean }) {
  const c = useColors();
  return (
    <Pressable onPress={onPress} accessibilityRole="link" accessibilityLabel="Smart Dispatch home" style={styles.brand}>
      <View style={[styles.brandMark, { backgroundColor: c.primary }]}>
        <Ionicons name="car-outline" size={17} color={c.primaryForeground} />
      </View>
      {!compact ? <Text style={[styles.brandText, { color: c.foreground }]}>Smart Dispatch</Text> : null}
    </Pressable>
  );
}

/**
 * Sticky top bar shared by every customer-facing screen (home, markets, market, checkout, tracking, login).
 * Mirrors the web `StorefrontHeader`: brand, optional actions (cart), theme switcher, account.
 * Pass it to `<Screen header={<StorefrontBar navigation={navigation} />}>`.
 */
export function StorefrontBar({
  navigation,
  actions,
  showBack = false,
  showAccount = true,
}: {
  navigation: any;
  actions?: ReactNode;
  showBack?: boolean;
  showAccount?: boolean;
}) {
  const c = useColors();
  const { token } = useAuth();
  const meQ = useMe(!!token);

  return (
    <View style={[styles.bar, { backgroundColor: c.background, borderBottomColor: c.border }]}>
      {showBack && navigation.canGoBack?.() ? (
        <IconButton icon="chevron-back" onPress={() => navigation.goBack()} accessibilityLabel="Go back" />
      ) : null}
      <Brand onPress={() => navigation.navigate("Home")} compact={showBack} />
      <View style={styles.flex} />
      {actions}
      <ThemeToggle />
      {showAccount ? (
        token ? (
          <Pressable onPress={() => navigation.navigate("Profile")} accessibilityLabel="Account" style={styles.avatar}>
            <Avatar name={meQ.data?.name} uri={meQ.data?.profile_photo_url} size={30} />
          </Pressable>
        ) : (
          <Button size="sm" onPress={() => navigation.navigate("Login", { mode: "login" })} style={styles.signIn}>
            Sign in
          </Button>
        )
      ) : null}
    </View>
  );
}

/** Cart icon button with a count badge, for the StorefrontBar `actions` slot. */
export function CartButton({ count, onPress }: { count: number; onPress: () => void }) {
  return <IconButton icon="bag-handle-outline" onPress={onPress} accessibilityLabel={`Cart, ${count} items`} badge={count} />;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  bar: {
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    paddingHorizontal: 10,
    borderBottomWidth: StyleSheet.hairlineWidth * 2,
  },
  brand: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 4 },
  brandMark: { width: 32, height: 32, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  brandText: { fontSize: 15, fontWeight: "600", letterSpacing: -0.2 },
  avatar: { paddingHorizontal: 6 },
  signIn: { marginLeft: 4 },
});
