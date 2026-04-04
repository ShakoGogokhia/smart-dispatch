import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import { AppButton, EmptyBlock, HelperText, HeroCard, InputField, LoadingBlock, Pill, Screen, SectionCard, StatCard, StatGrid, uiStyles } from "@/src/components/ui";
import { getErrorMessage } from "@/src/lib/errors";
import { api } from "@/src/lib/api";
import { formatMoney, toNumber } from "@/src/lib/format";
import { getDefaultAuthedRoute, normalizeRoles } from "@/src/lib/session";
import { clearCart, getActiveMarketId, loadCart, saveCart, setActiveMarketId } from "@/src/lib/storage";
import type { CartItem } from "@/src/lib/storage";
import { useProtectedAccess } from "@/src/hooks/use-protected-access";
import { useAuth, usePreferences } from "@/src/providers/app-providers";
import type { FavoritePayload, Item, MarketLite, PromoCode, ReviewRecord } from "@/src/types/api";
import type { RootStackParamList } from "@/src/types/navigation";

type PublicMarketsProps = NativeStackScreenProps<RootStackParamList, "PublicMarkets">;
type PublicMarketProps = NativeStackScreenProps<RootStackParamList, "PublicMarket">;
type LoginProps = NativeStackScreenProps<RootStackParamList, "Login">;
type CheckoutProps = NativeStackScreenProps<RootStackParamList, "Checkout">;
type HomeProps = NativeStackScreenProps<RootStackParamList, "Home">;

type CheckoutMarket = MarketLite;

function calcItemFinalPrice(item: Item) {
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
            const apiOrigin = new URL(api.defaults.baseURL ?? "http://127.0.0.1:8000").origin;
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

function getMarketBannerUrl(market?: MarketLite | null) {
  if (!market) {
    return null;
  }

  return (
    resolveMarketMediaUrl(market.banner_url) ??
    resolveMarketMediaUrl(market.image_url) ??
    resolveMarketMediaUrl(market.logo_url)
  );
}

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
    <Screen>
      <HeroCard eyebrow="Smart Dispatch" title="Opening your workspace" subtitle="Routing you into the correct customer, staff, or driver flow.">
        <LoadingBlock message={ready ? "Checking your session..." : "Preparing the app..."} />
      </HeroCard>
    </Screen>
  );
}

export function PublicMarketsScreen({ navigation }: PublicMarketsProps) {
  const { language, setLanguage, theme, toggleTheme } = usePreferences();

  const marketsQ = useQuery({
    queryKey: ["public-markets"],
    queryFn: async () => (await api.get("/api/public/markets")).data as MarketLite[],
  });

  const markets = marketsQ.data ?? [];
  const activeMarkets = markets.filter((market) => market.is_active).length;

  return (
    <Screen>
      <HeroCard
        eyebrow="Mobile Commerce"
        title="Smart Dispatch"
        subtitle="Browse live markets, build a cart, and move from storefront to dispatch on the same backend as the web app."
      >
        <View style={styles.heroActions}>
          <AppButton
            onPress={() => {
              if (markets[0]) {
                navigation.navigate("PublicMarket", { marketId: String(markets[0].id) });
                return;
              }

              navigation.navigate("PublicMarkets");
            }}
          >
            Open a market
          </AppButton>
          <AppButton variant="secondary" onPress={() => navigation.navigate("Login")}>
            Staff login
          </AppButton>
        </View>

        <View style={styles.preferenceRow}>
          <AppButton variant={language === "en" ? "primary" : "secondary"} compact onPress={() => void setLanguage("en")}>
            English
          </AppButton>
          <AppButton variant={language === "ka" ? "primary" : "secondary"} compact onPress={() => void setLanguage("ka")}>
            Georgian
          </AppButton>
          <AppButton variant="secondary" compact onPress={() => void toggleTheme()}>
            Theme: {theme}
          </AppButton>
        </View>
      </HeroCard>

      <StatGrid>
        <StatCard label="Available markets" value={markets.length} note="Public storefronts use the same backend data as the web app." />
        <StatCard label="Open now" value={activeMarkets} note="Markets currently marked active." />
      </StatGrid>

      {marketsQ.isLoading ? (
        <LoadingBlock message="Loading markets..." />
      ) : marketsQ.isError ? (
        <EmptyBlock message={`Could not load markets from ${api.defaults.baseURL}.`} actionLabel="Retry" onAction={() => void marketsQ.refetch()} />
      ) : (
        <View style={uiStyles.listGap}>
          {markets.map((market) => (
            <SectionCard
              key={market.id}
              title={market.name}
              subtitle={market.address || "Address coming soon"}
              right={<Pill tone={market.is_active ? "success" : "warning"}>{market.is_active ? "Open" : "Closed"}</Pill>}
            >
              {getMarketBannerUrl(market) ? <Image source={getMarketBannerUrl(market)} style={styles.marketHeroImage} contentFit="cover" /> : null}
              {resolveMarketMediaUrl(market.logo_url) ? <Image source={resolveMarketMediaUrl(market.logo_url)} style={styles.marketLogoImage} contentFit="cover" /> : null}
              <HelperText>{market.code}</HelperText>
              <AppButton onPress={() => navigation.navigate("PublicMarket", { marketId: String(market.id) })}>
                Open market
              </AppButton>
            </SectionCard>
          ))}
        </View>
      )}
    </Screen>
  );
}

