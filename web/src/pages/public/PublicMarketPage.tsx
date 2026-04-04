import { useDeferredValue, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Heart,
  Minus,
  Plus,
  Search,
  ShoppingCart,
  Star,
  Store,
  X,
  MessageSquare,
  Sparkles,
} from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AxiosError } from "axios";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import ThemeToggle from "@/components/ThemeToggle";
import { api } from "@/lib/api";
import { auth } from "@/lib/auth";
import {
  buildCartItemId,
  clearCart,
  loadCart,
  saveCart,
  setActiveMarketId,
  type CartItem,
  type ComboOffer,
  type ItemIngredient,
} from "@/lib/cart";
import { formatMoney, toNumber } from "@/lib/format";
import {
  calcStorefrontPrice,
  type MarketPromo,
  type StorefrontMarket,
} from "@/lib/storefront";
import type { FavoritePayload, ReviewRecord } from "@/types/api";

type Item = {
  id: number;
  name: string;
  sku: string;
  category?: string | null;
  image_url?: string | null;
  image_urls?: string[] | null;
  variants?: Array<{ name: string; value: string; price_delta?: number | string }> | null;
  ingredients?: ItemIngredient[] | null;
  combo_offers?: ComboOffer[] | null;
  price: number | string;
  discount_type?: "none" | "percent" | "fixed";
  discount_value?: number | string;
  is_active: boolean;
  stock_qty: number;
  is_low_stock?: boolean;
  review_summary?: {
    count?: number;
    average?: number | null;
  };
};

type MarketReviewRecord = {
  id: number;
  rating: number;
  comment?: string | null;
  user?: {
    id?: number;
    name?: string | null;
  } | null;
};

function getErrorMessage(error: unknown, fallback: string) {
  if (!error || typeof error !== "object") {
    return fallback;
  }

  const axiosError = error as AxiosError<{ message?: string }>;
  return axiosError.response?.data?.message ?? fallback;
}

function getRemovableIngredients(item?: Item | null) {
  return (item?.ingredients ?? []).filter((ingredient) => ingredient.removable);
}

function getItemImageUrls(item?: Item | null) {
  const urls = [...(item?.image_urls ?? [])];

  if (item?.image_url) {
    urls.push(item.image_url);
  }

  return Array.from(
    new Set(
      urls
        .map((url) => {
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
        })
        .filter((url): url is string => typeof url === "string" && url.length > 0),
    ),
  );
}

function resolveMarketMediaUrl(url?: string | null) {
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

function getMarketBannerUrl(market?: StorefrontMarket | null) {
  if (!market) {
    return null;
  }

  return (
    resolveMarketMediaUrl(market.banner_url) ??
    resolveMarketMediaUrl(market.image_url) ??
    resolveMarketMediaUrl(market.logo_url)
  );
}

function StarPicker({
  value,
  onChange,
  size = "md",
}: {
  value: number;
  onChange: (value: number) => void;
  size?: "sm" | "md" | "lg";
}) {
  const sizeClass =
    size === "sm" ? "h-4 w-4" : size === "lg" ? "h-7 w-7" : "h-5 w-5";

  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => {
        const active = star <= value;
        return (
          <button
            key={star}
            type="button"
            onClick={() => onChange(star)}
            className="transition-transform hover:scale-110"
            aria-label={`Rate ${star} star${star > 1 ? "s" : ""}`}
          >
            <Star
              className={`${sizeClass} ${
                active
                  ? "fill-amber-400 text-amber-400"
                  : "text-zinc-300 dark:text-zinc-600"
              }`}
            />
          </button>
        );
      })}
    </div>
  );
}

function RatingDisplay({
  value,
  count,
  size = "sm",
}: {
  value?: number | null;
  count?: number;
  size?: "sm" | "md";
}) {
  const rounded = value ? Math.round(value) : 0;
  const starClass = size === "md" ? "h-4 w-4" : "h-3.5 w-3.5";

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`${starClass} ${
              star <= rounded
                ? "fill-amber-400 text-amber-400"
                : "text-zinc-300 dark:text-zinc-600"
            }`}
          />
        ))}
      </div>
      <span className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">
        {value ? value.toFixed(1) : "0.0"}
        {typeof count === "number" ? ` (${count})` : ""}
      </span>
    </div>
  );
}

