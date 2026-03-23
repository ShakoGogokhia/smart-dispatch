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
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
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
