import { Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { AppText, Badge, Button, Chip, EmptyState, Input, Panel, Row, Switch, useColors, withAlpha } from "@/src/components/ui";
import { usePreferences } from "@/src/providers/app-providers";
import { formatMoney } from "@/src/lib/format";

import {
  SCHEDULE_DAYS,
  buildComboName,
  emptyComboOffer,
  emptyIngredient,
  emptyScheduleSlot,
  emptyVariant,
  type AvailabilitySlot,
  type ComboOffer,
  type ComboSelectableItem,
  type ItemIngredient,
  type ItemKind,
  type ItemVariant,
} from "./helpers";

function EditorHeader({ title, onRemove, removeLabel }: { title: string; onRemove: () => void; removeLabel: string }) {
  return (
    <Row justify="space-between" gap={8}>
      <AppText variant="label">{title}</AppText>
      <Button variant="ghost" size="sm" icon="trash-outline" onPress={onRemove} accessibilityLabel={removeLabel}>
        Remove
      </Button>
    </Row>
  );
}

export function VariantEditor({ variants, onChange }: { variants: ItemVariant[]; onChange: (variants: ItemVariant[]) => void }) {
  const patch = (index: number, next: Partial<ItemVariant>) =>
    onChange(variants.map((entry, entryIndex) => (entryIndex === index ? { ...entry, ...next } : entry)));

  return (
    <View style={styles.gap12}>
      {variants.map((variant, index) => (
        <Panel key={`variant-${index}`}>
          <EditorHeader
            title={`Variant ${index + 1}`}
            removeLabel="Remove variant"
            onRemove={() => onChange(variants.filter((_, entryIndex) => entryIndex !== index))}
          />
          <Row gap={8} align="flex-start">
            <View style={styles.flex}>
              <Input label="Option group" value={variant.name} onChangeText={(value) => patch(index, { name: value })} placeholder="Size" />
            </View>
            <View style={styles.flex}>
              <Input label="Option value" value={variant.value} onChangeText={(value) => patch(index, { value })} placeholder="Large" />
            </View>
          </Row>
          <Input
            label="Extra price"
            value={String(variant.price_delta ?? 0)}
            onChangeText={(value) => patch(index, { price_delta: value })}
            placeholder="0 or 1.50"
            keyboardType="decimal-pad"
            helper="Added to the base price when chosen."
          />
        </Panel>
      ))}
      <Button variant="outline" icon="add" onPress={() => onChange([...variants, emptyVariant()])} style={styles.selfStart}>
        Add variant
      </Button>
    </View>
  );
}

export function ScheduleEditor({ schedule, onChange }: { schedule: AvailabilitySlot[]; onChange: (schedule: AvailabilitySlot[]) => void }) {
  const patch = (index: number, next: Partial<AvailabilitySlot>) =>
    onChange(schedule.map((entry, entryIndex) => (entryIndex === index ? { ...entry, ...next } : entry)));

  return (
    <View style={styles.gap12}>
      {schedule.map((slot, index) => (
        <Panel key={`schedule-${index}`}>
          <EditorHeader
            title={`Time slot ${index + 1}`}
            removeLabel="Remove time slot"
            onRemove={() => onChange(schedule.filter((_, entryIndex) => entryIndex !== index))}
          />
          <Row wrap gap={6}>
            {SCHEDULE_DAYS.map((day) => (
              <Chip key={day} label={day} selected={slot.day === day} onPress={() => patch(index, { day })} />
            ))}
          </Row>
          <Row gap={8} align="flex-start">
            <View style={styles.flex}>
              <Input label="From" value={slot.from} onChangeText={(value) => patch(index, { from: value })} placeholder="09:00" icon="time-outline" />
            </View>
            <View style={styles.flex}>
              <Input label="To" value={slot.to} onChangeText={(value) => patch(index, { to: value })} placeholder="18:00" icon="time-outline" />
            </View>
          </Row>
        </Panel>
      ))}
      <Button variant="outline" icon="add" onPress={() => onChange([...schedule, emptyScheduleSlot()])} style={styles.selfStart}>
        Add time slot
      </Button>
    </View>
  );
}

export function IngredientEditor({ ingredients, onChange }: { ingredients: ItemIngredient[]; onChange: (ingredients: ItemIngredient[]) => void }) {
  const patch = (index: number, next: Partial<ItemIngredient>) =>
    onChange(ingredients.map((entry, entryIndex) => (entryIndex === index ? { ...entry, ...next } : entry)));

  return (
    <View style={styles.gap12}>
      {ingredients.length === 0 ? (
        <EmptyState compact icon="nutrition-outline" title="No ingredients yet" description="Add the ingredients used in this product." />
      ) : null}
      {ingredients.map((ingredient, index) => (
        <Panel key={`ingredient-${index}`}>
          <EditorHeader
            title={`Ingredient ${index + 1}`}
            removeLabel="Remove ingredient"
            onRemove={() => onChange(ingredients.filter((_, entryIndex) => entryIndex !== index))}
          />
          <Input label="Ingredient name" value={ingredient.name} onChangeText={(value) => patch(index, { name: value })} placeholder="Tomato" />
          <Row justify="space-between" gap={12}>
            <View style={styles.flex}>
              <AppText variant="label">Removable</AppText>
              <AppText variant="caption">Customers can order without it.</AppText>
            </View>
            <Switch value={ingredient.removable} onValueChange={(value) => patch(index, { removable: value })} />
          </Row>
        </Panel>
      ))}
      <Button variant="outline" icon="add" onPress={() => onChange([...ingredients, emptyIngredient()])} style={styles.selfStart}>
        Add ingredient
      </Button>
    </View>
  );
}

function IngredientChips({ ingredients }: { ingredients?: ItemIngredient[] | null }) {
  const list = ingredients ?? [];
  if (list.length === 0) {
    return <AppText variant="caption">No ingredients listed</AppText>;
  }
  return (
    <Row wrap gap={4}>
      {list.slice(0, 6).map((ingredient) => (
        <Badge key={ingredient.name} tone={ingredient.removable ? "info" : "neutral"}>
          {ingredient.removable ? `${ingredient.name} (removable)` : ingredient.name}
        </Badge>
      ))}
      {list.length > 6 ? <Badge>{`+${list.length - 6} more`}</Badge> : null}
    </Row>
  );
}

export function ComboOfferEditor({
  comboOffers,
  availableItems,
  itemKind,
  onChange,
}: {
  comboOffers: ComboOffer[];
  availableItems: ComboSelectableItem[];
  itemKind: ItemKind;
  onChange: (comboOffers: ComboOffer[]) => void;
}) {
  const c = useColors();
  const { language } = usePreferences();
  const visibleComboOffers = itemKind === "combo" ? (comboOffers.length > 0 ? [comboOffers[0]] : [emptyComboOffer()]) : comboOffers;

  function toggleComboItem(comboIndex: number, item: ComboSelectableItem) {
    const sourceOffers = itemKind === "combo" ? visibleComboOffers : comboOffers;
    const next = sourceOffers.map((entry, entryIndex) => {
      if (entryIndex !== comboIndex) {
        return entry;
      }

      const currentIds = new Set(entry.item_ids ?? []);
      if (currentIds.has(item.id)) {
        currentIds.delete(item.id);
      } else {
        currentIds.add(item.id);
      }

      const selectedItems = availableItems.filter((candidate) => currentIds.has(candidate.id));

      return {
        ...entry,
        name: entry.name?.trim() || buildComboName(selectedItems),
        item_ids: selectedItems.map((candidate) => candidate.id),
        items: selectedItems.map((candidate) => ({
          id: candidate.id,
          name: candidate.name,
          sku: candidate.sku,
          ingredients: candidate.ingredients,
        })),
      };
    });

    onChange(next);
  }

  const patch = (index: number, next: Partial<ComboOffer>) =>
    onChange(comboOffers.map((entry, entryIndex) => (entryIndex === index ? { ...entry, ...next } : entry)));

  return (
    <View style={styles.gap12}>
      {availableItems.length === 0 ? (
        <EmptyState
          compact
          icon="layers-outline"
          title="No products to combine yet"
          description="Add other products to this market first, then you can build combos from them here."
        />
      ) : null}

      {visibleComboOffers.map((comboOffer, index) => (
        <Panel key={`combo-offer-${index}`}>
          {itemKind === "regular" ? (
            <>
              <EditorHeader
                title={`Combo offer ${index + 1}`}
                removeLabel="Remove combo"
                onRemove={() => onChange(comboOffers.filter((_, entryIndex) => entryIndex !== index))}
              />
              <Input label="Combo label" value={comboOffer.name ?? ""} onChangeText={(value) => patch(index, { name: value })} placeholder="Auto-filled from selected items" />
              <Input
                label="Combo price"
                value={String(comboOffer.combo_price ?? 0)}
                onChangeText={(value) => patch(index, { combo_price: Number(value || 0) })}
                keyboardType="decimal-pad"
                placeholder="12.99"
              />
              <Input label="Description" value={comboOffer.description ?? ""} onChangeText={(value) => patch(index, { description: value })} placeholder="Optional short note" />
            </>
          ) : (
            <AppText variant="small" tone="muted">
              This combo product is sold at the price set in Pricing. Here you only choose which products are included.
            </AppText>
          )}

          <AppText variant="label">Products included in this combo</AppText>
          <View style={styles.gap8}>
            {availableItems.map((item) => {
              const active = (comboOffer.item_ids ?? []).includes(item.id);
              return (
                <Pressable
                  key={`${item.id}-${index}`}
                  onPress={() => toggleComboItem(index, item)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: active }}
                  style={[
                    styles.comboOption,
                    { borderColor: active ? c.primary : c.border, backgroundColor: active ? withAlpha(c.primary, 0.06) : c.card },
                  ]}
                >
                  <View style={[styles.flex, styles.gap4]}>
                    <AppText variant="label" numberOfLines={1}>
                      {item.name}
                    </AppText>
                    <AppText variant="caption">
                      {item.sku} · {formatMoney(item.price, language)}
                    </AppText>
                    {item.ingredients.length > 0 ? <IngredientChips ingredients={item.ingredients} /> : null}
                  </View>
                  <View style={[styles.check, { borderColor: active ? c.primary : c.input, backgroundColor: active ? c.primary : c.card }]}>
                    {active ? <Ionicons name="checkmark" size={13} color={c.primaryForeground} /> : null}
                  </View>
                </Pressable>
              );
            })}
          </View>

          <AppText variant="caption">
            {(comboOffer.items ?? []).length > 0
              ? `Selected: ${(comboOffer.items ?? []).map((item) => item.name).join(", ")}`
              : "Choose at least one product for this combo."}
          </AppText>
          {(comboOffer.items ?? []).map((item) => (
            <View key={`combo-item-preview-${item.id}`} style={[styles.selectedItem, { borderColor: c.border, backgroundColor: c.card }]}>
              <AppText variant="label">{item.name}</AppText>
              <IngredientChips ingredients={item.ingredients} />
            </View>
          ))}
        </Panel>
      ))}

      {itemKind === "regular" ? (
        <Button
          variant="outline"
          icon="add"
          onPress={() => onChange([...(comboOffers ?? []), emptyComboOffer()])}
          disabled={availableItems.length === 0}
          style={styles.selfStart}
        >
          Add combo offer
        </Button>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  gap4: { gap: 4 },
  gap8: { gap: 8 },
  gap12: { gap: 12 },
  selfStart: { alignSelf: "flex-start" },
  comboOption: { flexDirection: "row", alignItems: "flex-start", gap: 10, borderWidth: 1.5, borderRadius: 10, padding: 12, minHeight: 44 },
  check: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  selectedItem: { borderWidth: 1, borderRadius: 10, padding: 10, gap: 6 },
});
