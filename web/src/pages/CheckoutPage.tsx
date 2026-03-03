// src/pages/CheckoutPage.tsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api";
import { useMe } from "@/lib/useMe";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

type MarketLite = { id: number; name: string; code: string; address?: string | null };

type CartItem = {
  item_id: number;
  name: string;
  price: number; // final price (after item discount) stored in cart
  qty: number;
};

type CreateOrderPayload = {
  market_id: number;
  items: { item_id: number; qty: number }[];
  promo_code?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  customer_address?: string | null;
  notes?: string | null;
};

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

function money(n: number) {
  return `${n.toFixed(2)}`;
}

export default function CheckoutPage() {
  const nav = useNavigate();
  const meQ = useMe();

  // ✅ active market comes from sidebar logic
  const storedMarketId = localStorage.getItem("activeMarketId") || "";
  const [marketId, setMarketId] = useState(storedMarketId);

  const myMarketsQ = useQuery({
    queryKey: ["my-markets-lite"],
    queryFn: async () => (await api.get("/api/my/markets")).data as MarketLite[],
    enabled: !!meQ.data,
  });

  // if no activeMarketId but user has exactly 1 market => auto set it
  useEffect(() => {
    if (!marketId && (myMarketsQ.data?.length ?? 0) === 1) {
      const id = String(myMarketsQ.data![0].id);
      localStorage.setItem("activeMarketId", id);
      setMarketId(id);
    }
  }, [marketId, myMarketsQ.data]);

  const [cart, setCart] = useState<CartItem[]>(() => (marketId ? loadCart(marketId) : []));

  // reload cart if market changes
  useEffect(() => {
    if (marketId) setCart(loadCart(marketId));
    else setCart([]);
  }, [marketId]);

  // form
  const [promoCode, setPromoCode] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [notes, setNotes] = useState("");

  // pref-fill from profile
  useEffect(() => {
    if (meQ.data?.name) setCustomerName(meQ.data.name);
  }, [meQ.data?.name]);

  const market = useMemo(() => {
    const idNum = Number(marketId);
    return (myMarketsQ.data ?? []).find((m) => m.id === idNum) || null;
  }, [myMarketsQ.data, marketId]);

  const totals = useMemo(() => {
    const qty = cart.reduce((a, c) => a + c.qty, 0);
    const subtotal = cart.reduce((a, c) => a + c.price * c.qty, 0);
    return { qty, subtotal };
  }, [cart]);

  function inc(itemId: number) {
    if (!marketId) return;
    setCart((prev) => {
      const next = prev.map((c) => (c.item_id === itemId ? { ...c, qty: c.qty + 1 } : c));
      saveCart(marketId, next);
      return next;
    });
  }

  function dec(itemId: number) {
    if (!marketId) return;
    setCart((prev) => {
      const next = prev
        .map((c) => (c.item_id === itemId ? { ...c, qty: c.qty - 1 } : c))
        .filter((c) => c.qty > 0);
      saveCart(marketId, next);
      return next;
    });
  }

  function clearCart() {
    if (!marketId) return;
    setCart([]);
    saveCart(marketId, []);
  }

  const createOrderM = useMutation({
    mutationFn: async () => {
      if (!marketId) throw new Error("Select a market");
      if (cart.length === 0) throw new Error("Cart is empty");

      const payload: CreateOrderPayload = {
        market_id: Number(marketId),
        items: cart.map((c) => ({ item_id: c.item_id, qty: c.qty })),
        promo_code: promoCode.trim() || null,
        customer_name: customerName.trim() || null,
        customer_phone: customerPhone.trim() || null,
        customer_address: customerAddress.trim() || null,
        notes: notes.trim() || null,
      };

      // ✅ adjust endpoint to your backend
      // Suggested: POST /api/orders
      return (await api.post("/api/orders", payload)).data;
    },
    onSuccess: async () => {
      // clear cart after order
      if (marketId) {
        saveCart(marketId, []);
        setCart([]);
      }
      nav("/orders", { replace: true });
    },
  });

  const errorMsg =
    (createOrderM.error as any)?.response?.data?.message ??
    (createOrderM.error as any)?.message ??
    null;

  const canSubmit =
    !!marketId &&
    cart.length > 0 &&
    customerName.trim().length >= 2 &&
    customerPhone.trim().length >= 6 &&
    customerAddress.trim().length >= 5;

  return (
    <div className="grid gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Checkout</h1>
          <div className="text-sm text-muted-foreground">
            Review cart and submit your order.
          </div>
        </div>
        <Button variant="secondary" onClick={() => nav(-1)}>
          Back
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
        {/* Left: Details */}
        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Customer details</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid gap-2">
                <Label>Name</Label>
                <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Your name" />
              </div>

              <div className="grid gap-2">
                <Label>Phone</Label>
                <Input
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="+995..."
                />
              </div>

              <div className="grid gap-2">
                <Label>Address</Label>
                <Input
                  value={customerAddress}
                  onChange={(e) => setCustomerAddress(e.target.value)}
                  placeholder="Street, building, apartment..."
                />
              </div>

              <div className="grid gap-2">
                <Label>Notes (optional)</Label>
                <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Door code, call me, etc." />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Cart</CardTitle>
              <Button variant="secondary" onClick={clearCart} disabled={cart.length === 0}>
                Clear
              </Button>
            </CardHeader>
            <CardContent className="grid gap-3">
              {!marketId ? (
                <div className="text-sm text-muted-foreground">
                  No active market selected. Go to markets and open one.
                </div>
              ) : cart.length === 0 ? (
                <div className="text-sm text-muted-foreground">Your cart is empty.</div>
              ) : (
                <div className="grid gap-3">
                  {cart.map((c) => (
                    <div key={c.item_id} className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-medium truncate">{c.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {money(c.price)} × {c.qty} = <span className="font-medium">{money(c.price * c.qty)}</span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="secondary" className="h-9 px-3" onClick={() => dec(c.item_id)}>
                          −
                        </Button>
                        <Button variant="secondary" className="h-9 px-3" onClick={() => inc(c.item_id)}>
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

        {/* Right: Summary */}
        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Summary</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Market</span>
                <span className="font-medium">
                  {market ? market.name : marketId ? `Market #${marketId}` : "—"}
                </span>
              </div>

              {market?.address && (
                <div className="text-xs text-muted-foreground">
                  {market.address}
                </div>
              )}

              <Separator />

              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Items</span>
                <span className="font-medium">{totals.qty}</span>
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-medium">{money(totals.subtotal)}</span>
              </div>

              <div className="grid gap-2 pt-2">
                <Label>Promo code (optional)</Label>
                <Input
                  value={promoCode}
                  onChange={(e) => setPromoCode(e.target.value)}
                  placeholder="e.g. SAVE10"
                />
                <div className="text-xs text-muted-foreground">
                  Promo is validated on backend.
                </div>
              </div>

              {errorMsg && (
                <div className="text-sm text-red-600">{errorMsg}</div>
              )}

              <Button
                onClick={() => createOrderM.mutate()}
                disabled={!canSubmit || createOrderM.isPending}
              >
                {createOrderM.isPending ? "Placing order..." : "Place order"}
              </Button>

              <div className="text-xs text-muted-foreground">
                <Badge variant="secondary" className="mr-2">Tip</Badge>
                If order fails, check backend endpoint: <span className="font-mono">POST /api/orders</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>What happens next?</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground grid gap-2">
              <div>1) Your order is created and appears in Orders.</div>
              <div>2) Market staff accepts and prepares it.</div>
              <div>3) Dispatcher assigns a driver (later).</div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}