function PublicMarketScreen({ marketId }: { marketId: string }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [selectedItemId, setSelectedItemId] = useState<number | null>(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [selectedRemovedIngredients, setSelectedRemovedIngredients] = useState<string[]>([]);
  const [selectedComboOfferName, setSelectedComboOfferName] = useState("");
  const [isMarketReviewsOpen, setIsMarketReviewsOpen] = useState(false);

  const [reviewComment, setReviewComment] = useState("");
  const [reviewRating, setReviewRating] = useState(5);

  const [marketReviewComment, setMarketReviewComment] = useState("");
  const [marketReviewRating, setMarketReviewRating] = useState(5);

  const deferredQuery = useDeferredValue(query);
  const [cart, setCart] = useState<CartItem[]>(() => loadCart(marketId));

  useEffect(() => {
    setActiveMarketId(marketId);
    setCart(loadCart(marketId));
  }, [marketId]);

  useEffect(() => {
    setSelectedRemovedIngredients([]);
    setSelectedComboOfferName("");
    setSelectedImageIndex(0);
  }, [selectedItemId]);

  const marketQ = useQuery({
    queryKey: ["public-market", marketId],
    queryFn: async () => (await api.get(`/api/public/markets/${marketId}`)).data as StorefrontMarket,
    enabled: !!marketId,
  });

  const itemsQ = useQuery({
    queryKey: ["public-market-items", marketId],
    queryFn: async () => (await api.get(`/api/public/markets/${marketId}/items`)).data as Item[],
    enabled: !!marketId,
  });

  const promoQ = useQuery({
    queryKey: ["public-market-promo", marketId],
    queryFn: async () => (await api.get(`/api/public/markets/${marketId}/active-promo`)).data as MarketPromo | null,
    enabled: !!marketId,
    retry: false,
  });

  const favoritesQ = useQuery({
    queryKey: ["favorites"],
    queryFn: async () => (await api.get("/api/favorites")).data as FavoritePayload,
    enabled: !!auth.getToken(),
  });

  const reviewsQ = useQuery({
    queryKey: ["item-reviews", selectedItemId],
    queryFn: async () => (await api.get(`/api/public/items/${selectedItemId}/reviews`)).data as ReviewRecord[],
    enabled: selectedItemId != null,
  });

  // Optional market reviews endpoints. If backend doesn't have them,
  // UI still works and just shows no reviews / post failure gracefully.
  const marketReviewsQ = useQuery({
    queryKey: ["market-reviews", marketId],
    queryFn: async () =>
      (await api.get(`/api/public/markets/${marketId}/reviews`)).data as MarketReviewRecord[],
    enabled: !!marketId && isMarketReviewsOpen,
    retry: false,
  });

  const favoriteM = useMutation({
    mutationFn: async (payload: { market_id?: number; item_id?: number }) =>
      (await api.post("/api/favorites/toggle", payload)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["favorites"] }),
  });

  const reviewM = useMutation({
    mutationFn: async () => {
      if (!selectedItemId) throw new Error("No item selected");
      return (
        await api.post(`/api/items/${selectedItemId}/reviews`, {
          rating: reviewRating,
          comment: reviewComment || null,
        })
      ).data;
    },
    onSuccess: async () => {
      setReviewComment("");
      setReviewRating(5);
      await queryClient.invalidateQueries({ queryKey: ["item-reviews", selectedItemId] });
      await queryClient.invalidateQueries({ queryKey: ["public-market-items", marketId] });
    },
  });

  const marketReviewM = useMutation({
    mutationFn: async () =>
      (
        await api.post(`/api/markets/${marketId}/reviews`, {
          rating: marketReviewRating,
          comment: marketReviewComment || null,
        })
      ).data,
    onSuccess: async () => {
      setMarketReviewComment("");
      setMarketReviewRating(5);
      await queryClient.invalidateQueries({ queryKey: ["market-reviews", marketId] });
      await queryClient.invalidateQueries({ queryKey: ["public-market", marketId] });
    },
  });

  const market = marketQ.data;
  const promo = promoQ.data;

  const categories = useMemo(() => {
    const source = new Set(
      (itemsQ.data ?? [])
        .map((item) => item.category)
        .filter((v): v is string => typeof v === "string" && v.length > 0)
    );
    return ["All", ...Array.from(source)];
  }, [itemsQ.data]);

  const favoriteItems = favoritesQ.data?.items ?? [];
  const favoriteMarkets = favoritesQ.data?.markets ?? [];

  const favoriteItemIds = useMemo(() => new Set(favoriteItems.map((i) => i.id)), [favoriteItems]);
  const favoriteMarketIds = useMemo(() => new Set(favoriteMarkets.map((m) => m.id)), [favoriteMarkets]);

  const filteredItems = useMemo(() => {
    const term = deferredQuery.trim().toLowerCase();

    return (itemsQ.data ?? []).filter((item) => {
      const matchesSearch =
        !term ||
        `${item.name} ${item.sku} ${item.category ?? ""}`.toLowerCase().includes(term);
      const matchesCategory = category === "All" || item.category === category;
      return matchesSearch && matchesCategory;
    });
  }, [deferredQuery, category, itemsQ.data]);

  const totals = useMemo(
    () => ({
      quantity: cart.reduce((sum, i) => sum + i.qty, 0),
      subtotal: cart.reduce((sum, i) => sum + i.qty * i.price, 0),
    }),
    [cart]
  );

  const selectedItem = useMemo(
    () => (itemsQ.data ?? []).find((item) => item.id === selectedItemId) ?? null,
    [itemsQ.data, selectedItemId]
  );

  const selectedItemImageUrls = useMemo(() => getItemImageUrls(selectedItem), [selectedItem]);

  const selectedItemRemovableIngredients = useMemo(
    () => getRemovableIngredients(selectedItem),
    [selectedItem]
  );

  const selectedComboOffer = useMemo(
    () =>
      (selectedItem?.combo_offers ?? []).find(
        (comboOffer) => comboOffer.name.toLowerCase() === selectedComboOfferName.toLowerCase(),
      ) ?? null,
    [selectedComboOfferName, selectedItem?.combo_offers]
  );

  const marketReviewSummary = useMemo(() => {
    const marketReviews = marketReviewsQ.data ?? [];
    if (!marketReviews.length) {
      return {
        average: market?.review_summary?.average ?? 0,
        count: market?.review_summary?.count ?? 0,
      };
    }

    const total = marketReviews.reduce((sum, review) => sum + Number(review.rating || 0), 0);
    return {
      average: total / marketReviews.length,
      count: marketReviews.length,
    };
  }, [market?.review_summary, marketReviewsQ.data]);

  const itemReviewError = reviewM.isError
    ? getErrorMessage(reviewM.error, "Unable to post your item review right now.")
    : null;
  const marketReviewError = marketReviewM.isError
    ? getErrorMessage(marketReviewM.error, "Unable to post your market review right now.")
    : null;

  const updateCart = (newCart: CartItem[]) => {
    setCart(newCart);
    saveCart(marketId, newCart);
  };

  const addToCart = (item: Item, removedIngredients: string[] = [], comboOffer?: ComboOffer | null) => {
    const normalizedRemovedIngredients = [...removedIngredients].sort((left, right) => left.localeCompare(right));
    const price = comboOffer ? toNumber(comboOffer.combo_price) : calcStorefrontPrice(item);
    const cartId = buildCartItemId(item.id, normalizedRemovedIngredients, comboOffer?.name);
    const existing = cart.find((entry) => entry.cart_id === cartId);

    if (existing) {
      updateCart(
        cart.map((entry) =>
          entry.cart_id === cartId ? { ...entry, qty: entry.qty + 1 } : entry
        )
      );
      return;
    }

    updateCart([
      ...cart,
      {
        cart_id: cartId,
        item_id: item.id,
        name: item.name,
        price,
        qty: 1,
        image_url: item.image_url ?? null,
        ingredients: item.ingredients ?? [],
        removed_ingredients: normalizedRemovedIngredients,
        combo_offer: comboOffer ?? null,
      },
    ]);
  };

  const changeQty = (cartId: string, delta: number) => {
    const target = cart.find((item) => item.cart_id === cartId);
    if (!target) return;

    const nextQty = target.qty + delta;

    if (nextQty <= 0) {
      updateCart(cart.filter((item) => item.cart_id !== cartId));
      return;
    }

    updateCart(
      cart.map((item) =>
        item.cart_id === cartId ? { ...item, qty: nextQty } : item
      )
    );
  };

  const startCheckout = () => {
    if (!auth.getToken()) {
      navigate(`/login?next=${encodeURIComponent("/checkout")}`);
      return;
    }
    navigate("/checkout");
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-50 to-white dark:from-zinc-950 dark:to-zinc-950">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 border-b border-zinc-200/80 dark:border-zinc-800 bg-white/90 dark:bg-zinc-950/90 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-20 flex items-center justify-between gap-4">
          <Link
            to="/"
            className="flex items-center gap-3 text-zinc-700 dark:text-zinc-300 hover:text-cyan-600 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
            <span className="font-medium">Back to All Markets</span>
          </Link>

          <div className="flex items-center gap-3">
            {auth.getToken() && market?.id && (
              <Button
                variant="outline"
                onClick={() => favoriteM.mutate({ market_id: Number(market.id) })}
                className="rounded-2xl"
              >
                <Heart
                  className={`h-4 w-4 mr-2 ${
                    favoriteMarketIds.has(Number(market.id))
                      ? "fill-red-500 text-red-500"
                      : ""
                  }`}
                />
                Favorite Market
              </Button>
            )}
            <ThemeToggle />
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-8 sm:pt-10 pb-24">
        {/* Hero */}
        <div className="relative overflow-hidden rounded-[2rem] shadow-2xl mb-10 sm:mb-12 border border-zinc-200/60 dark:border-zinc-800">
          <div className="relative h-[360px] sm:h-[430px]">
            {getMarketBannerUrl(market) ? (
              <img
                src={getMarketBannerUrl(market) ?? undefined}
                alt={market?.name ?? "Market"}
                className="absolute inset-0 w-full h-full object-cover"
              />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-zinc-950 via-zinc-900 to-black" />
            )}

            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/45 to-black/15" />

            {promo && (
              <div className="absolute top-5 right-5 sm:top-6 sm:right-6 rounded-2xl bg-white/95 dark:bg-zinc-900/95 px-4 py-3 sm:px-6 shadow-xl border border-zinc-200 dark:border-zinc-800">
                <div className="text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  Active Promo
                </div>
                <div className="font-bold text-sm sm:text-base">
                  {promo.code} —{" "}
                  {promo.type === "percent"
                    ? `${toNumber(promo.value)}% OFF`
                    : `${formatMoney(promo.value)} OFF`}
                </div>
              </div>
            )}

            <div className="absolute inset-x-0 bottom-0 p-6 sm:p-10 text-white">
              <div className="flex flex-wrap items-center gap-3 mb-4">
                {resolveMarketMediaUrl(market?.logo_url) ? (
                  <img src={resolveMarketMediaUrl(market?.logo_url) ?? undefined} alt={`${market?.name ?? "Market"} logo`} className="h-16 w-16 rounded-2xl border border-white/30 object-cover shadow-lg" />
                ) : null}
                <span className="font-mono text-xs sm:text-sm tracking-widest text-white/75">
                  {market?.code}
                </span>

                {market?.featured_badge?.toLowerCase().includes("vip") ? (
                  <span className="px-5 py-2 bg-amber-300 text-black font-bold rounded-2xl shadow-lg text-xs sm:text-sm">
                    ✨ VIP EXCLUSIVE
                  </span>
                ) : market?.featured_badge ? (
                  <span className="px-4 py-2 bg-white/15 backdrop-blur text-white text-xs font-medium rounded-full border border-white/20">
                    {market.featured_badge}
                  </span>
                ) : null}
              </div>

              <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
                <div>
                  <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-none">
                    {market?.name}
                  </h1>
                  <p className="mt-4 text-sm sm:text-base lg:text-lg text-white/80 max-w-2xl">
                    {market?.address || "Premium marketplace experience"}
                  </p>

                  <div className="mt-5 flex flex-wrap items-center gap-3">
                    <div className="rounded-2xl bg-white/10 backdrop-blur px-4 py-2 border border-white/10">
                      <div className="text-xs text-white/70 mb-1">Products</div>
                      <div className="font-semibold">{itemsQ.data?.length ?? 0}</div>
                    </div>

                    <div className="rounded-2xl bg-white/10 backdrop-blur px-4 py-2 border border-white/10">
                      <div className="text-xs text-white/70 mb-1">Market Rating</div>
                      <div className="flex items-center gap-2">
                        <RatingDisplay value={marketReviewSummary.average} count={marketReviewSummary.count} size="md" />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  <Button
                    onClick={() => setIsMarketReviewsOpen(true)}
                    className="rounded-2xl h-12 px-5 text-sm sm:text-base font-medium"
                  >
                    <MessageSquare className="h-4 w-4 mr-2" />
                    Market Reviews
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Top filters/info */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-8 lg:gap-10">
          <div>
            <div className="rounded-[2rem] border border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/80 backdrop-blur p-4 sm:p-5 mb-8 shadow-sm">
              <div className="flex flex-col xl:flex-row gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-400" />
                  <Input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search products, SKU, category..."
                    className="h-14 pl-14 rounded-2xl text-base border-zinc-300 dark:border-zinc-700"
                  />
                </div>

                <div className="flex flex-wrap gap-2">
                  {categories.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setCategory(cat)}
                      className={`px-5 py-3 rounded-2xl text-sm font-medium transition-all whitespace-nowrap border ${
                        category === cat
                          ? "bg-cyan-600 text-white border-cyan-600 shadow-lg"
                          : "bg-white dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-zinc-500 dark:text-zinc-400">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4" />
                  <span>{filteredItems.length} visible items</span>
                </div>
                <div>•</div>
                <span>{category === "All" ? "All categories" : category}</span>
              </div>
            </div>

            {/* Products Grid */}
            {itemsQ.isLoading ? (
              <div className="text-center py-20 text-lg text-zinc-500 dark:text-zinc-400">
                Loading products...
              </div>
            ) : itemsQ.isError ? (
              <div className="text-center py-20 text-rose-500">
                Failed to load products
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-3 gap-6">
                {filteredItems.map((item) => {
                  const finalPrice = calcStorefrontPrice(item);
                  const isDiscounted = Math.abs(toNumber(item.price) - finalPrice) > 0.01;
                  const outOfStock = item.stock_qty <= 0;
                  const ingredientCount = item.ingredients?.length ?? 0;
                  const removableCount = getRemovableIngredients(item).length;
                  const comboCount = item.combo_offers?.length ?? 0;
                  const needsCustomization = ingredientCount > 0 || comboCount > 0;

                  return (
                    <Card
                      key={item.id}
                      className="group relative overflow-hidden rounded-[2rem] border border-zinc-200 dark:border-zinc-800 hover:border-cyan-400/60 hover:shadow-2xl transition-all duration-300 bg-white dark:bg-zinc-900 flex flex-col h-full"
                    >
                      <div className="relative h-56 sm:h-64 bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                        {getItemImageUrls(item)[0] ? (
                          <img
                            src={getItemImageUrls(item)[0]}
                            alt={item.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          />
                        ) : (
                          <div className="h-full flex items-center justify-center text-zinc-300 dark:text-zinc-700">
                            <Store className="h-16 w-16" />
                          </div>
                        )}

                        <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black/45 to-transparent">
                          <div className="flex items-center justify-between gap-2">
                            {item.category ? (
                              <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-medium text-zinc-900 dark:bg-zinc-900/90 dark:text-zinc-100">
                                {item.category}
                              </span>
                            ) : (
                              <span />
                            )}

                            {isDiscounted && (
                              <span className="bg-rose-500 text-white text-xs font-bold px-3 py-1 rounded-full">
                                SALE
                              </span>
                            )}
                          </div>
                          {getItemImageUrls(item).length > 1 ? (
                            <div className="mt-2 text-right">
                              <span className="inline-flex rounded-full bg-black/55 px-3 py-1 text-xs font-medium text-white">
                                {getItemImageUrls(item).length} photos
                              </span>
                            </div>
                          ) : null}
                        </div>
                      </div>

                      <CardContent className="p-5 sm:p-6 flex flex-col flex-1">
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div className="min-w-0">
                            <div className="font-mono text-xs text-zinc-500 dark:text-zinc-400 truncate">
                              {item.sku}
                            </div>
                            <h3 className="font-semibold text-lg sm:text-xl leading-tight mt-2 line-clamp-2">
                              {item.name}
                            </h3>
                          </div>

                          {auth.getToken() && (
                            <button
                              type="button"
                              onClick={() => favoriteM.mutate({ item_id: item.id })}
                              className="shrink-0 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                            >
                              <Heart
                                className={`h-4 w-4 ${
                                  favoriteItemIds.has(item.id)
                                    ? "fill-red-500 text-red-500"
                                    : "text-zinc-500"
                                }`}
                              />
                            </button>
                          )}
                        </div>

                        <div className="mb-4">
                          <RatingDisplay
                            value={item.review_summary?.average ?? null}
                            count={item.review_summary?.count ?? 0}
                            size="md"
                          />
                        </div>

                        <div className="flex items-center gap-2 mb-4 flex-wrap">
                          <span className="text-2xl sm:text-3xl font-bold text-emerald-600 dark:text-emerald-400">
                            {formatMoney(finalPrice)}
                          </span>
                          {isDiscounted && (
                            <span className="text-sm sm:text-base line-through text-zinc-400">
                              {formatMoney(item.price)}
                            </span>
                          )}
                        </div>

                        <div className="mb-5 flex flex-wrap gap-2">
                          {!item.is_active && (
                            <span className="text-xs px-3 py-1 rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">
                              Inactive
                            </span>
                          )}
                          {outOfStock ? (
                            <span className="text-xs px-3 py-1 rounded-full bg-rose-100 text-rose-600 dark:bg-rose-950/40 dark:text-rose-300">
                              Out of stock
                            </span>
                          ) : item.is_low_stock ? (
                            <span className="text-xs px-3 py-1 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                              Low stock
                            </span>
                          ) : (
                            <span className="text-xs px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                              In stock
                            </span>
                          )}

                          <span className="text-xs px-3 py-1 rounded-full bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                            Qty: {item.stock_qty}
                          </span>

                          {ingredientCount > 0 && (
                            <span className="text-xs px-3 py-1 rounded-full bg-cyan-100 text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-300">
                              {ingredientCount} ingredients
                            </span>
                          )}

                          {removableCount > 0 && (
                            <span className="text-xs px-3 py-1 rounded-full bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300">
                              {removableCount} removable
                            </span>
                          )}

                          {comboCount > 0 && (
                            <span className="text-xs px-3 py-1 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                              {comboCount} combos
                            </span>
                          )}
                        </div>

                        <div className="mt-auto grid grid-cols-2 gap-2 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                          <Button
                            variant="outline"
                            onClick={() => {
                              setSelectedItemId(item.id);
                              setReviewComment("");
                              setReviewRating(5);
                            }}
                            className="rounded-2xl h-11"
                          >
                            Details
                          </Button>

                          <Button
                            onClick={() => {
                              if (needsCustomization) {
                                setSelectedItemId(item.id);
                                setReviewComment("");
                                setReviewRating(5);
                                return;
                              }

                              addToCart(item);
                            }}
                            disabled={outOfStock || !item.is_active}
                            className="rounded-2xl h-11 font-medium"
                          >
                            {outOfStock ? "Out of Stock" : needsCustomization ? "Customize" : "Add to Cart"}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}

                {filteredItems.length === 0 && (
                  <div className="col-span-full">
                    <div className="rounded-[2rem] border border-dashed border-zinc-300 dark:border-zinc-700 p-12 text-center text-zinc-500 dark:text-zinc-400 bg-white dark:bg-zinc-900">
                      No products found.
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Cart Sidebar */}
          <div className="lg:w-[360px]">
            <div className="sticky top-24 rounded-[2rem] bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 sm:p-7 shadow-xl">
              <div className="flex items-center justify-between gap-3 mb-6">
                <div className="flex items-center gap-4">
                  <div className="h-14 w-14 rounded-2xl bg-cyan-50 dark:bg-cyan-950/40 flex items-center justify-center">
                    <ShoppingCart className="h-7 w-7 text-cyan-600 dark:text-cyan-400" />
                  </div>
                  <div>
                    <div className="text-sm text-zinc-500 dark:text-zinc-400">
                      Your Cart
                    </div>
                    <div className="text-3xl font-bold text-zinc-900 dark:text-white">
                      {totals.quantity}
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-3xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 p-5 mb-6">
                <div className="text-sm text-zinc-500 dark:text-zinc-400 mb-2">
                  Subtotal
                </div>
                <div className="text-3xl font-semibold">{formatMoney(totals.subtotal)}</div>
              </div>

              <div className="space-y-3">
                <Button
                  onClick={startCheckout}
                  disabled={totals.quantity === 0}
                  className="w-full h-14 text-base rounded-2xl font-semibold"
                >
                  Proceed to Checkout
                </Button>

                <Button
                  variant="outline"
                  onClick={() => {
                    clearCart(marketId);
                    setCart([]);
                  }}
                  disabled={totals.quantity === 0}
                  className="w-full h-14 rounded-2xl"
                >
                  Clear Cart
                </Button>
              </div>

              {cart.length > 0 ? (
                <div className="mt-8 space-y-3 max-h-[26rem] overflow-y-auto pr-1">
                  {cart.map((item) => (
                    <div
                      key={item.cart_id}
                      className="rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4 bg-zinc-50/60 dark:bg-zinc-950/60"
                    >
                      <div className="flex justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="font-medium line-clamp-1">{item.name}</div>
                          <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                            {formatMoney(item.price)} each
                          </div>
                          {item.combo_offer ? (
                            <div className="mt-2 text-xs text-amber-700 dark:text-amber-300">
                              Combo: {item.combo_offer.name}
                            </div>
                          ) : null}
                          {(item.removed_ingredients ?? []).length > 0 ? (
                            <div className="mt-2 text-xs text-violet-600 dark:text-violet-300">
                              Without: {item.removed_ingredients?.join(", ")}
                            </div>
                          ) : null}
                        </div>

                        <div className="text-right font-semibold whitespace-nowrap">
                          {formatMoney(item.price * item.qty)}
                        </div>
                      </div>

                      <div className="mt-3 flex items-center justify-end gap-2">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-9 w-9 rounded-xl"
                          onClick={() => changeQty(item.cart_id, -1)}
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </Button>
                        <span className="w-8 text-center font-medium">{item.qty}</span>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-9 w-9 rounded-xl"
                          onClick={() => changeQty(item.cart_id, 1)}
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-8 rounded-3xl border border-dashed border-zinc-300 dark:border-zinc-700 p-8 text-center text-zinc-500 dark:text-zinc-400">
                  Cart is empty.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Item Details Modal */}
      {selectedItemId !== null && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-[2rem] w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl border border-zinc-200 dark:border-zinc-800">
            <div className="p-6 sm:p-8 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-start gap-4">
              <div>
                <h3 className="text-xl sm:text-2xl font-semibold">Customize Item</h3>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                  {selectedItem?.name || "Selected item"}
                </p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setSelectedItemId(null)}>
                <X className="h-5 w-5 sm:h-6 sm:w-6" />
              </Button>
            </div>

            <div className="flex-1 p-6 sm:p-8 overflow-y-auto space-y-5">
              {selectedItem ? (
                <div className="rounded-[1.75rem] border border-zinc-200 dark:border-zinc-800 p-5 sm:p-6">
                  <div className="grid gap-5 md:grid-cols-[220px_minmax(0,1fr)]">
                    <div className="overflow-hidden rounded-[1.5rem] border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-800">
                      {selectedItemImageUrls[0] ? (
                        <img
                          src={selectedItemImageUrls[selectedImageIndex] ?? selectedItemImageUrls[0]}
                          alt={selectedItem.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex min-h-[220px] items-center justify-center text-zinc-400 dark:text-zinc-600">
                          <Store className="h-16 w-16" />
                        </div>
                      )}
                    </div>

                    <div className="grid gap-4">
                      <div>
                        <div className="font-mono text-xs text-zinc-500 dark:text-zinc-400">{selectedItem.sku}</div>
                        <div className="mt-2 text-3xl font-semibold">
                          {formatMoney(selectedComboOffer ? selectedComboOffer.combo_price : calcStorefrontPrice(selectedItem))}
                        </div>
                        {selectedComboOffer ? (
                          <div className="mt-2 text-sm text-amber-700 dark:text-amber-300">
                            Combo selected: {selectedComboOffer.name}
                          </div>
                        ) : null}
                        <div className="mt-3">
                          <RatingDisplay
                            value={selectedItem.review_summary?.average ?? null}
                            count={selectedItem.review_summary?.count ?? 0}
                            size="md"
                          />
                        </div>
                      </div>

                      {selectedItemImageUrls.length > 1 ? (
                        <div className="grid gap-2">
                          <div className="text-sm font-medium">Gallery</div>
                          <div className="flex flex-wrap gap-2">
                            {selectedItemImageUrls.map((url, index) => {
                              const active = index === selectedImageIndex;
                              return (
                                <button
                                  key={`${url}-${index}`}
                                  type="button"
                                  onClick={() => setSelectedImageIndex(index)}
                                  className={`overflow-hidden rounded-2xl border ${
                                    active ? "border-cyan-500 ring-2 ring-cyan-300/60" : "border-zinc-200 dark:border-zinc-800"
                                  }`}
                                >
                                  <img src={url} alt={`${selectedItem.name} ${index + 1}`} className="h-16 w-16 object-cover" />
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ) : null}

                      {(selectedItem.ingredients ?? []).length > 0 ? (
                        <div className="grid gap-3">
                          <div>
                            <div className="text-sm font-medium">Ingredients</div>
                            <div className="text-xs text-zinc-500 dark:text-zinc-400">
                              Required ingredients stay on the item. Optional ones can be removed individually or all at once.
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            {(selectedItem.ingredients ?? []).map((ingredient) => (
                              <span
                                key={ingredient.name}
                                className={`rounded-full px-3 py-1 text-xs font-medium ${
                                  ingredient.removable
                                    ? "bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300"
                                    : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                                }`}
                              >
                                {ingredient.name}
                                {ingredient.removable ? " · removable" : ""}
                              </span>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="rounded-2xl border border-dashed border-zinc-300 dark:border-zinc-700 p-4 text-sm text-zinc-500 dark:text-zinc-400">
                          No ingredients listed for this item yet.
                        </div>
                      )}

                      {selectedItemRemovableIngredients.length > 0 ? (
                        <div className="grid gap-3">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <div className="text-sm font-medium">Choose removable ingredients</div>
                              <div className="text-xs text-zinc-500 dark:text-zinc-400">
                                Keep everything or remove only the optional ingredients you do not want.
                              </div>
                            </div>

                            <div className="flex flex-wrap gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                className="rounded-full"
                                onClick={() => setSelectedRemovedIngredients([])}
                              >
                                Keep all
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                className="rounded-full"
                                onClick={() =>
                                  setSelectedRemovedIngredients(
                                    selectedItemRemovableIngredients.map((ingredient) => ingredient.name),
                                  )
                                }
                              >
                                Remove all optional
                              </Button>
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            {selectedItemRemovableIngredients.map((ingredient) => {
                              const removed = selectedRemovedIngredients.some(
                                (entry) => entry.toLowerCase() === ingredient.name.toLowerCase(),
                              );

                              return (
                                <button
                                  key={ingredient.name}
                                  type="button"
                                  onClick={() =>
                                    setSelectedRemovedIngredients((current) =>
                                      removed
                                        ? current.filter((entry) => entry.toLowerCase() !== ingredient.name.toLowerCase())
                                        : [...current, ingredient.name],
                                    )
                                  }
                                  className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                                    removed
                                      ? "border-violet-600 bg-violet-600 text-white"
                                      : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
                                  }`}
                                >
                                  {removed ? `Removed: ${ingredient.name}` : `Keep: ${ingredient.name}`}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ) : null}

                      {(selectedItem.combo_offers ?? []).length > 0 ? (
                        <div className="grid gap-3">
                          <div>
                            <div className="text-sm font-medium">Combo deals</div>
                            <div className="text-xs text-zinc-500 dark:text-zinc-400">
                              Choose the standard item or a discounted combo prepared by the market.
                            </div>
                          </div>

                          <div className="grid gap-2">
                            <button
                              type="button"
                              onClick={() => setSelectedComboOfferName("")}
                              className={`rounded-2xl border px-4 py-3 text-left transition-colors ${
                                !selectedComboOfferName
                                  ? "border-cyan-600 bg-cyan-50 text-cyan-900 dark:border-cyan-400 dark:bg-cyan-950/30 dark:text-cyan-100"
                                  : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
                              }`}
                            >
                              <div className="flex items-center justify-between gap-3">
                                <span className="font-medium">Standard item</span>
                                <span>{formatMoney(calcStorefrontPrice(selectedItem))}</span>
                              </div>
                            </button>

                            {(selectedItem.combo_offers ?? []).map((comboOffer) => {
                              const active = selectedComboOfferName.toLowerCase() === comboOffer.name.toLowerCase();

                              return (
                                <button
                                  key={comboOffer.name}
                                  type="button"
                                  onClick={() => setSelectedComboOfferName(comboOffer.name)}
                                  className={`rounded-2xl border px-4 py-3 text-left transition-colors ${
                                    active
                                      ? "border-amber-500 bg-amber-50 text-amber-900 dark:border-amber-400 dark:bg-amber-950/30 dark:text-amber-100"
                                      : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
                                  }`}
                                >
                                  <div className="flex items-center justify-between gap-3">
                                    <span className="font-medium">{comboOffer.name}</span>
                                    <span>{formatMoney(comboOffer.combo_price)}</span>
                                  </div>
                                  {comboOffer.description ? (
                                    <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                                      {comboOffer.description}
                                    </div>
                                  ) : null}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ) : null}

                      <Button
                        onClick={() => {
                          addToCart(selectedItem, selectedRemovedIngredients, selectedComboOffer);
                          setSelectedItemId(null);
                        }}
                        disabled={selectedItem.stock_qty <= 0 || !selectedItem.is_active}
                        className="h-12 rounded-2xl text-base"
                      >
                        {selectedItem.stock_qty <= 0 ? "Out of Stock" : "Add Customized Item"}
                      </Button>
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="flex items-center justify-between gap-3">
                <div className="text-lg font-semibold">Reviews</div>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  {selectedComboOffer ? (
                    <div className="text-xs text-amber-700 dark:text-amber-300">
                      Combo: {selectedComboOffer.name}
                    </div>
                  ) : null}
                  {(selectedRemovedIngredients ?? []).length > 0 ? (
                    <div className="text-xs text-violet-600 dark:text-violet-300">
                      Without: {selectedRemovedIngredients.join(", ")}
                    </div>
                  ) : null}
                </div>
              </div>

              {reviewsQ.isLoading ? (
                <p className="py-10 text-center text-zinc-500 dark:text-zinc-400">Loading reviews...</p>
              ) : (reviewsQ.data ?? []).length > 0 ? (
                reviewsQ.data?.map((review) => (
                  <div
                    key={review.id}
                    className="border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 sm:p-6"
                  >
                    <div className="flex justify-between items-center gap-4">
                      <div className="font-medium">
                        {review.user?.name || "Anonymous"}
                      </div>
                      <div className="flex items-center gap-2">
                        <RatingDisplay value={Number(review.rating)} count={undefined} />
                      </div>
                    </div>
                    <p className="mt-3 text-zinc-600 dark:text-zinc-400 text-sm sm:text-base leading-relaxed">
                      {review.comment || "No comment provided."}
                    </p>
                  </div>
                ))
              ) : (
                <p className="py-12 text-center text-zinc-500 dark:text-zinc-400">
                  No reviews yet. Be the first to review!
                </p>
              )}
            </div>

            {auth.getToken() && (
              <div className="p-6 sm:p-8 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950">
                <div className="mb-4">
                  <div className="text-sm font-medium mb-2">Your Rating</div>
                  <StarPicker value={reviewRating} onChange={setReviewRating} size="lg" />
                </div>

                <Input
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  placeholder="Add an optional comment..."
                  className="rounded-2xl h-12"
                />

                {itemReviewError ? (
                  <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">
                    {itemReviewError}
                  </div>
                ) : null}

                <Button
                  onClick={() => reviewM.mutate()}
                  disabled={reviewM.isPending}
                  className="mt-4 w-full h-12 rounded-2xl text-base"
                >
                  {reviewM.isPending ? "Posting Review..." : `Post ${reviewRating}-Star Review`}
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Market Reviews Modal */}
      {isMarketReviewsOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-[2rem] w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl border border-zinc-200 dark:border-zinc-800">
            <div className="p-6 sm:p-8 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-start gap-4">
              <div>
                <h3 className="text-xl sm:text-2xl font-semibold">Market Reviews</h3>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                  {market?.name || "Market"}
                </p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setIsMarketReviewsOpen(false)}>
                <X className="h-5 w-5 sm:h-6 sm:w-6" />
              </Button>
            </div>

            <div className="flex-1 p-6 sm:p-8 overflow-y-auto">
              <div className="mb-6 rounded-3xl border border-zinc-200 dark:border-zinc-800 p-5 bg-zinc-50 dark:bg-zinc-950">
                <div className="text-sm text-zinc-500 dark:text-zinc-400 mb-2">
                  Overall Rating
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-3xl font-bold">
                    {marketReviewSummary.average
                      ? marketReviewSummary.average.toFixed(1)
                      : "0.0"}
                  </div>
                  <RatingDisplay
                    value={marketReviewSummary.average}
                    count={marketReviewSummary.count}
                    size="md"
                  />
                </div>
              </div>

              <div className="space-y-5">
                {marketReviewsQ.isLoading ? (
                  <p className="py-10 text-center text-zinc-500 dark:text-zinc-400">Loading reviews...</p>
                ) : marketReviewsQ.isError ? (
                  <p className="py-10 text-center text-zinc-500 dark:text-zinc-400">
                    Market reviews are not available yet.
                  </p>
                ) : (marketReviewsQ.data ?? []).length > 0 ? (
                  marketReviewsQ.data?.map((review) => (
                    <div
                      key={review.id}
                      className="border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 sm:p-6"
                    >
                      <div className="flex justify-between items-center gap-4">
                        <div className="font-medium">
                          {review.user?.name || "Anonymous"}
                        </div>
                        <RatingDisplay value={Number(review.rating)} count={undefined} />
                      </div>
                      <p className="mt-3 text-zinc-600 dark:text-zinc-400 text-sm sm:text-base leading-relaxed">
                        {review.comment || "No comment provided."}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="py-12 text-center text-zinc-500 dark:text-zinc-400">
                    No market reviews yet. Be the first to review!
                  </p>
                )}
              </div>
            </div>

            {auth.getToken() && (
              <div className="p-6 sm:p-8 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950">
                <div className="mb-4">
                  <div className="text-sm font-medium mb-2">Your Market Rating</div>
                  <StarPicker
                    value={marketReviewRating}
                    onChange={setMarketReviewRating}
                    size="lg"
                  />
                </div>

                <Input
                  value={marketReviewComment}
                  onChange={(e) => setMarketReviewComment(e.target.value)}
                  placeholder="Add an optional market comment..."
                  className="rounded-2xl h-12"
                />

                {marketReviewError ? (
                  <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">
                    {marketReviewError}
                  </div>
                ) : null}

                <Button
                  onClick={() => marketReviewM.mutate()}
                  disabled={marketReviewM.isPending}
                  className="mt-4 w-full h-12 rounded-2xl text-base"
                >
                  {marketReviewM.isPending
                    ? "Posting Review..."
                    : `Post ${marketReviewRating}-Star Market Review`}
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function PublicMarketPage() {
  const { marketId = "" } = useParams();

  if (!marketId) {
    return <div className="p-10 text-red-500">Market ID is missing.</div>;
  }

  return <PublicMarketScreen key={marketId} marketId={marketId} />;
}
