import { formatMoney, toNumber } from "@/lib/format";

export type MarketPromo = {
  id: number;
  code: string;
  type: "percent" | "fixed";
  value: number | string;
  is_active: boolean;
};

export type StorefrontItemPreview = {
  id: number;
  name: string;
  sku: string;
  price: number | string;
  discount_type?: "none" | "percent" | "fixed";
  discount_value?: number | string;
  stock_qty: number;
};

export type StorefrontMarket = {
  id: number;
  name: string;
  code: string;
  address?: string | null;
  category?: string | null;
  lat?: number | string | null;
  lng?: number | string | null;
  is_active: boolean;
  is_open_now?: boolean | null;
  opens_at?: string | null;
  closes_at?: string | null;
  is_featured?: boolean;
  is_currently_featured?: boolean;
  featured_badge?: string | null;
  featured_headline?: string | null;
  featured_copy?: string | null;
  badge_expires_at?: string | null;
  badge_is_active?: boolean;
  featured_starts_at?: string | null;
  featured_ends_at?: string | null;
  featured_sort_order?: number;
  logo_url?: string | null;
  cover_url?: string | null;
  minimum_order?: number;
  delivery_eta_minutes?: number | null;
  active_items_count?: number;
  average_rating?: number | null;
  rating_count?: number;
  public_clicks_count?: number;
  item_preview?: StorefrontItemPreview[];
  active_promo?: MarketPromo | null;
};

export type MarketBanner = {
  id: number;
  title: string;
  subtitle?: string | null;
  cta_label?: string | null;
  cta_url?: string | null;
  theme: string;
  is_active: boolean;
  is_live?: boolean;
  sort_order: number;
  starts_at?: string | null;
  ends_at?: string | null;
  market?: {
    id: number;
    name: string;
    code: string;
  } | null;
};

export function calcStorefrontPrice(item: Pick<StorefrontItemPreview, "price" | "discount_type" | "discount_value">) {
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

export function formatPromoLabel(promo?: MarketPromo | null) {
  if (!promo) return "No live offer";

  return promo.type === "percent"
    ? `${toNumber(promo.value)}% off with ${promo.code}`
    : `${formatMoney(promo.value)} off with ${promo.code}`;
}

export function getMarketHeadline(market: Pick<StorefrontMarket, "featured_headline" | "featured_copy" | "name">) {
  return market.featured_headline || `Discover ${market.name}`;
}

export function getMarketCopy(market: Pick<StorefrontMarket, "featured_copy" | "address" | "name">) {
  return (
    market.featured_copy ||
    (market.address
      ? `${market.name} is ready to serve this area with a faster storefront and cleaner checkout flow.`
      : `${market.name} is ready for orders with a curated catalog and quick delivery handoff.`)
  );
}

export function formatEtaWindow(minutes?: number | null) {
  if (!minutes || minutes <= 0) {
    return "ETA on request";
  }

  const lowerBound = Math.max(10, minutes - 10);
  const upperBound = minutes + 10;

  return `${lowerBound}-${upperBound} min`;
}

export function formatMarketHours(open?: string | null, close?: string | null) {
  if (!open || !close) {
    return "Hours not set";
  }

  return `${open.slice(0, 5)}-${close.slice(0, 5)}`;
}
