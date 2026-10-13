import { type MultiBuy, multiBuyLabel, normalizeMultiBuy, paidQuantity } from "@/lib/market-types";

export type ItemIngredient = {
  name: string;
  removable: boolean;
};

export type ComboOffer = {
  name: string;
  description?: string | null;
  combo_price: number;
  item_ids?: number[];
  items?: ComboOfferItem[];
};

export type ComboOfferItem = {
  id: number;
  name: string;
  sku: string | null;
  ingredients: ItemIngredient[];
};

export type CartItem = {
  cart_id: string;
  item_id: number;
  name: string;
  price: number;
  qty: number;
  image_url?: string | null;
  ingredients?: ItemIngredient[];
  removed_ingredients?: string[];
  combo_offer?: ComboOffer | null;
  multi_buy?: MultiBuy | null;
};

/** Line total after any "buy X get Y free" deal; combos never stack with deals. */
export function cartLineTotal(line: Pick<CartItem, "price" | "qty" | "combo_offer" | "multi_buy">) {
  return line.price * (line.combo_offer ? line.qty : paidQuantity(line.qty, line.multi_buy));
}

export function cartSubtotal(lines: CartItem[]) {
  return lines.reduce((sum, line) => sum + cartLineTotal(line), 0);
}

/** e.g. "Buy 1, get 1 free · 2 free", or null when no deal applies to the line. */
export function cartDealNote(line: Pick<CartItem, "price" | "qty" | "combo_offer" | "multi_buy">) {
  if (line.combo_offer || !line.multi_buy) return null;
  const free = line.qty - paidQuantity(line.qty, line.multi_buy);
  const label = multiBuyLabel(line.multi_buy);
  return free > 0 ? `${label} · ${free} free` : label;
}

const ACTIVE_MARKET_KEY = "activeMarketId";

export function getCartKey(marketId: string) {
  return `cart_market_${marketId}`;
}

export function getActiveMarketId() {
  return localStorage.getItem(ACTIVE_MARKET_KEY) ?? "";
}

export function setActiveMarketId(marketId: string) {
  localStorage.setItem(ACTIVE_MARKET_KEY, marketId);
}

function normalizeIngredients(value: unknown): ItemIngredient[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((ingredient) => {
      if (!ingredient || typeof ingredient !== "object") {
        return null;
      }

      const entry = ingredient as Partial<ItemIngredient>;
      const name = typeof entry.name === "string" ? entry.name.trim() : "";

      if (!name) {
        return null;
      }

      return {
        name,
        removable: Boolean(entry.removable),
      } satisfies ItemIngredient;
    })
    .filter((ingredient): ingredient is ItemIngredient => ingredient !== null);
}

function normalizeRemovedIngredients(value: unknown, ingredients: ItemIngredient[]): string[] {
  if (!Array.isArray(value) || ingredients.length === 0) {
    return [];
  }

  const removable = new Set(
    ingredients
      .filter((ingredient) => ingredient.removable)
      .map((ingredient) => ingredient.name.toLowerCase()),
  );

  return value
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter((entry, index, source) => entry && source.findIndex((item) => item.toLowerCase() === entry.toLowerCase()) === index)
    .filter((entry) => removable.has(entry.toLowerCase()));
}

function normalizeComboOffer(value: unknown): ComboOffer | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const entry = value as Partial<ComboOffer>;
  const name = typeof entry.name === "string" ? entry.name.trim() : "";
  const comboPrice = Number(entry.combo_price);
  const itemIds = Array.isArray(entry.item_ids)
    ? entry.item_ids
        .map((itemId) => Number(itemId))
        .filter((itemId, index, source) => Number.isInteger(itemId) && itemId > 0 && source.indexOf(itemId) === index)
    : [];
  const items: ComboOfferItem[] = Array.isArray(entry.items)
    ? entry.items
        .map((item) => {
          if (!item || typeof item !== "object") {
            return null;
          }

          const comboItem = item as { id?: number; name?: string; sku?: string | null; ingredients?: unknown };
          const itemId = Number(comboItem.id);
          const itemName = typeof comboItem.name === "string" ? comboItem.name.trim() : "";

          if (!Number.isInteger(itemId) || itemId <= 0 || !itemName) {
            return null;
          }

          return {
            id: itemId,
            name: itemName,
            sku: typeof comboItem.sku === "string" && comboItem.sku.trim() ? comboItem.sku.trim() : null,
            ingredients: normalizeIngredients(comboItem.ingredients),
          } satisfies ComboOfferItem;
        })
        .filter((item): item is ComboOfferItem => item !== null)
    : [];

  if (!name || !Number.isFinite(comboPrice)) {
    return null;
  }

  return {
    name,
    description: typeof entry.description === "string" && entry.description.trim() ? entry.description.trim() : null,
    combo_price: comboPrice,
    item_ids: itemIds,
    items,
  };
}

export function buildCartItemId(itemId: number, removedIngredients: string[] = [], comboOfferName?: string | null) {
  const suffix = [...removedIngredients]
    .map((ingredient) => ingredient.trim())
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right))
    .join("|");

  const comboPart = comboOfferName?.trim() ? `combo=${comboOfferName.trim()}` : "";
  const parts = [suffix, comboPart].filter(Boolean);

  return parts.length > 0 ? `${itemId}:${parts.join("::")}` : `${itemId}`;
}

export function loadCart(marketId: string): CartItem[] {
  try {
    const raw = localStorage.getItem(getCartKey(marketId));
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((item): CartItem | null => {
        if (!item || typeof item !== "object") {
          return null;
        }

        const entry = item as Partial<CartItem>;
        const itemId = Number(entry.item_id);
        const qty = Number(entry.qty);
        const price = Number(entry.price);
        const ingredients = normalizeIngredients(entry.ingredients);
        const removedIngredients = normalizeRemovedIngredients(entry.removed_ingredients, ingredients);
        const comboOffer = normalizeComboOffer(entry.combo_offer);

        if (!Number.isFinite(itemId) || !Number.isFinite(qty) || qty <= 0 || !Number.isFinite(price)) {
          return null;
        }

        return {
          cart_id:
            typeof entry.cart_id === "string" && entry.cart_id.trim()
              ? entry.cart_id
              : buildCartItemId(itemId, removedIngredients, comboOffer?.name),
          item_id: itemId,
          name: typeof entry.name === "string" && entry.name.trim() ? entry.name : `Item #${itemId}`,
          price,
          qty,
          image_url: typeof entry.image_url === "string" && entry.image_url.trim() ? entry.image_url : null,
          ingredients,
          removed_ingredients: removedIngredients,
          combo_offer: comboOffer,
          multi_buy: comboOffer ? null : normalizeMultiBuy(entry.multi_buy),
        };
      })
      .filter((item): item is CartItem => item !== null);
  } catch {
    return [];
  }
}

export function saveCart(marketId: string, cart: CartItem[]) {
  localStorage.setItem(getCartKey(marketId), JSON.stringify(cart));
  setActiveMarketId(marketId);
}

export function clearCart(marketId: string) {
  saveCart(marketId, []);
}
