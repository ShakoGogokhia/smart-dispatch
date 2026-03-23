import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, BadgePercent, MapPin, Search, ShoppingCart, Sparkles, Store, Zap } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import ThemeToggle from "@/components/ThemeToggle";
import { api } from "@/lib/api";
import { auth } from "@/lib/auth";
import { clearCart, loadCart, saveCart, setActiveMarketId } from "@/lib/cart";
import type { CartItem } from "@/lib/cart";
import { formatMoney, toNumber } from "@/lib/format";
import { useI18n } from "@/lib/i18n";

type Market = {
  id: number;
  name: string;
  code: string;
  address?: string | null;
  is_active: boolean;
};

type Item = {
  id: number;
  name: string;
  sku: string;
  price: number | string;
  discount_type?: "none" | "percent" | "fixed";
  discount_value?: number | string;
  is_active: boolean;
  stock_qty: number;
};

type Promo = {
  id: number;
  code: string;
  type: "percent" | "fixed";
  value: number | string;
  is_active: boolean;
};

function calcItemFinalPrice(item: Item) {
  const base = toNumber(item.price);
  const discountType = item.discount_type ?? "none";
  const discountValue = toNumber(item.discount_value);

  if (discountType === "percent") return Math.max(0, base - base * (discountValue / 100));
  if (discountType === "fixed") return Math.max(0, base - discountValue);
  return base;
}

