import { useMemo, useState } from "react";
import { ArrowLeft, MapPinned, ShoppingBag, TicketPercent } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { AxiosError } from "axios";

import { api } from "@/lib/api";
import { clearCart, getActiveMarketId, loadCart, saveCart } from "@/lib/cart";
import type { CartItem } from "@/lib/cart";
import { formatMoney, toNumber } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
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
  const { t } = useI18n();
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
      if (!cart.length) throw new Error(t("checkout.emptyCart"));
      if (!marketId) throw new Error(t("checkout.noMarketSelected"));

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

  const canSubmit =
    cart.length > 0 &&
    !!marketId &&
    effectiveCustomerName.trim().length >= 2 &&
    customerPhone.trim().length >= 6 &&
    customerAddress.trim().length >= 5 &&
    Number.isFinite(Number(dropoffLat)) &&
    Number.isFinite(Number(dropoffLng));

  return (
    <div className="grid gap-6">
      <div className="intro-panel">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="section-kicker">{t("checkout.title")}</div>
            <h1 className="intro-title">{t("checkout.introTitle")}</h1>
            <p className="intro-copy">{t("checkout.introCopy")}</p>
          </div>
          <Button variant="secondary" className="rounded-[16px]" onClick={() => navigate(-1)}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t("checkout.back")}
          </Button>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="grid gap-6">
          <Card className="rounded-[30px]">
            <CardHeader>
              <CardTitle className="font-display text-2xl">{t("checkout.customerDetails")}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid gap-2">
                <Label>{t("auth.name")}</Label>
                <Input value={effectiveCustomerName} onChange={(event) => setCustomerName(event.target.value)} className="h-11 rounded-2xl" />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label>{t("checkout.phone")}</Label>
                  <Input value={customerPhone} onChange={(event) => setCustomerPhone(event.target.value)} className="h-11 rounded-2xl" />
                </div>
                <div className="grid gap-2">
                  <Label>{t("checkout.priority")}</Label>
                  <Input value={priority} onChange={(event) => setPriority(event.target.value)} className="h-11 rounded-2xl" />
                </div>
              </div>

              <div className="grid gap-2">
                <Label>{t("checkout.address")}</Label>
                <Input value={customerAddress} onChange={(event) => setCustomerAddress(event.target.value)} className="h-11 rounded-2xl" />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label>{t("checkout.lat")}</Label>
                  <Input value={dropoffLat} onChange={(event) => setDropoffLat(event.target.value)} className="h-11 rounded-2xl" />
                </div>
                <div className="grid gap-2">
                  <Label>{t("checkout.lng")}</Label>
                  <Input value={dropoffLng} onChange={(event) => setDropoffLng(event.target.value)} className="h-11 rounded-2xl" />
                </div>
              </div>

              <div className="grid gap-2">
                <Label>{t("checkout.deliveryNotes")}</Label>
                <Input value={notes} onChange={(event) => setNotes(event.target.value)} className="h-11 rounded-2xl" />
              </div>
              {(marketQ.data?.delivery_slots ?? []).length > 0 && (
                <div className="grid gap-2">
                  <Label>Delivery slot</Label>
                  <div className="flex flex-wrap gap-2">
                    {(marketQ.data?.delivery_slots ?? []).map((slot, index) => {
                      const label = typeof slot === "string" ? slot : slot.label || `${slot.from} - ${slot.to}`;
                      const value = typeof slot === "string" ? `${slot}|${slot}|${slot}` : `${label}|${slot.from}|${slot.to}`;
                      return (
                        <button
                          key={`${label}-${index}`}
                          type="button"
                          onClick={() => setDeliverySlot(value)}
                          className={`status-chip ${deliverySlot === value ? "status-good" : "status-neutral"}`}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-[30px]">
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <CardTitle className="font-display text-2xl">{t("checkout.cartReview")}</CardTitle>
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
                {t("checkout.clear")}
              </Button>
            </CardHeader>
            <CardContent className="grid gap-3">
              {cart.length === 0 ? (
                <div className="rounded-[24px] bg-slate-50 p-5 text-sm text-slate-600">
                  {t("checkout.emptyCart")}
                </div>
              ) : (
                cart.map((item) => (
                  <div
                    key={item.item_id}
                    className="flex items-center justify-between gap-4 rounded-[24px] border border-slate-200/70 bg-white p-4"
                  >
                    <div className="min-w-0">
                      <div className="truncate font-semibold text-slate-950">{item.name}</div>
                      <div className="text-sm text-slate-500">{formatMoney(item.price)} {t("checkout.each")}</div>
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
              <CardTitle className="font-display text-2xl">{t("checkout.summary")}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="rounded-[24px] bg-slate-950 p-5 text-white">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10">
                    <ShoppingBag className="h-5 w-5 text-amber-300" />
                  </div>
                  <div>
                    <div className="text-sm text-slate-300">{t("checkout.activeMarket")}</div>
                    <div className="font-semibold text-white">
                      {marketQ.data?.name || (marketId ? `#${marketId}` : t("checkout.noMarketSelected"))}
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
                <span className="text-slate-500">{t("common.items")}</span>
                <span className="font-semibold">{totals.items}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">{t("market.subtotal")}</span>
                <span className="font-semibold">{formatMoney(totals.subtotal)}</span>
              </div>

              <Separator />

              <div className="grid gap-2">
                <Label>{t("checkout.promo")}</Label>
                <Input
                  value={promoCode}
                  onChange={(event) => setPromoCode(event.target.value)}
                  placeholder={t("checkout.optional")}
                  className="h-11 rounded-2xl"
                />
              </div>

              {promoCode.trim() ? (
                promoQuery.isLoading ? (
                  <div className="rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                    Checking promo code...
                  </div>
                ) : promoPreview?.valid ? (
                  <div className="rounded-[20px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
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
                  <div className="rounded-[20px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                    {promoPreview?.message || "Promo code was not found for this market."}
                  </div>
                )
              ) : null}

              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">Discount</span>
                <span className={`font-semibold ${discountTotal > 0 ? "text-emerald-700" : ""}`}>
                  {discountTotal > 0 ? `-${formatMoney(discountTotal)}` : formatMoney(0)}
                </span>
              </div>

              <div className="flex items-center justify-between text-base">
                <span className="font-semibold text-slate-700">Total</span>
                <span className="text-xl font-semibold text-slate-950">{formatMoney(finalTotal)}</span>
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
                {createOrderM.isPending ? t("checkout.placingOrder") : t("checkout.placeOrder")}
              </Button>

              <div className="rounded-[24px] border border-teal-200 bg-teal-50/70 p-4 text-sm text-teal-900">
                <Badge variant="secondary" className="mr-2 rounded-full">{t("checkout.liveDispatch")}</Badge>
                {t("checkout.liveDispatchText")}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
