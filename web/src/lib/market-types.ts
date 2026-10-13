import {
  Car,
  Coffee,
  Flower2,
  type LucideIcon,
  PawPrint,
  Pill,
  Refrigerator,
  ShoppingBasket,
  Smartphone,
  Store,
  UtensilsCrossed,
} from "lucide-react";

// Mirrors backend/config/market_types.php — keep the keys and features in sync.

export type MarketFeature = "multi_buy" | "specs";

export type MarketTypeKey =
  | "grocery"
  | "restaurant"
  | "cafe_bakery"
  | "electronics"
  | "auto_parts"
  | "home_appliances"
  | "pharmacy_beauty"
  | "flowers_gifts"
  | "pet_supplies"
  | "general";

export type MarketTypeConfig = {
  label: string;
  description: string;
  icon: LucideIcon;
  features: MarketFeature[];
  /** Spec labels suggested to owners when they describe a product. */
  specLabels: string[];
};

export const MARKET_TYPES: Record<MarketTypeKey, MarketTypeConfig> = {
  grocery: {
    label: "Grocery",
    description: "Fresh produce, dairy, pantry and household basics.",
    icon: ShoppingBasket,
    features: ["multi_buy"],
    specLabels: [],
  },
  restaurant: {
    label: "Restaurant",
    description: "Cooked meals with ingredients, combos and meal deals.",
    icon: UtensilsCrossed,
    features: ["multi_buy"],
    specLabels: [],
  },
  cafe_bakery: {
    label: "Cafe & Bakery",
    description: "Coffee, pastries, cakes and fresh bread.",
    icon: Coffee,
    features: ["multi_buy"],
    specLabels: [],
  },
  electronics: {
    label: "Electronics",
    description: "Phones, laptops, audio and accessories.",
    icon: Smartphone,
    features: ["specs"],
    specLabels: ["Brand", "Model", "Storage", "Screen", "Battery", "Color", "Warranty"],
  },
  auto_parts: {
    label: "Auto Parts",
    description: "Car parts, oils, tires and accessories.",
    icon: Car,
    features: ["specs"],
    specLabels: ["Brand", "Fits", "Part number", "Size", "Warranty"],
  },
  home_appliances: {
    label: "Home Appliances",
    description: "Kitchen and household appliances.",
    icon: Refrigerator,
    features: ["specs"],
    specLabels: ["Brand", "Power", "Capacity", "Energy class", "Warranty"],
  },
  pharmacy_beauty: {
    label: "Pharmacy & Beauty",
    description: "Vitamins, personal care and cosmetics.",
    icon: Pill,
    features: ["multi_buy", "specs"],
    specLabels: ["Brand", "Volume", "Skin type", "Count"],
  },
  flowers_gifts: {
    label: "Flowers & Gifts",
    description: "Bouquets, plants and gift boxes.",
    icon: Flower2,
    features: ["multi_buy"],
    specLabels: [],
  },
  pet_supplies: {
    label: "Pet Supplies",
    description: "Food, toys and care for pets.",
    icon: PawPrint,
    features: ["multi_buy", "specs"],
    specLabels: ["Brand", "Weight", "Life stage", "Pet"],
  },
  general: {
    label: "General Store",
    description: "A bit of everything.",
    icon: Store,
    features: ["multi_buy", "specs"],
    specLabels: ["Brand", "Size", "Color", "Warranty"],
  },
};

export const MARKET_TYPE_KEYS = Object.keys(MARKET_TYPES) as MarketTypeKey[];

export function getMarketType(key?: string | null): MarketTypeConfig & { key: MarketTypeKey } {
  const safeKey = key && key in MARKET_TYPES ? (key as MarketTypeKey) : "general";
  return { key: safeKey, ...MARKET_TYPES[safeKey] };
}

export function marketSupports(key: string | null | undefined, feature: MarketFeature) {
  return getMarketType(key).features.includes(feature);
}

const FEATURE_NAMES: Record<MarketFeature, string> = {
  multi_buy: "buy X get Y deals (1+1, 2+1)",
  specs: "product specifications",
};

/** e.g. "Unlocks buy X get Y deals (1+1, 2+1) and product specifications." */
export function describeFeatures(features: MarketFeature[]) {
  if (features.length === 0) return "";
  return `Unlocks ${features.map((feature) => FEATURE_NAMES[feature]).join(" and ")}.`;
}

export type MultiBuy = { buy: number; get: number };

export const MULTI_BUY_OPTIONS: MultiBuy[] = [
  { buy: 1, get: 1 },
  { buy: 2, get: 1 },
  { buy: 3, get: 1 },
  { buy: 2, get: 2 },
];

export function normalizeMultiBuy(value: unknown): MultiBuy | null {
  if (!value || typeof value !== "object") return null;
  const entry = value as Partial<Record<keyof MultiBuy, unknown>>;
  const buy = Number(entry.buy);
  const get = Number(entry.get);
  return Number.isInteger(buy) && Number.isInteger(get) && buy > 0 && get > 0 ? { buy, get } : null;
}

/** Parses a deal key such as "2+1" back into a deal; "none" or junk gives null. */
export function parseMultiBuyKey(key: string): MultiBuy | null {
  const [buy, get] = key.split("+").map(Number);
  return normalizeMultiBuy({ buy, get });
}

/** Drops spec rows the owner left half empty. */
export function cleanSpecs(specs: ItemSpec[] | null | undefined): ItemSpec[] | null {
  const cleaned = (specs ?? [])
    .map((spec) => ({ label: spec.label.trim(), value: spec.value.trim() }))
    .filter((spec) => spec.label && spec.value);
  return cleaned.length > 0 ? cleaned : null;
}

/** Short badge text, e.g. "1+1" or "2+1". */
export function multiBuyBadge(deal: MultiBuy) {
  return `${deal.buy}+${deal.get}`;
}

export function multiBuyLabel(deal: MultiBuy) {
  return `Buy ${deal.buy}, get ${deal.get} free`;
}

/** Units paid for under a deal; mirrors Item::paidQuantity() on the backend. */
export function paidQuantity(qty: number, deal?: MultiBuy | null) {
  if (!deal) return qty;
  return qty - Math.floor(qty / (deal.buy + deal.get)) * deal.get;
}

export type ItemSpec = { label: string; value: string };
