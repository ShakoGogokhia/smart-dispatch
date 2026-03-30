import type { StorefrontMarket } from "@/lib/storefront";

const FAVORITES_KEY = "smart-dispatch-public-favorites";
const RECENT_KEY = "smart-dispatch-public-recent";
const DRAFT_PREFIX = "smart-dispatch-market-draft";
const VISITOR_KEY = "smart-dispatch-public-visitor";

type StoredMarket = Pick<
  StorefrontMarket,
  "id" | "name" | "code" | "category" | "cover_url" | "featured_badge" | "delivery_eta_minutes" | "minimum_order"
>;

function readJson<T>(key: string, fallback: T): T {
  if (typeof localStorage === "undefined") {
    return fallback;
  }

  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  if (typeof localStorage === "undefined") {
    return;
  }

  localStorage.setItem(key, JSON.stringify(value));
}

export function getVisitorKey() {
  if (typeof localStorage === "undefined") {
    return "guest";
  }

  const existing = localStorage.getItem(VISITOR_KEY);
  if (existing) {
    return existing;
  }

  const nextValue = `visitor-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
  localStorage.setItem(VISITOR_KEY, nextValue);
  return nextValue;
}

export function loadFavoriteIds() {
  return readJson<number[]>(FAVORITES_KEY, []);
}

export function toggleFavoriteMarket(marketId: number) {
  const current = new Set(loadFavoriteIds());

  if (current.has(marketId)) {
    current.delete(marketId);
  } else {
    current.add(marketId);
  }

  const next = Array.from(current);
  writeJson(FAVORITES_KEY, next);
  return next;
}

export function loadRecentlyViewedMarkets() {
  return readJson<StoredMarket[]>(RECENT_KEY, []);
}

export function rememberViewedMarket(market: StorefrontMarket) {
  const record: StoredMarket = {
    id: market.id,
    name: market.name,
    code: market.code,
    category: market.category,
    cover_url: market.cover_url,
    featured_badge: market.featured_badge,
    delivery_eta_minutes: market.delivery_eta_minutes,
    minimum_order: market.minimum_order,
  };

  const next = [record, ...loadRecentlyViewedMarkets().filter((entry) => entry.id !== market.id)].slice(0, 8);
  writeJson(RECENT_KEY, next);
  return next;
}

export function loadMarketDraft<T>(draftId: string, fallback: T): T {
  return readJson<T>(`${DRAFT_PREFIX}:${draftId}`, fallback);
}

export function saveMarketDraft<T>(draftId: string, value: T) {
  writeJson(`${DRAFT_PREFIX}:${draftId}`, value);
}

export function clearMarketDraft(draftId: string) {
  if (typeof localStorage === "undefined") {
    return;
  }

  localStorage.removeItem(`${DRAFT_PREFIX}:${draftId}`);
}

export function syncMeta(title: string, description: string) {
  if (typeof document === "undefined") {
    return;
  }

  document.title = title;

  const existing = document.querySelector('meta[name="description"]');
  if (existing) {
    existing.setAttribute("content", description);
    return;
  }

  const meta = document.createElement("meta");
  meta.name = "description";
  meta.content = description;
  document.head.appendChild(meta);
}
