import { formatMoney, toNumber } from "@/lib/format";

export type MarketPromo = {
  id: number;
  code: string;
  type: "percent" | "fixed";
  value: number | string;
  is_active: boolean;
};

export type ReviewSummary = {
  count?: number;
  average?: number | null;
};

export type StorefrontItemPreview = {
  id: number;
  name: string;
  sku: string;
  category?: string | null;
  image_url?: string | null;
  variants?: Array<{ name: string; value: string; price_delta?: number | string }> | null;
  availability_schedule?: Array<{ day: string; from: string; to: string }> | null;
  ingredients?: Array<{ name: string; removable: boolean }> | null;
  combo_offers?: Array<{ name: string; description?: string | null; combo_price: number | string }> | null;
  price: number | string;
  discount_type?: "none" | "percent" | "fixed";
  discount_value?: number | string;
  stock_qty: number;
  low_stock_threshold?: number;
  is_low_stock?: boolean;
  review_summary?: {
    count?: number;
    average?: number | null;
  };
};

export type StorefrontMarket = {
  id: number;
  name: string;
  code: string;
  address?: string | null;
  image_url?: string | null;
  lat?: number | string | null;
  lng?: number | string | null;
  is_active: boolean;
  is_featured?: boolean;
  featured_badge?: string | null;
  featured_headline?: string | null;
  featured_copy?: string | null;
  logo_url?: string | null;
  delivery_slots?: Array<{ label?: string; from?: string; to?: string } | string>;
  active_items_count?: number;
  item_preview?: StorefrontItemPreview[];
  active_promo?: MarketPromo | null;
  review_summary?: ReviewSummary;
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
