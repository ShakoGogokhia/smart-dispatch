/**
 * Mobile UI primitives — a React Native port of the web app's shadcn/ui (new-york) look.
 * Colors come from the same theme tokens as the web (`src/theme/tokens.ts`), so palette and
 * light/dark choices match across platforms. Use these instead of hard-coded colors.
 */
import { useEffect, useRef, useState } from "react";
import type { ComponentProps, PropsWithChildren, ReactNode } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch as RNSwitch,
  Text,
  TextInput,
  View,
} from "react-native";
import type { StyleProp, TextStyle, ViewStyle } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { usePreferences, useThemeColors } from "@/src/providers/app-providers";
import { humanizeStatus, toneForStatus, type Tone } from "@/src/theme/status";
import { PALETTES, radius, swatchColor, withAlpha, type ThemeColors, type ThemeMode } from "@/src/theme/tokens";

export { humanizeStatus, toneForStatus, withAlpha, radius };
export type { Tone, ThemeColors };

export type IconName = keyof typeof Ionicons.glyphMap;

/* -------------------------------------------------------------------------------------------------
 * Colors
 * -----------------------------------------------------------------------------------------------*/

/** Theme tokens. Prefer this in new code: `const c = useColors(); c.primary`. */
export function useColors() {
  return useThemeColors();
}

/**
 * Legacy palette shape used by older screens, mapped onto the theme tokens.
 * Every value is an opaque #rrggbb so `${palette.border}aa` style alpha suffixes keep working.
 */
export function usePalette() {
  const { theme, colors } = usePreferences();
  const dark = theme === "dark";

  return {
    dark,
    colors,
    background: colors.background,
    backgroundAlt: colors.card,
    surface: colors.card,
    surfaceStrong: colors.card,
    surfaceMuted: colors.muted,
    border: colors.border,
    text: colors.foreground,
    muted: colors.mutedForeground,
    primary: colors.primary,
    primaryStrong: colors.primary,
    primaryText: colors.primaryForeground,
    accent: colors.warning,
    accentSoft: withAlpha(colors.warning, 0.12),
    danger: colors.destructive,
    warning: colors.warning,
    success: colors.success,
    info: colors.info,
    shadow: colors.shadow,
    overlay: withAlpha(colors.overlay, dark ? 0.7 : 0.4),
  };
}

export function toneColors(c: ThemeColors, tone: Tone) {
  switch (tone) {
    case "success":
      return { bg: withAlpha(c.success, 0.15), fg: c.success, solid: c.success, solidFg: c.successForeground };
    case "warning":
      return { bg: withAlpha(c.warning, 0.22), fg: c.foreground, solid: c.warning, solidFg: c.warningForeground };
    case "destructive":
      return { bg: withAlpha(c.destructive, 0.12), fg: c.destructive, solid: c.destructive, solidFg: c.destructiveForeground };
    case "info":
      return { bg: withAlpha(c.info, 0.15), fg: c.info, solid: c.info, solidFg: c.infoForeground };
    case "primary":
      return { bg: withAlpha(c.primary, 0.12), fg: c.primary, solid: c.primary, solidFg: c.primaryForeground };
    default:
      return { bg: c.muted, fg: c.mutedForeground, solid: c.secondary, solidFg: c.secondaryForeground };
  }
}

/* -------------------------------------------------------------------------------------------------
 * Typography
 * -----------------------------------------------------------------------------------------------*/

type TextVariant = "display" | "title" | "heading" | "body" | "small" | "muted" | "label" | "caption";

const TEXT: Record<TextVariant, TextStyle> = {
  display: { fontSize: 28, lineHeight: 34, fontWeight: "700", letterSpacing: -0.5 },
  title: { fontSize: 22, lineHeight: 28, fontWeight: "600", letterSpacing: -0.3 },
  heading: { fontSize: 16, lineHeight: 22, fontWeight: "600" },
  body: { fontSize: 14, lineHeight: 20 },
  small: { fontSize: 13, lineHeight: 18 },
  muted: { fontSize: 14, lineHeight: 20 },
  label: { fontSize: 13, lineHeight: 18, fontWeight: "500" },
  caption: { fontSize: 12, lineHeight: 16 },
};

export function AppText({
  variant = "body",
  tone,
  style,
  numberOfLines,
  children,
}: PropsWithChildren<{
  variant?: TextVariant;
  tone?: "default" | "muted" | "primary" | Tone;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
}>) {
  const c = useColors();
  const resolvedTone = tone ?? (variant === "muted" || variant === "caption" ? "muted" : "default");
  const color =
    resolvedTone === "default"
      ? c.foreground
      : resolvedTone === "muted" || resolvedTone === "neutral"
        ? c.mutedForeground
        : resolvedTone === "primary"
          ? c.primary
          : resolvedTone === "warning"
            ? c.foreground
            : toneColors(c, resolvedTone).fg;

  return (
    <Text numberOfLines={numberOfLines} style={[TEXT[variant], { color, flexShrink: 1 }, style]}>
      {children}
    </Text>
  );
}

/* -------------------------------------------------------------------------------------------------
 * Layout
 * -----------------------------------------------------------------------------------------------*/

