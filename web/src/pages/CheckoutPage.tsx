import { useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  MapPin,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Store,
  TicketPercent,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { AxiosError } from "axios";

import ThemeToggle from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { api } from "@/lib/api";
import { clearCart, getActiveMarketId, loadCart, saveCart } from "@/lib/cart";
import type { CartItem } from "@/lib/cart";
import { formatMoney, toNumber } from "@/lib/format";
import { useMe } from "@/lib/useMe";

type Market = {
  id: number;
  name: string;
  code: string;
  address?: string | null;
  delivery_slots?: Array<{ label?: string; from?: string; to?: string } | string>;
};

type PromoPreview = {
  valid: boolean;
  message?: string;
  discount_total: number | string;
  total: number | string;
  promo?: {
    id: number;
    code: string;
    type: "percent" | "fixed";
    value: number | string;
    is_active: boolean;
  };
};

function getErrorMessage(error: unknown) {
  if (!error || typeof error !== "object") {
    return null;
  }

  const axiosError = error as AxiosError<{ message?: string }>;
  return axiosError.response?.data?.message ?? (error as Error | null)?.message ?? null;
}

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
  const [notes, setNotes] = useState("");
  const [deliverySlot, setDeliverySlot] = useState("");

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

  const promoQuery = useQuery({
    queryKey: ["checkout-promo-preview", marketId, promoCode.trim().toUpperCase(), totals.subtotal],
    queryFn: async () =>
      (
        await api.get(`/api/public/markets/${marketId}/validate-promo`, {
          params: {
            code: promoCode.trim(),
            subtotal: totals.subtotal,
          },
        })
      ).data as PromoPreview,
    enabled: !!marketId && promoCode.trim().length > 0 && totals.subtotal > 0,
    retry: false,
  });

  const promoPreview = promoCode.trim() ? promoQuery.data : null;
  const discountTotal = promoPreview?.valid ? toNumber(promoPreview.discount_total) : 0;
  const finalTotal = promoPreview?.valid ? toNumber(promoPreview.total) : totals.subtotal;
  const effectiveCustomerName = customerName || meQ.data?.name || "";

  const createOrderM = useMutation({
    mutationFn: async () => {
      if (!cart.length) {
        throw new Error("Your cart is empty. Add items before placing an order.");
      }

      if (!marketId) {
        throw new Error("No market selected.");
      }

      const payload = {
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

  function persistCart(next: CartItem[]) {
    setCart(next);
    if (marketId) {
      saveCart(marketId, next);
    }
  }

  function increment(itemId: number) {
    persistCart(cart.map((item) => (item.item_id === itemId ? { ...item, qty: item.qty + 1 } : item)));
  }

  function decrement(itemId: number) {
    persistCart(
      cart
        .map((item) => (item.item_id === itemId ? { ...item, qty: item.qty - 1 } : item))
        .filter((item) => item.qty > 0),
    );
  }

  const errorMessage = getErrorMessage(createOrderM.error);
  const deliverySlots = marketQ.data?.delivery_slots ?? [];
  const canSubmit =
    cart.length > 0 &&
    !!marketId &&
    effectiveCustomerName.trim().length >= 2 &&
    customerPhone.trim().length >= 6 &&
    customerAddress.trim().length >= 5 &&
    Number.isFinite(Number(dropoffLat)) &&
    Number.isFinite(Number(dropoffLng));

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-50 via-white to-zinc-100/40 text-zinc-900 dark:from-zinc-950 dark:via-zinc-950 dark:to-zinc-900 dark:text-zinc-100">
      <nav className="sticky top-0 z-50 border-b border-zinc-200/80 bg-white/90 backdrop-blur-xl dark:border-zinc-800 dark:bg-zinc-950/90">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          <button
            type="button"
            onClick={() => navigate(marketId ? `/m/${marketId}` : "/")}
            className="flex items-center gap-3 text-zinc-700 transition-colors hover:text-cyan-600 dark:text-zinc-300"
          >
            <ArrowLeft className="h-5 w-5" />
            <span className="font-medium">{marketId ? "Back to Market" : "Back to Markets"}</span>
          </button>

          <div className="flex items-center gap-4">
            <div className="hidden rounded-full border border-zinc-200 bg-zinc-50 px-4 py-2 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 sm:block">
              Secure checkout
            </div>
            <ThemeToggle />
          </div>
        </div>
      </nav>

      <div className="mx-auto max-w-7xl px-4 pb-24 pt-8 sm:px-6 sm:pt-10">
        <section className="relative mb-10 overflow-hidden rounded-[2.25rem] border border-zinc-200 shadow-[0_20px_80px_rgba(0,0,0,0.18)] dark:border-zinc-800">
          <div className="absolute inset-0 bg-gradient-to-br from-zinc-950 via-zinc-900 to-black" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_22%,rgba(34,211,238,0.18),transparent_24%),radial-gradient(circle_at_86%_14%,rgba(168,85,247,0.16),transparent_22%),radial-gradient(circle_at_50%_100%,rgba(244,114,182,0.12),transparent_30%)]" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />

          <div className="relative px-6 py-8 text-white sm:px-10 sm:py-10 lg:px-12 lg:py-12">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-5 py-2 backdrop-blur-md">
                <Sparkles className="h-4 w-4 text-cyan-300" />
                <span className="text-sm font-medium">Premium Checkout</span>
              </div>

              <div className="flex flex-wrap gap-3">
                <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm backdrop-blur-md">
                  {totals.items} items
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm backdrop-blur-md">
                  {formatMoney(finalTotal)}
                </div>
              </div>
            </div>

            <div className="mt-10 grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-end">
              <div>
                <div className="mb-5 flex flex-wrap gap-3">
                  <span className="rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm">
                    Live dispatch routing
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm">
                    Promo-ready summary
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm">
                    Customer-first flow
                  </span>
                </div>

                <h1 className="text-4xl font-bold tracking-tighter sm:text-6xl lg:text-7xl">
                  Finish your order with confidence
                </h1>

                <p className="mt-5 max-w-2xl text-base leading-relaxed text-white/80 sm:text-lg">
                  Review your cart, confirm delivery details, and send this order straight into the
                  Smart Dispatch workflow with the same premium storefront feel.
                </p>
              </div>

              <div className="grid gap-4">
                <div className="rounded-[1.75rem] border border-white/10 bg-white/10 p-5 backdrop-blur-xl">
                  <div className="mb-2 text-xs uppercase tracking-wider text-white/60">Active Market</div>
                  <div className="text-2xl font-semibold tracking-tight">
                    {marketQ.data?.name || (marketId ? `Market #${marketId}` : "Select a market")}
                  </div>
                  <div className="mt-3 text-sm leading-relaxed text-white/75">
                    {marketQ.data?.address || "Orders from this session will be checked out here."}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-[1.5rem] border border-white/10 bg-white/10 p-5 backdrop-blur-xl">
                    <div className="mb-2 text-xs uppercase tracking-wider text-white/60">Cart Count</div>
                    <div className="text-3xl font-bold">{totals.items}</div>
                  </div>

                  <div className="rounded-[1.5rem] border border-white/10 bg-white/10 p-5 backdrop-blur-xl">
                    <div className="mb-2 text-xs uppercase tracking-wider text-white/60">Discount</div>
                    <div className="text-3xl font-bold">
                      {discountTotal > 0 ? `-${formatMoney(discountTotal)}` : formatMoney(0)}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {!marketId ? (
          <div className="rounded-[2rem] border border-dashed border-zinc-300 bg-white p-12 text-center shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-100 dark:bg-zinc-800">
              <Store className="h-6 w-6 text-zinc-500 dark:text-zinc-300" />
            </div>
            <div className="text-xl font-semibold text-zinc-900 dark:text-white">No market selected</div>
            <p className="mt-2 text-zinc-500 dark:text-zinc-400">
              Start from a public market to build a cart before checking out.
            </p>
            <Button className="mt-6 rounded-2xl" onClick={() => navigate("/")}>
              Browse Markets
            </Button>
          </div>
        ) : (
          <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:gap-10">
            <div className="grid gap-8">
              <section className="rounded-[2rem] border border-zinc-200 bg-white/90 p-6 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/90 sm:p-8">
                <div className="mb-6 flex items-center gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-50 dark:bg-cyan-950/40">
                    <MapPin className="h-6 w-6 text-cyan-600 dark:text-cyan-400" />
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-[3px] text-cyan-600 dark:text-cyan-400">
                      Delivery
                    </div>
                    <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
                      Customer Details
                    </h2>
                  </div>
                </div>

                <div className="grid gap-5">
                  <div className="grid gap-2">
                    <Label className="text-sm font-medium">Name</Label>
                    <Input
                      value={effectiveCustomerName}
                      onChange={(event) => setCustomerName(event.target.value)}
                      className="h-14 rounded-2xl border-zinc-300 dark:border-zinc-700"
                    />
                  </div>

                  <div className="grid gap-5 md:grid-cols-2">
                    <div className="grid gap-2">
                      <Label className="text-sm font-medium">Phone</Label>
                      <Input
                        value={customerPhone}
                        onChange={(event) => setCustomerPhone(event.target.value)}
                        className="h-14 rounded-2xl border-zinc-300 dark:border-zinc-700"
                      />
                    </div>

                    <div className="grid gap-2">
                      <Label className="text-sm font-medium">Priority</Label>
                      <Input
                        value={priority}
                        onChange={(event) => setPriority(event.target.value)}
                        className="h-14 rounded-2xl border-zinc-300 dark:border-zinc-700"
                      />
                    </div>
                  </div>

                  <div className="grid gap-2">
                    <Label className="text-sm font-medium">Address</Label>
                    <Input
                      value={customerAddress}
                      onChange={(event) => setCustomerAddress(event.target.value)}
                      className="h-14 rounded-2xl border-zinc-300 dark:border-zinc-700"
                    />
                  </div>

                  <div className="grid gap-5 md:grid-cols-2">
                    <div className="grid gap-2">
                      <Label className="text-sm font-medium">Latitude</Label>
                      <Input
                        value={dropoffLat}
                        onChange={(event) => setDropoffLat(event.target.value)}
                        className="h-14 rounded-2xl border-zinc-300 dark:border-zinc-700"
                      />
                    </div>

                    <div className="grid gap-2">
                      <Label className="text-sm font-medium">Longitude</Label>
                      <Input
                        value={dropoffLng}
                        onChange={(event) => setDropoffLng(event.target.value)}
                        className="h-14 rounded-2xl border-zinc-300 dark:border-zinc-700"
                      />
                    </div>
                  </div>

                  <div className="grid gap-2">
                    <Label className="text-sm font-medium">Delivery Notes</Label>
                    <Input
                      value={notes}
                      onChange={(event) => setNotes(event.target.value)}
                      placeholder="Apartment, gate code, or handoff notes"
                      className="h-14 rounded-2xl border-zinc-300 dark:border-zinc-700"
                    />
                  </div>

                  {deliverySlots.length > 0 ? (
                    <div className="grid gap-3">
                      <Label className="text-sm font-medium">Delivery Slot</Label>
                      <div className="flex flex-wrap gap-2">
                        {deliverySlots.map((slot, index) => {
                          const label =
                            typeof slot === "string" ? slot : slot.label || `${slot.from} - ${slot.to}`;
                          const value =
                            typeof slot === "string"
                              ? `${slot}|${slot}|${slot}`
                              : `${label}|${slot.from}|${slot.to}`;

                          return (
                            <button
                              key={`${label}-${index}`}
                              type="button"
                              onClick={() => setDeliverySlot(value)}
                              className={[
                                "rounded-full border px-4 py-2 text-sm font-medium transition-colors",
                                deliverySlot === value
                                  ? "border-cyan-600 bg-cyan-600 text-white"
                                  : "border-zinc-300 bg-zinc-50 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800",
                              ].join(" ")}
                            >
                              {label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}
                </div>
              </section>

              <section className="rounded-[2rem] border border-zinc-200 bg-white/90 p-6 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/90 sm:p-8">
                <div className="mb-6 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-50 dark:bg-cyan-950/40">
                      <ShoppingBag className="h-6 w-6 text-cyan-600 dark:text-cyan-400" />
                    </div>
                    <div>
                      <div className="text-xs uppercase tracking-[3px] text-cyan-600 dark:text-cyan-400">
                        Cart
                      </div>
                      <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
                        Review Items
                      </h2>
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    className="rounded-2xl"
                    onClick={() => {
                      if (!marketId) {
                        return;
                      }

                      clearCart(marketId);
                      setCart([]);
                    }}
                    disabled={!cart.length}
                  >
                    Clear Cart
                  </Button>
                </div>

                {cart.length === 0 ? (
                  <div className="rounded-[1.75rem] border border-dashed border-zinc-300 bg-zinc-50 p-10 text-center text-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-400">
                    Your cart is empty. Add items before placing an order.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {cart.map((item) => (
                      <div
                        key={item.item_id}
                        className="rounded-[1.75rem] border border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-950/70 sm:p-5"
                      >
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                          <div className="min-w-0">
                            <div className="truncate text-lg font-semibold">{item.name}</div>
                            <div className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                              {formatMoney(item.price)} each
                            </div>
                          </div>

                          <div className="flex items-center gap-3 self-start sm:self-center">
                            <div className="text-right font-semibold text-zinc-900 dark:text-white">
                              {formatMoney(item.price * item.qty)}
                            </div>

                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                className="h-10 w-10 rounded-xl px-0"
                                onClick={() => decrement(item.item_id)}
                              >
                                -
                              </Button>
                              <div className="w-8 text-center font-medium">{item.qty}</div>
                              <Button
                                variant="outline"
                                className="h-10 w-10 rounded-xl px-0"
                                onClick={() => increment(item.item_id)}
                              >
                                +
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>

            <aside className="lg:w-full">
              <div className="sticky top-24 rounded-[2rem] border border-zinc-200 bg-white/90 p-6 shadow-xl backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/90 sm:p-7">
                <div className="mb-6 flex items-center gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-50 dark:bg-cyan-950/40">
                    <Store className="h-6 w-6 text-cyan-600 dark:text-cyan-400" />
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-[3px] text-cyan-600 dark:text-cyan-400">
                      Summary
                    </div>
                    <h2 className="mt-2 text-2xl font-semibold tracking-tight">Order Snapshot</h2>
                  </div>
                </div>

                <div className="rounded-[1.75rem] bg-gradient-to-br from-zinc-900 to-black p-5 text-white">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10">
                      <ShoppingBag className="h-5 w-5 text-cyan-300" />
                    </div>
                    <div>
                      <div className="text-sm text-white/70">Active market</div>
                      <div className="font-semibold">
                        {marketQ.data?.name || `Market #${marketId}`}
                      </div>
                    </div>
                  </div>

                  {marketQ.data?.address ? (
                    <div className="mt-4 flex items-start gap-2 text-sm text-white/75">
                      <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>{marketQ.data.address}</span>
                    </div>
                  ) : null}
                </div>

                <div className="mt-6 space-y-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-zinc-500 dark:text-zinc-400">Items</span>
                    <span className="font-semibold">{totals.items}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-zinc-500 dark:text-zinc-400">Subtotal</span>
                    <span className="font-semibold">{formatMoney(totals.subtotal)}</span>
                  </div>

                  <Separator />

                  <div className="grid gap-2">
                    <Label className="text-sm font-medium">Promo Code</Label>
                    <Input
                      value={promoCode}
                      onChange={(event) => setPromoCode(event.target.value)}
                      placeholder="Optional"
                      className="h-14 rounded-2xl border-zinc-300 dark:border-zinc-700"
                    />
                  </div>

                  {promoCode.trim() ? (
                    promoQuery.isLoading ? (
                      <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300">
                        Checking promo code...
                      </div>
                    ) : promoPreview?.valid ? (
                      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">
                        <div className="flex items-center gap-2 font-semibold">
                          <TicketPercent className="h-4 w-4" />
                          {promoPreview.promo?.code} applied
                        </div>
                        <div className="mt-1">
                          {promoPreview.promo?.type === "percent"
                            ? `${toNumber(promoPreview.promo.value)}% discount applied`
                            : `${formatMoney(promoPreview.promo?.value)} discount applied`}
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                        {promoPreview?.message || "Promo code was not found for this market."}
                      </div>
                    )
                  ) : null}

                  <div className="flex items-center justify-between text-sm">
                    <span className="text-zinc-500 dark:text-zinc-400">Discount</span>
                    <span className={discountTotal > 0 ? "font-semibold text-emerald-600 dark:text-emerald-400" : "font-semibold"}>
                      {discountTotal > 0 ? `-${formatMoney(discountTotal)}` : formatMoney(0)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-base">
                    <span className="font-semibold text-zinc-700 dark:text-zinc-200">Total</span>
                    <span className="text-2xl font-semibold text-zinc-950 dark:text-white">
                      {formatMoney(finalTotal)}
                    </span>
                  </div>
                </div>

                {errorMessage ? (
                  <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200">
                    {errorMessage}
                  </div>
                ) : null}

                <Button
                  className="mt-6 h-14 w-full rounded-2xl text-base font-semibold"
                  onClick={() => createOrderM.mutate()}
                  disabled={!canSubmit || createOrderM.isPending}
                >
                  {createOrderM.isPending ? "Placing Order..." : "Place Order"}
                  {!createOrderM.isPending ? <ArrowRight className="ml-2 h-4 w-4" /> : null}
                </Button>

                <div className="mt-6 rounded-[1.75rem] border border-cyan-200 bg-cyan-50/80 p-4 text-sm text-cyan-900 dark:border-cyan-900 dark:bg-cyan-950/20 dark:text-cyan-100">
                  <div className="flex items-center gap-2 font-semibold">
                    <ShieldCheck className="h-4 w-4" />
                    Live dispatch handoff
                  </div>
                  <div className="mt-2 leading-relaxed text-cyan-900/80 dark:text-cyan-100/80">
                    This order goes straight into the live dispatch workflow as soon as it is created.
                  </div>
                </div>
              </div>
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}
