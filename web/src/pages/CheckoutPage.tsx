import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, MapPinned, ShoppingBag } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api";
import { clearCart, getActiveMarketId, loadCart } from "@/lib/cart";
import type { CartItem } from "@/lib/cart";
import { formatMoney, toNumber } from "@/lib/format";
import { useMe } from "@/lib/useMe";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

type Market = {
  id: number;
  name: string;
  code: string;
  address?: string | null;
};

export default function CheckoutPage() {
  const navigate = useNavigate();
  const meQ = useMe();
  const [marketId] = useState(() => getActiveMarketId());
  const [cart, setCart] = useState<CartItem[]>(() => (marketId ? loadCart(marketId) : []));
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [dropoffLat, setDropoffLat] = useState("41.7151");
  const [dropoffLng, setDropoffLng] = useState("44.8271");
  const [priority, setPriority] = useState("2");
  const [promoCode, setPromoCode] = useState("");

  useEffect(() => {
    if (marketId) {
      setCart(loadCart(marketId));
    }
  }, [marketId]);

  useEffect(() => {
    if (meQ.data?.name) {
      setCustomerName((value) => value || meQ.data.name);
    }
  }, [meQ.data?.name]);

  const marketQ = useQuery({
    queryKey: ["checkout-market", marketId],
    queryFn: async () => (await api.get(`/api/public/markets/${marketId}`)).data as Market,
    enabled: !!marketId,
    retry: false,
  });

  const totals = useMemo(() => {
    const items = cart.reduce((sum, item) => sum + item.qty, 0);
    const subtotal = cart.reduce((sum, item) => sum + item.qty * item.price, 0);
    return { items, subtotal };
  }, [cart]);

  const createOrderM = useMutation({
    mutationFn: async () => {
      if (!cart.length) throw new Error("Your cart is empty.");

      const cartSummary = cart.map((item) => `${item.name} x${item.qty}`).join(", ");
      const pickupAddressParts = [
        marketQ.data?.name ? `Market: ${marketQ.data.name}` : null,
        cartSummary ? `Items: ${cartSummary}` : null,
        promoCode.trim() ? `Promo: ${promoCode.trim()}` : null,
        customerName.trim() ? `Customer: ${customerName.trim()}` : null,
        customerPhone.trim() ? `Phone: ${customerPhone.trim()}` : null,
      ].filter(Boolean);

      const payload = {
        pickup_address: pickupAddressParts.join(" | ") || "Market pickup",
        dropoff_address: customerAddress.trim(),
        dropoff_lat: toNumber(dropoffLat),
        dropoff_lng: toNumber(dropoffLng),
        priority: toNumber(priority, 2),
        size: Math.max(totals.items, 1),
      };

      return (await api.post("/api/orders", payload)).data;
    },
    onSuccess: async () => {
      if (marketId) {
        clearCart(marketId);
        setCart([]);
      }
      navigate("/orders", { replace: true });
    },
  });

  function increment(itemId: number) {
    if (!marketId) return;

    const next = cart.map((item) => (item.item_id === itemId ? { ...item, qty: item.qty + 1 } : item));
    localStorage.setItem(`cart_market_${marketId}`, JSON.stringify(next));
    setCart(next);
  }

  function decrement(itemId: number) {
    if (!marketId) return;

    const next = cart
      .map((item) => (item.item_id === itemId ? { ...item, qty: item.qty - 1 } : item))
      .filter((item) => item.qty > 0);
    localStorage.setItem(`cart_market_${marketId}`, JSON.stringify(next));
    setCart(next);
  }

  const errorMessage =
    (createOrderM.error as any)?.response?.data?.message ??
    (createOrderM.error as Error | null)?.message ??
    null;

  const canSubmit =
    cart.length > 0 &&
    customerName.trim().length >= 2 &&
    customerPhone.trim().length >= 6 &&
    customerAddress.trim().length >= 5 &&
    Number.isFinite(Number(dropoffLat)) &&
    Number.isFinite(Number(dropoffLng));

  return (
    <div className="grid gap-6">
      <div className="flex flex-col gap-4 rounded-[30px] bg-[linear-gradient(135deg,_rgba(251,191,36,0.18),_rgba(255,255,255,0.92)),linear-gradient(180deg,_#fffefc_0%,_#fff7ec_100%)] p-6 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Checkout</div>
          <h1 className="font-display mt-2 text-4xl font-semibold tracking-tight text-slate-950">
            Dispatch-ready order handoff
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            This checkout creates an order using the current backend contract, so we capture the
            customer address plus dispatch coordinates and summarize cart items in the pickup note.
          </p>
        </div>
        <Button variant="secondary" className="rounded-2xl" onClick={() => navigate(-1)}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="grid gap-6">
          <Card className="rounded-[30px]">
            <CardHeader>
              <CardTitle className="font-display text-2xl">Customer and delivery details</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid gap-2">
                <Label>Name</Label>
                <Input value={customerName} onChange={(event) => setCustomerName(event.target.value)} className="h-11 rounded-2xl" />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label>Phone</Label>
                  <Input value={customerPhone} onChange={(event) => setCustomerPhone(event.target.value)} className="h-11 rounded-2xl" />
                </div>
                <div className="grid gap-2">
                  <Label>Priority</Label>
                  <Input value={priority} onChange={(event) => setPriority(event.target.value)} className="h-11 rounded-2xl" />
                </div>
              </div>

              <div className="grid gap-2">
                <Label>Delivery address</Label>
                <Input value={customerAddress} onChange={(event) => setCustomerAddress(event.target.value)} className="h-11 rounded-2xl" />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label>Dropoff latitude</Label>
                  <Input value={dropoffLat} onChange={(event) => setDropoffLat(event.target.value)} className="h-11 rounded-2xl" />
                </div>
                <div className="grid gap-2">
                  <Label>Dropoff longitude</Label>
                  <Input value={dropoffLng} onChange={(event) => setDropoffLng(event.target.value)} className="h-11 rounded-2xl" />
                </div>
              </div>

              <div className="rounded-[24px] border border-amber-200 bg-amber-50/80 p-4 text-sm text-amber-900">
                Coordinates are required because the current backend `POST /api/orders` endpoint
                validates `dropoff_lat` and `dropoff_lng`.
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-[30px]">
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <CardTitle className="font-display text-2xl">Cart review</CardTitle>
              <Button
                variant="secondary"
                className="rounded-2xl"
                onClick={() => {
                  if (!marketId) return;
                  clearCart(marketId);
                  setCart([]);
                }}
                disabled={!cart.length}
              >
                Clear
              </Button>
            </CardHeader>
            <CardContent className="grid gap-3">
              {cart.length === 0 ? (
                <div className="rounded-[24px] bg-slate-50 p-5 text-sm text-slate-600">
                  Your cart is empty. Add items from a market first.
                </div>
              ) : (
                cart.map((item) => (
                  <div
                    key={item.item_id}
                    className="flex items-center justify-between gap-4 rounded-[24px] border border-slate-200/70 bg-white p-4"
                  >
                    <div className="min-w-0">
                      <div className="truncate font-semibold text-slate-950">{item.name}</div>
                      <div className="text-sm text-slate-500">
                        {formatMoney(item.price)} each
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="secondary" className="rounded-xl" onClick={() => decrement(item.item_id)}>
                        -
                      </Button>
                      <div className="w-10 text-center text-sm font-semibold">{item.qty}</div>
                      <Button variant="secondary" className="rounded-xl" onClick={() => increment(item.item_id)}>
                        +
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6">
          <Card className="rounded-[30px]">
            <CardHeader>
              <CardTitle className="font-display text-2xl">Summary</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="rounded-[24px] bg-slate-950 p-5 text-white">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10">
                    <ShoppingBag className="h-5 w-5 text-amber-300" />
                  </div>
                  <div>
                    <div className="text-sm text-slate-300">Active market</div>
                    <div className="font-semibold text-white">
                      {marketQ.data?.name || (marketId ? `Market #${marketId}` : "No market selected")}
                    </div>
                  </div>
                </div>
                {marketQ.data?.address && (
                  <div className="mt-4 flex items-start gap-2 text-sm text-slate-300">
                    <MapPinned className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{marketQ.data.address}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">Items</span>
                <span className="font-semibold">{totals.items}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">Subtotal</span>
                <span className="font-semibold">{formatMoney(totals.subtotal)}</span>
              </div>

              <Separator />

              <div className="grid gap-2">
                <Label>Promo code</Label>
                <Input
                  value={promoCode}
                  onChange={(event) => setPromoCode(event.target.value)}
                  placeholder="Optional"
                  className="h-11 rounded-2xl"
                />
                <div className="text-xs text-slate-500">
                  Promo code is included in the pickup note for now so it stays visible in ops.
                </div>
              </div>

              {errorMessage && (
                <div className="rounded-[20px] bg-red-50 px-4 py-3 text-sm text-red-700">
                  {errorMessage}
                </div>
              )}

              <Button
                className="h-12 rounded-2xl"
                onClick={() => createOrderM.mutate()}
                disabled={!canSubmit || createOrderM.isPending}
              >
                {createOrderM.isPending ? "Placing order..." : "Place order"}
              </Button>

              <div className="rounded-[24px] border border-teal-200 bg-teal-50/70 p-4 text-sm text-teal-900">
                <Badge variant="secondary" className="mr-2 rounded-full">Backend aligned</Badge>
                Order payload is mapped to the dispatch order schema instead of a custom storefront
                schema, so it works against the current Laravel API.
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
