import { Check, Clock, Layers, Plus, Star, Trash2, Utensils } from "lucide-react";

import type { ComboOffer, ItemIngredient } from "@/lib/cart";
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { EmptyState } from "@/components/app/empty-state";

import {
  SCHEDULE_DAYS,
  buildComboName,
  emptyAvailabilitySlot,
  emptyComboOffer,
  emptyIngredient,
  emptyVariant,
  normalizeAvailabilitySchedule,
  normalizeIngredients,
  normalizeVariants,
  type AvailabilitySlot,
  type ComboSelectableItem,
  type ItemKind,
  type ItemVariant,
} from "./market-item-helpers";

function IngredientChip({ ingredient }: { ingredient: ItemIngredient }) {
  return (
    <span
      className={cn(
        "rounded-md px-1.5 py-0.5 text-[11px]",
        ingredient.removable ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
      )}
    >
      {ingredient.name}
      {ingredient.removable ? " (removable)" : ""}
    </span>
  );
}

/* ---------------- Ingredients ---------------- */

export function IngredientEditor({
  ingredients,
  onChange,
}: {
  ingredients: ItemIngredient[];
  onChange: (ingredients: ItemIngredient[]) => void;
}) {
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => onChange(ingredients.map((ingredient) => ({ ...ingredient, removable: true })))}
          disabled={ingredients.length === 0}
        >
          Mark all removable
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => onChange(ingredients.map((ingredient) => ({ ...ingredient, removable: false })))}
          disabled={ingredients.length === 0}
        >
          Mark all required
        </Button>
      </div>

      {ingredients.length === 0 ? (
        <EmptyState
          compact
          icon={Utensils}
          title="No ingredients yet"
          description="Add the ingredients used in this product. Customers can remove the ones you mark as removable."
          className="rounded-lg border border-dashed"
        />
      ) : null}

      {ingredients.map((ingredient, index) => (
        <div
          key={`ingredient-${index}`}
          className="grid gap-3 rounded-lg border bg-muted/30 p-3 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-end"
        >
          <div className="grid gap-2">
            <Label htmlFor={`ingredient-name-${index}`}>Ingredient name</Label>
            <Input
              id={`ingredient-name-${index}`}
              value={ingredient.name}
              onChange={(event) => {
                const next = ingredients.map((entry, entryIndex) =>
                  entryIndex === index ? { ...entry, name: event.target.value } : entry,
                );
                onChange(next);
              }}
              placeholder="Tomato"
            />
          </div>

          <label className="flex h-9 items-center justify-between gap-3 rounded-md border bg-background px-3 text-sm sm:min-w-[170px]">
            <span>Removable</span>
            <Switch
              checked={ingredient.removable}
              onCheckedChange={(checked) => {
                const next = ingredients.map((entry, entryIndex) =>
                  entryIndex === index ? { ...entry, removable: checked } : entry,
                );
                onChange(next);
              }}
            />
          </label>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-destructive"
            aria-label="Remove ingredient"
            onClick={() => onChange(ingredients.filter((_, entryIndex) => entryIndex !== index))}
          >
            <Trash2 />
          </Button>
        </div>
      ))}

      <Button
        type="button"
        variant="outline"
        className="justify-self-start"
        onClick={() => onChange([...ingredients, emptyIngredient()])}
      >
        <Plus />
        Add ingredient
      </Button>
    </div>
  );
}

export function IngredientSummary({ ingredients }: { ingredients?: ItemIngredient[] | null }) {
  const normalized = normalizeIngredients(ingredients ?? []);
  if (!normalized.length) return null;
  const removableCount = normalized.filter((ingredient) => ingredient.removable).length;

  return (
    <span>
      {normalized.length} ingredients ({removableCount > 0 ? `${removableCount} removable` : "all required"})
    </span>
  );
}

/* ---------------- Combo offers ---------------- */

