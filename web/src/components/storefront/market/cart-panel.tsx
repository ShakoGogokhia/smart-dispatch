import { Minus, Plus, ShoppingBag, Store, Tag, Trash2 } from "lucide-react";

import { EmptyState } from "@/components/app/empty-state";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import type { CartItem } from "@/lib/cart";
import { formatMoney, toNumber } from "@/lib/format";
import type { MarketPromo } from "@/lib/storefront";
import { cn } from "@/lib/utils";

import { resolveMarketMediaUrl } from "./market-utils";

export type CartTotals = { quantity: number; subtotal: number };

function promoLabel(promo: MarketPromo) {
  return promo.type === "percent" ? `${toNumber(promo.value)}% off` : `${formatMoney(promo.value)} off`;
}

export function CartLines({
  cart,
  onChangeQty,
  className,
}: {
  cart: CartItem[];
  onChangeQty: (cartId: string, delta: number) => void;
  className?: string;
}) {
  return (
    <ul className={cn("divide-y", className)}>
      {cart.map((line) => {
        const image = resolveMarketMediaUrl(line.image_url);
        return (
          <li key={line.cart_id} className="flex gap-3 py-3 first:pt-0 last:pb-0">
            <div className="size-12 shrink-0 overflow-hidden rounded-md border bg-muted">
              {image ? (
                <img src={image} alt="" className="size-full object-cover" />
              ) : (
                <span className="flex size-full items-center justify-center text-muted-foreground/50">
                  <Store className="size-5" />
                </span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="line-clamp-2 text-sm font-medium leading-snug">{line.name}</div>
                  <div className="text-xs text-muted-foreground tabular-nums">{formatMoney(line.price)} each</div>
                </div>
                <div className="text-sm font-semibold whitespace-nowrap tabular-nums">{formatMoney(line.price * line.qty)}</div>
              </div>
              {line.combo_offer ? <div className="mt-1 text-xs text-primary">Combo: {line.combo_offer.name}</div> : null}
              {(line.removed_ingredients ?? []).length > 0 ? (
                <div className="mt-1 text-xs text-muted-foreground">Without: {line.removed_ingredients?.join(", ")}</div>
              ) : null}
              <div className="mt-2 flex items-center justify-between gap-2">
                <div className="flex items-center rounded-md border">
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => onChangeQty(line.cart_id, -1)}
                    aria-label={`Decrease ${line.name}`}
                  >
                    <Minus />
                  </Button>
                  <span className="w-7 text-center text-sm font-medium tabular-nums">{line.qty}</span>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => onChangeQty(line.cart_id, 1)}
                    aria-label={`Increase ${line.name}`}
                  >
                    <Plus />
                  </Button>
                </div>
                <Button
                  variant="ghost"
                  size="xs"
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => onChangeQty(line.cart_id, -line.qty)}
                >
                  <Trash2 />
                  Remove
                </Button>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function CartSummary({
  totals,
  promo,
  onCheckout,
  onClear,
}: {
  totals: CartTotals;
  promo?: MarketPromo | null;
  onCheckout: () => void;
  onClear: () => void;
}) {
  return (
    <div className="space-y-3">
      {promo ? (
        <div className="flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs">
          <Tag className="mt-0.5 size-3.5 shrink-0 text-primary" />
          <span>
            Use code <span className="font-mono font-semibold">{promo.code}</span> at checkout for {promoLabel(promo)}.
          </span>
        </div>
      ) : null}
      <div className="space-y-1.5 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">
            Subtotal · {totals.quantity} item{totals.quantity === 1 ? "" : "s"}
          </span>
          <span className="tabular-nums">{formatMoney(totals.subtotal)}</span>
        </div>
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Delivery fee and promo discounts</span>
          <span>At checkout</span>
        </div>
        <Separator className="my-2" />
        <div className="flex justify-between font-semibold">
          <span>Total</span>
          <span className="tabular-nums">{formatMoney(totals.subtotal)}</span>
        </div>
      </div>
      <Button size="lg" className="w-full" onClick={onCheckout} disabled={totals.quantity === 0}>
        Checkout
      </Button>
      <Button variant="ghost" size="sm" className="w-full text-muted-foreground" onClick={onClear} disabled={totals.quantity === 0}>
        Clear cart
      </Button>
    </div>
  );
}

export function CartEmpty() {
  return (
    <EmptyState
      compact
      icon={ShoppingBag}
      title="Your cart is empty"
      description="Add items from the menu to start your order."
    />
  );
}
