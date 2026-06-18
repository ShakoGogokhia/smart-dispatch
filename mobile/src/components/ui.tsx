import { useEffect, useRef } from "react";
import type { PropsWithChildren, ReactNode } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { usePreferences } from "@/src/providers/app-providers";

type ButtonVariant = "primary" | "secondary" | "danger";

export function usePalette() {
  const { theme } = usePreferences();
  const dark = theme === "dark";

  return {
    dark,
    background: dark ? "#020617" : "#f1f5f9",
    backgroundAlt: dark ? "#08111b" : "#ffffff",
    surface: dark ? "#0b1220" : "#ffffff",
    surfaceStrong: dark ? "#0f172a" : "#111827",
    surfaceMuted: dark ? "#111827" : "#f8fafc",
    border: dark ? "#26364d" : "#e2e8f0",
    text: dark ? "#f8fafc" : "#0f172a",
    muted: dark ? "#94a3b8" : "#64748b",
    primary: dark ? "#67e8f9" : "#0891b2",
    primaryStrong: dark ? "#a5f3fc" : "#0e7490",
    primaryText: "#ffffff",
    accent: dark ? "#fcd34d" : "#d97706",
    accentSoft: dark ? "rgba(252, 211, 77, 0.12)" : "rgba(217, 119, 6, 0.10)",
    danger: dark ? "#fda4af" : "#e11d48",
    warning: dark ? "#facc15" : "#b45309",
    shadow: dark ? "#000000" : "#0f172a",
    overlay: dark ? "rgba(2, 6, 23, 0.78)" : "rgba(15, 23, 42, 0.28)",
  };
}

function useEntranceAnimation(delay = 0) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(18)).current;
  const scale = useRef(new Animated.Value(0.98)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 360,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 420,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 1,
        duration: 420,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [delay, opacity, scale, translateY]);

  return {
    opacity,
    transform: [{ translateY }, { scale }],
  };
}

function AmbientBackground() {
  const palette = usePalette();

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={[styles.backgroundLayer, { backgroundColor: palette.background }]} />
      <View style={[styles.gridOverlay, { borderColor: `${palette.border}35` }]} />
    </View>
  );
}

export function Screen({ children, scroll = true }: PropsWithChildren<{ scroll?: boolean }>) {
  const palette = usePalette();

  if (!scroll) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: palette.background }]}>
        <AmbientBackground />
        <View style={[styles.screen, styles.screenContent]}>{children}</View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: palette.background }]}>
      <AmbientBackground />
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.screenContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

export function SectionCard({
  children,
  title,
  subtitle,
  right,
}: PropsWithChildren<{ title?: string; subtitle?: string; right?: ReactNode }>) {
  const palette = usePalette();
  const animatedStyle = useEntranceAnimation();

  return (
    <Animated.View
      style={[
        styles.card,
        {
          backgroundColor: `${palette.surface}f2`,
          borderColor: `${palette.border}bb`,
          shadowColor: palette.shadow,
        },
        animatedStyle,
      ]}
    >
      {(title || subtitle || right) && (
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderText}>
            {title ? <Text style={[styles.cardTitle, { color: palette.text }]}>{title}</Text> : null}
            {subtitle ? <Text style={[styles.cardSubtitle, { color: palette.muted }]}>{subtitle}</Text> : null}
          </View>
          {right}
        </View>
      )}
      {children}
    </Animated.View>
  );
}

export function HeroCard({
  eyebrow,
  title,
  subtitle,
  children,
}: PropsWithChildren<{ eyebrow?: string; title: string; subtitle: string }>) {
  const palette = usePalette();
  const animatedStyle = useEntranceAnimation(60);

  return (
    <Animated.View
      style={[
        styles.heroCard,
        {
          backgroundColor: palette.surfaceStrong,
          borderColor: palette.dark ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.12)",
          shadowColor: palette.shadow,
        },
        animatedStyle,
      ]}
    >
      {eyebrow ? <Text style={styles.heroEyebrow}>{eyebrow}</Text> : null}
      <Text style={styles.heroTitle}>{title}</Text>
      <Text style={styles.heroSubtitle}>{subtitle}</Text>
      {children}
    </Animated.View>
  );
}