export function PublicMarketScreen({ navigation, route }: PublicMarketProps) {
  const { token, setPendingRoute } = useAuth();
  const { language } = usePreferences();
  const queryClient = useQueryClient();
  const { marketId } = route.params;
  const [cart, setCart] = useState<CartItem[]>([]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [selectedItemId, setSelectedItemId] = useState<number | null>(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [reviewComment, setReviewComment] = useState("");
  const [cartReady, setCartReady] = useState(false);

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
    queryFn: async () => (await api.get(`/api/public/markets/${marketId}`)).data as MarketLite,
    enabled: !!marketId,
  });

  const itemsQ = useQuery({
    queryKey: ["public-market-items", marketId],
    queryFn: async () => (await api.get(`/api/public/markets/${marketId}/items`)).data as Item[],
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
          rating: 5,
          comment: reviewComment || null,
        })
      ).data;
    },
    onSuccess: async () => {
      setReviewComment("");
      await queryClient.invalidateQueries({ queryKey: ["item-reviews", selectedItemId] });
      await queryClient.invalidateQueries({ queryKey: ["public-market-items", marketId] });
    },
  });

  const categories = useMemo(() => {
    const source = new Set((itemsQ.data ?? []).map((item) => item.category).filter((value): value is string => typeof value === "string" && value.length > 0));
    return ["All", ...Array.from(source)];
  }, [itemsQ.data]);

  const favoriteItemIds = new Set((favoritesQ.data?.items ?? []).map((item) => item.id));
  const favoriteMarketIds = new Set((favoritesQ.data?.markets ?? []).map((entry) => entry.id));

  const filteredItems = useMemo(() => {
    const text = query.trim().toLowerCase();
    const items = itemsQ.data ?? [];

    return items.filter((item) => {
      const matchesText = !text || item.name.toLowerCase().includes(text) || item.sku.toLowerCase().includes(text);
      const matchesCategory = category === "All" || item.category === category;
      return matchesText && matchesCategory;
    });
  }, [category, itemsQ.data, query]);

  const totals = useMemo(() => {
    const quantity = cart.reduce((sum, item) => sum + item.qty, 0);
    const subtotal = cart.reduce((sum, item) => sum + item.qty * item.price, 0);
    return { quantity, subtotal };
  }, [cart]);

  const selectedItem = useMemo(
    () => (itemsQ.data ?? []).find((item) => item.id === selectedItemId) ?? null,
    [itemsQ.data, selectedItemId],
  );

  const selectedItemImageUrls = useMemo(() => getItemImageUrls(selectedItem), [selectedItem]);

  useEffect(() => {
    setSelectedImageIndex(0);
  }, [selectedItemId]);

  async function persistCart(nextCart: CartItem[]) {
    setCart(nextCart);
    await saveCart(marketId, nextCart);
  }

  function addToCart(item: Item) {
    const nextPrice = calcItemFinalPrice(item);
    const existing = cart.find((entry) => entry.item_id === item.id);

    if (existing) {
      void persistCart(cart.map((entry) => (entry.item_id === item.id ? { ...entry, qty: entry.qty + 1 } : entry)));
      return;
    }

    void persistCart([...cart, { item_id: item.id, name: item.name, price: nextPrice, qty: 1 }]);
  }

  function adjustQty(itemId: number, delta: number) {
    void persistCart(
      cart
        .map((item) => (item.item_id === itemId ? { ...item, qty: item.qty + delta } : item))
        .filter((item) => item.qty > 0),
    );
  }

  function startCheckout() {
    if (!token) {
      setPendingRoute({ name: "Checkout" });
      navigation.navigate("Login");
      return;
    }

    navigation.navigate("Checkout");
  }

  return (
    <Screen>
      <SectionCard title={marketQ.data?.name || `Market #${marketId}`} subtitle={marketQ.data?.address || "No address set yet."}>
        {getMarketBannerUrl(marketQ.data) ? <Image source={getMarketBannerUrl(marketQ.data)} style={styles.marketHeroImage} contentFit="cover" /> : null}
        {resolveMarketMediaUrl(marketQ.data?.logo_url) ? <Image source={resolveMarketMediaUrl(marketQ.data?.logo_url)} style={styles.marketLogoImageLarge} contentFit="cover" /> : null}
        <View style={styles.heroActions}>
          <AppButton variant="secondary" onPress={() => navigation.goBack()}>
            Back
          </AppButton>
          <Pill tone={marketQ.data?.is_active === false ? "warning" : "success"}>
            {marketQ.data?.is_active === false ? "Unavailable" : "Open for orders"}
          </Pill>
          {token ? (
            <AppButton compact variant="secondary" onPress={() => favoriteM.mutate({ market_id: Number(marketId) })}>
              {favoriteMarketIds.has(Number(marketId)) ? "Favorited" : "Favorite"}
            </AppButton>
          ) : null}
        </View>

        {promoQ.data?.is_active ? (
          <HelperText tone="success">
            Active promo: {promoQ.data.code} ({promoQ.data.type === "percent" ? `${toNumber(promoQ.data.value)}%` : formatMoney(promoQ.data.value, language)})
          </HelperText>
        ) : null}

        {(marketQ.data?.delivery_slots ?? []).length ? (
          <HelperText>
            Delivery slots: {(marketQ.data?.delivery_slots ?? []).map((slot: any) => typeof slot === "string" ? slot : slot.label || `${slot.from}-${slot.to}`).join(", ")}
          </HelperText>
        ) : null}

        <InputField label="Search items" value={query} onChangeText={setQuery} placeholder="Search by name or SKU" />

        <HelperText>Categories</HelperText>
        <View style={styles.filterRow}>
          {categories.map((entry) => (
            <Pressable key={entry} onPress={() => setCategory(entry)} style={[styles.filterChip, category === entry && styles.filterChipActive]}>
              <Text style={styles.filterChipText}>{entry}</Text>
            </Pressable>
          ))}
        </View>
      </SectionCard>

      <SectionCard title="Cart" subtitle="Stored per market so checkout can continue later.">
        <StatGrid>
          <StatCard label="Items" value={totals.quantity} />
          <StatCard label="Subtotal" value={formatMoney(totals.subtotal, language)} />
        </StatGrid>
        <View style={styles.heroActions}>
          <AppButton onPress={startCheckout} disabled={!totals.quantity}>
            Continue to checkout
          </AppButton>
          <AppButton
            variant="secondary"
            disabled={!totals.quantity}
            onPress={() => {
              void clearCart(marketId);
              setCart([]);
            }}
          >
            Clear cart
          </AppButton>
        </View>

        {cartReady && cart.length > 0 ? (
          <View style={uiStyles.listGap}>
            {cart.map((item) => (
              <SectionCard key={item.item_id} title={item.name} subtitle={`${item.qty} x ${formatMoney(item.price, language)}`}>
                <View style={styles.heroActions}>
                  <AppButton variant="secondary" compact onPress={() => adjustQty(item.item_id, -1)}>
                    -
                  </AppButton>
                  <AppButton variant="secondary" compact onPress={() => adjustQty(item.item_id, 1)}>
                    +
                  </AppButton>
                </View>
              </SectionCard>
            ))}
          </View>
        ) : (
          <HelperText>{cartReady ? "Your cart is empty." : "Loading cart..."}</HelperText>
        )}
      </SectionCard>

      {itemsQ.isLoading ? (
        <LoadingBlock message="Loading catalog..." />
      ) : itemsQ.isError ? (
        <EmptyBlock message="Could not load items." />
      ) : filteredItems.length === 0 ? (
        <EmptyBlock message="No items matched your search." />
      ) : (
        <View style={uiStyles.listGap}>
          {filteredItems.map((item) => {
            const basePrice = toNumber(item.price);
            const finalPrice = calcItemFinalPrice(item);
            const discounted = Math.abs(basePrice - finalPrice) > 0.0001;
            const outOfStock = item.stock_qty <= 0;

            return (
              <SectionCard
                key={item.id}
                title={item.name}
                subtitle={`${item.sku} • ${item.category || "General"} • ${item.stock_qty} in stock`}
                right={<Pill tone={outOfStock ? "danger" : "success"}>{outOfStock ? "Out of stock" : "Ready"}</Pill>}
              >
                {getItemImageUrls(item)[0] ? <Image source={getItemImageUrls(item)[0]} style={styles.itemImage} contentFit="cover" /> : null}
                <Text style={styles.price}>{formatMoney(finalPrice, language)}</Text>
                {discounted ? <HelperText>{formatMoney(basePrice, language)} regular</HelperText> : null}
                {getItemImageUrls(item).length > 1 ? <HelperText>{getItemImageUrls(item).length} photos available</HelperText> : null}
                <HelperText>Reviews: {item.review_summary?.average ?? "-"} / {item.review_summary?.count ?? 0}</HelperText>
                <View style={styles.heroActions}>
                  <AppButton onPress={() => addToCart(item)} disabled={outOfStock || !item.is_active}>
                    {outOfStock ? "Unavailable" : "Add to cart"}
                  </AppButton>
                  <AppButton compact variant="secondary" onPress={() => setSelectedItemId(item.id)}>
                    Reviews
                  </AppButton>
                  {token ? (
                    <AppButton compact variant="secondary" onPress={() => favoriteM.mutate({ item_id: item.id })}>
                      {favoriteItemIds.has(item.id) ? "Saved" : "Save"}
                    </AppButton>
                  ) : null}
                </View>
              </SectionCard>
            );
          })}
        </View>
      )}

      {selectedItemId != null ? (
        <SectionCard title={selectedItem?.name || "Reviews"} subtitle={selectedItem?.sku || "Item details"}>
          {selectedItemImageUrls[0] ? (
            <Image
              source={selectedItemImageUrls[selectedImageIndex] ?? selectedItemImageUrls[0]}
              style={styles.selectedImage}
              contentFit="cover"
            />
          ) : null}
          {selectedItemImageUrls.length > 1 ? (
            <View style={styles.galleryRow}>
              {selectedItemImageUrls.map((url, index) => (
                <Pressable
                  key={`${url}-${index}`}
                  onPress={() => setSelectedImageIndex(index)}
                  style={[styles.galleryThumbWrap, selectedImageIndex === index && styles.galleryThumbWrapActive]}
                >
                  <Image source={url} style={styles.galleryThumb} contentFit="cover" />
                </Pressable>
              ))}
            </View>
          ) : null}

          {(reviewsQ.data ?? []).map((review) => (
            <SectionCard key={review.id} title={`${review.user?.name || "Customer"} - ${review.rating}/5`} subtitle={review.comment || "No comment"} />
          ))}
          {token ? (
            <>
              <InputField label="Review" value={reviewComment} onChangeText={setReviewComment} placeholder="Share a quick note" />
              <View style={styles.heroActions}>
                <AppButton onPress={() => reviewM.mutate()} disabled={reviewM.isPending}>Post review</AppButton>
                <AppButton variant="secondary" onPress={() => setSelectedItemId(null)}>Close</AppButton>
              </View>
            </>
          ) : null}
        </SectionCard>
      ) : null}
    </Screen>
  );
}