export function Screen({
  children,
  scroll = true,
  header,
  footer,
  contentStyle,
  refreshControl,
}: PropsWithChildren<{
  scroll?: boolean;
  header?: ReactNode;
  footer?: ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
  refreshControl?: ComponentProps<typeof ScrollView>["refreshControl"];
}>) {
  const c = useColors();

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={[styles.flex, { backgroundColor: c.background }]}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        {header}
        {scroll ? (
          <ScrollView
            style={styles.flex}
            contentContainerStyle={[styles.screenContent, contentStyle]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            refreshControl={refreshControl}
          >
            {children}
          </ScrollView>
        ) : (
          <View style={[styles.flex, styles.screenContent, contentStyle]}>{children}</View>
        )}
        {footer}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export function Row({
  children,
  gap = 8,
  wrap = false,
  align = "center",
  justify = "flex-start",
  style,
}: PropsWithChildren<{
  gap?: number;
  wrap?: boolean;
  align?: ViewStyle["alignItems"];
  justify?: ViewStyle["justifyContent"];
  style?: StyleProp<ViewStyle>;
}>) {
  return (
    <View style={[{ flexDirection: "row", gap, alignItems: align, justifyContent: justify, flexWrap: wrap ? "wrap" : "nowrap" }, style]}>
      {children}
    </View>
  );
}

export function Stack({ children, gap = 12, style }: PropsWithChildren<{ gap?: number; style?: StyleProp<ViewStyle> }>) {
  return <View style={[{ gap }, style]}>{children}</View>;
}

/** Page title block — the mobile equivalent of the web `PageHeader`. */
export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  eyebrow?: string;
}) {
  return (
    <View style={styles.pageHeader}>
      <View style={styles.flexShrink}>
        {eyebrow ? (
          <AppText variant="caption" tone="primary" style={styles.eyebrow}>
            {eyebrow}
          </AppText>
        ) : null}
        <AppText variant="title">{title}</AppText>
        {description ? (
          <AppText variant="muted" style={styles.mt4}>
            {description}
          </AppText>
        ) : null}
      </View>
      {actions ? <Row wrap gap={8}>{actions}</Row> : null}
    </View>
  );
}

export function SectionHeader({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <Row justify="space-between" align="flex-end" gap={12}>
      <View style={styles.flexShrink}>
        <AppText variant="heading">{title}</AppText>
        {description ? <AppText variant="small" tone="muted">{description}</AppText> : null}
      </View>
      {action}
    </Row>
  );
}

/* -------------------------------------------------------------------------------------------------
 * Card
 * -----------------------------------------------------------------------------------------------*/

export function Card({
  children,
  title,
  description,
  right,
  footer,
  padded = true,
  onPress,
  style,
  highlighted = false,
}: PropsWithChildren<{
  title?: string;
  description?: string;
  right?: ReactNode;
  footer?: ReactNode;
  padded?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  highlighted?: boolean;
}>) {
  const c = useColors();
  const body = (
    <>
      {title || description || right ? (
        <View style={[styles.cardHeader, !padded && styles.cardHeaderUnpadded]}>
          <View style={styles.flexShrink}>
            {title ? <AppText variant="heading">{title}</AppText> : null}
            {description ? (
              <AppText variant="small" tone="muted" style={styles.mt2}>
                {description}
              </AppText>
            ) : null}
          </View>
          {right}
        </View>
      ) : null}
      {children}
      {footer ? <View style={[styles.cardFooter, { borderTopColor: c.border }]}>{footer}</View> : null}
    </>
  );

  const cardStyle: StyleProp<ViewStyle> = [
    styles.card,
    padded && styles.cardPadded,
    {
      backgroundColor: c.card,
      borderColor: highlighted ? c.primary : c.border,
      borderWidth: highlighted ? 1.5 : StyleSheet.hairlineWidth * 2,
      shadowColor: c.shadow,
    },
    style,
  ];

  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [cardStyle, pressed && { opacity: 0.85 }]}>
        {body}
      </Pressable>
    );
  }

  return <View style={cardStyle}>{body}</View>;
}

/** Legacy card API. */
export function SectionCard({ children, title, subtitle, right }: PropsWithChildren<{ title?: string; subtitle?: string; right?: ReactNode }>) {
  return (
    <Card title={title} description={subtitle} right={right}>
      {children}
    </Card>
  );
}

/** Legacy hero API — now a calm, tinted intro card instead of a dark slab. */
export function HeroCard({ eyebrow, title, subtitle, children }: PropsWithChildren<{ eyebrow?: string; title: string; subtitle: string }>) {
  const c = useColors();
  return (
    <View style={[styles.card, styles.cardPadded, { backgroundColor: withAlpha(c.primary, 0.06), borderColor: withAlpha(c.primary, 0.2), borderWidth: 1 }]}>
      {eyebrow ? <AppText variant="caption" tone="primary" style={styles.eyebrow}>{eyebrow}</AppText> : null}
      <AppText variant="display">{title}</AppText>
      <AppText variant="muted">{subtitle}</AppText>
      {children}
    </View>
  );
}

/** Inner sub-box inside a card (`rounded-lg border bg-muted/30`). */
export function Panel({ children, style }: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  const c = useColors();
  return <View style={[styles.panel, { borderColor: c.border, backgroundColor: withAlpha(c.muted, 0.5) }, style]}>{children}</View>;
}

