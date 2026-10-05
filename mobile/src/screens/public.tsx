import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Alert as RNAlert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import {
  Alert,
  AppText,
  Badge,
  Button,
  Card,
  Chip,
  ChipRow,
  EmptyState,
  Input,
  Label,
  LoadingBlock,
  OptionCard,
  PageHeader,
  Panel,
  Row,
  SectionHeader,
  SegmentedControl,
  Screen,
  Separator,
  radius,
  useColors,
  withAlpha,
  type IconName,
} from "@/src/components/ui";
import { Brand, CartButton, StorefrontBar } from "@/src/components/storefront-bar";
import { CartLines, CartSheet, ViewCartBar } from "@/src/components/storefront/cart";
import { SummaryRow } from "@/src/components/storefront/common";
import {
  DiscoveryProductCard,
  DiscoveryProductCardSkeleton,
  MarketCard,
  MarketCardSkeleton,
} from "@/src/components/storefront/home-cards";
import { MarketHero, MarketHeroSkeleton } from "@/src/components/storefront/market-hero";
import { MarketProductCard, MarketProductCardSkeleton } from "@/src/components/storefront/market-product-card";
import { ProductSheet } from "@/src/components/storefront/product-sheet";
import { MarketReviewsSection } from "@/src/components/storefront/reviews-section";
import {
  calcItemFinalPrice,
  formatDeliverySlot,
  getItemImageUrls,
  isMarketOpen,
  itemNeedsDetails,
  marketHasDeals,
  type DiscoveryFeed,
  type DiscoveryItem,
  type MarketReviewRecord,
  type StorefrontItem,
  type StorefrontMarket,
} from "@/src/components/storefront/utils";
import { getErrorMessage } from "@/src/lib/errors";
import { api } from "@/src/lib/api";
import { formatMoney, toNumber } from "@/src/lib/format";
import { getDefaultAuthedRoute, normalizeRoles } from "@/src/lib/session";
import { clearCart, getActiveMarketId, loadCart, saveCart, setActiveMarketId } from "@/src/lib/storage";
import type { CartItem } from "@/src/lib/storage";
import { useMe } from "@/src/lib/use-me";
import { useProtectedAccess } from "@/src/hooks/use-protected-access";
import { useAuth, usePreferences } from "@/src/providers/app-providers";
import type { FavoritePayload, MarketLite, PromoCode, ReviewRecord } from "@/src/types/api";
import type { RootStackParamList } from "@/src/types/navigation";

type PublicMarketsProps = NativeStackScreenProps<RootStackParamList, "PublicMarkets">;
type PublicMarketProps = NativeStackScreenProps<RootStackParamList, "PublicMarket">;
type LoginProps = NativeStackScreenProps<RootStackParamList, "Login">;
type CheckoutProps = NativeStackScreenProps<RootStackParamList, "Checkout">;
type HomeProps = NativeStackScreenProps<RootStackParamList, "Home">;

type CheckoutMarket = MarketLite;

const RAIL_MARKET_WIDTH = 280;
const RAIL_PRODUCT_WIDTH = 160;

function confirmClearCart(onConfirm: () => void) {
  RNAlert.alert("Clear cart?", "All items will be removed from your cart.", [
    { text: "Cancel", style: "cancel" },
    { text: "Clear cart", style: "destructive", onPress: onConfirm },
  ]);
}

/* -------------------------------------------------------------------------------------------------
 * Home (session router)
 * -----------------------------------------------------------------------------------------------*/

export function HomeScreen({ navigation }: HomeProps) {
  const { ready, token, signOut } = useAuth();
  const meQ = useQuery({
    queryKey: ["home-me"],
    queryFn: async () => (await api.get("/api/me")).data,
    enabled: ready && !!token,
    retry: false,
  });

  useEffect(() => {
    if (!ready) {
      return;
    }

    if (!token) {
      navigation.replace("PublicMarkets");
      return;
    }

    if (meQ.isError) {
      void signOut().finally(() => {
        navigation.replace("Login");
      });
      return;
    }

    const roles = normalizeRoles(meQ.data?.roles);
    if (meQ.data) {
      (navigation as any).replace(getDefaultAuthedRoute(roles));
    }
  }, [meQ.data, meQ.isError, navigation, ready, signOut, token]);

  return (
    <Screen header={<StorefrontBar navigation={navigation} showAccount={false} />}>
      <View style={styles.homeIntro}>
        <AppText variant="title">Opening your workspace</AppText>
        <AppText variant="muted">Routing you into the correct customer, staff, or driver flow.</AppText>
      </View>
      <LoadingBlock message={ready ? "Checking your session..." : "Preparing the app..."} rows={2} />
    </Screen>
  );
}

/* -------------------------------------------------------------------------------------------------
 * Markets (marketplace landing)
 * -----------------------------------------------------------------------------------------------*/

type QuickFilter = "all" | "open" | "featured" | "deals";

const QUICK_FILTERS: { value: QuickFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "open", label: "Open now" },
  { value: "featured", label: "Featured" },
  { value: "deals", label: "Has deals" },
];

const HOW_IT_WORKS: { icon: IconName; title: string; description: string }[] = [
  { icon: "storefront-outline", title: "Choose a market", description: "Browse local markets and see what's open right now." },
  { icon: "basket-outline", title: "Add items", description: "Fill your cart, apply deals and check out in a minute." },
  { icon: "bicycle-outline", title: "Track delivery live", description: "Follow your order from the market to your door." },
];

function HeroStat({ value, label }: { value: number; label: string }) {
  const c = useColors();
  return (
    <Row gap={5} align="baseline">
      <Text style={[styles.heroStatValue, { color: c.foreground }]}>{value}</Text>
      <AppText variant="small" tone="muted">
        {label}
      </AppText>
    </Row>
  );
}

function Rail({ children }: { children: ReactNode }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.bleed} contentContainerStyle={styles.railContent} decelerationRate="fast">
      {children}
    </ScrollView>
  );
}

