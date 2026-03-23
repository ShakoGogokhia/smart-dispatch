import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  BadgePercent,
  MapPin,
  Search,
  ShoppingCart,
  Sparkles,
  Store,
} from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api";
import { auth } from "@/lib/auth";
import { clearCart, loadCart, saveCart, setActiveMarketId } from "@/lib/cart";
import type { CartItem } from "@/lib/cart";
import { formatMoney, toNumber } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

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
    queryFn: async () =>
      (await api.get(`/api/public/markets/${marketId}/active-promo`)).data as Promo | null,
    enabled: !!marketId,
    retry: false,
  });

  const market = marketQ.data;
  const promo = promoQ.data;

  const filteredItems = useMemo(() => {
    const items = itemsQ.data ?? [];
    const text = query.trim().toLowerCase();
    if (!text) return items;

    return items.filter((item) => {
      const name = item.name.toLowerCase();
      const sku = item.sku.toLowerCase();
      return name.includes(text) || sku.includes(text);
    });
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
      cart
        .map((item) => (item.item_id === itemId ? { ...item, qty: item.qty - 1 } : item))
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

  return (
    <div className="relative min-h-screen overflow-hidden px-4 py-5 md:px-6 md:py-6">
      <div className="aurora-orb left-[6%] top-[8%] h-44 w-44 bg-orange-400/22" />
      <div className="aurora-orb right-[8%] top-[24%] h-56 w-56 bg-teal-400/18 [animation-delay:1.2s]" />
      <div className="aurora-orb bottom-[10%] left-[44%] h-36 w-36 bg-amber-200/14 [animation-delay:2s]" />

      <div className="relative mx-auto max-w-7xl">
        <header className="hero-surface animated-enter p-6 md:p-10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(255,255,255,0.12),_transparent_26%),linear-gradient(135deg,_rgba(255,176,86,0.14),_transparent_42%)]" />

          <div className="relative grid gap-6 lg:grid-cols-[1.08fr_0.92fr]">
            <div className="animated-enter animated-enter-delay-1">
              <Link
                to="/"
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/7 px-4 py-2 text-sm text-slate-100"
              >
                <ArrowLeft className="h-4 w-4" />
                {t("market.back")}
              </Link>

              <div className="mt-6 flex flex-wrap items-center gap-3">
                <div className="inline-flex items-center gap-2 rounded-full bg-white/8 px-4 py-2 text-sm text-slate-100">
                  <Store className="h-4 w-4 text-amber-300" />
                  {market?.code || `Market #${marketId}`}
                </div>
                <Badge className="rounded-full border-0 bg-emerald-400/16 px-4 py-2 text-emerald-100 shadow-none">
                  {market?.is_active === false ? t("market.unavailable") : t("market.openForOrders")}
                </Badge>
              </div>

              <h1 className="font-display mt-5 text-4xl font-bold tracking-[-0.05em] md:text-6xl">
                {marketQ.isLoading ? "Loading market..." : market?.name || `Market #${marketId}`}
              </h1>

              <div className="mt-4 flex max-w-2xl items-start gap-2 text-slate-300">
                <MapPin className="mt-1 h-4 w-4 shrink-0 text-teal-300" />
                <span className="leading-7">{market?.address || t("market.noAddress")}</span>
              </div>

              {promo?.is_active && (
                <div className="mt-6 inline-flex items-center gap-2 rounded-2xl border border-amber-300/20 bg-amber-300/10 px-4 py-3 text-sm text-amber-100">
                  <BadgePercent className="h-4 w-4" />
                  {t("market.activePromo")} `{promo.code}`{" "}
                  {promo.type === "percent"
                    ? `${toNumber(promo.value)}% off`
                    : `${formatMoney(promo.value)} off`}
                </div>
              )}

              <div className="mt-8 grid gap-3 sm:grid-cols-3">
                {[
                  { title: "Discover", text: "Find items fast with cleaner hierarchy and search.", icon: Sparkles },
                  { title: "Collect", text: "Cart state stays sticky while you browse the full catalog.", icon: ShoppingCart },
                  { title: "Checkout", text: "Move into order placement without losing delivery context.", icon: MapPin },
                ].map((entry) => {
                  const Icon = entry.icon;
                  return (
                    <div key={entry.title} className="rounded-[26px] border border-white/10 bg-white/6 p-4">
                      <Icon className="h-5 w-5 text-white" />
                      <div className="mt-4 font-semibold text-white">{entry.title}</div>
                      <div className="mt-2 text-sm leading-6 text-slate-300">{entry.text}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            <Card className="animated-enter animated-enter-delay-2 overflow-hidden rounded-[32px] border-white/10 bg-white/8 text-white shadow-none">
              <CardContent className="grid gap-5 p-6">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-14 w-14 items-center justify-center rounded-[22px] bg-white/10">
                      <ShoppingCart className="h-6 w-6 text-amber-300" />
                    </div>
                    <div>
                      <div className="text-sm uppercase tracking-[0.22em] text-slate-300">{t("market.cart")}</div>
                      <div className="font-display text-3xl font-bold text-white">
                        {totals.quantity} {t("market.itemsCount")}
                      </div>
                    </div>
                  </div>
                  <div className="rounded-full border border-white/10 bg-white/8 px-3 py-1 text-xs uppercase tracking-[0.2em] text-slate-200">
                    Saved
                  </div>
                </div>

                <div className="rounded-[28px] bg-white/7 p-5">
                  <div className="flex items-center justify-between text-sm text-slate-200">
                    <span>{t("market.subtotal")}</span>
                    <span className="text-2xl font-bold text-white">{formatMoney(totals.subtotal)}</span>
                  </div>
                  <div className="mt-2 text-xs tracking-[0.14em] text-slate-300">{t("market.cartSaved")}</div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <Button
                    className="h-12 rounded-2xl bg-white text-slate-950 hover:bg-white/92"
                    onClick={startCheckout}
                    disabled={!totals.quantity}
                  >
                    {t("market.continueCheckout")}
                  </Button>
                  <Button
                    variant="secondary"
                    className="h-12 rounded-2xl border-0 bg-white/10 text-white hover:bg-white/16"
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
                  <div className="grid gap-3 border-t border-white/10 pt-4">
                    {cart.map((item) => (
                      <div
                        key={item.item_id}
                        className="rounded-[22px] border border-white/8 bg-white/6 px-4 py-3"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="truncate font-medium text-white">{item.name}</div>
                            <div className="text-sm text-slate-300">
                              {item.qty} x {formatMoney(item.price)}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="secondary"
                              className="h-10 rounded-xl border-0 bg-white/10 px-3 text-white hover:bg-white/16"
                              onClick={() => decrement(item.item_id)}
                            >
                              -
                            </Button>
                            <Button
                              variant="secondary"
                              className="h-10 rounded-xl border-0 bg-white/10 px-3 text-white hover:bg-white/16"
                              onClick={() => increment(item.item_id)}
                            >
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
          </div>
        </header>

        <section className="mt-8">
          <div className="animated-enter animated-enter-delay-3 mb-5 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="section-heading">{t("market.catalog")}</h2>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600 md:text-base">
                {t("market.catalogText")}
              </p>
            </div>
            <div className="relative w-full md:max-w-sm">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t("market.searchItems")}
                className="h-12 rounded-2xl border-white/50 bg-white/85 pl-11 shadow-sm backdrop-blur"
              />
            </div>
          </div>

          {itemsQ.isLoading ? (
            <div className="glass-panel p-8 text-sm text-slate-600">{t("market.loadingCatalog")}</div>
          ) : itemsQ.isError ? (
            <div className="glass-panel p-8 text-sm text-red-700">{t("market.failedCatalog")}</div>
          ) : (
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {filteredItems.map((item, index) => {
                const basePrice = toNumber(item.price);
                const finalPrice = calcItemFinalPrice(item);
                const discounted = Math.abs(basePrice - finalPrice) > 0.0001;
                const outOfStock = item.stock_qty <= 0;

                return (
                  <Card
                    key={item.id}
                    className={`mesh-card animated-enter ${index % 3 === 1 ? "animated-enter-delay-1" : index % 3 === 2 ? "animated-enter-delay-2" : ""}`}
                  >
                    <CardContent className="grid gap-5 p-6">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="text-xs uppercase tracking-[0.22em] text-slate-500">{item.sku}</div>
                          <h3 className="font-display mt-2 text-3xl font-bold tracking-[-0.04em] text-slate-950">
                            {item.name}
                          </h3>
                        </div>
                        <Badge
                          variant={outOfStock ? "destructive" : "secondary"}
                          className="rounded-full"
                        >
                          {outOfStock ? t("market.outOfStock") : `${item.stock_qty}`}
                        </Badge>
                      </div>

                      <div className="rounded-[24px] bg-slate-950 p-4 text-white">
                        <div className="flex items-end gap-3">
                          <div className="text-3xl font-bold">{formatMoney(finalPrice)}</div>
                          {discounted && (
                            <div className="pb-1 text-sm text-slate-400 line-through">{formatMoney(basePrice)}</div>
                          )}
                        </div>
                        <div className="mt-2 text-sm text-slate-300">
                          {item.discount_type && item.discount_type !== "none"
                            ? item.discount_type === "percent"
                              ? `${toNumber(item.discount_value)}% discount applied`
                              : `${formatMoney(item.discount_value ?? 0)} discount applied`
                            : t("market.regularPrice")}
                        </div>
                      </div>

                      <Button
                        className="h-12 rounded-2xl"
                        onClick={() => addToCart(item)}
                        disabled={!item.is_active || outOfStock}
                      >
                        {outOfStock ? t("market.unavailableButton") : t("market.addToCart")}
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}

              {filteredItems.length === 0 && (
                <div className="glass-panel p-8 text-sm text-slate-600">{t("market.noItems")}</div>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

export default function PublicMarketPage() {
  const { marketId = "" } = useParams();

  if (!marketId) {
    return <div className="p-8 text-sm text-red-700">Market id is missing.</div>;
  }

  return <PublicMarketScreen key={marketId} marketId={marketId} />;
}