/** Label / value pair for details. */
export function InfoRow({ label, value, icon }: { label: string; value?: ReactNode; icon?: IconName }) {
  const c = useColors();
  return (
    <Row justify="space-between" align="flex-start" gap={12}>
      <Row gap={6} style={styles.flexShrink}>
        {icon ? <Ionicons name={icon} size={15} color={c.mutedForeground} /> : null}
        <AppText variant="small" tone="muted">{label}</AppText>
      </Row>
      {typeof value === "string" || typeof value === "number" ? (
        <AppText variant="small" style={styles.infoValue}>{String(value)}</AppText>
      ) : (
        value
      )}
    </Row>
  );
}

/* -------------------------------------------------------------------------------------------------
 * Button
 * -----------------------------------------------------------------------------------------------*/

export type ButtonVariant = "default" | "outline" | "secondary" | "ghost" | "destructive" | "link";
export type ButtonSize = "sm" | "default" | "lg" | "icon";

export function Button({
  children,
  onPress,
  disabled,
  loading,
  variant = "default",
  size = "default",
  icon,
  iconRight,
  fullWidth = false,
  style,
  accessibilityLabel,
}: PropsWithChildren<{
  onPress?: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: IconName;
  iconRight?: IconName;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}>) {
  const c = useColors();
  const inactive = disabled || loading;

  const scheme = {
    default: { bg: c.primary, fg: c.primaryForeground, border: c.primary },
    outline: { bg: c.card, fg: c.foreground, border: c.input },
    secondary: { bg: c.secondary, fg: c.secondaryForeground, border: c.secondary },
    ghost: { bg: "transparent", fg: c.foreground, border: "transparent" },
    destructive: { bg: c.destructive, fg: c.destructiveForeground, border: c.destructive },
    link: { bg: "transparent", fg: c.primary, border: "transparent" },
  }[variant];

  const height = size === "sm" ? 34 : size === "lg" ? 48 : size === "icon" ? 40 : 42;
  const iconSize = size === "lg" ? 18 : 16;

  return (
    <Pressable
      onPress={inactive ? undefined : onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      style={({ pressed }) => [
        styles.button,
        {
          height,
          minWidth: size === "icon" ? height : undefined,
          paddingHorizontal: size === "icon" ? 0 : size === "sm" ? 12 : size === "lg" ? 20 : 16,
          backgroundColor: scheme.bg,
          borderColor: scheme.border,
          borderWidth: variant === "outline" ? 1 : 0,
          alignSelf: fullWidth ? "stretch" : "auto",
          opacity: inactive ? 0.5 : pressed ? 0.85 : 1,
        },
        variant === "outline" && styles.shadowXs,
        pressed && variant === "ghost" && { backgroundColor: c.accent },
        style,
      ]}
    >
      {loading ? <ActivityIndicator size="small" color={scheme.fg} /> : icon ? <Ionicons name={icon} size={iconSize} color={scheme.fg} /> : null}
      {children !== undefined && children !== null && size !== "icon" ? (
        <Text
          numberOfLines={1}
          style={[
            styles.buttonText,
            { color: scheme.fg, fontSize: size === "sm" ? 13 : size === "lg" ? 15 : 14 },
            variant === "link" && styles.underline,
          ]}
        >
          {children}
        </Text>
      ) : null}
      {iconRight ? <Ionicons name={iconRight} size={iconSize} color={scheme.fg} /> : null}
    </Pressable>
  );
}

export function IconButton({
  icon,
  onPress,
  variant = "ghost",
  accessibilityLabel,
  badge,
  size = 40,
}: {
  icon: IconName;
  onPress?: () => void;
  variant?: ButtonVariant;
  accessibilityLabel: string;
  badge?: number;
  size?: number;
}) {
  const c = useColors();
  return (
    <View>
      <Button variant={variant} size="icon" onPress={onPress} accessibilityLabel={accessibilityLabel} style={{ height: size, minWidth: size }}>
        {null}
      </Button>
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.center]}>
        <Ionicons name={icon} size={20} color={variant === "default" ? c.primaryForeground : c.foreground} />
      </View>
      {badge ? (
        <View pointerEvents="none" style={[styles.iconBadge, { backgroundColor: c.destructive, borderColor: c.background }]}>
          <Text style={styles.iconBadgeText}>{badge > 9 ? "9+" : badge}</Text>
        </View>
      ) : null}
    </View>
  );
}

/** Legacy button API: primary / secondary / danger + compact. */
export function AppButton({
  children,
  onPress,
  disabled,
  variant = "primary",
  compact = false,
}: PropsWithChildren<{
  onPress?: () => void;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "danger";
  compact?: boolean;
}>) {
  return (
    <Button
      onPress={onPress}
      disabled={disabled}
      variant={variant === "secondary" ? "outline" : variant === "danger" ? "destructive" : "default"}
      size={compact ? "sm" : "default"}
    >
      {children}
    </Button>
  );
}

/* -------------------------------------------------------------------------------------------------
 * Form controls
 * -----------------------------------------------------------------------------------------------*/

export function Label({ children }: PropsWithChildren) {
  return <AppText variant="label">{children}</AppText>;
}

