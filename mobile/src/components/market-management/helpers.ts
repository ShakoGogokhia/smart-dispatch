import { Platform } from "react-native";

import { api } from "@/src/lib/api";
import type { Item, PromoCode, UserLite } from "@/src/types/api";
import type { Tone } from "@/src/components/ui";

export type StaffUser = UserLite & {
  roles?: string[];
  is_owner?: boolean;
  pivot?: { role?: string };
};

export type ItemVariant = {
  name: string;
  value: string;
  price_delta?: number | string;
};

export type AvailabilitySlot = {
  day: string;
  from: string;
  to: string;
};

export type ItemIngredient = {
  name: string;
  removable: boolean;
};

export type ItemKind = "regular" | "combo";

export type ComboOffer = NonNullable<Item["combo_offers"]>[number];

export type ComboSelectableItem = {
  id: number;
  name: string;
  sku: string;
  price: string | number;
  ingredients: ItemIngredient[];
};

export type PickedImage = { uri: string; name: string; type: string };

export const SCHEDULE_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export const MONO_FONT = Platform.select({ ios: "Menlo", default: "monospace" });

export function emptyVariant(): ItemVariant {
  return { name: "", value: "", price_delta: 0 };
}

export function emptyIngredient(): ItemIngredient {
  return { name: "", removable: false };
}

export function emptyComboOffer(): ComboOffer {
  return { name: "", description: null, combo_price: 0, item_ids: [], items: [] };
}

export function emptyScheduleSlot(): AvailabilitySlot {
  return { day: "Mon", from: "", to: "" };
}

export function normalizeVariants(variants: ItemVariant[]) {
  const normalized = variants
    .map((variant) => ({
      name: variant.name.trim(),
      value: variant.value.trim(),
      price_delta: Number(variant.price_delta || 0),
    }))
    .filter((variant) => variant.name.length > 0 && variant.value.length > 0);

  return normalized.length > 0 ? normalized : null;
}

export function normalizeAvailabilitySchedule(slots: AvailabilitySlot[]) {
  const normalized = slots
    .map((slot) => ({ day: slot.day.trim(), from: slot.from.trim(), to: slot.to.trim() }))
    .filter((slot) => slot.day && slot.from && slot.to);

  return normalized.length > 0 ? normalized : null;
}

export function normalizeIngredients(ingredients: ItemIngredient[]) {
  const normalized = ingredients
    .map((ingredient) => ({ name: ingredient.name.trim(), removable: Boolean(ingredient.removable) }))
    .filter((ingredient) => ingredient.name.length > 0);

  return normalized.length > 0 ? normalized : null;
}

export function normalizeComboOffers(comboOffers: ComboOffer[]) {
  const normalized = comboOffers
    .map((comboOffer) => ({
      name: comboOffer.name?.trim() || "",
      description: comboOffer.description?.trim() ? comboOffer.description.trim() : null,
      combo_price: Number(comboOffer.combo_price || 0),
      item_ids: Array.from(
        new Set(
          (comboOffer.item_ids ?? [])
            .map((itemId) => Number(itemId))
            .filter((itemId) => Number.isInteger(itemId) && itemId > 0),
        ),
      ),
    }))
    .filter((comboOffer) => comboOffer.item_ids.length > 0);

  return normalized.length > 0 ? normalized : null;
}

export function buildComboName(selectedItems: ComboSelectableItem[]) {
  return selectedItems
    .map((item) => item.name.trim())
    .filter(Boolean)
    .slice(0, 3)
    .join(" + ");
}

export function getComboSelectableItems(items: Item[], currentItemId?: number | null): ComboSelectableItem[] {
  return items
    .filter((item) => item.id !== currentItemId)
    .map((item) => ({
      id: item.id,
      name: item.name,
      sku: item.sku,
      price: item.price,
      ingredients: item.ingredients ?? [],
    }));
}

export function hydrateComboOffers(comboOffers: Item["combo_offers"], items: ComboSelectableItem[]): ComboOffer[] {
  return (comboOffers ?? []).map((comboOffer) => {
    const selectedIds = Array.from(
      new Set(
        (comboOffer.item_ids ?? comboOffer.items?.map((item) => item.id) ?? [])
          .map((itemId) => Number(itemId))
          .filter((itemId) => Number.isInteger(itemId) && itemId > 0),
      ),
    );
    const selectedItems = selectedIds
      .map((itemId) => items.find((item) => item.id === itemId))
      .filter((item): item is ComboSelectableItem => Boolean(item));

    return {
      ...comboOffer,
      name: comboOffer.name?.trim() || buildComboName(selectedItems),
      item_ids: selectedIds,
      items: selectedItems.map((item) => ({
        id: item.id,
        name: item.name,
        sku: item.sku,
        ingredients: item.ingredients,
      })),
    };
  });
}

