import { api } from "@/lib/api";
import type { StorefrontMarket } from "@/lib/storefront";

/** Item shape returned by `/api/public/discovery-items`. */
export type DiscoveryItem = {
  id: number;
  market_id: number;
  market?: {
    id: number;
    name: string;
    code: string;
    is_active?: boolean;
    operating_status?: StorefrontMarket["operating_status"];
  } | null;
  name: string;
  sku: string;
  category?: string | null;
  image_url?: string | null;
  image_urls?: string[] | null;
  combo_offers?: Array<{ name: string; description?: string | null; combo_price: number | string }> | null;
  price: number | string;
  discount_type?: "none" | "percent" | "fixed";
  discount_value?: number | string;
  stock_qty: number;
  ordered_qty?: number;
  is_promoted?: boolean;
  promotion_ends_at?: string | null;
  review_summary?: {
    count?: number;
    average?: number | null;
  };
};

export type DiscoveryFeed = {
  popular: DiscoveryItem[];
  combo: DiscoveryItem[];
  discounted: DiscoveryItem[];
};

/** Rewrites localhost media URLs to the API origin so images load from any host. */
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

export function getMarketBannerUrl(market: StorefrontMarket) {
  return (
    resolveMarketMediaUrl(market.banner_url) ??
    resolveMarketMediaUrl(market.image_url) ??
    resolveMarketMediaUrl(market.logo_url)
  );
}

export function getDiscoveryItemImageUrl(item: DiscoveryItem) {
  const urls = [...(item.image_urls ?? [])];

  if (item.image_url) {
    urls.push(item.image_url);
  }

  const firstUrl = urls.find((url) => typeof url === "string" && url.length > 0);
  return resolveMarketMediaUrl(firstUrl);
}

/** Maps a market's featured theme (or badge text) to token-based badge classes. */
export function getBadgeTheme(badge?: string | null, theme?: StorefrontMarket["featured_theme"] | null) {
  const tone = theme?.tone;
  const shape = theme?.shape === "soft" ? "rounded-md" : "rounded-full";

  if (tone === "amber") return `${shape} border-transparent bg-warning text-warning-foreground`;
  if (tone === "cyan") return `${shape} border-transparent bg-info text-info-foreground`;
  if (tone === "emerald") return `${shape} border-transparent bg-success text-success-foreground`;
  if (tone === "rose") return `${shape} border-transparent bg-destructive text-destructive-foreground`;
  if (tone === "slate") return `${shape} border-transparent bg-foreground text-background`;

  const value = (badge ?? "").trim().toLowerCase();

  if (value.includes("vip")) return `${shape} border-transparent bg-warning text-warning-foreground`;
  if (value.includes("new")) return `${shape} border-transparent bg-info text-info-foreground`;
  if (value.includes("staff")) return `${shape} border-transparent bg-primary text-primary-foreground`;

  return `${shape} border-transparent bg-secondary text-secondary-foreground`;
}

export function isMarketOpen(market: StorefrontMarket) {
  return market.operating_status?.is_open ?? market.is_active;
}
