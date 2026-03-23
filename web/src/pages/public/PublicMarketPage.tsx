import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, BadgePercent, MapPin, Search, ShoppingCart, Store } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api";
import { auth } from "@/lib/auth";
import { clearCart, loadCart, saveCart, setActiveMarketId } from "@/lib/cart";
import type { CartItem } from "@/lib/cart";
import { formatMoney, toNumber } from "@/lib/format";
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

export default function PublicMarketPage() {
  const navigate = useNavigate();
  const { marketId = "" } = useParams();
  const [query, setQuery] = useState("");
  const [cart, setCart] = useState<CartItem[]>(() => (marketId ? loadCart(marketId) : []));

  useEffect(() => {
    if (!marketId) return;
    setActiveMarketId(marketId);
    setCart(loadCart(marketId));
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
  const items = itemsQ.data ?? [];
  const promo = promoQ.data;

  const filteredItems = useMemo(() => {
    const text = query.trim().toLowerCase();
    if (!text) return items;

    return items.filter((item) => {
      const name = item.name.toLowerCase();
      const sku = item.sku.toLowerCase();
      return name.includes(text) || sku.includes(text);
    });
  }, [items, query]);

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
    updateCart(
      cart.map((item) => (item.item_id === itemId ? { ...item, qty: item.qty + 1 } : item)),
    );
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

  if (!marketId) {
    return <div className="p-8 text-sm text-red-700">Market id is missing.</div>;
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(251,191,36,0.26),_transparent_22%),radial-gradient(circle_at_center_right,_rgba(20,184,166,0.18),_transparent_25%),linear-gradient(180deg,_#0b1220_0%,_#12233e_26%,_#f7f1e8_26%,_#f7f1e8_100%)] px-4 py-5 md:px-6">
      <div className="mx-auto max-w-7xl">
        <header className="grid gap-6 rounded-[36px] border border-white/10 bg-slate-950/78 p-7 text-white shadow-[0_30px_80px_rgba(15,23,42,0.42)] backdrop-blur md:p-10 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <Link
              to="/"
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to all markets
            </Link>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/8 px-4 py-2 text-sm text-slate-100">
                <Store className="h-4 w-4 text-amber-300" />
                {market?.code || `Market #${marketId}`}
              </div>
              <Badge className="rounded-full border-0 bg-emerald-400/16 px-4 py-2 text-emerald-100 shadow-none">
                {market?.is_active === false ? "Temporarily unavailable" : "Open for orders"}
              </Badge>
            </div>
            <h1 className="font-display mt-5 text-4xl font-semibold tracking-tight md:text-5xl">
              {marketQ.isLoading ? "Loading market..." : market?.name || `Market #${marketId}`}
            </h1>
            <div className="mt-4 flex items-start gap-2 text-slate-300">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-teal-300" />
              <span>{market?.address || "Address information has not been provided yet."}</span>
            </div>
            {promo?.is_active && (
              <div className="mt-6 inline-flex items-center gap-2 rounded-2xl border border-amber-300/20 bg-amber-300/10 px-4 py-3 text-sm text-amber-100">
                <BadgePercent className="h-4 w-4" />
                Active promo code `{promo.code}` for{" "}
                {promo.type === "percent"
                  ? `${toNumber(promo.value)}% off`
                  : `${formatMoney(promo.value)} off`}
              </div>
            )}
          </div>

          <Card className="overflow-hidden rounded-[32px] border-white/10 bg-white/8 text-white shadow-none">
            <CardContent className="grid gap-5 p-6">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10">
                  <ShoppingCart className="h-5 w-5 text-amber-300" />
                </div>
                <div>
                  <div className="text-sm uppercase tracking-[0.22em] text-slate-300">Cart</div>
                  <div className="font-display text-2xl font-semibold text-white">
                    {totals.quantity} item{totals.quantity === 1 ? "" : "s"}
                  </div>
                </div>
              </div>
              <div className="rounded-[26px] bg-white/7 p-4">
                <div className="flex items-center justify-between text-sm text-slate-200">
                  <span>Subtotal</span>
                  <span className="text-lg font-semibold text-white">
                    {formatMoney(totals.subtotal)}
                  </span>
                </div>
                <div className="mt-2 text-xs text-slate-300">
                  Cart is saved per market so customers can come back later.
                </div>
              </div>
              <div className="grid gap-3">
                <Button
                  className="h-12 rounded-2xl bg-white text-slate-950 hover:bg-white/92"
                  onClick={startCheckout}
                  disabled={!totals.quantity}
                >
                  Continue to checkout
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
                  Clear cart
                </Button>
              </div>

              {cart.length > 0 && (
                <div className="grid gap-3 border-t border-white/10 pt-4">
                  {cart.map((item) => (
                    <div
                      key={item.item_id}
                      className="flex items-center justify-between gap-3 rounded-2xl bg-white/6 px-4 py-3"
                    >
                      <div className="min-w-0">
                        <div className="truncate font-medium text-white">{item.name}</div>
                        <div className="text-sm text-slate-300">
                          {item.qty} x {formatMoney(item.price)}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="secondary"
                          className="rounded-xl border-0 bg-white/10 text-white hover:bg-white/16"
                          onClick={() => decrement(item.item_id)}
                        >
                          -
                        </Button>
                        <Button
                          variant="secondary"
                          className="rounded-xl border-0 bg-white/10 text-white hover:bg-white/16"
                          onClick={() => increment(item.item_id)}
                        >
                          +
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </header>

        <section className="mt-8">
          <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="section-heading">Catalog</h2>
              <p className="mt-2 text-sm text-slate-600">
                Search by name or SKU, then add items to the cart.
              </p>
            </div>
            <div className="relative w-full md:max-w-sm">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search items"
                className="h-12 rounded-2xl border-white/50 bg-white/85 pl-11"
              />
            </div>
          </div>

          {itemsQ.isLoading ? (
            <div className="glass-panel p-8 text-sm text-slate-600">Loading catalog...</div>
          ) : itemsQ.isError ? (
            <div className="glass-panel p-8 text-sm text-red-700">
              Could not load items from `/api/public/markets/{marketId}/items`.
            </div>
          ) : (
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {filteredItems.map((item) => {
                const basePrice = toNumber(item.price);
                const finalPrice = calcItemFinalPrice(item);
                const discounted = Math.abs(basePrice - finalPrice) > 0.0001;
                const outOfStock = item.stock_qty <= 0;

                return (
                  <Card
                    key={item.id}
                    className="rounded-[30px] border-white/30 bg-white/82 shadow-[0_24px_60px_rgba(15,23,42,0.10)]"
                  >
                    <CardContent className="grid gap-5 p-6">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="text-xs uppercase tracking-[0.22em] text-slate-500">
                            {item.sku}
                          </div>
                          <h3 className="mt-2 font-display text-2xl font-semibold tracking-tight text-slate-950">
                            {item.name}
                          </h3>
                        </div>
                        <Badge
                          variant={outOfStock ? "destructive" : "secondary"}
                          className="rounded-full"
                        >
                          {outOfStock ? "Out" : `${item.stock_qty} in stock`}
                        </Badge>
                      </div>

                      <div className="flex items-end gap-3">
                        <div className="text-3xl font-semibold text-slate-950">
                          {formatMoney(finalPrice)}
                        </div>
                        {discounted && (
                          <div className="pb-1 text-sm text-slate-400 line-through">
                            {formatMoney(basePrice)}
                          </div>
                        )}
                      </div>

                      <div className="text-sm text-slate-600">
                        {item.discount_type && item.discount_type !== "none"
                          ? item.discount_type === "percent"
                            ? `${toNumber(item.discount_value)}% discount applied`
                            : `${formatMoney(item.discount_value ?? 0)} discount applied`
                          : "Regular price"}
                      </div>

                      <Button
                        className="h-12 rounded-2xl"
                        onClick={() => addToCart(item)}
                        disabled={!item.is_active || outOfStock}
                      >
                        {outOfStock ? "Unavailable" : "Add to cart"}
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}

              {filteredItems.length === 0 && (
                <div className="glass-panel p-8 text-sm text-slate-600">
                  No items match your search.
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