export function ComboOfferEditor({
  comboOffers,
  availableItems,
  itemKind,
  onChange,
}: {
  comboOffers: ComboOffer[];
  availableItems: ComboSelectableItem[];
  itemKind: ItemKind;
  onChange: (comboOffers: ComboOffer[]) => void;
}) {
  const visibleComboOffers =
    itemKind === "combo" ? (comboOffers.length > 0 ? [comboOffers[0]] : [emptyComboOffer()]) : comboOffers;

  const toggleComboItem = (comboIndex: number, item: ComboSelectableItem) => {
    const sourceOffers = itemKind === "combo" ? visibleComboOffers : comboOffers;
    const next = sourceOffers.map((entry, entryIndex) => {
      if (entryIndex !== comboIndex) {
        return entry;
      }

      const currentIds = new Set(entry.item_ids ?? []);
      if (currentIds.has(item.id)) {
        currentIds.delete(item.id);
      } else {
        currentIds.add(item.id);
      }

      const selectedItems = availableItems.filter((candidate) => currentIds.has(candidate.id));

      return {
        ...entry,
        name: entry.name?.trim() || buildComboName(selectedItems),
        item_ids: selectedItems.map((candidate) => candidate.id),
        items: selectedItems.map((candidate) => ({
          id: candidate.id,
          name: candidate.name,
          sku: candidate.sku,
          ingredients: candidate.ingredients,
        })),
      };
    });

    onChange(next);
  };

  return (
    <div className="grid gap-3">
      {availableItems.length === 0 ? (
        <EmptyState
          compact
          icon={Layers}
          title="No products to combine yet"
          description="Add other products to this market first, then you can build combos from them here."
          className="rounded-lg border border-dashed"
        />
      ) : null}

      {visibleComboOffers.map((comboOffer, index) => (
        <div key={`combo-offer-${index}`} className="grid gap-4 rounded-lg border bg-muted/30 p-4">
          {itemKind === "regular" ? (
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-medium">Combo offer {index + 1}</div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-destructive"
                onClick={() => onChange(comboOffers.filter((_, entryIndex) => entryIndex !== index))}
              >
                <Trash2 />
                Remove combo
              </Button>
            </div>
          ) : null}

          {itemKind === "regular" ? (
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="grid gap-2">
                <Label htmlFor={`combo-name-${index}`}>Combo label</Label>
                <Input
                  id={`combo-name-${index}`}
                  value={comboOffer.name}
                  onChange={(event) => {
                    const next = comboOffers.map((entry, entryIndex) =>
                      entryIndex === index ? { ...entry, name: event.target.value } : entry,
                    );
                    onChange(next);
                  }}
                  placeholder="Auto-filled from selected items"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor={`combo-price-${index}`}>Combo price</Label>
                <Input
                  id={`combo-price-${index}`}
                  type="number"
                  step="0.01"
                  inputMode="decimal"
                  value={String(comboOffer.combo_price ?? "")}
                  onChange={(event) => {
                    const next = comboOffers.map((entry, entryIndex) =>
                      entryIndex === index ? { ...entry, combo_price: Number(event.target.value || 0) } : entry,
                    );
                    onChange(next);
                  }}
                  placeholder="12.99"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor={`combo-description-${index}`}>Description</Label>
                <Input
                  id={`combo-description-${index}`}
                  value={comboOffer.description ?? ""}
                  onChange={(event) => {
                    const next = comboOffers.map((entry, entryIndex) =>
                      entryIndex === index ? { ...entry, description: event.target.value } : entry,
                    );
                    onChange(next);
                  }}
                  placeholder="Optional short note"
                />
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              This combo product is sold at the price set in the Pricing tab. Here you only choose which products are
              included.
            </p>
          )}

          <div className="grid gap-2">
            <Label>Products included in this combo</Label>
            <div className="grid gap-2 sm:grid-cols-2">
              {availableItems.map((item) => {
                const active = (comboOffer.item_ids ?? []).includes(item.id);

                return (
                  <button
                    key={`combo-item-${index}-${item.id}`}
                    type="button"
                    aria-pressed={active}
                    onClick={() => toggleComboItem(index, item)}
                    className={cn(
                      "relative min-w-0 rounded-lg border bg-background px-3 py-2.5 text-left text-sm transition-colors",
                      active ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:bg-muted/60",
                    )}
                  >
                    {active ? (
                      <span className="absolute top-2 right-2 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                        <Check className="size-3" />
                      </span>
                    ) : null}
                    <div className="truncate pr-6 font-medium">{item.name}</div>
                    <div className="text-xs text-muted-foreground tabular-nums">
                      {item.sku} · {Number(item.price).toFixed(2)}
                    </div>
                    {item.ingredients.length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {item.ingredients.slice(0, 4).map((ingredient) => (
                          <IngredientChip key={`${item.id}-${ingredient.name}`} ingredient={ingredient} />
                        ))}
                        {item.ingredients.length > 4 ? (
                          <span className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                            +{item.ingredients.length - 4} more
                          </span>
                        ) : null}
                      </div>
                    ) : null}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">
              {(comboOffer.items ?? []).length > 0
                ? `Selected: ${(comboOffer.items ?? []).map((item) => item.name).join(", ")}`
                : "Choose at least one product for this combo."}
            </p>
            {(comboOffer.items ?? []).length > 0 ? (
              <div className="grid gap-2">
                {(comboOffer.items ?? []).map((item) => (
                  <div key={`selected-combo-item-${item.id}`} className="rounded-lg border bg-background p-3">
                    <div className="text-sm font-medium">{item.name}</div>
                    {(item.ingredients ?? []).length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {(item.ingredients ?? []).map((ingredient) => (
                          <IngredientChip key={`${item.id}-${ingredient.name}-selected`} ingredient={ingredient} />
                        ))}
                      </div>
                    ) : (
                      <div className="mt-1 text-xs text-muted-foreground">No ingredients listed</div>
                    )}
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      ))}

      {itemKind === "regular" ? (
        <Button
          type="button"
          variant="outline"
          className="justify-self-start"
          onClick={() => onChange([...comboOffers, emptyComboOffer()])}
          disabled={availableItems.length === 0}
        >
          <Plus />
          Add combo offer
        </Button>
      ) : null}
    </div>
  );
}

export function ComboSummary({ comboOffers }: { comboOffers?: ComboOffer[] | null }) {
  const normalized = comboOffers ?? [];
  if (!normalized.length) return null;

  const names = normalized
    .map((comboOffer) => comboOffer.name || buildComboName((comboOffer.items ?? []) as ComboSelectableItem[]))
    .join(", ");

  return (
    <span title={names}>
      {normalized.length} combo offer{normalized.length === 1 ? "" : "s"}
    </span>
  );
}

/* ---------------- Variants ---------------- */

export function VariantEditor({
  variants,
  onChange,
}: {
  variants: ItemVariant[];
  onChange: (variants: ItemVariant[]) => void;
}) {
  return (
    <div className="grid gap-3">
      {variants.map((variant, index) => (
        <div
          key={`variant-${index}`}
          className="grid gap-3 rounded-lg border bg-muted/30 p-3 sm:grid-cols-[repeat(3,minmax(0,1fr))_auto] sm:items-end"
        >
          <div className="grid gap-2">
            <Label htmlFor={`variant-name-${index}`}>Option group</Label>
            <Input
              id={`variant-name-${index}`}
              value={variant.name}
              onChange={(event) => {
                const next = variants.map((entry, entryIndex) =>
                  entryIndex === index ? { ...entry, name: event.target.value } : entry,
                );
                onChange(next);
              }}
              placeholder="Size"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor={`variant-value-${index}`}>Option value</Label>
            <Input
              id={`variant-value-${index}`}
              value={variant.value}
              onChange={(event) => {
                const next = variants.map((entry, entryIndex) =>
                  entryIndex === index ? { ...entry, value: event.target.value } : entry,
                );
                onChange(next);
              }}
              placeholder="Large"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor={`variant-delta-${index}`}>Extra price</Label>
            <Input
              id={`variant-delta-${index}`}
              inputMode="decimal"
              value={String(variant.price_delta ?? 0)}
              onChange={(event) => {
                const next = variants.map((entry, entryIndex) =>
                  entryIndex === index ? { ...entry, price_delta: event.target.value } : entry,
                );
                onChange(next);
              }}
              placeholder="0 or 1.50"
            />
          </div>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-destructive"
            aria-label="Remove variant"
            onClick={() => onChange(variants.filter((_, entryIndex) => entryIndex !== index))}
          >
            <Trash2 />
          </Button>
        </div>
      ))}

      <Button
        type="button"
        variant="outline"
        className="justify-self-start"
        onClick={() => onChange([...variants, emptyVariant()])}
      >
        <Plus />
        Add variant
      </Button>
    </div>
  );
}

export function VariantSummary({ variants }: { variants?: ItemVariant[] | null }) {
  const normalized = normalizeVariants(variants ?? []);
  if (!normalized?.length) return null;

  return (
    <span title={normalized.map((variant) => `${variant.name}: ${variant.value}`).join(", ")}>
      {normalized.length} option{normalized.length === 1 ? "" : "s"}
    </span>
  );
}

/* ---------------- Availability schedule ---------------- */

export function ScheduleEditor({
  schedule,
  onChange,
}: {
  schedule: AvailabilitySlot[];
  onChange: (schedule: AvailabilitySlot[]) => void;
}) {
  return (
    <div className="grid gap-3">
      {schedule.map((slot, index) => (
        <div
          key={`schedule-${index}`}
          className="grid gap-3 rounded-lg border bg-muted/30 p-3 sm:grid-cols-[repeat(3,minmax(0,1fr))_auto] sm:items-end"
        >
          <div className="grid gap-2">
            <Label>Day</Label>
            <Select
              value={slot.day}
              onValueChange={(value) => {
                const next = schedule.map((entry, entryIndex) =>
                  entryIndex === index ? { ...entry, day: value } : entry,
                );
                onChange(next);
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SCHEDULE_DAYS.map((day) => (
                  <SelectItem key={day} value={day}>
                    {day}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor={`schedule-from-${index}`}>From</Label>
            <Input
              id={`schedule-from-${index}`}
              value={slot.from}
              onChange={(event) => {
                const next = schedule.map((entry, entryIndex) =>
                  entryIndex === index ? { ...entry, from: event.target.value } : entry,
                );
                onChange(next);
              }}
              placeholder="09:00"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor={`schedule-to-${index}`}>To</Label>
            <Input
              id={`schedule-to-${index}`}
              value={slot.to}
              onChange={(event) => {
                const next = schedule.map((entry, entryIndex) =>
                  entryIndex === index ? { ...entry, to: event.target.value } : entry,
                );
                onChange(next);
              }}
              placeholder="18:00"
            />
          </div>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-destructive"
            aria-label="Remove time slot"
            onClick={() => onChange(schedule.filter((_, entryIndex) => entryIndex !== index))}
          >
            <Trash2 />
          </Button>
        </div>
      ))}

      <Button
        type="button"
        variant="outline"
        className="justify-self-start"
        onClick={() => onChange([...schedule, emptyAvailabilitySlot()])}
      >
        <Plus />
        Add time slot
      </Button>
    </div>
  );
}

export function ScheduleSummary({ schedule }: { schedule?: AvailabilitySlot[] | null }) {
  const normalized = normalizeAvailabilitySchedule(schedule ?? []);

  if (!normalized?.length) {
    return <span>Always available</span>;
  }

  return (
    <span title={normalized.map((slot) => `${slot.day} ${slot.from}-${slot.to}`).join(", ")}>
      {normalized.length} time slot{normalized.length === 1 ? "" : "s"}
    </span>
  );
}

/** Compact line of item extras used in the products table and cards. */
export function ItemExtrasSummary({
  variants,
  schedule,
  ingredients,
  comboOffers,
  className,
}: {
  variants?: ItemVariant[] | null;
  schedule?: AvailabilitySlot[] | null;
  ingredients?: ItemIngredient[] | null;
  comboOffers?: ComboOffer[] | null;
  className?: string;
}) {
  const hasVariants = Boolean(normalizeVariants(variants ?? [])?.length);
  const hasIngredients = normalizeIngredients(ingredients ?? []).length > 0;
  const hasCombos = (comboOffers ?? []).length > 0;

  return (
    <div className={cn("grid gap-0.5 text-xs text-muted-foreground", className)}>
      <span className="inline-flex items-center gap-1">
        <Clock className="size-3" />
        <ScheduleSummary schedule={schedule} />
      </span>
      {hasVariants || hasIngredients || hasCombos ? (
        <span className="flex flex-wrap gap-x-1.5">
          {hasVariants ? <VariantSummary variants={variants} /> : null}
          {hasVariants && (hasIngredients || hasCombos) ? <span aria-hidden>·</span> : null}
          {hasIngredients ? <IngredientSummary ingredients={ingredients} /> : null}
          {hasIngredients && hasCombos ? <span aria-hidden>·</span> : null}
          {hasCombos ? <ComboSummary comboOffers={comboOffers} /> : null}
        </span>
      ) : (
        <span>No variants, ingredients or combos</span>
      )}
    </div>
  );
}

export function ReviewSummaryBadge({ average, count }: { average?: number | null; count?: number }) {
  if (!count) {
    return <span className="text-xs text-muted-foreground">No reviews</span>;
  }
  return (
    <span className="inline-flex items-center gap-1 text-sm tabular-nums">
      <Star className="size-3.5 fill-warning text-warning" />
      {average ?? "-"}
      <span className="text-xs text-muted-foreground">({count})</span>
    </span>
  );
}
