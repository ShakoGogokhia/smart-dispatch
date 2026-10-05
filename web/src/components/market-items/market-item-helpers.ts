import { api } from "@/lib/api";
import type { ComboOffer, ItemIngredient } from "@/lib/cart";

export type Item = {
  id: number;
  market_id: number;
  name: string;
  sku: string;
  item_kind?: "regular" | "combo";
  category?: string | null;
  image_url?: string | null;
  image_urls?: string[] | null;
  variants?: Array<{ name: string; value: string; price_delta?: number | string }> | null;
  availability_schedule?: Array<{ day: string; from: string; to: string }> | null;
  ingredients?: ItemIngredient[] | null;
  combo_offers?: ComboOffer[] | null;
  price: string | number;
  discount_type: "none" | "percent" | "fixed";
  discount_value: string | number;
  stock_qty: number;
  show_stock_quantity?: boolean;
  low_stock_threshold?: number;
  is_low_stock?: boolean;
  is_active: boolean;
  review_summary?: {
    count?: number;
    average?: number | null;
  };
};

export type ItemKind = "regular" | "combo";

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

export type ComboSelectableItem = {
  id: number;
  name: string;
  sku: string;
  price: string | number;
  ingredients: ItemIngredient[];
};

export const SCHEDULE_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function emptyIngredient(): ItemIngredient {
  return {
    name: "",
    removable: false,
  };
}

export function emptyComboOffer(): ComboOffer {
  return {
    name: "",
    description: "",
    combo_price: 0,
    item_ids: [],
    items: [],
  };
}

export function buildComboPayload(itemKind: ItemKind, comboOffers: ComboOffer[], priceValue: string | number) {
  const normalized = normalizeComboOffers(comboOffers);

  if (itemKind === "combo") {
    const primaryCombo = normalized[0];

    if (!primaryCombo) {
      return [];
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

  return normalized;
}

export function emptyVariant(): ItemVariant {
  return {
    name: "",
    value: "",
    price_delta: 0,
  };
}

export function emptyAvailabilitySlot(): AvailabilitySlot {
  return {
    day: "Mon",
    from: "",
    to: "",
  };
}

export function normalizeIngredients(ingredients: ItemIngredient[]) {
  return ingredients
    .map((ingredient) => ({
      name: ingredient.name.trim(),
      removable: Boolean(ingredient.removable),
    }))
    .filter((ingredient) => ingredient.name.length > 0);
}

export function normalizeComboOffers(comboOffers: ComboOffer[]) {
  return comboOffers
    .map((comboOffer) => ({
      name: comboOffer.name.trim(),
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
}

export function buildComboName(selectedItems: ComboSelectableItem[]) {
  return selectedItems
    .map((item) => item.name.trim())
    .filter(Boolean)
    .slice(0, 3)
    .join(" + ");
}

export function getComboSelectableItems(items: Item[], currentItemId?: number | null) {
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

export function hydrateComboOffers(comboOffers: ComboOffer[] | null | undefined, items: ComboSelectableItem[]) {
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

export function getItemIngredientsPayload(itemKind: ItemKind, ingredients: ItemIngredient[]) {
  if (itemKind === "combo") {
    return null;
  }

  return normalizeIngredients(ingredients);
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

export function normalizeAvailabilitySchedule(schedule: AvailabilitySlot[]) {
  const normalized = schedule
    .map((slot) => ({
      day: slot.day.trim(),
      from: slot.from.trim(),
      to: slot.to.trim(),
    }))
    .filter((slot) => slot.day && slot.from && slot.to);

  return normalized.length > 0 ? normalized : null;
}

export function resolveMediaUrl(url?: string | null) {
  if (!url) {
    return null;
  }

  try {
    const apiOrigin = new URL(api.defaults.baseURL ?? window.location.origin).origin;
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

/* ---------- presentation-only helpers (client-side display) ---------- */

/** Price after the item's discount, used only for display/preview. */
export function computeFinalPrice(price: string | number, discountType: Item["discount_type"], discountValue: string | number) {
  const base = Number(price || 0);
  const value = Number(discountValue || 0);
  if (!Number.isFinite(base)) return 0;
  if (!Number.isFinite(value) || value <= 0 || discountType === "none") return base;
  const result = discountType === "percent" ? base * (1 - value / 100) : base - value;
  return Math.max(0, Math.round(result * 100) / 100);
}

export function hasDiscount(item: Pick<Item, "discount_type" | "discount_value">) {
  return item.discount_type !== "none" && Number(item.discount_value || 0) > 0;
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
  return item.discount_type === "percent"
    ? `${Number(item.discount_value)}% off`
    : `${Number(item.discount_value).toFixed(2)} off`;
}
