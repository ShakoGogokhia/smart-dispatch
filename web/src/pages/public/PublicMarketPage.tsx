import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Minus, Plus, Search, Share2, ShoppingCart, Star } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { auth } from "@/lib/auth";
import { clearCart, loadCart, saveCart, setActiveMarketId, type CartItem } from "@/lib/cart";
import { formatMoney, toNumber } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { getVisitorKey, rememberViewedMarket, syncMeta } from "@/lib/publicMarketplace";
import { calcStorefrontPrice, formatEtaWindow, formatMarketHours, type MarketPromo, type StorefrontMarket } from "@/lib/storefront";

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

function PublicMarketScreen({ marketId }: { marketId: string }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [cart, setCart] = useState<CartItem[]>(() => loadCart(marketId));

  useEffect(() => {
    setActiveMarketId(marketId);
  }, [marketId]);

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

  const market = marketQ.data;
  const promo = promoQ.data;

  useEffect(() => {
    if (!market) return;

    rememberViewedMarket(market);
    syncMeta(`${market.name} | Smart Dispatch`, market.featured_copy || market.address || `${market.name} storefront and delivery catalog.`);

    void api.post(`/api/public/markets/${market.id}/track-click`, {
      source: "market-detail",
      visitor_key: getVisitorKey(),
    }).catch(() => undefined);
  }, [market]);

  const filteredItems = useMemo(() => {
    const normalized = deferredQuery.trim().toLowerCase();
    const items = itemsQ.data ?? [];

    if (!normalized) {
      return items;
    }

    return items.filter((item) => `${item.name} ${item.sku}`.toLowerCase().includes(normalized));
  }, [deferredQuery, itemsQ.data]);

  const totals = useMemo(() => {
    const quantity = cart.reduce((sum, item) => sum + item.qty, 0);
    const subtotal = cart.reduce((sum, item) => sum + item.qty * item.price, 0);
    return { quantity, subtotal };
  }, [cart]);

  function updateCart(next: CartItem[]) {
    setCart(next);
    saveCart(marketId, next);
  }

  function addToCart(item: Item) {
    const nextPrice = calcStorefrontPrice(item);
    const current = [...cart];
    const existing = current.find((entry) => entry.item_id === item.id);

    if (existing) {
      existing.qty += 1;
    } else {
      current.push({ item_id: item.id, name: item.name, price: nextPrice, qty: 1 });
    }

    updateCart(current);
  }

  function changeQty(itemId: number, delta: number) {
    updateCart(
      cart
        .map((item) => (item.item_id === itemId ? { ...item, qty: item.qty + delta } : item))
        .filter((item) => item.qty > 0),
    );
  }

  function startCheckout() {
    if (!auth.getToken()) {
      navigate(`/login?next=${encodeURIComponent("/checkout")}`, { replace: true });
      return;
    }

    navigate("/checkout");
  }

  async function shareMarket() {
    if (!market || typeof window === "undefined") {
      return;
    }

    const url = window.location.href;

    if (navigator.share) {
      try {
        await navigator.share({ title: market.name, text: market.featured_headline || market.name, url });
        return;
      } catch {
        // Fall back to clipboard.
      }
    }

    if (navigator.clipboard) {
      await navigator.clipboard.writeText(url);
    }
  }

  return (
    <div className="space-y-6">
      <section className="dashboard-card page-enter">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link to="/" className="status-chip rounded-[16px] px-4 py-2">
            <ArrowLeft className="h-4 w-4" />
            All markets
          </Link>

          <div className="flex flex-wrap gap-2">
            {market?.featured_badge && <span className="status-chip status-good">{market.featured_badge}</span>}
            {promo && (
              <span className="status-chip status-warn">
                {promo.code}: {promo.type === "percent" ? `${toNumber(promo.value)}% off` : `${formatMoney(promo.value)} off`}
              </span>
            )}
            <Button variant="secondary" onClick={shareMarket}>
              <Share2 className="h-4 w-4" />
              Share
            </Button>
          </div>
        </div>

        <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div>
            {market?.cover_url && <img src={market.cover_url} alt={`${market.name} cover`} className="mb-5 h-56 w-full rounded-[28px] object-cover" />}
            <div className="section-kicker">{market?.code || `#${marketId}`}</div>
            <h1 className="font-display mt-3 text-4xl font-semibold tracking-[-0.05em] text-slate-950 dark:text-white md:text-5xl">
              {marketQ.isLoading ? "Loading market..." : market?.name || `#${marketId}`}
            </h1>
            <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-slate-300">
              {market?.address || "Address not added yet."}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Badge className={`status-chip ${market?.is_active === false ? "status-warn" : "status-good"}`}>
                {market?.is_active === false ? t("market.unavailable") : t("market.openForOrders")}
              </Badge>
              <span className="status-chip status-neutral">{(itemsQ.data ?? []).length} products</span>
              <span className="status-chip status-neutral">{formatEtaWindow(market?.delivery_eta_minutes)}</span>
              <span className="status-chip status-neutral">{formatMoney(market?.minimum_order ?? 0)} minimum</span>
              <span className="status-chip status-neutral">{formatMarketHours(market?.opens_at, market?.closes_at)}</span>
              <span className="status-chip status-neutral">
                <Star className="h-4 w-4" />
                {market?.average_rating ? `${market.average_rating.toFixed(1)} (${market.rating_count ?? 0})` : "New market"}
              </span>
            </div>
          </div>

          <div className="subpanel p-5">
            <div className="flex items-center justify-between">
              <div>
                <div className="section-kicker">{t("market.cart")}</div>
                <div className="mt-2 text-4xl font-semibold text-slate-950 dark:text-white">{totals.quantity}</div>
              </div>
              <ShoppingCart className="h-6 w-6 text-cyan-700 dark:text-cyan-100" />
            </div>
            <div className="mt-3 text-sm text-slate-600 dark:text-slate-300">{t("market.subtotal")}: {formatMoney(totals.subtotal)}</div>
            <div className="mt-4 grid gap-3">
              <Button onClick={startCheckout} disabled={!totals.quantity}>
                {t("market.continueCheckout")}
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  clearCart(marketId);
                  setCart([]);
                }}
                disabled={!totals.quantity}
              >
                {t("market.clearCart")}
              </Button>
            </div>
          </div>
        </div>
      </section>

      {cart.length > 0 && (
        <section className="dashboard-card page-enter page-enter-delay-1">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="font-display text-2xl font-semibold text-slate-950 dark:text-white">Cart</h2>
            <span className="status-chip status-neutral">{totals.quantity} items</span>
          </div>

          <div className="grid gap-3">
            {cart.map((item) => (
              <div key={item.item_id} className="subpanel flex items-center justify-between gap-4 px-4 py-3">
                <div>
                  <div className="font-medium text-slate-950 dark:text-white">{item.name}</div>
                  <div className="text-sm text-slate-600 dark:text-slate-300">{formatMoney(item.price)}</div>
                </div>

                <div className="flex items-center gap-2">
                  <Button variant="secondary" className="h-10 w-10 rounded-2xl p-0" onClick={() => changeQty(item.item_id, -1)}>
                    <Minus className="h-4 w-4" />
                  </Button>
                  <span className="min-w-8 text-center">{item.qty}</span>
                  <Button variant="secondary" className="h-10 w-10 rounded-2xl p-0" onClick={() => changeQty(item.item_id, 1)}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="dashboard-card page-enter page-enter-delay-2">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="section-kicker">{t("market.catalog")}</div>
            <h2 className="mt-2 font-display text-2xl font-semibold text-slate-950 dark:text-white">Products</h2>
          </div>

          <div className="relative w-full md:max-w-sm">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("market.searchItems")} className="input-shell pl-11" />
          </div>
        </div>
      </section>

      {itemsQ.isLoading ? (
        <div className="dashboard-card text-sm text-slate-600 dark:text-slate-300">{t("market.loadingCatalog")}</div>
      ) : itemsQ.isError ? (
        <div className="dashboard-card text-sm text-rose-700 dark:text-rose-100">{t("market.failedCatalog")}</div>
      ) : (
        <section className="grid gap-4">
          {filteredItems.map((item) => {
            const outOfStock = item.stock_qty <= 0;
            const finalPrice = calcStorefrontPrice(item);
            const discounted = Math.abs(toNumber(item.price) - finalPrice) > 0.0001;

            return (
              <Card key={item.id}>
                <CardContent className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
                  <div className="min-w-0">
                    <div className="section-kicker">{item.sku}</div>
                    <div className="mt-2 text-lg font-semibold text-slate-950 dark:text-white">{item.name}</div>
                    <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                      {formatMoney(finalPrice)}
                      {discounted && " • Saving now"}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <span className={`status-chip ${outOfStock ? "status-bad" : "status-good"}`}>
                      {outOfStock ? t("market.outOfStock") : t("market.stockLeft", { value: item.stock_qty })}
                    </span>
                    <Button onClick={() => addToCart(item)} disabled={outOfStock || !item.is_active}>
                      {outOfStock ? t("market.unavailableButton") : t("market.addToCart")}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {filteredItems.length === 0 && <div className="dashboard-card text-sm text-slate-600 dark:text-slate-300">{t("market.noItems")}</div>}
        </section>
      )}
    </div>
  );
}

export default function PublicMarketPage() {
  const { marketId = "" } = useParams();
  const { t } = useI18n();

  if (!marketId) {
    return <div className="dashboard-card text-sm text-red-500 dark:text-red-300">{t("market.marketIdMissing")}</div>;
  }

  return <PublicMarketScreen key={marketId} marketId={marketId} />;
}
