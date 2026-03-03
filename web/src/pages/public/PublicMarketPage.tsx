// src/pages/public/PublicMarketPage.tsx
import { useMemo, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { auth } from "@/lib/auth";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

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
  discount_type: "percent" | "fixed";
  discount_value: number | string;
  is_active: boolean;
};

type CartItem = {
  item_id: number;
  name: string;
  price: number;
  qty: number;
};

function toNumber(x: number | string | undefined | null) {
  const n = Number(x ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function money(n: number) {
  // simple formatting
  return `${n.toFixed(2)}`;
}

function calcItemFinalPrice(i: Item) {
  const base = toNumber(i.price);
  const dt = i.discount_type ?? "none";
  const dv = toNumber(i.discount_value);

  if (dt === "percent") return Math.max(0, base - base * (dv / 100));
  if (dt === "fixed") return Math.max(0, base - dv);
  return base;
}

function cartKey(marketId: string) {
  return `cart_market_${marketId}`;
}

function loadCart(marketId: string): CartItem[] {
  try {
    const raw = localStorage.getItem(cartKey(marketId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(Boolean);
  } catch {
    return [];
  }
}

function saveCart(marketId: string, cart: CartItem[]) {
  localStorage.setItem(cartKey(marketId), JSON.stringify(cart));
}

export default function PublicMarketPage() {
  const nav = useNavigate();
  const { marketId } = useParams();
  const mid = marketId || "";

  const [q, setQ] = useState("");
  const [cart, setCart] = useState<CartItem[]>(() => (mid ? loadCart(mid) : []));

  // reload cart when marketId changes
  useMemo(() => {
    if (mid) setCart(loadCart(mid));
  }, [mid]);

  const marketQ = useQuery({
    queryKey: ["public-market", mid],
    queryFn: async () => (await api.get(`/api/public/markets/${mid}`)).data as Market,
    enabled: !!mid,
  });

  const itemsQ = useQuery({
    queryKey: ["public-market-items", mid],
    queryFn: async () => (await api.get(`/api/public/markets/${mid}/items`)).data as Item[],
    enabled: !!mid,
  });

  const promoQ = useQuery({
    queryKey: ["public-market-promo", mid],
    queryFn: async () => (await api.get(`/api/public/markets/${mid}/active-promo`)).data as Promo | null,
    enabled: !!mid,
    retry: false,
  });

  const items = itemsQ.data ?? [];

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    const active = items.filter((i) => i.is_active);
    if (!s) return active;
    return active.filter((i) => {
      const name = (i.name || "").toLowerCase();
      const sku = (i.sku || "").toLowerCase();
      return name.includes(s) || sku.includes(s);
    });
  }, [items, q]);

  const totals = useMemo(() => {
    const qty = cart.reduce((a, c) => a + c.qty, 0);
    const sum = cart.reduce((a, c) => a + c.price * c.qty, 0);
    return { qty, sum };
  }, [cart]);

  function addToCart(item: Item) {
    if (!mid) return;
    const finalPrice = calcItemFinalPrice(item);

    setCart((prev) => {
      const next = [...prev];
      const idx = next.findIndex((x) => x.item_id === item.id);

      if (idx >= 0) {
        next[idx] = { ...next[idx], qty: next[idx].qty + 1 };
      } else {
        next.push({ item_id: item.id, name: item.name, price: finalPrice, qty: 1 });
      }

      saveCart(mid, next);
      return next;
    });
  }

  function decFromCart(itemId: number) {
    if (!mid) return;
    setCart((prev) => {
      const next = prev
        .map((c) => (c.item_id === itemId ? { ...c, qty: c.qty - 1 } : c))
        .filter((c) => c.qty > 0);
      saveCart(mid, next);
      return next;
    });
  }

  function clearCart() {
    if (!mid) return;
    setCart([]);
    saveCart(mid, []);
  }

  function goCheckout() {
    // require login for checkout
    const token = auth.getToken();
    if (!token) {
      const next = encodeURIComponent("/checkout");
      nav(`/login?next=${next}`, { replace: true });
      return;
    }
    nav("/checkout");
  }

  if (!marketId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Market</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">Missing market id.</CardContent>
      </Card>
    );
  }

  const market = marketQ.data;
  const promo = promoQ.data ?? null;

  return (
    <div className="grid gap-6">
      {/* Top bar */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3">
          <div>
            <div className="text-sm text-muted-foreground">
              <Link to="/" className="hover:underline">
                Markets
              </Link>{" "}
              / <span className="text-foreground">{market ? market.name : `Market #${marketId}`}</span>
            </div>
            <h1 className="text-2xl font-semibold leading-tight">
              {marketQ.isLoading ? "Loading..." : market?.name ?? `Market #${marketId}`}
            </h1>
            <div className="text-sm text-muted-foreground">
              {market?.address ? market.address : "—"}
              {market?.is_active === false ? (
                <span className="ml-2">
                  <Badge variant="destructive">Closed</Badge>
                </span>
              ) : (
                <span className="ml-2">
                  <Badge variant="secondary">Open</Badge>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Cart summary */}
        <Card className="w-full md:w-[420px]">
          <CardHeader className="py-3">
            <CardTitle className="text-base">Cart</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Items</span>
              <span className="font-medium">{totals.qty}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-medium">{money(totals.sum)}</span>
            </div>

            <div className="flex gap-2 pt-1">
              <Button className="flex-1" onClick={goCheckout} disabled={totals.qty === 0}>
                Checkout
              </Button>
              <Button variant="secondary" onClick={clearCart} disabled={totals.qty === 0}>
                Clear
              </Button>
            </div>

            {cart.length > 0 && (
              <div className="pt-2 grid gap-2">
                {cart.map((c) => (
                  <div key={c.item_id} className="flex items-center justify-between text-sm">
                    <div className="min-w-0">
                      <div className="font-medium truncate">{c.name}</div>
                      <div className="text-muted-foreground">
                        {c.qty} × {money(c.price)}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="secondary"
                        className="h-8 px-3"
                        onClick={() => decFromCart(c.item_id)}
                      >
                        −
                      </Button>
                      <Button
                        variant="secondary"
                        className="h-8 px-3"
                        onClick={() => {
                          // +1 without needing item list
                          setCart((prev) => {
                            const next = prev.map((x) =>
                              x.item_id === c.item_id ? { ...x, qty: x.qty + 1 } : x
                            );
                            saveCart(mid, next);
                            return next;
                          });
                        }}
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
      </div>

      {/* Promo banner */}
      {promo && promo.is_active && (
        <Card>
          <CardContent className="py-4 flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-2">
              <Badge>Promo</Badge>
              <div className="text-sm">
                Use code <span className="font-semibold">{promo.code}</span> —{" "}
                {promo.discount_type === "percent"
                  ? `${toNumber(promo.discount_value)}% off`
                  : `${money(toNumber(promo.discount_value))} off`}
              </div>
            </div>
            <div className="text-xs text-muted-foreground">
              Applied at checkout (login required).
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search + Items */}
      <Card>
        <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <CardTitle>Items</CardTitle>
          <div className="w-full md:w-[340px]">
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search items (name or sku)..." />
          </div>
        </CardHeader>

        <CardContent>
          {itemsQ.isLoading ? (
            <div className="text-sm text-muted-foreground">Loading items...</div>
          ) : itemsQ.error ? (
            <div className="text-sm text-red-600">
              Failed to load items. Make sure you created public endpoints:
              <div className="mt-1 text-xs text-muted-foreground">
                GET /api/public/markets/{marketId}/items
              </div>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((i) => {
                const base = toNumber(i.price);
                const final = calcItemFinalPrice(i);
                const hasDiscount = Math.abs(final - base) > 0.0001;

                const outOfStock = (i.stock_qty ?? 0) <= 0;

                return (
                  <Card key={i.id} className="overflow-hidden">
                    <CardHeader className="py-3">
                      <CardTitle className="text-base flex items-start justify-between gap-2">
                        <span className="truncate">{i.name}</span>
                        {!i.is_active && <Badge variant="destructive">Inactive</Badge>}
                      </CardTitle>
                      <div className="text-xs text-muted-foreground">SKU: {i.sku}</div>
                    </CardHeader>
                    <CardContent className="grid gap-2 pb-4">
                      <div className="flex items-center gap-2">
                        <div className="text-lg font-semibold">{money(final)}</div>
                        {hasDiscount && (
                          <div className="text-sm text-muted-foreground line-through">{money(base)}</div>
                        )}
                        {i.discount_type && i.discount_type !== "none" && (
                          <Badge variant="secondary">
                            {i.discount_type === "percent"
                              ? `-${toNumber(i.discount_value)}%`
                              : `-${money(toNumber(i.discount_value))}`}
                          </Badge>
                        )}
                      </div>

                      <div className="text-xs text-muted-foreground">
                        Stock: {i.stock_qty}
                        {outOfStock && <span className="ml-2 text-red-600">Out of stock</span>}
                      </div>

                      <Button
                        onClick={() => addToCart(i)}
                        disabled={!i.is_active || outOfStock}
                      >
                        Add to cart
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}

              {filtered.length === 0 && (
                <div className="text-sm text-muted-foreground">
                  No items found.
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}