export function buildComboPayload(itemKind: ItemKind, comboOffers: ComboOffer[], priceValue: string | number) {
  const normalized = normalizeComboOffers(comboOffers) ?? [];

  if (itemKind === "combo") {
    const primaryCombo = normalized[0];

    if (!primaryCombo) {
      return null;
    }

    return [
      {
        ...primaryCombo,
        name: primaryCombo.name || "Combo bundle",
        description: null,
        combo_price: Number(priceValue || 0),
      },
    ];
  }

  return normalized.length > 0 ? normalized : null;
}

export function getItemIngredientsPayload(itemKind: ItemKind, ingredients: ItemIngredient[]) {
  if (itemKind === "combo") {
    return null;
  }

  return normalizeIngredients(ingredients);
}

export function resolveMediaUrl(url?: string | null) {
  if (!url) {
    return null;
  }

  try {
    const apiOrigin = new URL(api.defaults.baseURL ?? "http://127.0.0.1:8000").origin;
    const parsed = new URL(url, apiOrigin);

    if (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1") {
      return `${apiOrigin}${parsed.pathname}${parsed.search}${parsed.hash}`;
    }

    return parsed.toString();
  } catch {
    return url;
  }
}

export function getItemImageUrls(item?: Item | null) {
  const urls = [...(item?.image_urls ?? [])];

  if (item?.image_url) {
    urls.push(item.image_url);
  }

  return Array.from(
    new Set(
      urls
        .map((url) => resolveMediaUrl(url))
        .filter((url): url is string => typeof url === "string" && url.length > 0),
    ),
  );
}

/* ---------- presentation-only helpers (same logic as the web) ---------- */

export type DiscountType = NonNullable<Item["discount_type"]>;

export function computeFinalPrice(price: string | number, discountType: DiscountType | undefined, discountValue: string | number | undefined) {
  const base = Number(price || 0);
  const value = Number(discountValue || 0);
  if (!Number.isFinite(base)) return 0;
  if (!Number.isFinite(value) || value <= 0 || !discountType || discountType === "none") return base;
  const result = discountType === "percent" ? base * (1 - value / 100) : base - value;
  return Math.max(0, Math.round(result * 100) / 100);
}

export function hasDiscount(item: Pick<Item, "discount_type" | "discount_value">) {
  return !!item.discount_type && item.discount_type !== "none" && Number(item.discount_value || 0) > 0;
}

export type StockState = "in" | "low" | "out";

export function getStockState(item: Pick<Item, "stock_qty" | "is_low_stock" | "low_stock_threshold">): StockState {
  const qty = Number(item.stock_qty || 0);
  if (qty <= 0) return "out";
  if (item.is_low_stock ?? qty <= Number(item.low_stock_threshold ?? 5)) return "low";
  return "in";
}

export function describeDiscount(item: Pick<Item, "discount_type" | "discount_value">) {
  if (!hasDiscount(item)) return "No discount";
  return item.discount_type === "percent" ? `${Number(item.discount_value)}% off` : `${Number(item.discount_value).toFixed(2)} off`;
}

export function summarizeExtras(item: Item) {
  const schedule = normalizeAvailabilitySchedule((item.availability_schedule as AvailabilitySlot[] | null) ?? []);
  const variants = normalizeVariants((item.variants as ItemVariant[] | null) ?? []);
  const ingredients = normalizeIngredients((item.ingredients as ItemIngredient[] | null) ?? []);
  const combos = item.combo_offers ?? [];

  const scheduleLabel = schedule?.length ? `${schedule.length} time slot${schedule.length === 1 ? "" : "s"}` : "Always available";
  const parts: string[] = [];
  if (variants?.length) parts.push(`${variants.length} option${variants.length === 1 ? "" : "s"}`);
  if (ingredients?.length) {
    const removable = ingredients.filter((ingredient) => ingredient.removable).length;
    parts.push(`${ingredients.length} ingredients (${removable > 0 ? `${removable} removable` : "all required"})`);
  }
  if (combos.length) parts.push(`${combos.length} combo offer${combos.length === 1 ? "" : "s"}`);

  return { scheduleLabel, extrasLabel: parts.length ? parts.join(" · ") : "No variants, ingredients or combos" };
}

/* ---------- promo helpers ---------- */

export type PromoStatus = "active" | "expired" | "scheduled" | "disabled";

export function promoStatus(promo: PromoCode, now: number): PromoStatus {
  if (!promo.is_active) return "disabled";
  if (promo.ends_at) {
    const end = new Date(promo.ends_at).getTime();
    if (!Number.isNaN(end) && end < now) return "expired";
  }
  if (promo.max_uses && promo.uses >= promo.max_uses) return "expired";
  if (promo.starts_at) {
    const start = new Date(promo.starts_at).getTime();
    if (!Number.isNaN(start) && start > now) return "scheduled";
  }
  return "active";
}

export const PROMO_STATUS_META: Record<PromoStatus, { label: string; tone: Tone }> = {
  active: { label: "Active", tone: "success" },
  expired: { label: "Expired", tone: "destructive" },
  scheduled: { label: "Scheduled", tone: "info" },
  disabled: { label: "Disabled", tone: "neutral" },
};