export function LoginScreen({ navigation }: LoginProps) {
  const { language, setLanguage, theme, toggleTheme } = usePreferences();
  const { pendingRoute, setPendingRoute, signIn } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("admin@test.com");
  const [password, setPassword] = useState("123456");
  const [name, setName] = useState("");
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

  return (
    <Screen>
      <SectionCard title={mode === "login" ? "Sign in" : "Create account"} subtitle="Order as a customer, operate as staff, control everything as admin.">
        <View style={styles.preferenceRow}>
          <AppButton variant={mode === "login" ? "primary" : "secondary"} compact onPress={() => setMode("login")}>
            Login
          </AppButton>
          <AppButton variant={mode === "register" ? "primary" : "secondary"} compact onPress={() => setMode("register")}>
            Register
          </AppButton>
          <AppButton variant="secondary" compact onPress={() => void toggleTheme()}>
            Theme: {theme}
          </AppButton>
        </View>

        <View style={styles.preferenceRow}>
          <AppButton variant={language === "en" ? "primary" : "secondary"} compact onPress={() => void setLanguage("en")}>
            English
          </AppButton>
          <AppButton variant={language === "ka" ? "primary" : "secondary"} compact onPress={() => void setLanguage("ka")}>
            Georgian
          </AppButton>
        </View>

        {mode === "register" ? <InputField label="Name" value={name} onChangeText={setName} placeholder="Your name" /> : null}
        <InputField label="Email" value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="email-address" />
        <InputField label="Password" value={password} onChangeText={setPassword} placeholder="Password" secureTextEntry />
        {mode === "register" ? (
          <InputField
            label="Confirm password"
            value={passwordConfirmation}
            onChangeText={setPasswordConfirmation}
            placeholder="Confirm password"
            secureTextEntry
          />
        ) : null}

        {authMutation.error ? <HelperText tone="danger">{getErrorMessage(authMutation.error)}</HelperText> : null}

        <AppButton onPress={() => authMutation.mutate()} disabled={authMutation.isPending}>
          {authMutation.isPending ? (mode === "login" ? "Signing in..." : "Creating account...") : mode === "login" ? "Continue" : "Create account"}
        </AppButton>

        <AppButton variant="secondary" onPress={() => navigation.navigate("PublicMarkets")}>
          Back to markets
        </AppButton>
      </SectionCard>
    </Screen>
  );
}

