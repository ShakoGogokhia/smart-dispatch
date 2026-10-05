import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, PackageSearch, Search, ShoppingBag, Store, X } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { EmptyState } from "@/components/app/empty-state";
import { StorefrontHeader } from "@/components/app/storefront-header";
import { CartEmpty, CartLines, CartSummary } from "@/components/storefront/market/cart-panel";
import { MarketHero, MarketHeroSkeleton } from "@/components/storefront/market/market-hero";
import {
  getErrorMessage,
  getItemImageUrls,
  getRemovableIngredients,
  itemNeedsCustomization,
  type MarketItem,
  type MarketReviewRecord,
} from "@/components/storefront/market/market-utils";
import { ProductCard, ProductCardSkeleton } from "@/components/storefront/market/product-card";
import { ProductDialog } from "@/components/storefront/market/product-dialog";
import { MarketReviewsSection } from "@/components/storefront/market/reviews-section";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
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
} from "@/lib/cart";
import { formatMoney, toNumber } from "@/lib/format";
import {
  calcStorefrontPrice,
  formatMarketHours,
  formatOperatingHoursList,
  type MarketPromo,
  type StorefrontMarket,
} from "@/lib/storefront";
import { cn } from "@/lib/utils";
import type { FavoritePayload, ReviewRecord } from "@/types/api";

const UNCATEGORIZED = "Other";