export function Input({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  multiline,
  keyboardType,
  editable = true,
  helper,
  error,
  icon,
  right,
  autoCapitalize,
  onSubmitEditing,
  returnKeyType,
}: {
  label?: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  multiline?: boolean;
  keyboardType?: ComponentProps<typeof TextInput>["keyboardType"];
  editable?: boolean;
  helper?: string;
  error?: string | null;
  icon?: IconName;
  right?: ReactNode;
  autoCapitalize?: ComponentProps<typeof TextInput>["autoCapitalize"];
  onSubmitEditing?: () => void;
  returnKeyType?: ComponentProps<typeof TextInput>["returnKeyType"];
}) {
  const c = useColors();
  const focus = useRef(new Animated.Value(0)).current;
  const borderColor = focus.interpolate({ inputRange: [0, 1], outputRange: [error ? c.destructive : c.input, error ? c.destructive : c.ring] });

  return (
    <View style={styles.field}>
      {label ? <Label>{label}</Label> : null}
      <Animated.View
        style={[
          styles.inputWrap,
          multiline && styles.inputWrapMultiline,
          { borderColor, backgroundColor: editable ? c.card : c.muted },
        ]}
      >
        {icon ? <Ionicons name={icon} size={16} color={c.mutedForeground} style={multiline ? styles.mt2 : undefined} /> : null}
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={c.mutedForeground}
          secureTextEntry={secureTextEntry}
          multiline={multiline}
          keyboardType={keyboardType}
          editable={editable}
          autoCapitalize={autoCapitalize}
          onSubmitEditing={onSubmitEditing}
          returnKeyType={returnKeyType}
          onFocus={() => Animated.timing(focus, { toValue: 1, duration: 120, useNativeDriver: false }).start()}
          onBlur={() => Animated.timing(focus, { toValue: 0, duration: 120, useNativeDriver: false }).start()}
          style={[styles.input, multiline && styles.inputMultiline, { color: editable ? c.foreground : c.mutedForeground }]}
        />
        {right}
      </Animated.View>
      {error ? (
        <AppText variant="caption" tone="destructive">{error}</AppText>
      ) : helper ? (
        <AppText variant="caption">{helper}</AppText>
      ) : null}
    </View>
  );
}

/** Legacy input API. */
export function InputField(props: {
  label?: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  multiline?: boolean;
  keyboardType?: "default" | "email-address" | "numeric";
  editable?: boolean;
}) {
  return <Input {...props} />;
}

export function HelperText({ children, tone = "muted" }: PropsWithChildren<{ tone?: "muted" | "danger" | "success" }>) {
  return (
    <AppText variant="small" tone={tone === "danger" ? "destructive" : tone === "success" ? "success" : "muted"}>
      {children}
    </AppText>
  );
}

export function Switch({ value, onValueChange, disabled }: { value: boolean; onValueChange: (value: boolean) => void; disabled?: boolean }) {
  const c = useColors();
  return (
    <RNSwitch
      value={value}
      onValueChange={onValueChange}
      disabled={disabled}
      trackColor={{ true: c.primary, false: c.input }}
      thumbColor={Platform.OS === "android" ? c.card : undefined}
      ios_backgroundColor={c.input}
    />
  );
}

export function Checkbox({ checked, onChange, label, description, disabled }: { checked: boolean; onChange: (next: boolean) => void; label: string; description?: string; disabled?: boolean }) {
  const c = useColors();
  return (
    <Pressable
      onPress={disabled ? undefined : () => onChange(!checked)}
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled }}
      style={[styles.checkRow, disabled && { opacity: 0.5 }]}
    >
      <View style={[styles.checkbox, { borderColor: checked ? c.primary : c.input, backgroundColor: checked ? c.primary : c.card }]}>
        {checked ? <Ionicons name="checkmark" size={13} color={c.primaryForeground} /> : null}
      </View>
      <View style={styles.flexShrink}>
        <AppText variant="label">{label}</AppText>
        {description ? <AppText variant="caption">{description}</AppText> : null}
      </View>
    </Pressable>
  );
}

/** Selectable option card (radio-group style). */
export function OptionCard({
  selected,
  onPress,
  title,
  description,
  right,
  icon,
}: {
  selected: boolean;
  onPress: () => void;
  title: string;
  description?: string;
  right?: ReactNode;
  icon?: IconName;
}) {
  const c = useColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      style={[
        styles.optionCard,
        { borderColor: selected ? c.primary : c.border, backgroundColor: selected ? withAlpha(c.primary, 0.06) : c.card },
      ]}
    >
      <View style={[styles.radio, { borderColor: selected ? c.primary : c.input }]}>
        {selected ? <View style={[styles.radioDot, { backgroundColor: c.primary }]} /> : null}
      </View>
      {icon ? <Ionicons name={icon} size={18} color={selected ? c.primary : c.mutedForeground} /> : null}
      <View style={styles.flex}>
        <AppText variant="label">{title}</AppText>
        {description ? <AppText variant="caption">{description}</AppText> : null}
      </View>
      {right}
    </Pressable>
  );
}