export function CheckoutScreen({ navigation }: CheckoutProps) {
  const access = useProtectedAccess("Checkout");
  const { language } = usePreferences();
  const [marketId, setMarketIdState] = useState("");
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

  const createOrderM = useMutation({
    mutationFn: async () => {
      if (!cart.length) {
        throw new Error("Your cart is empty.");
      }

      if (!marketId) {
        throw new Error("No market selected.");
      }

      return (
        await api.post("/api/orders", {
          market_id: Number(marketId),
          customer_name: effectiveCustomerName.trim(),
          customer_phone: customerPhone.trim(),
          dropoff_address: customerAddress.trim(),
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
    customerPhone.trim().length >= 6 &&
    customerAddress.trim().length >= 5 &&
    Number.isFinite(Number(dropoffLat)) &&
    Number.isFinite(Number(dropoffLng));

  return (
    <Screen>
      <SectionCard title="Checkout" subtitle="Place a real market order against the same backend contract.">
        <View style={styles.heroActions}>
          <AppButton variant="secondary" onPress={() => navigation.goBack()}>
            Back
          </AppButton>
          <Pill tone="success">Dispatch-ready</Pill>
        </View>
      </SectionCard>

      <SectionCard title="Customer and delivery details">
        <InputField label="Name" value={effectiveCustomerName} onChangeText={setCustomerName} placeholder="Customer name" />
        <InputField label="Phone" value={customerPhone} onChangeText={setCustomerPhone} placeholder="Phone" />
        <InputField label="Priority" value={priority} onChangeText={setPriority} placeholder="2" keyboardType="numeric" />
        <InputField label="Address" value={customerAddress} onChangeText={setCustomerAddress} placeholder="Delivery address" multiline />
        <InputField label="Dropoff latitude" value={dropoffLat} onChangeText={setDropoffLat} placeholder="41.7151" keyboardType="numeric" />
        <InputField label="Dropoff longitude" value={dropoffLng} onChangeText={setDropoffLng} placeholder="44.8271" keyboardType="numeric" />
        <InputField label="Promo code" value={promoCode} onChangeText={setPromoCode} placeholder="Optional" />
        <InputField label="Delivery notes" value={notes} onChangeText={setNotes} placeholder="Optional notes" multiline />
        {(marketQ.data?.delivery_slots ?? []).length ? (
          <>
            <HelperText>Delivery slot</HelperText>
            <View style={styles.filterRow}>
              {(marketQ.data?.delivery_slots ?? []).map((slot: any, index: number) => {
                const label = typeof slot === "string" ? slot : slot.label || `${slot.from} - ${slot.to}`;
                const value = typeof slot === "string" ? `${slot}|${slot}|${slot}` : `${label}|${slot.from}|${slot.to}`;
                return (
                  <Pressable key={`${label}-${index}`} onPress={() => setDeliverySlot(value)} style={[styles.filterChip, deliverySlot === value && styles.filterChipActive]}>
                    <Text style={styles.filterChipText}>{label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        ) : null}
      </SectionCard>

      <SectionCard title="Summary" subtitle={marketQ.data?.name || "No market selected"}>
        <StatGrid>
          <StatCard label="Items" value={totals.items} />
          <StatCard label="Subtotal" value={formatMoney(totals.subtotal, language)} />
        </StatGrid>

        {marketQ.data?.address ? <HelperText>{marketQ.data.address}</HelperText> : null}
        {createOrderM.error ? <HelperText tone="danger">{getErrorMessage(createOrderM.error)}</HelperText> : null}
        <AppButton onPress={() => createOrderM.mutate()} disabled={!canSubmit || createOrderM.isPending}>
          {createOrderM.isPending ? "Placing order..." : "Place order"}
        </AppButton>
      </SectionCard>

      <SectionCard title="Cart review">
        {cart.length === 0 ? (
          <HelperText>Your cart is empty.</HelperText>
        ) : (
          <View style={uiStyles.listGap}>
            {cart.map((item) => (
              <SectionCard key={item.item_id} title={item.name} subtitle={`${item.qty} x ${formatMoney(item.price, language)}`}>
                <View style={styles.heroActions}>
                  <AppButton variant="secondary" compact onPress={() => void adjustQty(item.item_id, -1)}>
                    -
                  </AppButton>
                  <AppButton variant="secondary" compact onPress={() => void adjustQty(item.item_id, 1)}>
                    +
                  </AppButton>
                </View>
              </SectionCard>
            ))}
          </View>
        )}
      </SectionCard>
    </Screen>
  );
}

const styles = StyleSheet.create({
  heroActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  marketHeroImage: {
    width: "100%",
    height: 180,
    borderRadius: 20,
    marginBottom: 12,
    backgroundColor: "#e5e7eb",
  },
  marketLogoImage: {
    width: 64,
    height: 64,
    borderRadius: 16,
    marginBottom: 10,
    backgroundColor: "#ffffff",
  },
  marketLogoImageLarge: {
    width: 88,
    height: 88,
    borderRadius: 20,
    marginBottom: 12,
    backgroundColor: "#ffffff",
  },
  preferenceRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  price: {
    fontSize: 26,
    fontWeight: "800",
    color: "#0f172a",
  },
  itemImage: {
    width: "100%",
    height: 180,
    borderRadius: 18,
    marginBottom: 12,
    backgroundColor: "#e5e7eb",
  },
  selectedImage: {
    width: "100%",
    height: 240,
    borderRadius: 20,
    marginBottom: 12,
    backgroundColor: "#e5e7eb",
  },
  galleryRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  galleryThumbWrap: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    padding: 2,
  },
  galleryThumbWrapActive: {
    borderColor: "#0891b2",
    backgroundColor: "#cffafe",
  },
  galleryThumb: {
    width: 64,
    height: 64,
    borderRadius: 12,
    backgroundColor: "#e5e7eb",
  },
  filterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  filterChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#ffffff",
  },
  filterChipActive: {
    backgroundColor: "#cffafe",
    borderColor: "#0891b2",
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0f172a",
  },
});
