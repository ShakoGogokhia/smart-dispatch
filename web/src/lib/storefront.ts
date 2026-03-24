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
  is_active: boolean;
  is_featured?: boolean;
  featured_badge?: string | null;
  featured_headline?: string | null;
  featured_copy?: string | null;
  logo_url?: string | null;
  active_items_count?: number;
  item_preview?: StorefrontItemPreview[];
  active_promo?: MarketPromo | null;
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