/** Segmented control — the mobile equivalent of shadcn `Tabs`. */
export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (value: T) => void;
  options: Array<{ value: T; label: string; icon?: IconName; count?: number }>;
}) {
  const c = useColors();
  return (
    <View style={[styles.segmented, { backgroundColor: c.muted }]}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            style={[styles.segment, active && [styles.shadowXs, { backgroundColor: c.background }]]}
          >
            {option.icon ? <Ionicons name={option.icon} size={14} color={active ? c.foreground : c.mutedForeground} /> : null}
            <Text numberOfLines={1} style={[styles.segmentText, { color: active ? c.foreground : c.mutedForeground }]}>
              {option.label}
              {option.count !== undefined ? ` ${option.count}` : ""}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Filter chip (toggle). */
export function Chip({
  label,
  selected = false,
  onPress,
  icon,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: IconName;
}) {
  const c = useColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={[
        styles.chip,
        { borderColor: selected ? c.primary : c.border, backgroundColor: selected ? c.primary : c.card },
      ]}
    >
      {icon ? <Ionicons name={icon} size={14} color={selected ? c.primaryForeground : c.mutedForeground} /> : null}
      <Text style={[styles.chipText, { color: selected ? c.primaryForeground : c.foreground }]}>{label}</Text>
    </Pressable>
  );
}

export function ChipRow({ children }: PropsWithChildren) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
      {children}
    </ScrollView>
  );
}

/* -------------------------------------------------------------------------------------------------
 * Badges & status
 * -----------------------------------------------------------------------------------------------*/

export function Badge({
  children,
  tone = "neutral",
  variant = "soft",
  dot = false,
  icon,
}: PropsWithChildren<{ tone?: Tone; variant?: "soft" | "solid" | "outline"; dot?: boolean; icon?: IconName }>) {
  const c = useColors();
  const t = toneColors(c, tone);
  const bg = variant === "solid" ? t.solid : variant === "outline" ? "transparent" : t.bg;
  const fg = variant === "solid" ? t.solidFg : variant === "outline" ? c.foreground : t.fg;

  return (
    <View style={[styles.badge, { backgroundColor: bg, borderColor: variant === "outline" ? c.border : "transparent" }]}>
      {dot ? <View style={[styles.badgeDot, { backgroundColor: fg }]} /> : null}
      {icon ? <Ionicons name={icon} size={12} color={fg} /> : null}
      <Text numberOfLines={1} style={[styles.badgeText, { color: fg }]}>{children}</Text>
    </View>
  );
}

/** Status string -> colored badge with a readable label (same mapping as the web). */
export function StatusBadge({ status, label }: { status: string | null | undefined; label?: string }) {
  const { language } = usePreferences();
  return (
    <Badge tone={toneForStatus(status)} dot>
      {label ?? humanizeStatus(status, language)}
    </Badge>
  );
}

/** Legacy pill API. */
export function Pill({ children, tone = "neutral" }: PropsWithChildren<{ tone?: "neutral" | "success" | "warning" | "danger" }>) {
  return <Badge tone={tone === "danger" ? "destructive" : tone}>{children}</Badge>;
}

/* -------------------------------------------------------------------------------------------------
 * Stats
 * -----------------------------------------------------------------------------------------------*/

export function StatGrid({ children }: PropsWithChildren) {
  return <View style={styles.statGrid}>{children}</View>;
}

export function StatCard({
  label,
  value,
  note,
  icon,
  tone = "neutral",
  onPress,
  active = false,
}: {
  label: string;
  value: string | number;
  note?: string;
  icon?: IconName;
  tone?: Tone;
  onPress?: () => void;
  active?: boolean;
}) {
  const c = useColors();
  const t = toneColors(c, tone);

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [
        styles.statCard,
        styles.shadowXs,
        { backgroundColor: c.card, borderColor: active ? c.primary : c.border, borderWidth: active ? 1.5 : 1, shadowColor: c.shadow },
        pressed && { opacity: 0.85 },
      ]}
    >
      <Row justify="space-between" align="flex-start" gap={8}>
        <View style={styles.flexShrink}>
          <AppText variant="caption" numberOfLines={1}>{label}</AppText>
          <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.statValue, { color: c.foreground }]}>
            {value}
          </Text>
        </View>
        {icon ? (
          <View style={[styles.statIcon, { backgroundColor: t.bg }]}>
            <Ionicons name={icon} size={18} color={tone === "warning" ? c.warningForeground : t.fg} />
          </View>
        ) : null}
      </Row>
      {note ? <AppText variant="caption" numberOfLines={2}>{note}</AppText> : null}
    </Pressable>
  );
}

export function Progress({ value, tone = "primary" }: { value: number; tone?: Tone }) {
  const c = useColors();
  const pct = Math.max(0, Math.min(100, value));
  return (
    <View style={[styles.progressTrack, { backgroundColor: withAlpha(c.primary, 0.15) }]}>
      <View style={[styles.progressBar, { width: `${pct}%`, backgroundColor: toneColors(c, tone).solid }]} />
    </View>
  );
}

/* -------------------------------------------------------------------------------------------------
 * Feedback
 * -----------------------------------------------------------------------------------------------*/

export function Separator({ style }: { style?: StyleProp<ViewStyle> }) {
  const c = useColors();
  return <View style={[styles.divider, { backgroundColor: c.border }, style]} />;
}

export const Divider = Separator;

export function Skeleton({ height = 16, width = "100%", style }: { height?: number; width?: ViewStyle["width"]; style?: StyleProp<ViewStyle> }) {
  const c = useColors();
  const opacity = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.5, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return <Animated.View style={[{ height, width, borderRadius: radius.md, backgroundColor: c.muted, opacity }, style]} />;
}

