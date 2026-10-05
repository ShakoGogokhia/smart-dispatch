/**
 * Small building blocks shared by the operations + admin screens (orders, routes, live map,
 * analytics, markets, users, drivers). Colors come from theme tokens only.
 */
import type { ReactNode } from "react";
import { Image, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { AppText, Badge, Button, Card, Row, radius, useColors, withAlpha } from "@/src/components/ui";
import type { IconName } from "@/src/components/ui";
import { formatMoney, toNumber, type AppLanguage } from "@/src/lib/format";
import type { MarketLite } from "@/src/types/api";

/** Compact label/value tile (web `InfoCard` / `DetailStat`). */
export function DetailStat({ icon, label, value, strong = false }: { icon?: IconName; label: string; value: string; strong?: boolean }) {
  const c = useColors();
  return (
    <View style={[styles.detailStat, { borderColor: c.border, backgroundColor: withAlpha(c.muted, 0.5) }]}>
      <Row gap={5}>
        {icon ? <Ionicons name={icon} size={13} color={c.mutedForeground} /> : null}
        <AppText variant="caption" numberOfLines={1}>
          {label}
        </AppText>
      </Row>
      <AppText variant="small" numberOfLines={1} style={strong ? styles.semibold : styles.medium}>
        {value}
      </AppText>
    </View>
  );
}

/** Two-column grid of DetailStat tiles. */
export function DetailGrid({ children }: { children: ReactNode }) {
  return <View style={styles.detailGrid}>{children}</View>;
}

/** Section title inside a sheet / card body. */
export function DetailSection({ title, description, icon, children }: { title: string; description?: string; icon?: IconName; children: ReactNode }) {
  const c = useColors();
  return (
    <View style={styles.section}>
      <View>
        <Row gap={6}>
          {icon ? <Ionicons name={icon} size={15} color={c.mutedForeground} /> : null}
          <AppText variant="label" style={styles.semibold}>
            {title}
          </AppText>
        </Row>
        {description ? <AppText variant="caption">{description}</AppText> : null}
      </View>
      {children}
    </View>
  );
}

/** Horizontal bar on a muted track. Segments are drawn left to right, widths relative to `max`. */
export function HBar({ segments, max, height = 8 }: { segments: { value: number; color: string }[]; max: number; height?: number }) {
  const c = useColors();
  const safeMax = Math.max(1, max);
  return (
    <View style={[styles.barTrack, { height, borderRadius: height / 2, backgroundColor: c.muted }]}>
      {segments.map((segment, index) => (
        <View
          key={index}
          style={{ width: `${Math.max(0, Math.min(100, (segment.value / safeMax) * 100))}%`, backgroundColor: segment.color }}
        />
      ))}
    </View>
  );
}

export function LegendDot({ color, label, line = false }: { color: string; label: string; line?: boolean }) {
  return (
    <Row gap={6}>
      <View style={[line ? styles.legendLine : styles.legendDot, { backgroundColor: color }]} />
      <AppText variant="caption">{label}</AppText>
    </Row>
  );
}

export function RankBadge({ rank }: { rank: number }) {
  const c = useColors();
  return (
    <View style={[styles.rank, { backgroundColor: c.muted }]}>
      <AppText variant="caption" style={styles.semibold}>
        {rank}
      </AppText>
    </View>
  );
}

/** Thumbnail with a muted placeholder icon. */
export function Thumb({ uri, size, icon = "storefront-outline", rounded = radius.lg }: { uri?: string | null; size: number; icon?: IconName; rounded?: number }) {
  const c = useColors();
  if (uri) {
    return <Image source={{ uri }} resizeMode="cover" style={{ width: size, height: size, borderRadius: rounded, backgroundColor: c.muted }} />;
  }
  return (
    <View style={[styles.center, { width: size, height: size, borderRadius: rounded, backgroundColor: c.muted }]}>
      <Ionicons name={icon} size={size * 0.45} color={c.mutedForeground} />
    </View>
  );
}

export type MarketCardAction = { label: string; icon: IconName; onPress: () => void; primary?: boolean };

/** Market card used by Markets (admin) and My markets (web AdminMarketCard / MyMarkets card). */
export function MarketCard({
  market,
  language,
  actions,
  showOwner = true,
}: {
  market: MarketLite;
  language: AppLanguage;
  actions: MarketCardAction[];
  showOwner?: boolean;
}) {
  const c = useColors();
  const promo = market.active_promo;
  const promoText = promo
    ? promo.type === "percent"
      ? `${toNumber(promo.value)}% off`
      : `${formatMoney(promo.value ?? 0, language)} off`
    : null;

  return (
    <Card padded={false} style={styles.overflowHidden}>
      <View style={[styles.banner, { backgroundColor: c.muted }]}>
        {market.banner_url ? (
          <Image source={{ uri: market.banner_url }} resizeMode="cover" style={StyleSheet.absoluteFill} />
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.center, { backgroundColor: withAlpha(c.primary, 0.08) }]}>
            <Ionicons name="image-outline" size={22} color={c.mutedForeground} />
          </View>
        )}
        {market.is_featured ? (
          <View style={styles.bannerBadge}>
            <Badge tone="warning" variant="solid" icon="sparkles">
              {market.featured_badge || "Promoted"}
            </Badge>
          </View>
        ) : null}
      </View>

      <View style={styles.marketBody}>
        <Row gap={12} align="flex-start">
          <View style={[styles.logoWrap, { borderColor: c.card, backgroundColor: c.card }]}>
            <Thumb uri={market.logo_url ?? market.image_url} size={52} />
          </View>
          <View style={styles.flexShrink}>
            <AppText variant="heading" numberOfLines={1}>
              {market.name}
            </AppText>
            <Row gap={6} wrap style={styles.mt4}>
              <Badge variant="outline">{market.code}</Badge>
              <Badge tone={market.is_active === false ? "neutral" : "success"} dot>
                {market.is_active === false ? "Hidden" : "Live"}
              </Badge>
            </Row>
          </View>
        </Row>

        <AppText variant="small" tone="muted" numberOfLines={2}>
          {market.featured_headline || market.address || "No public marketing copy yet."}
        </AppText>

        <View style={[styles.metaRow, { borderTopColor: c.border }]}>
          {showOwner ? (
            <View style={styles.metaCell}>
              <AppText variant="caption">Owner</AppText>
              <AppText variant="small" numberOfLines={1} style={styles.medium}>
                {market.owner?.name ?? (market.owner_user_id ? `User #${market.owner_user_id}` : "-")}
              </AppText>
            </View>
          ) : null}
          <View style={styles.metaCell}>
            <AppText variant="caption">Visible items</AppText>
            <AppText variant="small" style={styles.medium}>
              {market.active_items_count ?? 0}
            </AppText>
          </View>
          <View style={styles.metaCell}>
            <AppText variant="caption">Offer</AppText>
            <AppText variant="small" numberOfLines={1} style={styles.medium}>
              {promo?.code ? `${promo.code} live` : "No live code"}
            </AppText>
            {promoText ? (
              <AppText variant="caption" numberOfLines={1}>
                {promoText}
              </AppText>
            ) : null}
          </View>
        </View>
      </View>

      <View style={[styles.marketFooter, { borderTopColor: c.border, backgroundColor: withAlpha(c.muted, 0.35) }]}>
        {actions.map((action) => (
          <Button
            key={action.label}
            size="sm"
            variant={action.primary ? "default" : "outline"}
            icon={action.icon}
            onPress={action.onPress}
            style={styles.footerButton}
          >
            {action.label}
          </Button>
        ))}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  semibold: { fontWeight: "600" },
  medium: { fontWeight: "500" },
  flexShrink: { flexShrink: 1, flexGrow: 1 },
  center: { alignItems: "center", justifyContent: "center" },
  mt4: { marginTop: 4 },
  overflowHidden: { overflow: "hidden" },
  detailStat: { flexGrow: 1, flexBasis: "46%", minWidth: 0, borderWidth: 1, borderRadius: radius.lg, padding: 10, gap: 3 },
  detailGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  section: { gap: 10 },
  barTrack: { flexDirection: "row", overflow: "hidden" },
  legendDot: { width: 10, height: 10, borderRadius: 3 },
  legendLine: { width: 14, height: 4, borderRadius: 2 },
  rank: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  banner: { height: 96, overflow: "hidden" },
  bannerBadge: { position: "absolute", top: 10, left: 10 },
  marketBody: { padding: 16, gap: 12 },
  logoWrap: { marginTop: -38, borderWidth: 2, borderRadius: radius.lg + 2 },
  metaRow: { flexDirection: "row", gap: 12, borderTopWidth: StyleSheet.hairlineWidth * 2, paddingTop: 12 },
  metaCell: { flex: 1, minWidth: 0, gap: 2 },
  marketFooter: { flexDirection: "row", flexWrap: "wrap", gap: 8, borderTopWidth: StyleSheet.hairlineWidth * 2, padding: 12 },
  footerButton: { flexGrow: 1, flexBasis: "45%" },
});
