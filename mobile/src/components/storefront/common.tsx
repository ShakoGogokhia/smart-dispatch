import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { StyleProp, ViewStyle } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";

import { Alert, AppText, Avatar, Button, Input, Label, Panel, Row, useColors, withAlpha, type IconName } from "@/src/components/ui";

import { formatReviewDate } from "./utils";

/** Image with a muted placeholder + icon when there is no URL. */
export function MediaImage({
  uri,
  style,
  icon = "storefront-outline",
  iconSize = 28,
  dimmed = false,
}: {
  uri?: string | null;
  style: StyleProp<ViewStyle>;
  icon?: IconName;
  iconSize?: number;
  dimmed?: boolean;
}) {
  const c = useColors();
  return (
    <View style={[styles.media, { backgroundColor: c.muted }, style]}>
      {uri ? (
        <Image source={uri} style={[StyleSheet.absoluteFill, dimmed && styles.dimmed]} contentFit="cover" transition={150} />
      ) : (
        <Ionicons name={icon} size={iconSize} color={c.mutedForeground} />
      )}
    </View>
  );
}

/** Compact "★ 4.6 (128)" rating. */
export function RatingInline({ value, count, size = "default" }: { value?: number | string | null; count?: number | null; size?: "sm" | "default" }) {
  const c = useColors();
  const numeric = Number(value ?? 0);
  const fontSize = size === "sm" ? 12 : 13;
  return (
    <View style={styles.ratingInline}>
      <Ionicons name="star" size={size === "sm" ? 12 : 14} color={c.warning} />
      <Text style={[styles.tabular, { color: c.foreground, fontSize, fontWeight: "500" }]}>{numeric > 0 ? numeric.toFixed(1) : "New"}</Text>
      {count ? <Text style={[styles.tabular, { color: c.mutedForeground, fontSize }]}>({count})</Text> : null}
    </View>
  );
}

