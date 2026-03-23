import AsyncStorage from "@react-native-async-storage/async-storage";

export const STORAGE_KEYS = {
  token: "smart-dispatch-token",
  language: "smart-dispatch-language",
  theme: "smart-dispatch-theme",
  activeMarketId: "smart-dispatch-active-market-id",
} as const;

export type CartItem = {
  item_id: number;
  name: string;
  price: number;
  qty: number;
};

export function getCartKey(marketId: string) {
  return `smart-dispatch-cart-market-${marketId}`;
}

export async function getStoredToken() {
  try {
    return await AsyncStorage.getItem(STORAGE_KEYS.token);
  } catch {
    return null;
  }
}

export async function setStoredToken(token: string) {
  await AsyncStorage.setItem(STORAGE_KEYS.token, token);
}

export async function clearStoredToken() {
  await AsyncStorage.removeItem(STORAGE_KEYS.token);
}

export async function getStoredLanguage() {
  try {
    return await AsyncStorage.getItem(STORAGE_KEYS.language);
  } catch {
    return null;
  }
}

export async function setStoredLanguage(language: string) {
  await AsyncStorage.setItem(STORAGE_KEYS.language, language);
}

export async function getStoredTheme() {
  try {
    return await AsyncStorage.getItem(STORAGE_KEYS.theme);
  } catch {
    return null;
  }
}

export async function setStoredTheme(theme: string) {
  await AsyncStorage.setItem(STORAGE_KEYS.theme, theme);
}

export async function getActiveMarketId() {
  try {
    return (await AsyncStorage.getItem(STORAGE_KEYS.activeMarketId)) ?? "";
  } catch {
    return "";
  }
}

export async function setActiveMarketId(marketId: string) {
  await AsyncStorage.setItem(STORAGE_KEYS.activeMarketId, marketId);
}

export async function loadCart(marketId: string): Promise<CartItem[]> {
  try {
    const raw = await AsyncStorage.getItem(getCartKey(marketId));
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((item) => {
        if (!item || typeof item !== "object") {
          return null;
        }

        const candidate = item as Partial<CartItem>;
        const itemId = Number(candidate.item_id);
        const price = Number(candidate.price);
        const qty = Number(candidate.qty);

        if (!Number.isFinite(itemId) || !Number.isFinite(price) || !Number.isFinite(qty) || qty <= 0) {
          return null;
        }

        return {
          item_id: itemId,
          name: typeof candidate.name === "string" && candidate.name.trim() ? candidate.name : `Item #${itemId}`,
          price,
          qty,
        } satisfies CartItem;
      })
      .filter((item): item is CartItem => item !== null);
  } catch {
    return [];
  }
}

export async function saveCart(marketId: string, cart: CartItem[]) {
  await AsyncStorage.setItem(getCartKey(marketId), JSON.stringify(cart));
  await setActiveMarketId(marketId);
}

export async function clearCart(marketId: string) {
  await saveCart(marketId, []);
}
