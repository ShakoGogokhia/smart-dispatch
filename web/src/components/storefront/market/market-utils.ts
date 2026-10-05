import type { AxiosError } from "axios";

import { api } from "@/lib/api";
import type { ComboOffer, ItemIngredient } from "@/lib/cart";
import type { StorefrontMarket } from "@/lib/storefront";

export type MarketItem = {
  id: number;
  name: string;
  sku: string;
  item_kind?: "regular" | "combo";
  category?: string | null;
  image_url?: string | null;
  image_urls?: string[] | null;
  is_promoted?: boolean;
  promotion_ends_at?: string | null;
  variants?: Array<{ name: string; value: string; price_delta?: number | string }> | null;
  ingredients?: ItemIngredient[] | null;
  combo_offers?: ComboOffer[] | null;
  price: number | string;
  discount_type?: "none" | "percent" | "fixed";
  discount_value?: number | string;
  is_active: boolean;
  stock_qty: number;
  show_stock_quantity?: boolean;
  is_low_stock?: boolean;
  review_summary?: {
    count?: number;
    average?: number | null;
  };
};

export type MarketReviewRecord = {
  id: number;
  rating: number;
  comment?: string | null;
  created_at?: string | null;
  user?: {
    id?: number;
    name?: string | null;
  } | null;
};

export function getErrorMessage(error: unknown, fallback: string) {
  if (!error || typeof error !== "object") {
    return fallback;
  }

  const axiosError = error as AxiosError<{ message?: string }>;
  return axiosError.response?.data?.message ?? fallback;
}

export function getRemovableIngredients(item?: MarketItem | null) {
  if (item?.item_kind === "combo") {
    return [];
  }

  return (item?.ingredients ?? []).filter((ingredient) => ingredient.removable);
}

export function getComboIncludedItems(item?: MarketItem | null) {
  if (item?.item_kind !== "combo") {
    return [];
  }

  return item.combo_offers?.[0]?.items ?? [];
}

export function getComboRemovableCount(item?: MarketItem | null) {
  return getComboIncludedItems(item).reduce(
    (sum, comboItem) => sum + (comboItem.ingredients ?? []).filter((ingredient) => ingredient.removable).length,
    0,
  );
}

/** Items with ingredients or combos must be configured in the details dialog before adding. */
export function itemNeedsCustomization(item: MarketItem) {
  return (item.ingredients?.length ?? 0) > 0 || (item.combo_offers?.length ?? 0) > 0 || item.item_kind === "combo";
}

export function resolveMarketMediaUrl(url?: string | null) {
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

export function getItemImageUrls(item?: MarketItem | null) {
  const urls = [...(item?.image_urls ?? [])];

  if (item?.image_url) {
    urls.push(item.image_url);
  }

  return Array.from(
    new Set(
      urls
        .map((url) => resolveMarketMediaUrl(url))
        .filter((url): url is string => typeof url === "string" && url.length > 0),
    ),
  );
}

export function getMarketBannerUrl(market?: StorefrontMarket | null) {
  if (!market) {
    return null;
  }

  return (
    resolveMarketMediaUrl(market.banner_url) ??
    resolveMarketMediaUrl(market.image_url) ??
    resolveMarketMediaUrl(market.logo_url)
  );
}

export function formatReviewDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString([], { year: "numeric", month: "short", day: "numeric" });
}

export function initials(name?: string | null) {
  const parts = String(name ?? "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return parts
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}