function PublicMarketScreen({ marketId }: { marketId: string }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [cart, setCart] = useState<CartItem[]>(() => loadCart(marketId));

  useEffect(() => {
    setActiveMarketId(marketId);
  }, [marketId]);

  const marketQ = useQuery({
    queryKey: ["public-market", marketId],
    queryFn: async () => (await api.get(`/api/public/markets/${marketId}`)).data as Market,
    enabled: !!marketId,
  });

  const itemsQ = useQuery({
    queryKey: ["public-market-items", marketId],
    queryFn: async () => (await api.get(`/api/public/markets/${marketId}/items`)).data as Item[],
    enabled: !!marketId,
  });

  const promoQ = useQuery({
    queryKey: ["public-market-promo", marketId],
    queryFn: async () => (await api.get(`/api/public/markets/${marketId}/active-promo`)).data as Promo | null,
    enabled: !!marketId,
    retry: false,
  });

  const market = marketQ.data;
  const promo = promoQ.data;

  const filteredItems = useMemo(() => {
    const items = itemsQ.data ?? [];
    const text = query.trim().toLowerCase();
    if (!text) return items;
    return items.filter((item) => item.name.toLowerCase().includes(text) || item.sku.toLowerCase().includes(text));
  }, [itemsQ.data, query]);

  const totals = useMemo(() => {
    const quantity = cart.reduce((sum, item) => sum + item.qty, 0);
    const subtotal = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
    return { quantity, subtotal };
  }, [cart]);

  function updateCart(next: CartItem[]) {
    setCart(next);
    saveCart(marketId, next);
  }

  function addToCart(item: Item) {
    const nextPrice = calcItemFinalPrice(item);
    const current = [...cart];
    const existing = current.find((entry) => entry.item_id === item.id);
    if (existing) {
      existing.qty += 1;
    } else {
      current.push({ item_id: item.id, name: item.name, price: nextPrice, qty: 1 });
    }
    updateCart(current);
  }

  function increment(itemId: number) {
    updateCart(cart.map((item) => (item.item_id === itemId ? { ...item, qty: item.qty + 1 } : item)));
  }

  function decrement(itemId: number) {
    updateCart(
      cart.map((item) => (item.item_id === itemId ? { ...item, qty: item.qty - 1 } : item)).filter((item) => item.qty > 0),
    );
  }

  function startCheckout() {
    if (!auth.getToken()) {
      navigate(`/login?next=${encodeURIComponent("/checkout")}`, { replace: true });
      return;
    }

    navigate("/checkout");
  }

  return (
    <div className="app-shell">
      <div className="glow-orb left-[12%] top-36 h-44 w-44 bg-cyan-300/18" />
      <div className="glow-orb right-[6%] top-[28rem] h-52 w-52 bg-orange-300/18" />

      <div className="relative z-10 mx-auto max-w-7xl space-y-6">
        <header className="hero-grid">
          <section className="hero-panel">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Link to="/" className="status-chip w-fit">
                <ArrowLeft className="h-4 w-4" />
                {t("market.back")}
              </Link>
              <ThemeToggle />
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-3">
                <div className="command-chip">
                  <Store className="h-4 w-4" />
                  {market?.code || `#${marketId}`}
                </div>
              <Badge className={`status-chip ${market?.is_active === false ? "status-warn" : "status-good"}`}>
                {market?.is_active === false ? t("market.unavailable") : t("market.openForOrders")}
              </Badge>
            </div>

            <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1fr)_280px]">
              <div>
                <h1 className="font-display text-5xl font-semibold tracking-[-0.07em] text-white md:text-7xl">
                  {marketQ.isLoading ? t("public.loadingMarket") : market?.name || `#${marketId}`}
                </h1>

                <div className="mt-5 flex max-w-2xl items-start gap-2 text-slate-300">
                  <MapPin className="mt-1 h-4 w-4 shrink-0 text-cyan-200" />
                  <span className="leading-7">{market?.address || t("market.noAddress")}</span>
                </div>

                {promo?.is_active && (
                  <div className="mt-6 inline-flex items-center gap-2 rounded-[18px] border border-cyan-300/18 bg-cyan-300/10 px-4 py-3 text-sm text-cyan-50">
                    <BadgePercent className="h-4 w-4 text-cyan-100" />
                    {t("market.activePromo")} `{promo.code}`{" "}
                    {promo.type === "percent"
                      ? t("market.discountAppliedPercent", { value: toNumber(promo.value) })
                      : t("market.discountAppliedFixed", { value: formatMoney(promo.value) })}
                  </div>
                )}

                <div className="mt-8 flex flex-wrap gap-2">
                  <span className="data-pill">{t("market.pillPersistentCart")}</span>
                  <span className="data-pill">{t("market.pillLiveSavings")}</span>
                  <span className="data-pill">{t("market.pillDispatchReady")}</span>
                </div>
              </div>

              <div className="hero-mesh">
                <div className="section-kicker">{t("market.storefrontMode")}</div>
                <div className="mt-3 font-display text-4xl font-semibold tracking-[-0.05em] text-white">{t("market.fastLane")}</div>
                <div className="mt-3 text-sm leading-7 text-slate-300">
                  {t("market.fastLaneCopy")}
                </div>
                <div className="mt-5 grid gap-3">
                  <div className="metric-block py-4">
                    <div className="section-kicker">{t("market.itemsVisible")}</div>
                    <div className="theme-ink mt-2 text-lg font-semibold">{filteredItems.length}</div>
                  </div>
                  <div className="metric-block py-4">
                    <div className="section-kicker">{t("market.marketState")}</div>
                    <div className="theme-ink mt-2 text-lg font-semibold">
                      {market?.is_active === false ? t("market.unavailable") : t("market.openForOrders")}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <Card>
            <CardContent className="grid gap-5 p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="section-kicker">{t("market.cart")}</div>
                  <div className="font-display theme-ink mt-2 text-5xl font-semibold tracking-[-0.05em]">
                    {totals.quantity}
                  </div>
                  <div className="theme-muted mt-1 text-sm">{t("market.itemsCount")}</div>
                </div>
                <div className="flex h-14 w-14 items-center justify-center rounded-[18px] border border-cyan-300/20 bg-cyan-50 text-cyan-700 dark:border-cyan-300/14 dark:bg-cyan-300/10 dark:text-cyan-100">
                  <ShoppingCart className="h-6 w-6" />
                </div>
              </div>

              <div className="metric-block">
                <div className="section-kicker">{t("market.subtotal")}</div>
                <div className="font-display theme-ink mt-2 text-4xl font-semibold tracking-[-0.05em]">
                  {formatMoney(totals.subtotal)}
                </div>
                <div className="theme-copy mt-2 text-sm">{t("market.cartSaved")}</div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <Button className="h-12" onClick={startCheckout} disabled={!totals.quantity}>
                  {t("market.continueCheckout")}
                </Button>
                <Button
                  variant="secondary"
                  className="h-12"
                  onClick={() => {
                    clearCart(marketId);
                    setCart([]);
                  }}
                  disabled={!totals.quantity}
                >
                  {t("market.clearCart")}
                </Button>
              </div>

              {cart.length > 0 && (
                <div className="grid gap-3">
                  {cart.map((item) => (
                    <div key={item.item_id} className="subpanel px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="theme-ink truncate font-semibold">{item.name}</div>
                          <div className="theme-muted text-sm">
                            {item.qty} x {formatMoney(item.price)}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button variant="secondary" className="h-10 w-10 p-0" onClick={() => decrement(item.item_id)}>
                            -
                          </Button>
                          <Button variant="secondary" className="h-10 w-10 p-0" onClick={() => increment(item.item_id)}>
                            +
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </header>

        <section className="dashboard-card">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="command-chip">
                <Sparkles className="h-3.5 w-3.5" />
                {t("market.catalog")}
              </div>
              <h2 className="section-title mt-4">{t("market.catalogTitle")}</h2>
              <p className="section-copy mt-3 max-w-2xl">{t("market.catalogText")}</p>
            </div>
            <div className="relative w-full md:max-w-sm">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t("market.searchItems")}
                className="input-shell pl-11"
              />
            </div>
          </div>
        </section>

        {itemsQ.isLoading ? (
          <div className="dashboard-card theme-copy p-8 text-sm">{t("market.loadingCatalog")}</div>
        ) : itemsQ.isError ? (
          <div className="dashboard-card p-8 text-sm text-rose-700 dark:text-rose-100">{t("market.failedCatalog")}</div>
        ) : (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {filteredItems.map((item) => {
              const basePrice = toNumber(item.price);
              const finalPrice = calcItemFinalPrice(item);
              const discounted = Math.abs(basePrice - finalPrice) > 0.0001;
              const outOfStock = item.stock_qty <= 0;

              return (
                <Card key={item.id}>
                  <CardContent className="grid gap-5 p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="section-kicker">{item.sku}</div>
                        <h3 className="font-display theme-ink mt-2 text-4xl font-semibold tracking-[-0.05em]">{item.name}</h3>
                      </div>
                      <Badge className={`status-chip ${outOfStock ? "status-bad" : "status-good"}`}>
                        {outOfStock ? t("market.outOfStock") : `${item.stock_qty}`}
                      </Badge>
                    </div>

                    <div className="metric-block">
                      <div className="font-display theme-ink text-4xl font-semibold tracking-[-0.05em]">{formatMoney(finalPrice)}</div>
                      {discounted && <div className="theme-muted mt-1 text-sm line-through">{formatMoney(basePrice)}</div>}
                      <div className="theme-copy mt-3 text-sm leading-7">
                        {item.discount_type && item.discount_type !== "none"
                          ? item.discount_type === "percent"
                            ? t("market.discountAppliedPercent", { value: toNumber(item.discount_value) })
                            : t("market.discountAppliedFixed", { value: formatMoney(item.discount_value ?? 0) })
                          : t("market.regularPrice")}
                      </div>
                    </div>

                    <div className="subpanel flex items-center justify-between px-4 py-3">
                      <div className="theme-copy text-sm">
                        <div className="theme-ink font-medium">{t("market.readyToAdd")}</div>
                        <div className="theme-muted">
                          {item.is_active && !outOfStock ? t("market.availableForCheckout") : t("market.unavailableNow")}
                        </div>
                      </div>
                      <div className="flex h-11 w-11 items-center justify-center rounded-[16px] border border-cyan-300/20 bg-cyan-50 text-cyan-700 dark:border-cyan-300/14 dark:bg-cyan-300/10 dark:text-cyan-50">
                        <Zap className="h-4 w-4" />
                      </div>
                    </div>

                    <Button className="h-12" onClick={() => addToCart(item)} disabled={!item.is_active || outOfStock}>
                      {outOfStock ? t("market.unavailableButton") : t("market.addToCart")}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}

            {filteredItems.length === 0 && <div className="dashboard-card theme-copy p-8 text-sm">{t("market.noItems")}</div>}
          </div>
        )}
      </div>
    </div>
  );
}

export default function PublicMarketPage() {
  const { marketId = "" } = useParams();
  const { t } = useI18n();

  if (!marketId) {
    return <div className="p-8 text-sm text-red-500 dark:text-red-300">{t("market.marketIdMissing")}</div>;
  }

  return <PublicMarketScreen key={marketId} marketId={marketId} />;
}