export function AppButton({
  children,
  onPress,
  disabled,
  variant = "primary",
  compact = false,
}: PropsWithChildren<{
  onPress?: () => void;
  disabled?: boolean;
  variant?: ButtonVariant;
  compact?: boolean;
}>) {
  const palette = usePalette();
  const scale = useRef(new Animated.Value(1)).current;

  const colors =
    variant === "secondary"
      ? { backgroundColor: `${palette.surfaceMuted}f0`, borderColor: `${palette.border}cc`, color: palette.text }
      : variant === "danger"
        ? { backgroundColor: palette.danger, borderColor: palette.danger, color: "#ffffff" }
        : { backgroundColor: palette.primary, borderColor: palette.primary, color: palette.primaryText };

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        onPress={disabled ? undefined : onPress}
        onPressIn={() => Animated.spring(scale, { toValue: 0.98, useNativeDriver: true, speed: 40, bounciness: 6 }).start()}
        onPressOut={() => Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 40, bounciness: 6 }).start()}
        style={[
          styles.button,
          compact && styles.buttonCompact,
          {
            backgroundColor: disabled ? `${palette.border}aa` : colors.backgroundColor,
            borderColor: colors.borderColor,
            shadowColor: palette.shadow,
          },
        ]}
      >
        <Text style={[styles.buttonText, { color: disabled ? palette.muted : colors.color }]}>{children}</Text>
      </Pressable>
    </Animated.View>
  );
}

export function InputField({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  multiline,
  keyboardType,
  editable = true,
}: {
  label?: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  multiline?: boolean;
  keyboardType?: "default" | "email-address" | "numeric";
  editable?: boolean;
}) {
  const palette = usePalette();

  return (
    <View style={styles.field}>
      {label ? <Text style={[styles.fieldLabel, { color: palette.muted }]}>{label}</Text> : null}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={palette.muted}
        secureTextEntry={secureTextEntry}
        multiline={multiline}
        keyboardType={keyboardType}
        editable={editable}
        style={[
          styles.input,
          multiline && styles.inputMultiline,
          {
            backgroundColor: editable ? `${palette.backgroundAlt}ea` : `${palette.backgroundAlt}b8`,
            borderColor: `${palette.border}c9`,
            color: editable ? palette.text : palette.muted,
          },
        ]}
      />
    </View>
  );
}

export function HelperText({ children, tone = "muted" }: PropsWithChildren<{ tone?: "muted" | "danger" | "success" }>) {
  const palette = usePalette();
  const color = tone === "danger" ? palette.danger : tone === "success" ? palette.primaryStrong : palette.muted;

  return <Text style={[styles.helperText, { color }]}>{children}</Text>;
}

export function Pill({ children, tone = "neutral" }: PropsWithChildren<{ tone?: "neutral" | "success" | "warning" | "danger" }>) {
  const palette = usePalette();

  const backgroundColor =
    tone === "success"
      ? `${palette.primaryStrong}22`
      : tone === "warning"
        ? `${palette.warning}22`
        : tone === "danger"
          ? `${palette.danger}22`
          : `${palette.surfaceMuted}ee`;

  const color =
    tone === "success"
      ? palette.primaryStrong
      : tone === "warning"
        ? palette.warning
        : tone === "danger"
          ? palette.danger
          : palette.text;

  return (
    <View style={[styles.pill, { backgroundColor, borderColor: `${palette.border}aa` }]}>
      <Text style={[styles.pillText, { color }]}>{children}</Text>
    </View>
  );
}

export function StatGrid({ children }: PropsWithChildren) {
  return <View style={styles.statGrid}>{children}</View>;
}

export function StatCard({ label, value, note }: { label: string; value: string | number; note?: string }) {
  const palette = usePalette();
  const animatedStyle = useEntranceAnimation(120);

  return (
    <Animated.View
      style={[
        styles.statCard,
        {
          backgroundColor: `${palette.surfaceMuted}f4`,
          borderColor: `${palette.border}bf`,
        },
        animatedStyle,
      ]}
    >
      <Text style={[styles.statLabel, { color: palette.muted }]}>{label}</Text>
      <Text style={[styles.statValue, { color: palette.text }]}>{value}</Text>
      {note ? <Text style={[styles.statNote, { color: palette.muted }]}>{note}</Text> : null}
    </Animated.View>
  );
}

export function Divider() {
  const palette = usePalette();
  return <View style={[styles.divider, { backgroundColor: `${palette.border}aa` }]} />;
}

export function LoadingBlock({ message = "Loading..." }: { message?: string }) {
  const palette = usePalette();

  return (
    <SectionCard>
      <View style={styles.centeredBlock}>
        <ActivityIndicator color={palette.primary} />
        <Text style={[styles.loadingText, { color: palette.muted }]}>{message}</Text>
      </View>
    </SectionCard>
  );
}