export function LoadingBlock({ message = "Loading...", rows = 3 }: { message?: string; rows?: number }) {
  return (
    <View style={styles.listGap} accessibilityLabel={message} accessibilityState={{ busy: true }}>
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} height={i === 0 ? 96 : 72} style={{ borderRadius: radius.xl }} />
      ))}
    </View>
  );
}

export function EmptyState({
  title,
  description,
  icon = "file-tray-outline",
  action,
  compact = false,
}: {
  title: string;
  description?: string;
  icon?: IconName;
  action?: ReactNode;
  compact?: boolean;
}) {
  const c = useColors();
  return (
    <View style={[styles.empty, !compact && [styles.emptyBordered, { borderColor: c.border }]]}>
      <View style={[styles.emptyIcon, { backgroundColor: c.muted }, compact && styles.emptyIconCompact]}>
        <Ionicons name={icon} size={compact ? 18 : 22} color={c.mutedForeground} />
      </View>
      <AppText variant={compact ? "label" : "heading"} style={styles.textCenter}>{title}</AppText>
      {description ? (
        <AppText variant="small" tone="muted" style={[styles.textCenter, styles.emptyDesc]}>{description}</AppText>
      ) : null}
      {action ? <View style={styles.mt4}>{action}</View> : null}
    </View>
  );
}

/** Legacy empty API. */
export function EmptyBlock({ message, actionLabel, onAction }: { message: string; actionLabel?: string; onAction?: () => void }) {
  return (
    <EmptyState
      title={message}
      action={actionLabel && onAction ? <Button variant="outline" onPress={onAction}>{actionLabel}</Button> : undefined}
    />
  );
}

export function Alert({
  title,
  description,
  tone = "neutral",
  icon,
  action,
}: {
  title: string;
  description?: string;
  tone?: Tone;
  icon?: IconName;
  action?: ReactNode;
}) {
  const c = useColors();
  const t = toneColors(c, tone);
  const defaultIcon: IconName =
    tone === "destructive" ? "alert-circle-outline" : tone === "success" ? "checkmark-circle-outline" : tone === "warning" ? "warning-outline" : "information-circle-outline";
  const fg = tone === "neutral" ? c.foreground : tone === "warning" ? c.foreground : t.fg;

  return (
    <View style={[styles.alert, { borderColor: tone === "neutral" ? c.border : withAlpha(t.solid, 0.35), backgroundColor: tone === "neutral" ? c.card : t.bg }]}>
      <Ionicons name={icon ?? defaultIcon} size={18} color={tone === "warning" ? c.warningForeground : fg} />
      <View style={styles.flex}>
        <Text style={[styles.alertTitle, { color: fg }]}>{title}</Text>
        {description ? <Text style={[styles.alertDesc, { color: tone === "neutral" ? c.mutedForeground : fg }]}>{description}</Text> : null}
        {action ? <View style={styles.mt8}>{action}</View> : null}
      </View>
    </View>
  );
}

/* -------------------------------------------------------------------------------------------------
 * Overlays
 * -----------------------------------------------------------------------------------------------*/

/** Bottom sheet modal — used for forms, details, menus (web Dialog/Sheet). */
export function Sheet({
  visible,
  title,
  description,
  onClose,
  children,
  footer,
  scroll = true,
}: PropsWithChildren<{
  visible: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  footer?: ReactNode;
  scroll?: boolean;
}>) {
  const c = useColors();
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.sheetBackdrop}>
          <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: withAlpha(c.overlay, 0.5) }]} onPress={onClose} accessibilityLabel="Close" />
          <View style={[styles.sheetCard, { backgroundColor: c.background, borderColor: c.border, paddingBottom: Math.max(insets.bottom, 12) }]}>
            <View style={[styles.sheetHandle, { backgroundColor: c.border }]} />
            <View style={styles.sheetHeader}>
              <View style={styles.flex}>
                <AppText variant="heading">{title}</AppText>
                {description ? <AppText variant="small" tone="muted">{description}</AppText> : null}
              </View>
              <IconButton icon="close" onPress={onClose} accessibilityLabel="Close" size={34} />
            </View>
            {scroll ? (
              <ScrollView style={styles.sheetBody} contentContainerStyle={styles.sheetBodyContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                {children}
              </ScrollView>
            ) : (
              <View style={styles.sheetBodyContent}>{children}</View>
            )}
            {footer ? <View style={[styles.sheetFooter, { borderTopColor: c.border }]}>{footer}</View> : null}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/** Legacy modal API. */
export function AppModal({ visible, title, onClose, children }: PropsWithChildren<{ visible: boolean; title: string; onClose: () => void }>) {
  return (
    <Sheet visible={visible} title={title} onClose={onClose}>
      {children}
    </Sheet>
  );
}

/* -------------------------------------------------------------------------------------------------
 * Lists
 * -----------------------------------------------------------------------------------------------*/

export function ListItem({
  title,
  description,
  icon,
  value,
  onPress,
  right,
  active = false,
  destructive = false,
}: {
  title: string;
  description?: string;
  icon?: IconName;
  value?: string;
  onPress?: () => void;
  right?: ReactNode;
  active?: boolean;
  destructive?: boolean;
}) {
  const c = useColors();
  const fg = destructive ? c.destructive : active ? c.primary : c.foreground;
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [
        styles.listItem,
        { backgroundColor: active ? c.accent : pressed ? withAlpha(c.accent, 0.7) : "transparent" },
      ]}
    >
      {active ? <View style={[styles.activeBar, { backgroundColor: c.primary }]} /> : null}
      {icon ? <Ionicons name={icon} size={18} color={destructive ? c.destructive : active ? c.primary : c.mutedForeground} /> : null}
      <View style={styles.flex}>
        <Text numberOfLines={1} style={[styles.listTitle, { color: fg, fontWeight: active ? "600" : "500" }]}>{title}</Text>
        {description ? <AppText variant="caption" numberOfLines={2}>{description}</AppText> : null}
      </View>
      {value ? <AppText variant="caption">{value}</AppText> : null}
      {right ?? (onPress && !destructive ? <Ionicons name="chevron-forward" size={16} color={c.mutedForeground} /> : null)}
    </Pressable>
  );
}