function PublicMarketScreen({ marketId }: { marketId: string }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isLoggedIn = !!auth.getToken();

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [selectedItemId, setSelectedItemId] = useState<number | null>(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [selectedRemovedIngredients, setSelectedRemovedIngredients] = useState<string[]>([]);
  const [selectedComboOfferName, setSelectedComboOfferName] = useState("");
  const [selectedQty, setSelectedQty] = useState(1);
  const [isMarketReviewsOpen, setIsMarketReviewsOpen] = useState(false);
  const [isCartSheetOpen, setIsCartSheetOpen] = useState(false);

  const [reviewComment, setReviewComment] = useState("");
  const [reviewRating, setReviewRating] = useState(5);

  const [marketReviewComment, setMarketReviewComment] = useState("");
  const [marketReviewRating, setMarketReviewRating] = useState(5);

  const deferredQuery = useDeferredValue(query);
  const [cart, setCart] = useState<CartItem[]>(() => loadCart(marketId));

  const catalogRef = useRef<HTMLDivElement>(null);
  const reviewsRef = useRef<HTMLElement>(null);

  useEffect(() => {
    setActiveMarketId(marketId);
    setCart(loadCart(marketId));
  }, [marketId]);

  useEffect(() => {
    setSelectedRemovedIngredients([]);
    setSelectedComboOfferName("");
    setSelectedImageIndex(0);
    setSelectedQty(1);
  }, [selectedItemId]);

  const marketQ = useQuery({
    queryKey: ["public-market", marketId],
    queryFn: async () => (await api.get(`/api/public/markets/${marketId}`)).data as StorefrontMarket,
    enabled: !!marketId,
  });

  const itemsQ = useQuery({
    queryKey: ["public-market-items", marketId],
    queryFn: async () => (await api.get(`/api/public/markets/${marketId}/items`)).data as MarketItem[],
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

  // Optional market reviews endpoint. Loaded lazily once the reviews section is
  // viewed; if the backend doesn't have it, the UI shows a graceful fallback.
  const marketReviewsQ = useQuery({
    queryKey: ["market-reviews", marketId],
    queryFn: async () =>
      (await api.get(`/api/public/markets/${marketId}/reviews`)).data as MarketReviewRecord[],
    enabled: !!marketId && isMarketReviewsOpen,
    retry: false,
  });

  // Load market reviews when the reviews section scrolls into view.
  useEffect(() => {
    const node = reviewsRef.current;
    if (!node || isMarketReviewsOpen || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setIsMarketReviewsOpen(true);
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [isMarketReviewsOpen, marketQ.data]);

  const favoriteM = useMutation({
    mutationFn: async (payload: { market_id?: number; item_id?: number }) =>
      (await api.post("/api/favorites/toggle", payload)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["favorites"] }),
    onError: () => toast.error("Couldn't update favorites. Please try again."),
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
      toast.success("Thanks! Your review was posted.");
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
      toast.success("Thanks! Your market review was posted.");
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
        .filter((v): v is string => typeof v === "string" && v.length > 0),
    );
    return ["All", ...Array.from(source)];
  }, [itemsQ.data]);

  const favoriteItems = favoritesQ.data?.items;
  const favoriteMarkets = favoritesQ.data?.markets;

  const favoriteItemIds = useMemo(() => new Set((favoriteItems ?? []).map((i) => i.id)), [favoriteItems]);
  const favoriteMarketIds = useMemo(() => new Set((favoriteMarkets ?? []).map((m) => m.id)), [favoriteMarkets]);

  const filteredItems = useMemo(() => {
    const term = deferredQuery.trim().toLowerCase();

    return (itemsQ.data ?? []).filter((item) => {
      const matchesSearch =
        !term || `${item.name} ${item.sku} ${item.category ?? ""}`.toLowerCase().includes(term);
      const matchesCategory = category === "All" || item.category === category;
      return matchesSearch && matchesCategory;
    });
  }, [deferredQuery, category, itemsQ.data]);

  const groupedItems = useMemo(() => {
    const groups = new Map<string, MarketItem[]>();
    for (const name of categories.slice(1)) groups.set(name, []);
    for (const item of filteredItems) {
      const key = item.category || UNCATEGORIZED;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)?.push(item);
    }
    return Array.from(groups.entries()).filter(([, items]) => items.length > 0);
  }, [categories, filteredItems]);

  const totals = useMemo(
    () => ({
      quantity: cart.reduce((sum, i) => sum + i.qty, 0),
      subtotal: cart.reduce((sum, i) => sum + i.qty * i.price, 0),
    }),
    [cart],
  );

  const selectedItem = useMemo(
    () => (itemsQ.data ?? []).find((item) => item.id === selectedItemId) ?? null,
    [itemsQ.data, selectedItemId],
  );

  const selectedItemImageUrls = useMemo(() => getItemImageUrls(selectedItem), [selectedItem]);

  const selectedItemRemovableIngredients = useMemo(() => getRemovableIngredients(selectedItem), [selectedItem]);

  const selectedComboOffer = useMemo(
    () =>
      selectedItem?.item_kind === "combo"
        ? null
        : (selectedItem?.combo_offers ?? []).find(
            (comboOffer) => comboOffer.name.toLowerCase() === selectedComboOfferName.toLowerCase(),
          ) ?? null,
    [selectedComboOfferName, selectedItem],
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
  const marketIsOpen = market?.operating_status?.is_open ?? market?.is_active ?? false;
  const marketHoursLabel = formatMarketHours(market);
  const operatingHoursList = formatOperatingHoursList(market);

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

  const addToCart = (
    item: MarketItem,
    removedIngredients: string[] = [],
    comboOffer?: ComboOffer | null,
    qty = 1,
  ) => {
    if (!marketIsOpen) {
      return;
    }

    const normalizedRemovedIngredients = [...removedIngredients].sort((left, right) => left.localeCompare(right));
    const price = comboOffer ? toNumber(comboOffer.combo_price) : calcStorefrontPrice(item);
    const cartId = buildCartItemId(item.id, normalizedRemovedIngredients, comboOffer?.name);
    const existing = cart.find((entry) => entry.cart_id === cartId);

    if (existing) {
      updateCart(cart.map((entry) => (entry.cart_id === cartId ? { ...entry, qty: entry.qty + qty } : entry)));
    } else {
      updateCart([
        ...cart,
        {
          cart_id: cartId,
          item_id: item.id,
          name: item.name,
          price,
          qty,
          image_url: item.image_url ?? null,
          ingredients: item.ingredients ?? [],
          removed_ingredients: normalizedRemovedIngredients,
          combo_offer: comboOffer ?? null,
        },
      ]);
    }

    toast.success(`Added ${qty > 1 ? `${qty} × ` : ""}${item.name} to your cart`);
  };

  const changeQty = (cartId: string, delta: number) => {
    const target = cart.find((item) => item.cart_id === cartId);
    if (!target) return;

    const nextQty = target.qty + delta;

    if (nextQty <= 0) {
      updateCart(cart.filter((item) => item.cart_id !== cartId));
      return;
    }

    updateCart(cart.map((item) => (item.cart_id === cartId ? { ...item, qty: nextQty } : item)));
  };

  const handleClearCart = () => {
    clearCart(marketId);
    setCart([]);
  };

  const startCheckout = () => {
    if (!auth.getToken()) {
      navigate(`/login?next=${encodeURIComponent("/checkout")}`);
      return;
    }
    navigate("/checkout");
  };

  const openItem = (itemId: number) => {
    setSelectedItemId(itemId);
    setReviewComment("");
    setReviewRating(5);
  };

  const showMarketReviews = () => {
    setIsMarketReviewsOpen(true);
    reviewsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const selectCategory = (cat: string) => {
    setCategory(cat);
    const node = catalogRef.current;
    if (node && node.getBoundingClientRect().top < 0) {
      node.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const cartButton = (
    <Button variant="outline" className="relative gap-2" onClick={() => setIsCartSheetOpen(true)} aria-label="Open cart">
      <ShoppingBag />
      <span className="hidden tabular-nums sm:inline">{formatMoney(totals.subtotal)}</span>
      {totals.quantity > 0 ? (
        <Badge className="h-5 min-w-5 rounded-full px-1.5 tabular-nums">{totals.quantity}</Badge>
      ) : null}
    </Button>
  );

  if (marketQ.isError) {
    return (
      <div className="min-h-screen bg-background">
        <StorefrontHeader actions={cartButton} />
        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 md:py-8">
          <EmptyState
            icon={Store}
            title="Market not found"
            description="This market may have been removed or is temporarily unavailable."
            action={
              <Button asChild variant="outline">
                <Link to="/">
                  <ArrowLeft />
                  Back to markets
                </Link>
              </Button>
            }
          />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <StorefrontHeader actions={cartButton} />

      <main className={cn("mx-auto max-w-7xl px-4 py-6 sm:px-6 md:py-8", cart.length > 0 && "pb-28 lg:pb-8")}>
        <Button asChild variant="ghost" size="sm" className="-ml-2 mb-3 text-muted-foreground">
          <Link to="/">
            <ArrowLeft />
            All markets
          </Link>
        </Button>

        {marketQ.isLoading ? (
          <MarketHeroSkeleton />
        ) : (
          <MarketHero
            market={market}
            isOpen={marketIsOpen}
            hoursLabel={marketHoursLabel}
            operatingHoursList={operatingHoursList}
            promo={promo}
            itemCount={itemsQ.data?.length ?? 0}
            reviewSummary={marketReviewSummary}
            onShowReviews={showMarketReviews}
            canFavorite={isLoggedIn && !!market?.id}
            isFavorite={!!market?.id && favoriteMarketIds.has(Number(market.id))}
            favoritePending={favoriteM.isPending}
            onToggleFavorite={() => market?.id && favoriteM.mutate({ market_id: Number(market.id) })}
          />
        )}

        <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          {/* Catalog */}
          <div ref={catalogRef} className="min-w-0 scroll-mt-16 space-y-6">
            <div className="sticky top-16 z-30 -mx-4 space-y-3 border-b bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0">
              <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={`Search ${market?.name ?? "this market"} by name, SKU or category`}
                  className="pr-9 pl-9"
                  aria-label="Search products"
                />
                {query ? (
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    className="absolute top-1/2 right-2 -translate-y-1/2"
                    onClick={() => setQuery("")}
                    aria-label="Clear search"
                  >
                    <X />
                  </Button>
                ) : null}
              </div>
              <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {categories.map((cat) => (
                  <Button
                    key={cat}
                    size="sm"
                    variant={category === cat ? "default" : "outline"}
                    className="shrink-0 rounded-full"
                    onClick={() => selectCategory(cat)}
                    aria-pressed={category === cat}
                  >
                    {cat === "All" ? "All items" : cat}
                  </Button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                <span className="tabular-nums">{filteredItems.length}</span> item{filteredItems.length === 1 ? "" : "s"}
                {" · "}
                {category === "All" ? "All categories" : category}
                {deferredQuery.trim() ? ` · matching “${deferredQuery.trim()}”` : ""}
              </p>
            </div>

            {itemsQ.isLoading ? (
              <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: 6 }).map((_, index) => (
                  <ProductCardSkeleton key={index} />
                ))}
              </div>
            ) : itemsQ.isError ? (
              <Alert variant="destructive">
                <AlertDescription>Failed to load products. Please refresh the page and try again.</AlertDescription>
              </Alert>
            ) : filteredItems.length === 0 ? (
              <EmptyState
                icon={PackageSearch}
                title="No products found"
                description={
                  (itemsQ.data ?? []).length === 0
                    ? "This market hasn't added any products yet."
                    : "Try a different search term or category."
                }
                action={
                  query || category !== "All" ? (
                    <Button
                      variant="outline"
                      onClick={() => {
                        setQuery("");
                        setCategory("All");
                      }}
                    >
                      Clear filters
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              groupedItems.map(([groupName, items]) => (
                <section key={groupName} className="space-y-3" aria-label={groupName}>
                  <div className="flex items-baseline justify-between gap-2">
                    <h2 className="text-lg font-semibold tracking-tight">{groupName}</h2>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {items.length} item{items.length === 1 ? "" : "s"}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3">
                    {items.map((item) => (
                      <ProductCard
                        key={item.id}
                        item={item}
                        marketIsOpen={marketIsOpen}
                        canFavorite={isLoggedIn}
                        isFavorite={favoriteItemIds.has(item.id)}
                        onToggleFavorite={() => favoriteM.mutate({ item_id: item.id })}
                        onOpen={() => openItem(item.id)}
                        onAdd={() => {
                          if (itemNeedsCustomization(item)) {
                            openItem(item.id);
                            return;
                          }
                          addToCart(item);
                        }}
                      />
                    ))}
                  </div>
                </section>
              ))
            )}

            {!marketQ.isLoading ? (
              <MarketReviewsSection
                ref={reviewsRef}
                marketName={market?.name}
                summary={marketReviewSummary}
                reviews={marketReviewsQ.data}
                isLoading={marketReviewsQ.isLoading}
                isError={marketReviewsQ.isError}
                isLoggedIn={isLoggedIn}
                rating={marketReviewRating}
                onRatingChange={setMarketReviewRating}
                comment={marketReviewComment}
                onCommentChange={setMarketReviewComment}
                error={marketReviewError}
                isPending={marketReviewM.isPending}
                onSubmit={() => marketReviewM.mutate()}
              />
            ) : null}
          </div>

          {/* Cart sidebar (lg+) */}
          <aside className="hidden lg:block">
            <Card className="sticky top-20 gap-4">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <ShoppingBag className="size-4" />
                  Your cart
                </CardTitle>
                <CardDescription>
                  {totals.quantity > 0
                    ? `${totals.quantity} item${totals.quantity === 1 ? "" : "s"} from ${market?.name ?? "this market"}`
                    : "Items you add will appear here."}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {cart.length > 0 ? (
                  <CartLines cart={cart} onChangeQty={changeQty} className="max-h-[calc(100svh-26rem)] overflow-y-auto pr-1" />
                ) : (
                  <CartEmpty />
                )}
              </CardContent>
              <CardFooter className="block border-t pt-4">
                <CartSummary totals={totals} promo={promo} onCheckout={startCheckout} onClear={handleClearCart} />
              </CardFooter>
            </Card>
          </aside>
        </div>
      </main>

      {/* Mobile "view cart" bar */}
      {cart.length > 0 ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 p-3 backdrop-blur supports-[backdrop-filter]:bg-background/80 lg:hidden">
          <Button size="lg" className="w-full justify-between" onClick={() => setIsCartSheetOpen(true)}>
            <span className="flex items-center gap-2">
              <ShoppingBag />
              View cart
            </span>
            <span className="tabular-nums">
              {totals.quantity} item{totals.quantity === 1 ? "" : "s"} · {formatMoney(totals.subtotal)}
            </span>
          </Button>
        </div>
      ) : null}

      {/* Cart sheet */}
      <Sheet open={isCartSheetOpen} onOpenChange={setIsCartSheetOpen}>
        <SheetContent side="right" className="w-full gap-0 sm:max-w-md">
          <SheetHeader className="border-b">
            <SheetTitle className="flex items-center gap-2">
              <ShoppingBag className="size-4" />
              Your cart
            </SheetTitle>
            <SheetDescription>
              {totals.quantity > 0
                ? `${totals.quantity} item${totals.quantity === 1 ? "" : "s"} from ${market?.name ?? "this market"}`
                : "Items you add will appear here."}
            </SheetDescription>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            {cart.length > 0 ? <CartLines cart={cart} onChangeQty={changeQty} /> : <CartEmpty />}
          </div>
          <SheetFooter className="border-t">
            <CartSummary
              totals={totals}
              promo={promo}
              onCheckout={() => {
                setIsCartSheetOpen(false);
                startCheckout();
              }}
              onClear={handleClearCart}
            />
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <ProductDialog
        open={selectedItemId !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedItemId(null);
        }}
        item={selectedItem}
        imageUrls={selectedItemImageUrls}
        imageIndex={selectedImageIndex}
        onImageIndexChange={setSelectedImageIndex}
        removableIngredients={selectedItemRemovableIngredients}
        removedIngredients={selectedRemovedIngredients}
        onRemovedIngredientsChange={setSelectedRemovedIngredients}
        comboOfferName={selectedComboOfferName}
        onComboOfferNameChange={setSelectedComboOfferName}
        selectedComboOffer={selectedComboOffer}
        quantity={selectedQty}
        onQuantityChange={setSelectedQty}
        marketIsOpen={marketIsOpen}
        onAddToCart={() => {
          if (!selectedItem) return;
          addToCart(selectedItem, selectedRemovedIngredients, selectedComboOffer, selectedQty);
          setSelectedItemId(null);
        }}
        reviews={reviewsQ.data}
        reviewsLoading={reviewsQ.isLoading}
        isLoggedIn={isLoggedIn}
        reviewRating={reviewRating}
        onReviewRatingChange={setReviewRating}
        reviewComment={reviewComment}
        onReviewCommentChange={setReviewComment}
        reviewError={itemReviewError}
        reviewPending={reviewM.isPending}
        onSubmitReview={() => reviewM.mutate()}
      />
    </div>
  );
}

export default function PublicMarketPage() {
  const { marketId = "" } = useParams();

  if (!marketId) {
    return (
      <div className="min-h-screen bg-background">
        <StorefrontHeader />
        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 md:py-8">
          <EmptyState
            icon={Store}
            title="Market ID is missing"
            description="Pick a market from the list to start ordering."
            action={
              <Button asChild variant="outline">
                <Link to="/">
                  <ArrowLeft />
                  Back to markets
                </Link>
              </Button>
            }
          />
        </main>
      </div>
    );
  }

  return <PublicMarketScreen key={marketId} marketId={marketId} />;
}
