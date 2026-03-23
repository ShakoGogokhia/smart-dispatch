export type CartItem = {
  item_id: number;
  name: string;
  price: number;
  qty: number;
};

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

export function loadCart(marketId: string): CartItem[] {
  try {
    const raw = localStorage.getItem(getCartKey(marketId));
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((item) => {
        if (!item || typeof item !== "object") {
          return null;
        }

        const entry = item as Partial<CartItem>;
        const itemId = Number(entry.item_id);
        const qty = Number(entry.qty);
        const price = Number(entry.price);

        if (!Number.isFinite(itemId) || !Number.isFinite(qty) || qty <= 0 || !Number.isFinite(price)) {
          return null;
        }

        return {
          item_id: itemId,
          name: typeof entry.name === "string" && entry.name.trim() ? entry.name : `Item #${itemId}`,
          price,
          qty,
        } satisfies CartItem;
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