/** Legacy row APIs. */
export function SettingRow({ label, value, onPress }: { label: string; value?: string; onPress?: () => void }) {
  return <ListItem title={label} value={value} onPress={onPress} />;
}

export function ToggleRow({ label, value, onValueChange, description }: { label: string; value: boolean; onValueChange: (value: boolean) => void; description?: string }) {
  return <ListItem title={label} description={description} right={<Switch value={value} onValueChange={onValueChange} />} />;
}

/* -------------------------------------------------------------------------------------------------
 * Avatar
 * -----------------------------------------------------------------------------------------------*/

export function initials(name?: string | null) {
  return (
    (name ?? "User")
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "U"
  );
}

export function Avatar({ name, uri, size = 36 }: { name?: string | null; uri?: string | null; size?: number }) {
  const c = useColors();
  if (uri) {
    return <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: c.muted }} />;
  }
  return (
    <View style={[styles.center, { width: size, height: size, borderRadius: size / 2, backgroundColor: c.primary }]}>
      <Text style={{ color: c.primaryForeground, fontWeight: "600", fontSize: size * 0.38 }}>{initials(name)}</Text>
    </View>
  );
}

/* -------------------------------------------------------------------------------------------------
 * Theme picker (same options as the web ThemeToggle)
 * -----------------------------------------------------------------------------------------------*/

const MODES: Array<{ value: ThemeMode; label: string; icon: IconName }> = [
  { value: "light", label: "Light", icon: "sunny-outline" },
  { value: "dark", label: "Dark", icon: "moon-outline" },
  { value: "system", label: "System", icon: "phone-portrait-outline" },
];

