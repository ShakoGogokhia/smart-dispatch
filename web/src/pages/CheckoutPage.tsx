import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  AlertCircle,
  ArrowLeft,
  ChevronDown,
  Clock3,
  MapPin,
  Minus,
  Plus,
  ShieldCheck,
  ShoppingBag,
  Store,
  TicketPercent,
  Trash2,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { AxiosError } from "axios";

import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { StorefrontHeader } from "@/components/app/storefront-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { clearCart, getActiveMarketId, loadCart, saveCart } from "@/lib/cart";
import type { CartItem } from "@/lib/cart";
import { formatMoney, toNumber } from "@/lib/format";
import { resolveApiMediaUrl } from "@/lib/media";
import { useMe } from "@/lib/useMe";
import { cn } from "@/lib/utils";

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
  const effectiveCustomerPhone = customerPhone || meQ.data?.phone || "";
  const effectiveCustomerAddress = customerAddress || meQ.data?.address || "";

  useEffect(() => {
    if (meQ.data?.phone && !customerPhone) {
      setCustomerPhone(meQ.data.phone);
    }
  }, [customerPhone, meQ.data?.phone]);

  useEffect(() => {
    if (meQ.data?.address && !customerAddress) {
      setCustomerAddress(meQ.data.address);
    }
  }, [customerAddress, meQ.data?.address]);

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
        customer_phone: effectiveCustomerPhone.trim(),
        dropoff_address: effectiveCustomerAddress.trim(),
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
          ingredients: item.ingredients ?? [],
          removed_ingredients: item.removed_ingredients ?? [],
          combo_offer: item.combo_offer ?? null,
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

  function increment(cartId: string) {
    persistCart(cart.map((item) => (item.cart_id === cartId ? { ...item, qty: item.qty + 1 } : item)));
  }

  function decrement(cartId: string) {
    persistCart(
      cart
        .map((item) => (item.cart_id === cartId ? { ...item, qty: item.qty - 1 } : item))
        .filter((item) => item.qty > 0),
    );
  }

  const errorMessage = getErrorMessage(createOrderM.error);
  const deliverySlots = marketQ.data?.delivery_slots ?? [];
  const canSubmit =
    cart.length > 0 &&
    !!marketId &&
    effectiveCustomerName.trim().length >= 2 &&
    effectiveCustomerPhone.trim().length >= 6 &&
    effectiveCustomerAddress.trim().length >= 5 &&
    Number.isFinite(Number(dropoffLat)) &&
    Number.isFinite(Number(dropoffLng));

  const marketName = marketQ.data?.name || (marketId ? `Market #${marketId}` : "Select a market");
  const backPath = marketId ? `/m/${marketId}` : "/";
  const missing: string[] = [];
  if (effectiveCustomerName.trim().length < 2) missing.push("your name (at least 2 characters)");
  if (effectiveCustomerPhone.trim().length < 6) missing.push("a phone number (at least 6 digits)");
  if (effectiveCustomerAddress.trim().length < 5) missing.push("a delivery address (at least 5 characters)");
  if (!Number.isFinite(Number(dropoffLat)) || !Number.isFinite(Number(dropoffLng))) missing.push("valid map coordinates");

  const placeOrderButton = (
    <Button
      size="lg"
      className="w-full"
      onClick={() => createOrderM.mutate()}
      disabled={!canSubmit || createOrderM.isPending}
    >
      {createOrderM.isPending ? (
        <>
          <Spinner />
          Placing order...
        </>
      ) : (
        <>Place order · {formatMoney(finalTotal)}</>
      )}
    </Button>
  );

  const errorAlert = errorMessage ? (
    <Alert variant="destructive">
      <AlertCircle />
      <AlertTitle>Could not place the order</AlertTitle>
      <AlertDescription>{errorMessage}</AlertDescription>
    </Alert>
  ) : null;

  const totalsRows = (
    <div className="grid gap-2 text-sm">
      <SummaryRow label={`Subtotal (${totals.items} ${totals.items === 1 ? "item" : "items"})`} value={formatMoney(totals.subtotal)} />
      <SummaryRow
        label={promoPreview?.valid && promoPreview.promo?.code ? `Discount (${promoPreview.promo.code})` : "Discount"}
        value={discountTotal > 0 ? `-${formatMoney(discountTotal)}` : formatMoney(0)}
        valueClassName={discountTotal > 0 ? "text-success" : undefined}
      />
      <SummaryRow label="Delivery" value="Calculated by dispatch" valueClassName="text-muted-foreground font-normal" />
      <Separator className="my-1" />
      <div className="flex items-center justify-between gap-3">
        <span className="font-semibold">Total</span>
        <span className="text-xl font-semibold tabular-nums">{formatMoney(finalTotal)}</span>
      </div>
    </div>
  );

  const lineItems = (
    <ul className="grid gap-3">
      {cart.map((item) => (
        <SummaryLineItem key={item.cart_id} item={item} />
      ))}
    </ul>
  );

  const marketBlock = (
    <div className="flex items-center gap-3">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Store className="size-5" />
      </div>
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold">{marketName}</div>
        {marketQ.data?.address ? (
          <div className="flex items-center gap-1 truncate text-xs text-muted-foreground">
            <MapPin className="size-3 shrink-0" />
            <span className="truncate">{marketQ.data.address}</span>
          </div>
        ) : null}
      </div>
    </div>
  );

  const trustNote = (
    <div className="flex items-start gap-2 text-xs text-muted-foreground">
      <ShieldCheck className="mt-0.5 size-4 shrink-0 text-success" />
      <span>Your order goes straight to the market and our live dispatch team as soon as it is placed.</span>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <StorefrontHeader showLinks={false} />

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 md:py-8">
        <Button variant="ghost" size="sm" className="-ml-2 mb-2" onClick={() => navigate(backPath)}>
          <ArrowLeft />
          {marketId ? "Back to market" : "Back to markets"}
        </Button>

        <PageHeader
          title="Checkout"
          description="Confirm where to deliver, choose your options, and place your order."
          actions={
            marketId && cart.length > 0 ? (
              <Badge variant="secondary" className="gap-1.5">
                <ShieldCheck className="size-3.5" />
                Secure checkout
              </Badge>
            ) : null
          }
        />

        {!marketId ? (
          <EmptyState
            icon={Store}
            title="No market selected"
            description="Start from a market to build a cart before checking out."
            action={<Button onClick={() => navigate("/")}>Browse markets</Button>}
          />
        ) : cart.length === 0 ? (
          <EmptyState
            icon={ShoppingBag}
            title="Your cart is empty"
            description="Add items from a market before placing an order."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Button onClick={() => navigate(backPath)}>Back to {marketQ.data?.name ?? "market"}</Button>
                <Button variant="outline" onClick={() => navigate("/")}>
                  Browse markets
                </Button>
              </div>
            }
          />
        ) : (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
            {/* Mobile: collapsible summary on top */}
            <Card className="gap-0 py-0 lg:hidden">
              <Collapsible>
                <CollapsibleTrigger asChild>
                  <button type="button" className="group flex w-full items-center justify-between gap-3 px-4 py-3 text-left">
                    <span className="flex min-w-0 items-center gap-2 text-sm font-medium">
                      <ShoppingBag className="size-4 shrink-0 text-muted-foreground" />
                      <span className="truncate">
                        Order summary · {totals.items} {totals.items === 1 ? "item" : "items"}
                      </span>
                      <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
                    </span>
                    <span className="shrink-0 font-semibold tabular-nums">{formatMoney(finalTotal)}</span>
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="grid gap-4 border-t px-4 py-4">
                    {marketBlock}
                    {lineItems}
                    <Separator />
                    {totalsRows}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </Card>

            <div className="grid min-w-0 gap-6">
              {/* Step 1 */}
              <Card>
                <CardHeader>
                  <StepTitle step={1} title="Delivery details" description="Who receives the order and where we should bring it." />
                </CardHeader>
                <CardContent className="grid gap-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="grid gap-2">
                      <Label htmlFor="checkout-name">Full name</Label>
                      <Input
                        id="checkout-name"
                        value={effectiveCustomerName}
                        onChange={(event) => setCustomerName(event.target.value)}
                        aria-invalid={effectiveCustomerName.trim().length > 0 && effectiveCustomerName.trim().length < 2}
                        placeholder="Your name"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="checkout-email">Email</Label>
                      <Input id="checkout-email" value={meQ.data?.email || ""} readOnly disabled placeholder="Not signed in" />
                    </div>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="checkout-phone">Phone</Label>
                    <Input
                      id="checkout-phone"
                      value={effectiveCustomerPhone}
                      onChange={(event) => setCustomerPhone(event.target.value)}
                      aria-invalid={effectiveCustomerPhone.trim().length > 0 && effectiveCustomerPhone.trim().length < 6}
                      placeholder="Phone number"
                      inputMode="tel"
                    />
                    <p className="text-xs text-muted-foreground">The driver will call this number if they need help finding you.</p>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="checkout-address">Delivery address</Label>
                    <Input
                      id="checkout-address"
                      value={effectiveCustomerAddress}
                      onChange={(event) => setCustomerAddress(event.target.value)}
                      aria-invalid={effectiveCustomerAddress.trim().length > 0 && effectiveCustomerAddress.trim().length < 5}
                      placeholder="Street, building, apartment"
                    />
                  </div>

                  <div className="grid gap-3 rounded-lg border bg-muted/30 p-4">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <MapPin className="size-4 text-muted-foreground" />
                      Drop-off location
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="grid gap-2">
                        <Label htmlFor="checkout-lat">Latitude</Label>
                        <Input
                          id="checkout-lat"
                          value={dropoffLat}
                          onChange={(event) => setDropoffLat(event.target.value)}
                          aria-invalid={!Number.isFinite(Number(dropoffLat))}
                          inputMode="decimal"
                          className="bg-background tabular-nums"
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="checkout-lng">Longitude</Label>
                        <Input
                          id="checkout-lng"
                          value={dropoffLng}
                          onChange={(event) => setDropoffLng(event.target.value)}
                          aria-invalid={!Number.isFinite(Number(dropoffLng))}
                          inputMode="decimal"
                          className="bg-background tabular-nums"
                        />
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">Used to route the driver. Leave the defaults if you are not sure.</p>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="checkout-notes">Delivery notes</Label>
                    <Textarea
                      id="checkout-notes"
                      value={notes}
                      onChange={(event) => setNotes(event.target.value)}
                      placeholder="Apartment, gate code, or handoff notes"
                      rows={3}
                    />
                    <p className="text-xs text-muted-foreground">Optional.</p>
                  </div>
                </CardContent>
              </Card>

              {/* Step 2 */}
              <Card>
                <CardHeader>
                  <StepTitle step={2} title="Delivery options" description="Pick a delivery time and how urgent the order is." />
                </CardHeader>
                <CardContent className="grid gap-4">
                  {deliverySlots.length > 0 ? (
                    <div className="grid gap-2">
                      <Label>Delivery slot</Label>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {deliverySlots.map((slot, index) => {
                          const label =
                            typeof slot === "string" ? slot : slot.label || `${slot.from} - ${slot.to}`;
                          const value =
                            typeof slot === "string"
                              ? `${slot}|${slot}|${slot}`
                              : `${label}|${slot.from}|${slot.to}`;
                          const selected = deliverySlot === value;

                          return (
                            <button
                              key={`${label}-${index}`}
                              type="button"
                              aria-pressed={selected}
                              onClick={() => setDeliverySlot(value)}
                              className={cn(
                                "flex items-center gap-3 rounded-lg border p-3 text-left text-sm transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
                                selected ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:bg-accent",
                              )}
                            >
                              <Clock3 className={cn("size-4 shrink-0", selected ? "text-primary" : "text-muted-foreground")} />
                              <span className="min-w-0 truncate font-medium">{label}</span>
                            </button>
                          );
                        })}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {deliverySlot ? "You can change the slot any time before placing the order." : "No slot selected: we will deliver as soon as possible."}
                      </p>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">
                      <Clock3 className="size-4 shrink-0" />
                      This market delivers as soon as possible. No time slots to choose.
                    </div>
                  )}

                  <div className="grid gap-2 sm:max-w-xs">
                    <Label htmlFor="checkout-priority">Priority</Label>
                    <Input
                      id="checkout-priority"
                      value={priority}
                      onChange={(event) => setPriority(event.target.value)}
                      inputMode="numeric"
                      className="tabular-nums"
                    />
                    <p className="text-xs text-muted-foreground">Dispatch priority level. The default is 2.</p>
                  </div>
                </CardContent>
              </Card>

              {/* Step 3 */}
              <Card>
                <CardHeader>
                  <StepTitle step={3} title="Review items" description="Adjust quantities before you place the order." />
                  <CardAction>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        if (!marketId) {
                          return;
                        }

                        clearCart(marketId);
                        setCart([]);
                      }}
                      disabled={!cart.length}
                    >
                      <Trash2 />
                      Clear cart
                    </Button>
                  </CardAction>
                </CardHeader>
                <CardContent>
                  <ul className="divide-y rounded-lg border">
                    {cart.map((item) => (
                      <li key={item.cart_id} className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex min-w-0 items-center gap-3">
                          <ItemThumb item={item} />
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium">{item.name}</div>
                            <div className="text-xs text-muted-foreground tabular-nums">{formatMoney(item.price)} each</div>
                            <ItemCustomizations item={item} />
                          </div>
                        </div>
                        <div className="flex items-center justify-between gap-4 sm:justify-end">
                          <div className="flex items-center gap-1 rounded-md border">
                            <Button variant="ghost" size="icon-sm" aria-label={`Remove one ${item.name}`} onClick={() => decrement(item.cart_id)}>
                              <Minus />
                            </Button>
                            <span className="w-7 text-center text-sm font-medium tabular-nums">{item.qty}</span>
                            <Button variant="ghost" size="icon-sm" aria-label={`Add one ${item.name}`} onClick={() => increment(item.cart_id)}>
                              <Plus />
                            </Button>
                          </div>
                          <div className="w-20 text-right text-sm font-semibold tabular-nums">{formatMoney(item.price * item.qty)}</div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              {/* Step 4 */}
              <Card>
                <CardHeader>
                  <StepTitle step={4} title="Promo code" description="Have a code from this market? It is checked as you type." />
                </CardHeader>
                <CardContent className="grid gap-3">
                  <div className="grid gap-2 sm:max-w-sm">
                    <Label htmlFor="checkout-promo">Promo code</Label>
                    <div className="relative">
                      <TicketPercent className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="checkout-promo"
                        value={promoCode}
                        onChange={(event) => setPromoCode(event.target.value)}
                        placeholder="Optional"
                        className="pl-9 uppercase placeholder:normal-case"
                        aria-invalid={!!promoCode.trim() && !promoQuery.isLoading && !promoPreview?.valid}
                      />
                    </div>
                  </div>

                  {promoCode.trim() ? (
                    promoQuery.isLoading ? (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Spinner />
                        Checking promo code...
                      </div>
                    ) : promoPreview?.valid ? (
                      <div className="flex items-start gap-2 rounded-lg border border-success/30 bg-success/10 p-3 text-sm text-success">
                        <TicketPercent className="mt-0.5 size-4 shrink-0" />
                        <div>
                          <div className="font-medium">{promoPreview.promo?.code} applied</div>
                          <div className="text-success/90">
                            {promoPreview.promo?.type === "percent"
                              ? `${toNumber(promoPreview.promo.value)}% discount applied`
                              : `${formatMoney(promoPreview.promo?.value)} discount applied`}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-destructive">{promoPreview?.message || "Promo code was not found for this market."}</p>
                    )
                  ) : null}
                </CardContent>
              </Card>

              {/* Mobile: totals + CTA at the bottom */}
              <Card className="lg:hidden">
                <CardContent className="grid gap-4">
                  {totalsRows}
                  {!canSubmit && missing.length > 0 ? <MissingFields missing={missing} /> : null}
                  {errorAlert}
                  {placeOrderButton}
                  {trustNote}
                </CardContent>
              </Card>
            </div>

            {/* Desktop: sticky summary */}
            <aside className="hidden lg:sticky lg:top-24 lg:block">
              <Card>
                <CardHeader>
                  <CardTitle>Order summary</CardTitle>
                  <CardDescription>
                    {totals.items} {totals.items === 1 ? "item" : "items"} from one market
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4">
                  {marketBlock}
                  <Separator />
                  {lineItems}
                  <Separator />
                  {totalsRows}
                  {!canSubmit && missing.length > 0 ? <MissingFields missing={missing} /> : null}
                  {errorAlert}
                </CardContent>
                <CardFooter className="flex-col items-stretch gap-3">
                  {placeOrderButton}
                  {trustNote}
                </CardFooter>
              </Card>
            </aside>
          </div>
        )}
      </main>
    </div>
  );
}