export function EmptyBlock({
  message,
  actionLabel,
  onAction,
}: {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const palette = usePalette();

  return (
    <SectionCard>
      <View style={styles.centeredBlock}>
        <Text style={[styles.loadingText, { color: palette.muted }]}>{message}</Text>
        {actionLabel && onAction ? (
          <View style={styles.emptyAction}>
            <AppButton variant="secondary" onPress={onAction}>
              {actionLabel}
            </AppButton>
          </View>
        ) : null}
      </View>
    </SectionCard>
  );
}

export function AppModal({
  visible,
  title,
  onClose,
  children,
}: PropsWithChildren<{ visible: boolean; title: string; onClose: () => void }>) {
  const palette = usePalette();

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={[styles.modalBackdrop, { backgroundColor: palette.overlay }]}>
        <View style={[styles.modalCard, { backgroundColor: palette.surface, borderColor: `${palette.border}aa` }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.cardTitle, { color: palette.text }]}>{title}</Text>
            <AppButton variant="secondary" compact onPress={onClose}>
              Close
            </AppButton>
          </View>
          <ScrollView style={styles.modalBody} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

export function SettingRow({
  label,
  value,
  onPress,
}: {
  label: string;
  value?: string;
  onPress?: () => void;
}) {
  const palette = usePalette();

  return (
    <Pressable
      onPress={onPress}
      style={[styles.settingRow, { backgroundColor: `${palette.surfaceMuted}ed`, borderColor: `${palette.border}bf` }]}
    >
      <Text style={[styles.settingLabel, { color: palette.text }]}>{label}</Text>
      {value ? <Text style={[styles.settingValue, { color: palette.muted }]}>{value}</Text> : null}
    </Pressable>
  );
}

export function ToggleRow({
  label,
  value,
  onValueChange,
}: {
  label: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}) {
  const palette = usePalette();

  return (
    <View style={[styles.settingRow, { backgroundColor: `${palette.surfaceMuted}ed`, borderColor: `${palette.border}bf` }]}>
      <Text style={[styles.settingLabel, { color: palette.text }]}>{label}</Text>
      <Switch value={value} onValueChange={onValueChange} trackColor={{ true: palette.primary }} />
    </View>
  );
}

export const uiStyles = StyleSheet.create({
  listGap: {
    gap: 14,
  },
  rowGap: {
    gap: 12,
  },
});

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  screen: {
    flex: 1,
  },
  screenContent: {
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 28,
    gap: 16,
  },
  backgroundLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  gridOverlay: {
    position: "absolute",
    top: 12,
    left: 12,
    right: 12,
    bottom: 12,
    borderWidth: 1,
    borderRadius: 34,
    opacity: 0.18,
  },
  card: {
    overflow: "hidden",
    borderWidth: 1,
    borderRadius: 28,
    padding: 18,
    gap: 12,
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
  },
  heroCard: {
    overflow: "hidden",
    borderWidth: 1,
    borderRadius: 34,
    padding: 22,
    gap: 10,
    shadowOpacity: 0.2,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 16 },
    elevation: 6,
  },
  heroEyebrow: {
    color: "rgba(255,255,255,0.78)",
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1.4,
  },
  heroTitle: {
    color: "#ffffff",
    fontSize: 34,
    lineHeight: 38,
    fontWeight: "900",
    flexShrink: 1,
  },
  heroSubtitle: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 15,
    lineHeight: 23,
    flexShrink: 1,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "flex-start",
  },
  cardHeaderText: {
    flex: 1,
    gap: 4,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: "800",
    flexShrink: 1,
  },
  cardSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    flexShrink: 1,
  },
  button: {
    minHeight: 50,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
  },
  buttonCompact: {
    minHeight: 40,
    paddingHorizontal: 13,
    borderRadius: 14,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: "800",
    textAlign: "center",
    flexShrink: 1,
  },
  field: {
    gap: 8,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    flexShrink: 1,
  },
  input: {
    minHeight: 52,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  inputMultiline: {
    minHeight: 110,
    textAlignVertical: "top",
  },
  helperText: {
    fontSize: 13,
    lineHeight: 19,
  },
  pill: {
    alignSelf: "flex-start",
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  pillText: {
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    flexShrink: 1,
    textAlign: "center",
  },
  statGrid: {
    gap: 12,
  },
  statCard: {
    borderWidth: 1,
    borderRadius: 22,
    padding: 15,
    gap: 6,
  },
  statLabel: {
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 1,
    fontWeight: "800",
    flexShrink: 1,
  },
  statValue: {
    fontSize: 30,
    fontWeight: "900",
    flexShrink: 1,
  },
  statNote: {
    fontSize: 13,
    lineHeight: 18,
  },
  divider: {
    height: 1,
  },
  centeredBlock: {
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingVertical: 18,
  },
  loadingText: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 21,
  },
  emptyAction: {
    width: "100%",
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalCard: {
    maxHeight: "92%",
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  modalBody: {
    maxHeight: "100%",
  },
  settingRow: {
    minHeight: 58,
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  settingLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: "700",
    flexShrink: 1,
  },
  settingValue: {
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
});