export function ThemePanel() {
  const c = useColors();
  const { themeMode, setThemeMode, palette, setPalette, theme } = usePreferences();
  const dark = theme === "dark";

  return (
    <View style={styles.listGap}>
      <View style={styles.field}>
        <AppText variant="caption">Mode</AppText>
        <SegmentedControl value={themeMode} onChange={(mode) => void setThemeMode(mode)} options={MODES} />
      </View>
      <View style={styles.field}>
        <AppText variant="caption">Color</AppText>
        <View style={styles.paletteGrid}>
          {PALETTES.map((p) => {
            const active = palette === p.id;
            const swatch = swatchColor(p, dark);
            return (
              <Pressable
                key={p.id}
                onPress={() => void setPalette(p.id)}
                accessibilityRole="button"
                accessibilityLabel={p.label}
                accessibilityState={{ selected: active }}
                style={[styles.paletteItem, { borderColor: active ? c.primary : "transparent", backgroundColor: active ? c.accent : "transparent" }]}
              >
                <View style={[styles.swatch, { backgroundColor: p.id === "midnight" ? "#0b0d14" : swatch, borderColor: c.border }]}>
                  {p.id === "midnight" ? <View style={[styles.swatchHalf, { backgroundColor: swatchColor(p, true) }]} /> : null}
                  {active ? <Ionicons name="checkmark" size={15} color={p.id === "zinc" && dark ? "#000000" : "#ffffff"} /> : null}
                </View>
                <Text numberOfLines={1} style={[styles.paletteLabel, { color: c.mutedForeground }]}>{p.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

/** Icon button that opens the theme & color sheet. */
export function ThemeToggle() {
  const { theme } = usePreferences();
  const [open, setOpen] = useState(false);
  return (
    <>
      <IconButton icon={theme === "dark" ? "moon-outline" : "sunny-outline"} onPress={() => setOpen(true)} accessibilityLabel="Theme and colors" />
      <Sheet visible={open} title="Theme & colors" description="Applies to the whole app" onClose={() => setOpen(false)}>
        <ThemePanel />
      </Sheet>
    </>
  );
}

/* -------------------------------------------------------------------------------------------------
 * Styles
 * -----------------------------------------------------------------------------------------------*/

export const uiStyles = StyleSheet.create({
  listGap: { gap: 12 },
  rowGap: { gap: 12 },
});

const styles = StyleSheet.create({
  flex: { flex: 1 },
  flexShrink: { flexShrink: 1, flexGrow: 1 },
  center: { alignItems: "center", justifyContent: "center" },
  textCenter: { textAlign: "center" },
  underline: { textDecorationLine: "underline" },
  mt2: { marginTop: 2 },
  mt4: { marginTop: 4 },
  mt8: { marginTop: 8 },
  listGap: { gap: 12 },
  eyebrow: { fontWeight: "600", marginBottom: 2 },
  screenContent: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 32, gap: 16 },
  pageHeader: { gap: 12 },
  shadowXs: {
    shadowOpacity: 0.05,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  card: {
    borderRadius: radius.xl,
    gap: 12,
    shadowOpacity: 0.05,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
    overflow: "hidden",
  },
  cardPadded: { padding: 16 },
  cardHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
  cardHeaderUnpadded: { paddingHorizontal: 16, paddingTop: 16 },
  cardFooter: { borderTopWidth: StyleSheet.hairlineWidth * 2, paddingTop: 12, flexDirection: "row", gap: 8, flexWrap: "wrap" },
  panel: { borderWidth: 1, borderRadius: radius.lg, padding: 12, gap: 8 },
  infoValue: { fontWeight: "500", textAlign: "right", flexShrink: 1 },
  button: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: radius.md },
  buttonText: { fontWeight: "500", flexShrink: 1 },
  iconBadge: {
    position: "absolute",
    top: 3,
    right: 3,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 3,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  iconBadgeText: { color: "#ffffff", fontSize: 9, fontWeight: "700" },
  field: { gap: 6 },
  inputWrap: {
    minHeight: 42,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  inputWrapMultiline: { alignItems: "flex-start", paddingVertical: 10 },
  input: { flex: 1, fontSize: 15, paddingVertical: Platform.OS === "ios" ? 11 : 8 },
  inputMultiline: { minHeight: 96, textAlignVertical: "top", paddingVertical: 0 },
  checkRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, paddingVertical: 4 },
  checkbox: { width: 18, height: 18, borderRadius: 5, borderWidth: 1.5, alignItems: "center", justifyContent: "center", marginTop: 1 },
  optionCard: { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1.5, borderRadius: radius.lg, padding: 12 },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  radioDot: { width: 8, height: 8, borderRadius: 4 },
  segmented: { flexDirection: "row", borderRadius: radius.lg, padding: 3, gap: 3 },
  segment: { flex: 1, minHeight: 32, borderRadius: radius.md, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingHorizontal: 6 },
  segmentText: { fontSize: 13, fontWeight: "500" },
  chip: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderRadius: radius.full, paddingHorizontal: 12, height: 32 },
  chipText: { fontSize: 13, fontWeight: "500" },
  chipRow: { gap: 8, paddingRight: 16 },
  badge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  badgeDot: { width: 6, height: 6, borderRadius: 3 },
  badgeText: { fontSize: 12, fontWeight: "500" },
  statGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  statCard: { flexGrow: 1, flexBasis: "46%", borderRadius: radius.xl, paddingHorizontal: 14, paddingVertical: 12, gap: 4 },
  statValue: { fontSize: 24, fontWeight: "600", letterSpacing: -0.4, fontVariant: ["tabular-nums"], marginTop: 2 },
  statIcon: { width: 36, height: 36, borderRadius: radius.lg, alignItems: "center", justifyContent: "center" },
  progressTrack: { height: 8, borderRadius: 4, overflow: "hidden" },
  progressBar: { height: "100%", borderRadius: 4 },
  divider: { height: StyleSheet.hairlineWidth * 2 },
  empty: { alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 28, paddingHorizontal: 16 },
  emptyBordered: { borderWidth: 1, borderStyle: "dashed", borderRadius: radius.xl, paddingVertical: 40 },
  emptyIcon: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  emptyIconCompact: { width: 36, height: 36, borderRadius: 18 },
  emptyDesc: { maxWidth: 300 },
  alert: { flexDirection: "row", gap: 10, borderWidth: 1, borderRadius: radius.lg, padding: 12, alignItems: "flex-start" },
  alertTitle: { fontSize: 14, fontWeight: "600" },
  alertDesc: { fontSize: 13, lineHeight: 18, marginTop: 2 },
  sheetBackdrop: { flex: 1, justifyContent: "flex-end" },
  sheetCard: { maxHeight: "92%", borderTopLeftRadius: 20, borderTopRightRadius: 20, borderWidth: 1, borderBottomWidth: 0 },
  sheetHandle: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, marginTop: 8 },
  sheetHeader: { flexDirection: "row", alignItems: "flex-start", gap: 12, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  sheetBody: { flexGrow: 0 },
  sheetBodyContent: { paddingHorizontal: 16, paddingBottom: 16, gap: 14 },
  sheetFooter: { borderTopWidth: 1, paddingHorizontal: 16, paddingTop: 12, flexDirection: "row", gap: 8 },
  listItem: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 44, borderRadius: radius.md, paddingHorizontal: 10, paddingVertical: 8 },
  listTitle: { fontSize: 14.5 },
  activeBar: { position: "absolute", left: 0, top: 8, bottom: 8, width: 3, borderRadius: 2 },
  paletteGrid: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  paletteItem: { width: "23%", alignItems: "center", gap: 4, borderWidth: 1, borderRadius: radius.lg, paddingVertical: 8 },
  swatch: { width: 30, height: 30, borderRadius: 15, borderWidth: 1, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  swatchHalf: { position: "absolute", right: 0, top: 0, bottom: 0, width: "50%" },
  paletteLabel: { fontSize: 10.5 },
});