function StepTitle({ step, title, description }: { step: number; title: string; description: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground tabular-nums">
        {step}
      </span>
      <div className="grid gap-1">
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </div>
    </div>
  );
}

function SummaryRow({ label, value, valueClassName }: { label: ReactNode; value: ReactNode; valueClassName?: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("font-medium tabular-nums", valueClassName)}>{value}</span>
    </div>
  );
}

function ItemThumb({ item }: { item: CartItem }) {
  const src = resolveApiMediaUrl(item.image_url);
  return (
    <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted text-muted-foreground">
      {src ? <img src={src} alt={item.name} className="size-full object-cover" /> : <ShoppingBag className="size-4" />}
    </div>
  );
}

function ItemCustomizations({ item }: { item: CartItem }) {
  const removed = item.removed_ingredients ?? [];
  if (!item.combo_offer && removed.length === 0) return null;
  return (
    <div className="mt-0.5 grid gap-0.5 text-xs text-muted-foreground">
      {item.combo_offer ? <span className="truncate">Combo: {item.combo_offer.name}</span> : null}
      {removed.length > 0 ? <span className="truncate">Without: {removed.join(", ")}</span> : null}
    </div>
  );
}

function SummaryLineItem({ item }: { item: CartItem }) {
  return (
    <li className="flex items-start gap-3">
      <ItemThumb item={item} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{item.name}</div>
        <ItemCustomizations item={item} />
        <div className="text-xs text-muted-foreground tabular-nums">
          {item.qty} × {formatMoney(item.price)}
        </div>
      </div>
      <div className="text-sm font-medium tabular-nums">{formatMoney(item.price * item.qty)}</div>
    </li>
  );
}

function MissingFields({ missing }: { missing: string[] }) {
  return (
    <Alert>
      <AlertCircle />
      <AlertTitle>Almost there</AlertTitle>
      <AlertDescription>
        <p>To place the order, please add {missing.join(", ")}.</p>
      </AlertDescription>
    </Alert>
  );
}