export function PublicMarketsScreen({ navigation }: PublicMarketsProps) {
  const c = useColors();
  const { token } = useAuth();
  const meQ = useMe(!!token);
  const scrollRef = useRef<ScrollView>(null);
  const marketsY = useRef(0);
  const [search, setSearch] = useState("");
  const [quickFilter, setQuickFilter] = useState<QuickFilter>("all");
  const [refreshing, setRefreshing] = useState(false);

  const marketsQ = useQuery({
    queryKey: ["public-markets"],
    queryFn: async () => (await api.get("/api/public/markets")).data as StorefrontMarket[],
  });

  const discoveryQ = useQuery({
    queryKey: ["public-discovery-items"],
    queryFn: async () => (await api.get("/api/public/discovery-items")).data as DiscoveryFeed,
  });

  const allMarkets = useMemo(() => marketsQ.data ?? [], [marketsQ.data]);
  const query = search.trim().toLowerCase();

  const searchedMarkets = useMemo(() => {
    if (!query) return allMarkets;
    return allMarkets.filter((market) =>
      [market.name, market.code, market.address, market.featured_badge, market.featured_headline, market.featured_copy]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [allMarkets, query]);

  const filteredMarkets = useMemo(() => {
    switch (quickFilter) {
      case "open":
        return searchedMarkets.filter((market) => isMarketOpen(market));
      case "featured":
        return searchedMarkets.filter((market) => market.is_featured);
      case "deals":
        return searchedMarkets.filter(marketHasDeals);
      default:
        return searchedMarkets;
    }
  }, [quickFilter, searchedMarkets]);

  const promotedMarkets = filteredMarkets.filter((market) => market.is_featured);
  const promotedIds = new Set(promotedMarkets.map((market) => market.id));
  const regularMarkets = filteredMarkets.filter((market) => !promotedIds.has(market.id));
  const showFeaturedAsList = quickFilter === "featured";
  const listMarkets = showFeaturedAsList ? promotedMarkets : regularMarkets;

  const totalMarkets = allMarkets.length;
  const totalOpen = allMarkets.filter((market) => isMarketOpen(market)).length;
  const totalItems = allMarkets.reduce((sum, market) => sum + Number(market.active_items_count ?? 0), 0);
  const isFiltering = !!query || quickFilter !== "all";
  const firstName = typeof meQ.data?.name === "string" ? meQ.data.name.split(" ")[0] : null;

  const openMarket = (marketId: number | string) => navigation.navigate("PublicMarket", { marketId: String(marketId) });

  const clearFilters = () => {
    setSearch("");
    setQuickFilter("all");
  };

  async function onRefresh() {
    setRefreshing(true);
    try {
      await Promise.all([marketsQ.refetch(), discoveryQ.refetch()]);
    } finally {
      setRefreshing(false);
    }
  }

  const productRail = (title: string, description: string, items?: DiscoveryItem[]) =>
    items && items.length > 0 ? (
      <View style={styles.section}>
        <SectionHeader title={title} description={description} />
        <Rail>
          {items.map((item) => (
            <DiscoveryProductCard
              key={`${item.market_id}-${item.id}`}
              item={item}
              onPress={() => openMarket(item.market_id)}
              style={styles.railProduct}
            />
          ))}
        </Rail>
      </View>
    ) : null;

  return (
    <Screen header={<StorefrontBar navigation={navigation} />} scroll={false} contentStyle={styles.noPad}>
      <ScrollView
        ref={scrollRef}
        style={styles.flex}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} tintColor={c.primary} colors={[c.primary]} />}
      >
        {/* Hero */}
        <View style={[styles.hero, { backgroundColor: withAlpha(c.primary, 0.05), borderColor: c.border }]}>
          <View style={styles.gap8}>
            {firstName ? (
              <AppText variant="label" tone="primary">
                Hi, {firstName}
              </AppText>
            ) : null}
            <AppText variant="display">Order from local markets, delivered fast</AppText>
            <AppText variant="muted">Find a market near you, add what you need, and track your delivery live.</AppText>
          </View>

          <Input
            value={search}
            onChangeText={setSearch}
            placeholder="Search markets by name, code, location..."
            icon="search"
            returnKeyType="search"
            autoCapitalize="none"
            right={
              search ? (
                <Pressable onPress={() => setSearch("")} accessibilityLabel="Clear search" hitSlop={8}>
                  <Ionicons name="close-circle" size={18} color={c.mutedForeground} />
                </Pressable>
              ) : undefined
            }
          />

          <Row gap={18} wrap>
            <HeroStat value={totalMarkets} label="live markets" />
            <HeroStat value={totalItems} label="items" />
            <HeroStat value={totalOpen} label="open now" />
          </Row>

          <Row gap={8} wrap>
            <Button iconRight="arrow-forward" onPress={() => scrollRef.current?.scrollTo({ y: marketsY.current, animated: true })}>
              Browse markets
            </Button>
            <Button variant="outline" icon="location-outline" onPress={() => navigation.navigate("OrderTracking")}>
              Track an order
            </Button>
            {token ? (
              <Button variant="ghost" onPress={() => navigation.navigate("Home")}>
                Continue workspace
              </Button>
            ) : (
              <Button variant="ghost" onPress={() => navigation.navigate("Login", { mode: "register" })}>
                Join workspace
              </Button>
            )}
          </Row>
        </View>

        {/* Markets */}
        <View
          style={styles.sectionLg}
          onLayout={(event) => {
            marketsY.current = event.nativeEvent.layout.y;
          }}
        >
          <View style={styles.gap8}>
            <ChipRow>
              {QUICK_FILTERS.map((filter) => (
                <Chip key={filter.value} label={filter.label} selected={quickFilter === filter.value} onPress={() => setQuickFilter(filter.value)} />
              ))}
            </ChipRow>
            {marketsQ.isSuccess ? (
              <AppText variant="caption" style={styles.tabular}>
                {filteredMarkets.length} of {totalMarkets} markets
              </AppText>
            ) : null}
          </View>

          {marketsQ.isLoading ? (
            <View style={styles.section}>
              <SectionHeader title="All markets" description="Loading markets..." />
              <MarketCardSkeleton />
              <MarketCardSkeleton />
            </View>
          ) : marketsQ.isError ? (
            <Alert
              tone="destructive"
              title="Couldn't load markets"
              description={`Failed to load markets from ${api.defaults.baseURL}. Please try again.`}
              action={
                <Button variant="outline" size="sm" onPress={() => void marketsQ.refetch()}>
                  Try again
                </Button>
              }
            />
          ) : filteredMarkets.length === 0 ? (
            <EmptyState
              icon="search"
              title="No markets found"
              description={
                isFiltering
                  ? "Nothing matches your search or filter. Try a different term or show all markets."
                  : "There are no live markets right now. Please check back soon."
              }
              action={
                isFiltering ? (
                  <Button variant="outline" onPress={clearFilters}>
                    Clear search
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <>
              {!showFeaturedAsList && promotedMarkets.length > 0 ? (
                <View style={styles.section}>
                  <SectionHeader
                    title="Featured markets"
                    description={`${promotedMarkets.length} highlighted market${promotedMarkets.length === 1 ? "" : "s"} with special offers and picks.`}
                  />
                  <Rail>
                    {promotedMarkets.map((market) => (
                      <MarketCard key={market.id} market={market} onPress={() => openMarket(market.id)} style={styles.railMarket} />
                    ))}
                  </Rail>
                </View>
              ) : null}

              {listMarkets.length > 0 ? (
                <View style={styles.section}>
                  <SectionHeader
                    title={showFeaturedAsList ? "Featured markets" : "All markets"}
                    description={showFeaturedAsList ? "Highlighted markets with special offers and picks." : "Every live market. Tap a card to see its menu."}
                  />
                  {listMarkets.map((market) => (
                    <MarketCard key={market.id} market={market} onPress={() => openMarket(market.id)} />
                  ))}
                </View>
              ) : null}
            </>
          )}
        </View>

        {/* Product rails */}
        {discoveryQ.isLoading ? (
          <View style={styles.section}>
            <SectionHeader title="Popular right now" description="Loading items..." />
            <Rail>
              {[0, 1, 2].map((index) => (
                <DiscoveryProductCardSkeleton key={index} style={styles.railProduct} />
              ))}
            </Rail>
          </View>
        ) : discoveryQ.isSuccess ? (
          <>
            {productRail("Popular right now", "Top items by recent orders across all markets.", discoveryQ.data?.popular)}
            {productRail("Deals", "Discounted items across all markets.", discoveryQ.data?.discounted)}
            {productRail("Combo picks", "Items with combo offers set up by their market.", discoveryQ.data?.combo)}
          </>
        ) : null}

        {/* How it works */}
        <View style={styles.section}>
          <SectionHeader title="How it works" />
          {HOW_IT_WORKS.map((step, index) => (
            <Card key={step.title}>
              <Row gap={12} align="flex-start">
                <View style={[styles.stepIcon, { backgroundColor: withAlpha(c.primary, 0.1) }]}>
                  <Ionicons name={step.icon} size={20} color={c.primary} />
                </View>
                <View style={styles.flex}>
                  <AppText variant="label" style={styles.semibold}>
                    <Text style={{ color: c.mutedForeground }}>{index + 1}. </Text>
                    {step.title}
                  </AppText>
                  <AppText variant="small" tone="muted" style={styles.mt2}>
                    {step.description}
                  </AppText>
                </View>
              </Row>
            </Card>
          ))}
          <Row gap={6} wrap>
            <Ionicons name="cube-outline" size={15} color={c.mutedForeground} />
            <AppText variant="small" tone="muted">
              Already ordered?
            </AppText>
            <Button variant="link" size="sm" onPress={() => navigation.navigate("OrderTracking")} style={styles.inlineLink}>
              Track your order
            </Button>
          </Row>
        </View>

        {/* Footer */}
        <View style={[styles.footerBlock, { borderTopColor: c.border }]}>
          <Brand />
          <AppText variant="small" tone="muted">
            Order from local markets and follow your delivery live.
          </AppText>
          <Row gap={4} wrap>
            <Button variant="ghost" size="sm" onPress={() => scrollRef.current?.scrollTo({ y: 0, animated: true })}>
              Markets
            </Button>
            <Button variant="ghost" size="sm" onPress={() => navigation.navigate("OrderTracking")}>
              Track order
            </Button>
            {!token ? (
              <Button variant="ghost" size="sm" onPress={() => navigation.navigate("Login", { mode: "login" })}>
                Sign in
              </Button>
            ) : null}
          </Row>
        </View>
      </ScrollView>
    </Screen>
  );
}

/* -------------------------------------------------------------------------------------------------
 * Market storefront
 * -----------------------------------------------------------------------------------------------*/

const UNCATEGORIZED = "Other";

export function PublicMarketScreen({ navigation, route }: PublicMarketProps) {
  const c = useColors();
  const { width } = useWindowDimensions();
  const { token, setPendingRoute } = useAuth();
  const queryClient = useQueryClient();
  const { marketId } = route.params;
  const scrollRef = useRef<ScrollView>(null);
  const scrollY = useRef(0);
  const catalogY = useRef(0);
  const reviewsY = useRef(0);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [selectedItemId, setSelectedItemId] = useState<number | null>(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [selectedQty, setSelectedQty] = useState(1);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewRating, setReviewRating] = useState(5);
  const [marketReviewComment, setMarketReviewComment] = useState("");
  const [marketReviewRating, setMarketReviewRating] = useState(5);
  const [cartReady, setCartReady] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);

  useEffect(() => {
    let active = true;

    async function load() {
      await setActiveMarketId(marketId);
      const nextCart = await loadCart(marketId);

      if (!active) {
        return;
      }

      setCart(nextCart);
      setCartReady(true);
    }

    void load();

    return () => {
      active = false;
    };
  }, [marketId]);

  const marketQ = useQuery({
    queryKey: ["public-market", marketId],
    queryFn: async () => (await api.get(`/api/public/markets/${marketId}`)).data as StorefrontMarket,
    enabled: !!marketId,
  });

  const itemsQ = useQuery({
    queryKey: ["public-market-items", marketId],
    queryFn: async () => (await api.get(`/api/public/markets/${marketId}/items`)).data as StorefrontItem[],
    enabled: !!marketId,
  });

  const promoQ = useQuery({
    queryKey: ["public-market-promo", marketId],
    queryFn: async () => (await api.get(`/api/public/markets/${marketId}/active-promo`)).data as PromoCode | null,
    enabled: !!marketId,
    retry: false,
  });

  const favoritesQ = useQuery({
    queryKey: ["favorites"],
    queryFn: async () => (await api.get("/api/favorites")).data as FavoritePayload,
    enabled: !!token,
    retry: false,
  });

  const reviewsQ = useQuery({
    queryKey: ["item-reviews", selectedItemId],
    queryFn: async () => (await api.get(`/api/public/items/${selectedItemId}/reviews`)).data as ReviewRecord[],
    enabled: selectedItemId != null,
  });

  const marketReviewsQ = useQuery({
    queryKey: ["market-reviews", marketId],
    queryFn: async () => (await api.get(`/api/public/markets/${marketId}/reviews`)).data as MarketReviewRecord[],
    enabled: !!marketId,
    retry: false,
  });

  const favoriteM = useMutation({
    mutationFn: async (payload: { market_id?: number; item_id?: number }) => (await api.post("/api/favorites/toggle", payload)).data,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["favorites"] });
    },
  });

  const reviewM = useMutation({
    mutationFn: async () => {
      if (!selectedItemId) {
        throw new Error("No item selected");
      }

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
  const marketIsOpen = isMarketOpen(market);
  const activePromo = promoQ.data?.is_active ? promoQ.data : market?.active_promo?.is_active ? market.active_promo : null;

  const categories = useMemo(() => {
    const source = new Set((itemsQ.data ?? []).map((item) => item.category).filter((value): value is string => typeof value === "string" && value.length > 0));
    return ["All", ...Array.from(source)];
  }, [itemsQ.data]);

  const favoriteItemIds = new Set((favoritesQ.data?.items ?? []).map((item) => item.id));
  const favoriteMarketIds = new Set((favoritesQ.data?.markets ?? []).map((entry) => entry.id));

  const filteredItems = useMemo(() => {
    const text = query.trim().toLowerCase();
    return (itemsQ.data ?? []).filter((item) => {
      const matchesText = !text || `${item.name} ${item.sku} ${item.category ?? ""}`.toLowerCase().includes(text);
      const matchesCategory = category === "All" || item.category === category;
      return matchesText && matchesCategory;
    });
  }, [category, itemsQ.data, query]);

  const groupedItems = useMemo(() => {
    const groups = new Map<string, StorefrontItem[]>();
    for (const name of categories.slice(1)) groups.set(name, []);
    for (const item of filteredItems) {
      const key = item.category || UNCATEGORIZED;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)?.push(item);
    }
    return Array.from(groups.entries()).filter(([, items]) => items.length > 0);
  }, [categories, filteredItems]);

  const totals = useMemo(() => {
    const quantity = cart.reduce((sum, item) => sum + item.qty, 0);
    const subtotal = cart.reduce((sum, item) => sum + item.qty * item.price, 0);
    return { quantity, subtotal };
  }, [cart]);

  const selectedItem = useMemo(() => (itemsQ.data ?? []).find((item) => item.id === selectedItemId) ?? null, [itemsQ.data, selectedItemId]);
  const selectedItemImageUrls = useMemo(() => getItemImageUrls(selectedItem), [selectedItem]);

  const imageById = useMemo(() => {
    const map = new Map<number, string | undefined>();
    for (const item of itemsQ.data ?? []) map.set(item.id, getItemImageUrls(item)[0]);
    return map;
  }, [itemsQ.data]);

  const marketReviewSummary = useMemo(() => {
    const reviews = marketReviewsQ.data ?? [];
    if (reviews.length === 0) {
      return { average: toNumber(market?.review_summary?.average), count: market?.review_summary?.count ?? 0 };
    }
    return {
      average: reviews.reduce((sum, review) => sum + Number(review.rating || 0), 0) / reviews.length,
      count: reviews.length,
    };
  }, [market?.review_summary, marketReviewsQ.data]);

  useEffect(() => {
    setSelectedImageIndex(0);
    setSelectedQty(1);
  }, [selectedItemId]);

  async function persistCart(nextCart: CartItem[]) {
    setCart(nextCart);
    await saveCart(marketId, nextCart);
  }

  function addToCart(item: StorefrontItem, qty = 1) {
    if (!marketIsOpen) {
      return;
    }

    const nextPrice = calcItemFinalPrice(item);
    const existing = cart.find((entry) => entry.item_id === item.id);

    if (existing) {
      void persistCart(cart.map((entry) => (entry.item_id === item.id ? { ...entry, qty: entry.qty + qty } : entry)));
      return;
    }

    void persistCart([...cart, { item_id: item.id, name: item.name, price: nextPrice, qty }]);
  }

  function adjustQty(itemId: number, delta: number) {
    void persistCart(
      cart
        .map((item) => (item.item_id === itemId ? { ...item, qty: item.qty + delta } : item))
        .filter((item) => item.qty > 0),
    );
  }

  function handleClearCart() {
    confirmClearCart(() => {
      void clearCart(marketId);
      setCart([]);
    });
  }

  function startCheckout() {
    if (!token) {
      setPendingRoute({ name: "Checkout" });
      navigation.navigate("Login");
      return;
    }

    navigation.navigate("Checkout");
  }

  function openItem(itemId: number) {
    setSelectedItemId(itemId);
    setReviewComment("");
    setReviewRating(5);
  }

  function selectCategory(next: string) {
    setCategory(next);
    if (scrollY.current > catalogY.current) {
      scrollRef.current?.scrollTo({ y: catalogY.current, animated: true });
    }
  }

  const cardWidth = Math.floor((Math.min(width, 720) - 32 - 12) / 2);
  const cartButton = <CartButton count={totals.quantity} onPress={() => setCartOpen(true)} />;

  if (marketQ.isError) {
    return (
      <Screen header={<StorefrontBar navigation={navigation} showBack actions={cartButton} />}>
        <EmptyState
          icon="storefront-outline"
          title="Market not found"
          description="This market may have been removed or is temporarily unavailable."
          action={
            <Button variant="outline" icon="arrow-back" onPress={() => navigation.navigate("PublicMarkets")}>
              Back to markets
            </Button>
          }
        />
      </Screen>
    );
  }

  return (
    <Screen
      header={<StorefrontBar navigation={navigation} showBack actions={cartButton} />}
      scroll={false}
      contentStyle={styles.noPad}
      footer={cartReady && cart.length > 0 ? <ViewCartBar totals={totals} onPress={() => setCartOpen(true)} /> : undefined}
    >
      <ScrollView
        ref={scrollRef}
        style={styles.flex}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        stickyHeaderIndices={[1]}
        scrollEventThrottle={32}
        onScroll={(event) => {
          scrollY.current = event.nativeEvent.contentOffset.y;
        }}
      >
        {/* 0: Hero */}
        <View>
          {marketQ.isLoading ? (
            <MarketHeroSkeleton />
          ) : (
            <MarketHero
              market={market}
              isOpen={marketIsOpen}
              promo={activePromo}
              itemCount={itemsQ.data?.length ?? market?.active_items_count ?? 0}
              reviewSummary={marketReviewSummary}
              onShowReviews={() => scrollRef.current?.scrollTo({ y: reviewsY.current, animated: true })}
              canFavorite={!!token && !!market?.id}
              isFavorite={favoriteMarketIds.has(Number(marketId))}
              favoritePending={favoriteM.isPending}
              onToggleFavorite={() => favoriteM.mutate({ market_id: Number(marketId) })}
            />
          )}
        </View>

        {/* 1: Sticky search + categories */}
        <View
          style={[styles.filterBar, { backgroundColor: c.background, borderBottomColor: c.border }]}
          onLayout={(event) => {
            catalogY.current = event.nativeEvent.layout.y;
          }}
        >
          <Input
            value={query}
            onChangeText={setQuery}
            placeholder={`Search ${market?.name ?? "this market"}`}
            icon="search"
            autoCapitalize="none"
            returnKeyType="search"
            right={
              query ? (
                <Pressable onPress={() => setQuery("")} accessibilityLabel="Clear search" hitSlop={8}>
                  <Ionicons name="close-circle" size={18} color={c.mutedForeground} />
                </Pressable>
              ) : undefined
            }
          />
          <ChipRow>
            {categories.map((entry) => (
              <Chip key={entry} label={entry === "All" ? "All items" : entry} selected={category === entry} onPress={() => selectCategory(entry)} />
            ))}
          </ChipRow>
          <AppText variant="caption">
            {filteredItems.length} item{filteredItems.length === 1 ? "" : "s"} · {category === "All" ? "All categories" : category}
            {query.trim() ? ` · matching “${query.trim()}”` : ""}
          </AppText>
        </View>

        {/* 2: Catalog */}
        <View style={styles.sectionLg}>
          {itemsQ.isLoading ? (
            <View style={styles.grid}>
              {[0, 1, 2, 3].map((index) => (
                <MarketProductCardSkeleton key={index} style={{ width: cardWidth }} />
              ))}
            </View>
          ) : itemsQ.isError ? (
            <Alert
              tone="destructive"
              title="Failed to load products"
              description="Please try again."
              action={
                <Button variant="outline" size="sm" onPress={() => void itemsQ.refetch()}>
                  Try again
                </Button>
              }
            />
          ) : filteredItems.length === 0 ? (
            <EmptyState
              icon="search"
              title="No products found"
              description={(itemsQ.data ?? []).length === 0 ? "This market hasn't added any products yet." : "Try a different search term or category."}
              action={
                query || category !== "All" ? (
                  <Button
                    variant="outline"
                    onPress={() => {
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
              <View key={groupName} style={styles.section}>
                <Row justify="space-between" align="baseline" gap={8}>
                  <AppText variant="heading">{groupName}</AppText>
                  <AppText variant="caption" style={styles.tabular}>
                    {items.length} item{items.length === 1 ? "" : "s"}
                  </AppText>
                </Row>
                <View style={styles.grid}>
                  {items.map((item) => (
                    <MarketProductCard
                      key={item.id}
                      item={item}
                      style={{ width: cardWidth }}
                      marketIsOpen={marketIsOpen}
                      cartQty={cart.find((entry) => entry.item_id === item.id)?.qty ?? 0}
                      canFavorite={!!token}
                      isFavorite={favoriteItemIds.has(item.id)}
                      onToggleFavorite={() => favoriteM.mutate({ item_id: item.id })}
                      onOpen={() => openItem(item.id)}
                      onAdd={() => {
                        if (itemNeedsDetails(item)) {
                          openItem(item.id);
                          return;
                        }
                        addToCart(item);
                      }}
                      onChangeQty={(delta) => adjustQty(item.id, delta)}
                    />
                  ))}
                </View>
              </View>
            ))
          )}
        </View>

        {/* 3: Reviews */}
        <View
          onLayout={(event) => {
            reviewsY.current = event.nativeEvent.layout.y;
          }}
        >
          {!marketQ.isLoading ? (
            <MarketReviewsSection
              marketName={market?.name}
              summary={marketReviewSummary}
              reviews={marketReviewsQ.data}
              isLoading={marketReviewsQ.isLoading}
              isError={marketReviewsQ.isError}
              isLoggedIn={!!token}
              rating={marketReviewRating}
              onRatingChange={setMarketReviewRating}
              comment={marketReviewComment}
              onCommentChange={setMarketReviewComment}
              error={marketReviewM.error ? getErrorMessage(marketReviewM.error, "Unable to post your market review right now.") : null}
              isPending={marketReviewM.isPending}
              onSubmit={() => marketReviewM.mutate()}
            />
          ) : null}
        </View>
      </ScrollView>

      <CartSheet
        visible={cartOpen}
        onClose={() => setCartOpen(false)}
        cart={cart}
        totals={totals}
        marketName={market?.name}
        promo={activePromo}
        onChangeQty={adjustQty}
        imageFor={(itemId) => imageById.get(itemId)}
        onCheckout={() => {
          setCartOpen(false);
          startCheckout();
        }}
        onClear={handleClearCart}
      />

      <ProductSheet
        visible={selectedItemId != null}
        onClose={() => setSelectedItemId(null)}
        item={selectedItem}
        imageUrls={selectedItemImageUrls}
        imageIndex={selectedImageIndex}
        onImageIndexChange={setSelectedImageIndex}
        quantity={selectedQty}
        onQuantityChange={setSelectedQty}
        cartQty={selectedItem ? cart.find((entry) => entry.item_id === selectedItem.id)?.qty ?? 0 : 0}
        marketIsOpen={marketIsOpen}
        onAddToCart={() => {
          if (!selectedItem) return;
          addToCart(selectedItem, selectedQty);
          setSelectedItemId(null);
        }}
        reviews={reviewsQ.data}
        reviewsLoading={reviewsQ.isLoading}
        isLoggedIn={!!token}
        reviewRating={reviewRating}
        onReviewRatingChange={setReviewRating}
        reviewComment={reviewComment}
        onReviewCommentChange={setReviewComment}
        reviewError={reviewM.error ? getErrorMessage(reviewM.error, "Unable to post your item review right now.") : null}
        reviewPending={reviewM.isPending}
        onSubmitReview={() => reviewM.mutate()}
      />
    </Screen>
  );
}

/* -------------------------------------------------------------------------------------------------
 * Login
 * -----------------------------------------------------------------------------------------------*/

const LOGIN_HIGHLIGHTS = [
  { title: "Customers", text: "Browse markets, place orders and track deliveries live." },
  { title: "Market owners", text: "Manage your market, catalog, promo codes and incoming orders." },
  { title: "Drivers & admins", text: "Pick up deliveries, oversee users, roles and operations." },
];

export function LoginScreen({ navigation, route }: LoginProps) {
  const c = useColors();
  const { language, setLanguage } = usePreferences();
  const { pendingRoute, setPendingRoute, signIn } = useAuth();
  const [mode, setMode] = useState<"login" | "register">(route.params?.mode ?? "login");
  const [email, setEmail] = useState("admin@test.com");
  const [password, setPassword] = useState("123456");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");

  const authMutation = useMutation({
    mutationFn: async () => {
      if (mode === "login") {
        return (await api.post("/api/login", { email, password })).data;
      }

      return (
        await api.post("/api/register", {
          name,
          email,
          phone: phone.trim() || null,
          address: address.trim() || null,
          language,
          password,
          password_confirmation: passwordConfirmation,
        })
      ).data;
    },
    onSuccess: async (data) => {
      await signIn(data.token);
      const roles = normalizeRoles(data?.user?.roles ?? (mode === "register" ? ["customer"] : []));
      const target = pendingRoute ?? { name: getDefaultAuthedRoute(roles) };
      setPendingRoute(null);
      navigation.reset({
        index: 0,
        routes: [{ name: target.name as keyof RootStackParamList, params: target.params as never }],
      });
    },
  });

  useEffect(() => {
    if (route.params?.mode) {
      setMode(route.params.mode);
    }
  }, [route.params?.mode]);

  const switchMode = (next: "login" | "register") => {
    setMode(next);
    authMutation.reset();
  };

  return (
    <Screen header={<StorefrontBar navigation={navigation} showBack showAccount={false} />}>
      <View style={styles.gap8}>
        <AppText variant="title">Order, deliver and manage, all in one place.</AppText>
        <AppText variant="muted">Customers place orders, owners run their markets, drivers deliver and admins keep everything moving.</AppText>
      </View>

      <Card
        title={mode === "login" ? "Welcome back" : "Create your account"}
        description={mode === "login" ? "Sign in with your email and password to continue." : "New accounts are created as customer accounts by default."}
      >
        <SegmentedControl
          value={mode}
          onChange={switchMode}
          options={[
            { value: "login", label: "Sign in" },
            { value: "register", label: "Register" },
          ]}
        />

        {mode === "register" ? <Input label="Full name" value={name} onChangeText={setName} placeholder="Your name" icon="person-outline" /> : null}
        <Input
          label="Email"
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
          icon="mail-outline"
        />
        {mode === "register" ? (
          <>
            <Input label="Phone" value={phone} onChangeText={setPhone} placeholder="Optional" keyboardType="phone-pad" icon="call-outline" />
            <Input
              label="Address"
              value={address}
              onChangeText={setAddress}
              placeholder="Optional"
              icon="location-outline"
              helper="Saved to speed up checkout. You can change them later."
            />
          </>
        ) : null}
        <Input
          label="Password"
          value={password}
          onChangeText={setPassword}
          placeholder="Enter your password"
          secureTextEntry
          autoCapitalize="none"
          icon="lock-closed-outline"
          returnKeyType={mode === "login" ? "go" : "next"}
          onSubmitEditing={mode === "login" ? () => authMutation.mutate() : undefined}
        />
        {mode === "register" ? (
          <Input
            label="Confirm password"
            value={passwordConfirmation}
            onChangeText={setPasswordConfirmation}
            placeholder="Confirm password"
            secureTextEntry
            autoCapitalize="none"
            icon="lock-closed-outline"
          />
        ) : null}

        <View style={styles.gap6}>
          <Label>Language</Label>
          <SegmentedControl
            value={language}
            onChange={(next) => void setLanguage(next)}
            options={[
              { value: "en", label: "English" },
              { value: "ka", label: "Georgian" },
            ]}
          />
        </View>

        {authMutation.error ? (
          <Alert tone="destructive" title={getErrorMessage(authMutation.error, mode === "login" ? "Login failed" : "Registration failed")} />
        ) : null}

        <Button size="lg" fullWidth loading={authMutation.isPending} iconRight={authMutation.isPending ? undefined : "arrow-forward"} onPress={() => authMutation.mutate()}>
          {authMutation.isPending ? (mode === "login" ? "Signing in..." : "Creating account...") : mode === "login" ? "Continue" : "Create account"}
        </Button>

        <Row justify="center" gap={4} wrap>
          <AppText variant="small" tone="muted">
            {mode === "login" ? "New to Smart Dispatch?" : "Already have an account?"}
          </AppText>
          <Button variant="link" size="sm" style={styles.inlineLink} onPress={() => switchMode(mode === "login" ? "register" : "login")}>
            {mode === "login" ? "Create an account" : "Sign in"}
          </Button>
        </Row>

        <View style={styles.gap6}>
          {LOGIN_HIGHLIGHTS.map((item) => (
            <Row key={item.title} gap={8} align="flex-start">
              <Ionicons name="checkmark" size={14} color={c.primary} style={styles.mt2} />
              <AppText variant="caption" style={styles.flex}>
                <Text style={[styles.medium, { color: c.foreground }]}>{item.title}:</Text> {item.text}
              </AppText>
            </Row>
          ))}
        </View>
      </Card>

      <Row justify="center" gap={6}>
        <Ionicons name="shield-checkmark-outline" size={14} color={c.mutedForeground} />
        <AppText variant="caption">Secure sign-in for every role</AppText>
      </Row>

      <Button variant="ghost" icon="arrow-back" onPress={() => navigation.navigate("PublicMarkets")}>
        Back to markets
      </Button>
    </Screen>
  );
}

/* -------------------------------------------------------------------------------------------------
 * Checkout
 * -----------------------------------------------------------------------------------------------*/

function StepCard({ step, title, description, right, children }: { step: number; title: string; description: string; right?: ReactNode; children: ReactNode }) {
  const c = useColors();
  return (
    <Card>
      <Row gap={12} align="flex-start">
        <View style={[styles.stepBadge, { backgroundColor: c.primary }]}>
          <Text style={[styles.stepBadgeText, { color: c.primaryForeground }]}>{step}</Text>
        </View>
        <View style={styles.flex}>
          <AppText variant="heading">{title}</AppText>
          <AppText variant="small" tone="muted" style={styles.mt2}>
            {description}
          </AppText>
        </View>
        {right}
      </Row>
      {children}
    </Card>
  );
}

export function CheckoutScreen({ navigation }: CheckoutProps) {
  const access = useProtectedAccess("Checkout");
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { language } = usePreferences();
  const [marketId, setMarketIdState] = useState("");
  const [cartLoaded, setCartLoaded] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [dropoffLat, setDropoffLat] = useState("41.7151");
  const [dropoffLng, setDropoffLng] = useState("44.8271");
  const [priority, setPriority] = useState("2");
  const [promoCode, setPromoCode] = useState("");
  const [notes, setNotes] = useState("");
  const [deliverySlot, setDeliverySlot] = useState("");
  const [summaryOpen, setSummaryOpen] = useState(false);

  useEffect(() => {
    let active = true;

    async function load() {
      const activeMarketId = await getActiveMarketId();
      const nextCart = activeMarketId ? await loadCart(activeMarketId) : [];

      if (!active) {
        return;
      }

      setMarketIdState(activeMarketId);
      setCart(nextCart);
      setCartLoaded(true);
    }

    void load();

    return () => {
      active = false;
    };
  }, []);

  const marketQ = useQuery({
    queryKey: ["checkout-market", marketId],
    queryFn: async () => (await api.get(`/api/public/markets/${marketId}`)).data as CheckoutMarket,
    enabled: !!marketId,
    retry: false,
  });

  const totals = useMemo(() => {
    const items = cart.reduce((sum, item) => sum + item.qty, 0);
    const subtotal = cart.reduce((sum, item) => sum + item.qty * item.price, 0);
    return { items, subtotal };
  }, [cart]);

  const effectiveCustomerName = customerName || access.me?.name || "";
  const effectiveCustomerPhone = customerPhone || access.me?.phone || "";
  const effectiveCustomerAddress = customerAddress || access.me?.address || "";

  useEffect(() => {
    if (access.me?.phone && !customerPhone) {
      setCustomerPhone(access.me.phone);
    }
  }, [access.me?.phone, customerPhone]);

  useEffect(() => {
    if (access.me?.address && !customerAddress) {
      setCustomerAddress(access.me.address);
    }
  }, [access.me?.address, customerAddress]);

  const createOrderM = useMutation({
    mutationFn: async () => {
      if (!cart.length) {
        throw new Error("Your cart is empty. Add items before placing an order.");
      }

      if (!marketId) {
        throw new Error("No market selected.");
      }

      return (
        await api.post("/api/orders", {
          market_id: Number(marketId),
          customer_name: effectiveCustomerName.trim(),
          customer_phone: effectiveCustomerPhone.trim(),
          dropoff_address: effectiveCustomerAddress.trim(),
          dropoff_lat: toNumber(dropoffLat),
          dropoff_lng: toNumber(dropoffLng),
          priority: toNumber(priority, 2),
          size: Math.max(totals.items, 1),
          promo_code: promoCode.trim() || null,
          notes: notes.trim() || null,
          ...(deliverySlot
            ? {
                time_window_start: deliverySlot.split("|")[1],
                time_window_end: deliverySlot.split("|")[2],
              }
            : {}),
          items: cart.map((item) => ({
            item_id: item.item_id,
            name: item.name,
            qty: item.qty,
            price: item.price,
          })),
        })
      ).data;
    },
    onSuccess: async () => {
      if (marketId) {
        await clearCart(marketId);
      }
      navigation.reset({
        index: 0,
        routes: [{ name: "Orders" }],
      });
    },
  });

  async function adjustQty(itemId: number, delta: number) {
    const nextCart = cart
      .map((item) => (item.item_id === itemId ? { ...item, qty: item.qty + delta } : item))
      .filter((item) => item.qty > 0);

    setCart(nextCart);

    if (marketId) {
      await saveCart(marketId, nextCart);
    }
  }

  if (!access.ready) {
    return access.fallback;
  }

  const canSubmit =
    cart.length > 0 &&
    !!marketId &&
    effectiveCustomerName.trim().length >= 2 &&
    effectiveCustomerPhone.trim().length >= 6 &&
    effectiveCustomerAddress.trim().length >= 5 &&
    Number.isFinite(Number(dropoffLat)) &&
    Number.isFinite(Number(dropoffLng));

  const missing: string[] = [];
  if (effectiveCustomerName.trim().length < 2) missing.push("your name (at least 2 characters)");
  if (effectiveCustomerPhone.trim().length < 6) missing.push("a phone number (at least 6 digits)");
  if (effectiveCustomerAddress.trim().length < 5) missing.push("a delivery address (at least 5 characters)");
  if (!Number.isFinite(Number(dropoffLat)) || !Number.isFinite(Number(dropoffLng))) missing.push("valid map coordinates");

  const marketName = marketQ.data?.name || (marketId ? `Market #${marketId}` : "Select a market");
  const deliverySlots = marketQ.data?.delivery_slots ?? [];
  const hasCart = !!marketId && cart.length > 0;
  const backToMarket = () => (marketId ? navigation.navigate("PublicMarket", { marketId }) : navigation.navigate("PublicMarkets"));
  const totalLabel = formatMoney(totals.subtotal, language);

  const totalsRows = (
    <View style={styles.gap8}>
      <SummaryRow label={`Subtotal (${totals.items} ${totals.items === 1 ? "item" : "items"})`} value={totalLabel} />
      <SummaryRow
        label={promoCode.trim() ? `Discount (${promoCode.trim().toUpperCase()})` : "Discount"}
        value={promoCode.trim() ? "Applied when placed" : formatMoney(0, language)}
        valueTone={promoCode.trim() ? "muted" : undefined}
      />
      <SummaryRow label="Delivery" value="Calculated by dispatch" valueTone="muted" />
      <Separator style={styles.sepTight} />
      <SummaryRow label="Total" value={totalLabel} strong />
    </View>
  );

  const marketBlock = (
    <Row gap={12}>
      <View style={[styles.stepIcon, { backgroundColor: withAlpha(c.primary, 0.1) }]}>
        <Ionicons name="storefront-outline" size={20} color={c.primary} />
      </View>
      <View style={styles.flex}>
        <AppText variant="label" numberOfLines={1} style={styles.semibold}>
          {marketName}
        </AppText>
        {marketQ.data?.address ? (
          <Row gap={4}>
            <Ionicons name="location-outline" size={12} color={c.mutedForeground} />
            <AppText variant="caption" numberOfLines={1} style={styles.flex}>
              {marketQ.data.address}
            </AppText>
          </Row>
        ) : null}
      </View>
    </Row>
  );

  return (
    <Screen
      header={<StorefrontBar navigation={navigation} showBack />}
      footer={
        hasCart ? (
          <View style={[styles.checkoutFooter, { backgroundColor: c.background, borderTopColor: c.border, paddingBottom: Math.max(insets.bottom, 12) }]}>
            <Row justify="space-between" gap={12}>
              <AppText variant="small" tone="muted">
                Total · {totals.items} {totals.items === 1 ? "item" : "items"}
              </AppText>
              <AppText variant="heading" style={styles.tabular}>
                {totalLabel}
              </AppText>
            </Row>
            <Button size="lg" fullWidth onPress={() => createOrderM.mutate()} disabled={!canSubmit} loading={createOrderM.isPending}>
              {createOrderM.isPending ? "Placing order..." : `Place order · ${totalLabel}`}
            </Button>
          </View>
        ) : undefined
      }
    >
      <View style={styles.backRow}>
        <Button variant="ghost" size="sm" icon="arrow-back" onPress={backToMarket}>
          {marketId ? "Back to market" : "Back to markets"}
        </Button>
      </View>

      <PageHeader
        title="Checkout"
        description="Confirm where to deliver, choose your options, and place your order."
        actions={hasCart ? <Badge icon="shield-checkmark-outline">Secure checkout</Badge> : undefined}
      />

      {!cartLoaded ? (
        <LoadingBlock message="Loading your cart..." rows={3} />
      ) : !marketId ? (
        <EmptyState
          icon="storefront-outline"
          title="No market selected"
          description="Start from a market to build a cart before checking out."
          action={<Button onPress={() => navigation.navigate("PublicMarkets")}>Browse markets</Button>}
        />
      ) : cart.length === 0 ? (
        <EmptyState
          icon="bag-handle-outline"
          title="Your cart is empty"
          description="Add items from a market before placing an order."
          action={
            <View style={styles.emptyActions}>
              <Button onPress={backToMarket}>{`Back to ${marketQ.data?.name ?? "market"}`}</Button>
              <Button variant="outline" onPress={() => navigation.navigate("PublicMarkets")}>
                Browse markets
              </Button>
            </View>
          }
        />
      ) : (
        <>
          {/* Collapsible order summary */}
          <Card padded={false}>
            <Pressable
              onPress={() => setSummaryOpen((open) => !open)}
              accessibilityRole="button"
              accessibilityState={{ expanded: summaryOpen }}
              style={styles.summaryToggle}
            >
              <Row gap={8} style={styles.flex}>
                <Ionicons name="bag-handle-outline" size={16} color={c.mutedForeground} />
                <AppText variant="label" numberOfLines={1} style={styles.flexShrink}>
                  Order summary · {totals.items} {totals.items === 1 ? "item" : "items"}
                </AppText>
                <Ionicons name={summaryOpen ? "chevron-up" : "chevron-down"} size={16} color={c.mutedForeground} />
              </Row>
              <AppText variant="label" style={[styles.semibold, styles.tabular]}>
                {totalLabel}
              </AppText>
            </Pressable>
            {summaryOpen ? (
              <View style={[styles.summaryBody, { borderTopColor: c.border }]}>
                {marketBlock}
                {cart.map((item) => (
                  <Row key={item.item_id} gap={12} justify="space-between">
                    <View style={styles.flex}>
                      <AppText variant="label" numberOfLines={1}>
                        {item.name}
                      </AppText>
                      <AppText variant="caption" style={styles.tabular}>
                        {item.qty} × {formatMoney(item.price, language)}
                      </AppText>
                    </View>
                    <AppText variant="label" style={styles.tabular}>
                      {formatMoney(item.price * item.qty, language)}
                    </AppText>
                  </Row>
                ))}
                <Separator />
                {totalsRows}
              </View>
            ) : null}
          </Card>

          {/* Step 1 */}
          <StepCard step={1} title="Delivery details" description="Who receives the order and where we should bring it.">
            <Input
              label="Full name"
              value={effectiveCustomerName}
              onChangeText={setCustomerName}
              placeholder="Your name"
              icon="person-outline"
              error={effectiveCustomerName.trim().length > 0 && effectiveCustomerName.trim().length < 2 ? "At least 2 characters" : null}
            />
            <Input label="Email" value={access.me?.email || ""} onChangeText={() => {}} editable={false} placeholder="Not signed in" icon="mail-outline" />
            <Input
              label="Phone"
              value={effectiveCustomerPhone}
              onChangeText={setCustomerPhone}
              placeholder="Phone number"
              keyboardType="phone-pad"
              icon="call-outline"
              helper="The driver will call this number if they need help finding you."
              error={effectiveCustomerPhone.trim().length > 0 && effectiveCustomerPhone.trim().length < 6 ? "At least 6 digits" : null}
            />
            <Input
              label="Delivery address"
              value={effectiveCustomerAddress}
              onChangeText={setCustomerAddress}
              placeholder="Street, building, apartment"
              icon="home-outline"
              multiline
              error={effectiveCustomerAddress.trim().length > 0 && effectiveCustomerAddress.trim().length < 5 ? "At least 5 characters" : null}
            />
            <Panel>
              <Row gap={6}>
                <Ionicons name="location-outline" size={16} color={c.mutedForeground} />
                <AppText variant="label">Drop-off location</AppText>
              </Row>
              <Row gap={10} align="flex-start">
                <View style={styles.flex}>
                  <Input
                    label="Latitude"
                    value={dropoffLat}
                    onChangeText={setDropoffLat}
                    placeholder="41.7151"
                    keyboardType="numeric"
                    error={!Number.isFinite(Number(dropoffLat)) ? "Invalid" : null}
                  />
                </View>
                <View style={styles.flex}>
                  <Input
                    label="Longitude"
                    value={dropoffLng}
                    onChangeText={setDropoffLng}
                    placeholder="44.8271"
                    keyboardType="numeric"
                    error={!Number.isFinite(Number(dropoffLng)) ? "Invalid" : null}
                  />
                </View>
              </Row>
              <AppText variant="caption">Used to route the driver. Leave the defaults if you are not sure.</AppText>
            </Panel>
            <Input label="Delivery notes" value={notes} onChangeText={setNotes} placeholder="Apartment, gate code, or handoff notes" multiline helper="Optional." />
          </StepCard>

          {/* Step 2 */}
          <StepCard step={2} title="Delivery options" description="Pick a delivery time and how urgent the order is.">
            {deliverySlots.length > 0 ? (
              <View style={styles.gap8}>
                <Label>Delivery slot</Label>
                {deliverySlots.map((slot, index) => {
                  const label = typeof slot === "string" ? slot : slot.label || formatDeliverySlot(slot);
                  const value = typeof slot === "string" ? `${slot}|${slot}|${slot}` : `${label}|${slot.from}|${slot.to}`;
                  return <OptionCard key={`${label}-${index}`} selected={deliverySlot === value} onPress={() => setDeliverySlot(value)} title={label} icon="time-outline" />;
                })}
                <AppText variant="caption">
                  {deliverySlot ? "You can change the slot any time before placing the order." : "No slot selected: we will deliver as soon as possible."}
                </AppText>
              </View>
            ) : (
              <Panel style={styles.rowPanel}>
                <Ionicons name="time-outline" size={16} color={c.mutedForeground} />
                <AppText variant="small" tone="muted" style={styles.flex}>
                  This market delivers as soon as possible. No time slots to choose.
                </AppText>
              </Panel>
            )}
            <Input label="Priority" value={priority} onChangeText={setPriority} placeholder="2" keyboardType="numeric" helper="Dispatch priority level. The default is 2." />
          </StepCard>

          {/* Step 3 */}
          <StepCard
            step={3}
            title="Review items"
            description="Adjust quantities before you place the order."
            right={
              <Button
                variant="ghost"
                size="sm"
                icon="trash-outline"
                onPress={() =>
                  confirmClearCart(() => {
                    void clearCart(marketId);
                    setCart([]);
                  })
                }
              >
                Clear
              </Button>
            }
          >
            <View style={[styles.itemsBox, { borderColor: c.border }]}>
              <CartLines cart={cart} onChangeQty={(itemId, delta) => void adjustQty(itemId, delta)} />
            </View>
          </StepCard>

          {/* Step 4 */}
          <StepCard step={4} title="Promo code" description="Have a code from this market? It is checked when you place the order.">
            <Input
              label="Promo code"
              value={promoCode}
              onChangeText={setPromoCode}
              placeholder="Optional"
              icon="ticket-outline"
              autoCapitalize="characters"
              helper={promoCode.trim() ? "The discount is applied by the market when the order is created." : undefined}
            />
          </StepCard>

          {/* Summary */}
          <Card title="Order summary" description={`${totals.items} ${totals.items === 1 ? "item" : "items"} from one market`}>
            {marketBlock}
            <Separator />
            {totalsRows}
            {!canSubmit && missing.length > 0 ? (
              <Alert tone="warning" title="Almost there" description={`To place the order, please add ${missing.join(", ")}.`} />
            ) : null}
            {createOrderM.error ? <Alert tone="destructive" title="Could not place the order" description={getErrorMessage(createOrderM.error)} /> : null}
            <Row gap={8} align="flex-start">
              <Ionicons name="shield-checkmark-outline" size={16} color={c.success} />
              <AppText variant="caption" style={styles.flex}>
                Your order goes straight to the market and our live dispatch team as soon as it is placed.
              </AppText>
            </Row>
          </Card>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  flexShrink: { flexShrink: 1 },
  mt2: { marginTop: 2 },
  gap6: { gap: 6 },
  gap8: { gap: 8 },
  medium: { fontWeight: "500" },
  semibold: { fontWeight: "600" },
  tabular: { fontVariant: ["tabular-nums"] },
  noPad: { paddingHorizontal: 0, paddingTop: 0, paddingBottom: 0, gap: 0 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 32, gap: 24 },
  bleed: { marginHorizontal: -16 },
  railContent: { paddingHorizontal: 16, gap: 12 },
  railMarket: { width: RAIL_MARKET_WIDTH },
  railProduct: { width: RAIL_PRODUCT_WIDTH },
  section: { gap: 12 },
  sectionLg: { gap: 20 },
  homeIntro: { gap: 6, paddingTop: 8 },
  hero: { borderWidth: 1, borderRadius: radius.xl, paddingHorizontal: 18, paddingVertical: 22, gap: 16 },
  heroStatValue: { fontSize: 18, fontWeight: "600", fontVariant: ["tabular-nums"] },
  stepIcon: { width: 40, height: 40, borderRadius: radius.lg, alignItems: "center", justifyContent: "center" },
  inlineLink: { paddingHorizontal: 0, height: 28 },
  footerBlock: { borderTopWidth: StyleSheet.hairlineWidth * 2, paddingTop: 20, gap: 8 },
  filterBar: { marginHorizontal: -16, paddingHorizontal: 16, paddingVertical: 10, gap: 10, borderBottomWidth: StyleSheet.hairlineWidth * 2 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  stepBadge: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  stepBadgeText: { fontSize: 12, fontWeight: "600", fontVariant: ["tabular-nums"] },
  checkoutFooter: { borderTopWidth: StyleSheet.hairlineWidth * 2, paddingHorizontal: 16, paddingTop: 10, gap: 8 },
  backRow: { alignItems: "flex-start", marginLeft: -8, marginBottom: -8 },
  emptyActions: { gap: 8, alignItems: "center" },
  summaryToggle: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, paddingHorizontal: 16, minHeight: 52 },
  summaryBody: { borderTopWidth: StyleSheet.hairlineWidth * 2, padding: 16, gap: 12 },
  sepTight: { marginVertical: 2 },
  rowPanel: { flexDirection: "row", alignItems: "center", gap: 8 },
  itemsBox: { borderWidth: 1, borderRadius: radius.lg, padding: 12 },
});