export function Stars({ value, size = 14 }: { value?: number | null; size?: number }) {
  const c = useColors();
  const rounded = value ? Math.round(value) : 0;
  return (
    <View style={styles.stars} accessibilityLabel={`${rounded} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Ionicons key={star} name={star <= rounded ? "star" : "star-outline"} size={size} color={star <= rounded ? c.warning : withAlpha(c.mutedForeground, 0.5)} />
      ))}
    </View>
  );
}

export function StarPicker({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  const c = useColors();
  return (
    <View style={styles.starPicker} accessibilityRole="radiogroup" accessibilityLabel="Rating">
      {[1, 2, 3, 4, 5].map((star) => (
        <Pressable
          key={star}
          onPress={() => onChange(star)}
          accessibilityRole="radio"
          accessibilityState={{ checked: star === value }}
          accessibilityLabel={`Rate ${star} star${star > 1 ? "s" : ""}`}
          hitSlop={4}
          style={styles.starButton}
        >
          <Ionicons name={star <= value ? "star" : "star-outline"} size={28} color={star <= value ? c.warning : withAlpha(c.mutedForeground, 0.5)} />
        </Pressable>
      ))}
    </View>
  );
}

export function ReviewListItem({ name, rating, comment, createdAt }: { name?: string | null; rating: number; comment?: string | null; createdAt?: string | null }) {
  const date = formatReviewDate(createdAt);
  return (
    <Row align="flex-start" gap={12}>
      <Avatar name={name || "Anonymous"} size={34} />
      <View style={styles.flex}>
        <Row justify="space-between" gap={8}>
          <AppText variant="label" numberOfLines={1} style={styles.flex}>
            {name || "Anonymous"}
          </AppText>
          {date ? <AppText variant="caption">{date}</AppText> : null}
        </Row>
        <View style={styles.mt4}>
          <Stars value={Number(rating)} size={13} />
        </View>
        <AppText variant="body" tone={comment ? "default" : "muted"} style={styles.mt6}>
          {comment || "No comment provided."}
        </AppText>
      </View>
    </Row>
  );
}

export function ReviewForm({
  title,
  rating,
  onRatingChange,
  comment,
  onCommentChange,
  placeholder,
  error,
  isPending,
  submitLabel,
  onSubmit,
}: {
  title: string;
  rating: number;
  onRatingChange: (value: number) => void;
  comment: string;
  onCommentChange: (value: string) => void;
  placeholder: string;
  error?: string | null;
  isPending: boolean;
  submitLabel: string;
  onSubmit: () => void;
}) {
  return (
    <Panel style={styles.formPanel}>
      <View style={styles.gap6}>
        <Label>{title}</Label>
        <StarPicker value={rating} onChange={onRatingChange} />
      </View>
      <Input label="Comment (optional)" value={comment} onChangeText={onCommentChange} placeholder={placeholder} multiline />
      {error ? <Alert tone="destructive" title={error} /> : null}
      <Button onPress={onSubmit} loading={isPending} fullWidth>
        {isPending ? "Posting review..." : submitLabel}
      </Button>
    </Panel>
  );
}

/** Bordered - qty + stepper (web: `rounded-md border` with ghost icon buttons). */
export function QtyStepper({
  qty,
  onDecrease,
  onIncrease,
  decreaseDisabled,
  label,
  size = "default",
}: {
  qty: number;
  onDecrease: () => void;
  onIncrease: () => void;
  decreaseDisabled?: boolean;
  label?: string;
  size?: "sm" | "default";
}) {
  const c = useColors();
  const dim = size === "sm" ? 32 : 40;
  return (
    <View style={[styles.stepper, { borderColor: c.input, backgroundColor: c.card }]}>
      <Pressable
        onPress={decreaseDisabled ? undefined : onDecrease}
        accessibilityRole="button"
        accessibilityLabel={label ? `Decrease ${label}` : "Decrease quantity"}
        style={({ pressed }) => [styles.stepperButton, { width: dim, height: dim, opacity: decreaseDisabled ? 0.4 : 1 }, pressed && { backgroundColor: c.accent }]}
      >
        <Ionicons name="remove" size={16} color={c.foreground} />
      </Pressable>
      <Text style={[styles.stepperQty, styles.tabular, { color: c.foreground }]}>{qty}</Text>
      <Pressable
        onPress={onIncrease}
        accessibilityRole="button"
        accessibilityLabel={label ? `Increase ${label}` : "Increase quantity"}
        style={({ pressed }) => [styles.stepperButton, { width: dim, height: dim }, pressed && { backgroundColor: c.accent }]}
      >
        <Ionicons name="add" size={16} color={c.foreground} />
      </Pressable>
    </View>
  );
}

/** Label / value row for totals. */
export function SummaryRow({ label, value, valueTone, strong = false }: { label: ReactNode; value: ReactNode; valueTone?: "success" | "muted"; strong?: boolean }) {
  return (
    <Row justify="space-between" gap={12}>
      <AppText variant={strong ? "heading" : "small"} tone={strong ? "default" : "muted"} style={styles.flex}>
        {label}
      </AppText>
      <AppText
        variant={strong ? "title" : "small"}
        tone={valueTone ?? "default"}
        style={[styles.tabular, !strong && valueTone !== "muted" ? styles.medium : null]}
      >
        {value}
      </AppText>
    </Row>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  mt4: { marginTop: 4 },
  mt6: { marginTop: 6 },
  gap6: { gap: 6 },
  medium: { fontWeight: "500" },
  tabular: { fontVariant: ["tabular-nums"] },
  media: { overflow: "hidden", alignItems: "center", justifyContent: "center" },
  dimmed: { opacity: 0.6 },
  ratingInline: { flexDirection: "row", alignItems: "center", gap: 4 },
  stars: { flexDirection: "row", alignItems: "center", gap: 2 },
  starPicker: { flexDirection: "row", alignItems: "center", gap: 4 },
  starButton: { padding: 2 },
  formPanel: { gap: 14, padding: 14 },
  stepper: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: 8, overflow: "hidden", alignSelf: "flex-start" },
  stepperButton: { alignItems: "center", justifyContent: "center" },
  stepperQty: { minWidth: 28, textAlign: "center", fontSize: 14, fontWeight: "500" },
});
