import { Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useColors, withAlpha } from "@/src/components/ui";

const STARS = [1, 2, 3, 4, 5];

/**
 * 5-star picker. Interactive when `onChange` is given (large touch targets, "Rate N out of 5" labels),
 * otherwise a read-only display.
 */
export function StarRating({
  value,
  onChange,
  size,
  label = "Rating",
}: {
  value: number;
  onChange?: (value: number) => void;
  size?: number;
  label?: string;
}) {
  const c = useColors();
  const rounded = Math.round(value || 0);
  const iconSize = size ?? (onChange ? 30 : 14);
  const colorFor = (star: number) => (star <= rounded ? c.warning : withAlpha(c.mutedForeground, 0.5));
  const nameFor = (star: number) => (star <= rounded ? "star" : "star-outline");

  if (!onChange) {
    return (
      <View style={styles.row} accessible accessibilityLabel={`${rounded} out of 5 stars`}>
        {STARS.map((star) => (
          <Ionicons key={star} name={nameFor(star)} size={iconSize} color={colorFor(star)} />
        ))}
      </View>
    );
  }

  return (
    <View style={styles.row} accessibilityRole="radiogroup" accessibilityLabel={label}>
      {STARS.map((star) => (
        <Pressable
          key={star}
          onPress={() => onChange(star)}
          accessibilityRole="radio"
          accessibilityState={{ checked: star === rounded }}
          accessibilityLabel={`Rate ${star} out of 5`}
          hitSlop={4}
          style={({ pressed }) => [styles.button, pressed && styles.pressed]}
        >
          <Ionicons name={nameFor(star)} size={iconSize} color={colorFor(star)} />
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 2 },
  button: { minWidth: 40, minHeight: 40, alignItems: "center", justifyContent: "center" },
  pressed: { opacity: 0.6 },
});
