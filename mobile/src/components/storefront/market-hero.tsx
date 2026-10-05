import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { Alert, AppText, Badge, Button, Row, Separator, Sheet, Skeleton, radius, useColors, withAlpha } from "@/src/components/ui";
import { usePreferences } from "@/src/providers/app-providers";
import type { MarketLite, PromoCode } from "@/src/types/api";

import { MediaImage, RatingInline } from "./common";
import {
  formatDeliverySlot,
  formatMarketHours,
  formatOperatingHoursList,
  formatPromoLabel,
  getMarketBannerUrl,
  marketStatusLabel,
  resolveMarketMediaUrl,
  type StorefrontMarket,
} from "./utils";

function initials(name?: string | null) {
  return (
    (name ?? "M")
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "M"
  );
}

export function MarketHero({
  market,
  isOpen,
  promo,
  itemCount,
  reviewSummary,
  onShowReviews,
  canFavorite,
  isFavorite,
  favoritePending,
  onToggleFavorite,
}: {
  market?: StorefrontMarket;
  isOpen: boolean;
  promo?: PromoCode | MarketLite["active_promo"] | null;
  itemCount: number;
  reviewSummary: { average: number; count: number };
  onShowReviews: () => void;
  canFavorite: boolean;
  isFavorite: boolean;
  favoritePending: boolean;
  onToggleFavorite: () => void;
}) {
  const c = useColors();
  const { language } = usePreferences();
  const [hoursOpen, setHoursOpen] = useState(false);
  const bannerUrl = getMarketBannerUrl(market);
  const logoUrl = resolveMarketMediaUrl(market?.logo_url);
  const statusLabel = marketStatusLabel(market);
  const hoursLabel = formatMarketHours(market);
  const deliverySlots = (market?.delivery_slots ?? []).map(formatDeliverySlot).filter(Boolean);
  const promoLabel = formatPromoLabel(promo, language);

  return (
    <View style={styles.section}>
      <View>
        <MediaImage uri={bannerUrl} style={styles.banner} iconSize={40} />
        <View style={[styles.logoWrap, { backgroundColor: c.card, borderColor: c.background }]}>
          {logoUrl ? (
            <MediaImage uri={logoUrl} style={styles.logo} />
          ) : (
            <View style={[styles.logo, styles.center, { backgroundColor: withAlpha(c.primary, 0.1) }]}>
              <Text style={[styles.initials, { color: c.primary }]}>{initials(market?.name)}</Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.titleBlock}>
        <Row gap={8} wrap>
          <AppText variant="title" style={styles.flexShrink}>
            {market?.name}
          </AppText>
          {market?.featured_badge ? <Badge variant="soft">{market.featured_badge}</Badge> : null}
        </Row>
        {market?.featured_headline ? <AppText variant="body" style={styles.medium}>{market.featured_headline}</AppText> : null}
        {market?.featured_copy ? <AppText variant="small" tone="muted">{market.featured_copy}</AppText> : null}
        {market?.code ? <Text style={[styles.code, { color: c.mutedForeground }]}>Market code {market.code}</Text> : null}
      </View>

      <Row gap={8} wrap>
        <Button variant="outline" size="sm" icon="chatbubble-outline" onPress={onShowReviews}>
          Reviews
        </Button>
        {canFavorite ? (
          <Button variant="outline" size="sm" icon={isFavorite ? "heart" : "heart-outline"} onPress={onToggleFavorite} disabled={favoritePending}>
            {isFavorite ? "Saved" : "Save market"}
          </Button>
        ) : null}
      </Row>

      <View style={styles.metaList}>
        <Pressable onPress={onShowReviews} accessibilityRole="button" style={styles.metaRow}>
          <RatingInline value={reviewSummary.average} count={reviewSummary.count} />
          <AppText variant="small" tone="muted">
            {reviewSummary.count === 1 ? "review" : "reviews"}
          </AppText>
        </Pressable>

        <Row gap={8} wrap>
          <Badge tone={isOpen ? "success" : "destructive"} dot>
            {statusLabel}
          </Badge>
          {hoursLabel ? <AppText variant="small" tone="muted">{hoursLabel}</AppText> : null}
          <Button variant="link" size="sm" icon="time-outline" onPress={() => setHoursOpen(true)} style={styles.linkButton}>
            See hours
          </Button>
        </Row>

        {market?.address ? (
          <Row gap={6}>
            <Ionicons name="location-outline" size={15} color={c.mutedForeground} />
            <AppText variant="small" tone="muted" numberOfLines={2} style={styles.flexShrink}>
              {market.address}
            </AppText>
          </Row>
        ) : null}

        <Row gap={6}>
          <Ionicons name="cube-outline" size={15} color={c.mutedForeground} />
          <AppText variant="small" tone="muted">
            {itemCount} products
          </AppText>
        </Row>

        {deliverySlots.length > 0 ? (
          <Row gap={6} align="flex-start">
            <Ionicons name="bicycle-outline" size={15} color={c.mutedForeground} />
            <AppText variant="small" tone="muted" style={styles.flexShrink}>
              Delivery: {deliverySlots.join(", ")}
            </AppText>
          </Row>
        ) : null}

        {promoLabel ? (
          <Badge tone="primary" icon="pricetag-outline">
            {promoLabel}
          </Badge>
        ) : null}
      </View>

      {market && !isOpen ? (
        <Alert
          tone="destructive"
          icon="time-outline"
          title={`${statusLabel} · ordering is unavailable`}
          description={
            hoursLabel
              ? `You can browse the menu, but items can't be added to the cart right now. ${hoursLabel.replace(/\.$/, "")}.`
              : "You can browse the menu, but items can't be added to the cart until the market opens again."
          }
        />
      ) : null}

      <Sheet visible={hoursOpen} title="Opening hours" description={market?.name} onClose={() => setHoursOpen(false)}>
        <View style={styles.hoursList}>
          {formatOperatingHoursList(market).map((entry, index) => (
            <View key={entry.day}>
              {index > 0 ? <Separator style={styles.hoursSep} /> : null}
              <Row justify="space-between" gap={16}>
                <AppText variant="label">{entry.day}</AppText>
                <AppText variant="small" tone="muted" style={styles.tabular}>
                  {entry.hours}
                </AppText>
              </Row>
            </View>
          ))}
        </View>
      </Sheet>
    </View>
  );
}

export function MarketHeroSkeleton() {
  return (
    <View style={styles.section}>
      <Skeleton height={160} style={styles.skeletonBanner} />
      <View style={styles.titleBlock}>
        <Skeleton height={26} width="60%" />
        <Skeleton height={14} width="85%" />
      </View>
      <Row gap={8}>
        <Skeleton height={20} width={80} />
        <Skeleton height={20} width={110} />
      </Row>
    </View>
  );
}

const styles = StyleSheet.create({
  flexShrink: { flexShrink: 1 },
  center: { alignItems: "center", justifyContent: "center" },
  medium: { fontWeight: "500" },
  tabular: { fontVariant: ["tabular-nums"] },
  section: { gap: 14 },
  banner: { width: "100%", height: 160, borderRadius: radius.xl },
  skeletonBanner: { borderRadius: radius.xl },
  logoWrap: { position: "absolute", left: 16, bottom: -32, borderWidth: 4, borderRadius: 16, overflow: "hidden" },
  logo: { width: 60, height: 60, borderRadius: 12 },
  initials: { fontSize: 18, fontWeight: "600" },
  titleBlock: { paddingTop: 30, gap: 6 },
  code: { fontSize: 12, fontFamily: "monospace" },
  metaList: { gap: 10 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", minHeight: 24 },
  linkButton: { paddingHorizontal: 0, height: 28 },
  hoursList: { gap: 10 },
  hoursSep: { marginBottom: 10 },
});
