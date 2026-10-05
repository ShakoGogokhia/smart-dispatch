import { api } from "@/src/lib/api";
import { formatMoney, toNumber, type AppLanguage } from "@/src/lib/format";
import type { Item, MarketLite, PromoCode } from "@/src/types/api";

/** Operating status the public market endpoints return (not in the shared MarketLite type yet). */
export type OperatingStatus = {
  is_open: boolean;
  mode?: "inactive" | "manual" | "schedule" | "always_open";
  label?: string;
  reason?: string | null;
  next_open_at?: string | null;
  next_close_at?: string | null;
  today_hours?: { day: string; enabled?: boolean; open?: string; close?: string } | null;
};

export type StorefrontMarket = MarketLite & {
  operating_status?: OperatingStatus;
  uses_operating_schedule?: boolean;
  operating_hours?: { day: string; enabled?: boolean; open?: string; close?: string }[];
};

export type StorefrontItem = Item & {
  is_promoted?: boolean;
  show_stock_quantity?: boolean;
};

export type DiscoveryItem = Item & {
  market_id: number;
  market?: {
    id: number;
    name: string;
    code: string;
    is_active?: boolean;
    operating_status?: OperatingStatus;
  } | null;
  ordered_qty?: number;
  is_promoted?: boolean;
  promotion_ends_at?: string | null;
};

export type DiscoveryFeed = {
  popular: DiscoveryItem[];
  combo: DiscoveryItem[];
  discounted: DiscoveryItem[];
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

type PriceLike = Pick<Item, "price" | "discount_type" | "discount_value">;

export function calcItemFinalPrice(item: PriceLike) {
  const base = toNumber(item.price);
  const discountType = item.discount_type ?? "none";
  const discountValue = toNumber(item.discount_value);

  if (discountType === "percent") {
    return Math.max(0, base - base * (discountValue / 100));
  }

  if (discountType === "fixed") {
    return Math.max(0, base - discountValue);
  }

  return base;
}

export function isDiscounted(item: PriceLike) {
  return Math.abs(toNumber(item.price) - calcItemFinalPrice(item)) > 0.0001;
}

export function getRemovableIngredients(item?: Item | null) {
  if (item?.item_kind === "combo") {
    return [];
  }

  return (item?.ingredients ?? []).filter((ingredient) => ingredient.removable);
}

export function getComboIncludedItems(item?: Item | null) {
  if (item?.item_kind !== "combo") {
    return [];
  }

  return item.combo_offers?.[0]?.items ?? [];
}

export function getComboRemovableCount(item?: Item | null) {
  return getComboIncludedItems(item).reduce(
    (sum, comboItem) => sum + (comboItem.ingredients ?? []).filter((ingredient) => ingredient.removable).length,
    0,
  );
}

export function itemNeedsDetails(item: Item) {
  return item.item_kind === "combo" || getRemovableIngredients(item).length > 0 || (item.combo_offers?.length ?? 0) > 0;
}

/** Rewrites localhost media URLs to the API origin so images load on a device. */
export function resolveMarketMediaUrl(url?: string | null) {
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

export function getItemImageUrls(item?: Pick<Item, "image_url" | "image_urls"> | null) {
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

export function getMarketBannerUrl(market?: MarketLite | null) {
  if (!market) {
    return null;
  }

  return (
    resolveMarketMediaUrl(market.banner_url) ??
    resolveMarketMediaUrl(market.image_url) ??
    resolveMarketMediaUrl(market.logo_url)
  );
}

export function isMarketOpen(market?: StorefrontMarket | null) {
  return market?.operating_status?.is_open ?? market?.is_active ?? false;
}

export function marketHasDeals(market: StorefrontMarket) {
  if (market.active_promo) return true;
  return (market.item_preview ?? []).some(
    (item) => item.discount_type && item.discount_type !== "none" && toNumber(item.discount_value) > 0,
  );
}

export function marketStatusLabel(market?: StorefrontMarket | null) {
  return market?.operating_status?.label ?? (isMarketOpen(market) ? "Open now" : "Closed now");
}

export function formatMarketHours(market?: StorefrontMarket | null) {
  const status = market?.operating_status;

  if (!status) {
    return null;
  }

  if (status.reason) {
    return status.reason;
  }

  if (status.next_open_at) {
    return `Opens ${new Date(status.next_open_at).toLocaleString([], { weekday: "short", hour: "numeric", minute: "2-digit" })}`;
  }

  if (status.next_close_at) {
    return `Closes ${new Date(status.next_close_at).toLocaleString([], { hour: "numeric", minute: "2-digit" })}`;
  }

  if (status.today_hours?.open && status.today_hours?.close) {
    return `Today ${status.today_hours.open} - ${status.today_hours.close}`;
  }

  return null;
}

const DAYS: [string, string][] = [
  ["monday", "Mon"],
  ["tuesday", "Tue"],
  ["wednesday", "Wed"],
  ["thursday", "Thu"],
  ["friday", "Fri"],
  ["saturday", "Sat"],
  ["sunday", "Sun"],
];

export function formatOperatingHoursList(market?: StorefrontMarket | null): { day: string; hours: string }[] {
  if (!market?.uses_operating_schedule) {
    return [{ day: "Every day", hours: "Open all day" }];
  }

  return DAYS.map(([day, label]) => {
    const entry = market.operating_hours?.find((item) => item.day === day);
    return { day: label, hours: entry?.enabled && entry.open && entry.close ? `${entry.open} - ${entry.close}` : "Closed" };
  });
}

export function formatPromoLabel(promo?: MarketLite["active_promo"] | PromoCode | null, language: AppLanguage = "en") {
  if (!promo?.code) {
    return null;
  }

  if (promo.type === "percent") {
    return `${promo.code} · ${toNumber(promo.value)}% off`;
  }

  return `${promo.code} · ${formatMoney(promo.value ?? 0, language)} off`;
}

export function formatDeliverySlot(slot: { label?: string; from?: string; to?: string } | string) {
  if (typeof slot === "string") return slot;
  if (slot.label) return slot.label;
  if (slot.from && slot.to) return `${slot.from} - ${slot.to}`;
  return slot.from ?? slot.to ?? "";
}

export function formatReviewDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}

export function plural(count: number, word: string) {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}
