import { useMemo, useState } from "react";
import { AlertCircle, ImageOff, ImagePlus, Layers, Package, Trash2, Utensils } from "lucide-react";

import type { ComboOffer, ItemIngredient } from "@/lib/cart";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { ComboOfferEditor, IngredientEditor, ScheduleEditor, VariantEditor } from "./market-item-editors";
import {
  computeFinalPrice,
  emptyComboOffer,
  type AvailabilitySlot,
  type ComboSelectableItem,
  type Item,
  type ItemKind,
  type ItemVariant,
} from "./market-item-helpers";

export type ItemFormValues = {
  itemKind: ItemKind;
  name: string;
  sku: string;
  category: string;
  price: string;
  discountType: Item["discount_type"];
  discountValue: string;
  stockQty: string;
  showStockQuantity: boolean;
  lowStockThreshold: string;
  isActive: boolean;
  imageUrl: string;
  imageFiles: File[];
  variants: ItemVariant[];
  schedule: AvailabilitySlot[];
  ingredients: ItemIngredient[];
  comboOffers: ComboOffer[];
};

export type ItemFormTab = "basics" | "pricing" | "inventory" | "media" | "options" | "composition";

type GalleryProps = {
  urls: string[];
  onDelete: (index: number) => void;
  onClearAll: () => void;
  busy: boolean;
};

function FieldHint({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-muted-foreground">{children}</p>;
}

function SectionHeading({ title, description }: { title: string; description?: string }) {
  return (
    <div className="grid gap-1">
      <h3 className="text-sm font-semibold">{title}</h3>
      {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
    </div>
  );
}

function SwitchRow({
  id,
  title,
  description,
  checked,
  onCheckedChange,
}: {
  id: string;
  title: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border bg-muted/30 p-3">
      <div className="grid gap-0.5">
        <Label htmlFor={id}>{title}</Label>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

function SelectedFilesPreview({ files }: { files: File[] }) {
  const urls = useMemo(() => files.map((file) => URL.createObjectURL(file)), [files]);

  if (files.length === 0) return null;

  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
      {files.map((file, index) => (
        <div key={`${file.name}-${index}`} className="grid gap-1">
          <img
            src={urls[index]}
            alt={file.name}
            onLoad={() => URL.revokeObjectURL(urls[index])}
            className="aspect-square w-full rounded-md border object-cover"
          />
          <span className="truncate text-[11px] text-muted-foreground">{file.name}</span>
        </div>
      ))}
    </div>
  );
}

export function MarketItemFormDialog({
  mode,
  values,
  onChange,
  comboItems,
  categories,
  initialTab = "basics",
  gallery,
  error,
  missing,
  canSubmit,
  submitting,
  onSubmit,
}: {
  mode: "create" | "edit";
  values: ItemFormValues;
  onChange: (patch: Partial<ItemFormValues>) => void;
  comboItems: ComboSelectableItem[];
  categories: string[];
  initialTab?: ItemFormTab;
  gallery?: GalleryProps;
  error?: string | null;
  missing?: string[];
  canSubmit: boolean;
  submitting: boolean;
  onSubmit: () => void;
}) {
  const [tab, setTab] = useState<ItemFormTab>(initialTab);
  const [pendingImageDelete, setPendingImageDelete] = useState<number | "all" | null>(null);

  const isCombo = values.itemKind === "combo";
  const basePrice = Number(values.price || 0);
  const finalPrice = computeFinalPrice(values.price, values.discountType, values.discountValue);
  const savings = Math.max(0, basePrice - finalPrice);
  const priceIsValid = values.price.trim() === "" || Number.isFinite(Number(values.price));
  const fileInputId = `${mode}-item-images`;

  const setKind = (kind: ItemKind) => {
    if (kind === values.itemKind) return;
    if (kind === "regular") {
      onChange({ itemKind: "regular", comboOffers: [] });
    } else {
      onChange({
        itemKind: "combo",
        ingredients: [],
        comboOffers: values.comboOffers.length > 0 ? [values.comboOffers[0]] : [emptyComboOffer()],
      });
    }
  };

  const basicsMissing = (missing ?? []).some((entry) => entry === "Name" || entry === "SKU");
  const pricingMissing = (missing ?? []).includes("Price");
  const compositionMissing = (missing ?? []).some((entry) => entry.startsWith("Combo"));

  const tabDot = <span className="size-1.5 rounded-full bg-destructive" aria-label="Needs attention" />;

  return (
    <DialogContent className="flex max-h-[calc(100svh-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
      <Tabs value={tab} onValueChange={(value) => setTab(value as ItemFormTab)} className="flex min-h-0 flex-1 flex-col gap-0">
        <DialogHeader className="gap-3 border-b px-6 pt-6 pb-4">
          <div className="grid gap-1 pr-6">
            <DialogTitle>{mode === "create" ? "Add product" : `Edit ${values.name || "product"}`}</DialogTitle>
            <DialogDescription>
              {mode === "create"
                ? "Fill in the basics and price. Everything else is optional and can be changed later."
                : "Update product details. Changes are saved when you click Save changes."}
            </DialogDescription>
          </div>
          <div className="-mx-1 overflow-x-auto px-1">
            <TabsList className="w-max">
              <TabsTrigger value="basics">Basics {basicsMissing ? tabDot : null}</TabsTrigger>
              <TabsTrigger value="pricing">Pricing {pricingMissing ? tabDot : null}</TabsTrigger>
              <TabsTrigger value="inventory">Inventory</TabsTrigger>
              <TabsTrigger value="media">Media</TabsTrigger>
              <TabsTrigger value="options">Options</TabsTrigger>
              <TabsTrigger value="composition">
                {isCombo ? "Combo" : "Ingredients & combos"} {compositionMissing ? tabDot : null}
              </TabsTrigger>
            </TabsList>
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-5">
          {/* ---------------- Basics ---------------- */}
          <TabsContent value="basics" className="grid gap-5">
            <div className="grid gap-2">
              <Label>Product type</Label>
              <div className="grid gap-2 sm:grid-cols-2">
                {(
                  [
                    { kind: "regular", title: "Regular product", text: "A single product with its own ingredients.", icon: Package },
                    { kind: "combo", title: "Combo product", text: "A bundle made from other products in this market.", icon: Layers },
                  ] as const
                ).map((option) => {
                  const active = values.itemKind === option.kind;
                  const disabled = option.kind === "combo" && comboItems.length === 0;
                  return (
                    <button
                      key={option.kind}
                      type="button"
                      aria-pressed={active}
                      disabled={disabled}
                      onClick={() => setKind(option.kind)}
                      className={cn(
                        "flex items-start gap-3 rounded-lg border p-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                        active ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:bg-muted/60",
                      )}
                    >
                      <span
                        className={cn(
                          "flex size-8 shrink-0 items-center justify-center rounded-md",
                          active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                        )}
                      >
                        <option.icon className="size-4" />
                      </span>
                      <span className="grid gap-0.5">
                        <span className="text-sm font-medium">{option.title}</span>
                        <span className="text-xs text-muted-foreground">{option.text}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
              {comboItems.length === 0 ? (
                <FieldHint>Combo products become available once this market has other products.</FieldHint>
              ) : null}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2 sm:col-span-2">
                <Label htmlFor={`${mode}-name`}>Product name</Label>
                <Input
                  id={`${mode}-name`}
                  value={values.name}
                  onChange={(event) => onChange({ name: event.target.value })}
                  placeholder="e.g. Margherita pizza"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor={`${mode}-sku`}>SKU</Label>
                <Input
                  id={`${mode}-sku`}
                  value={values.sku}
                  onChange={(event) => onChange({ sku: event.target.value })}
                  placeholder="e.g. PIZ-001"
                />
                <FieldHint>Your internal code. Must be unique inside this market.</FieldHint>
              </div>

              <div className="grid gap-2">
                <Label htmlFor={`${mode}-category`}>Category</Label>
                <Input
                  id={`${mode}-category`}
                  list={`${mode}-category-options`}
                  value={values.category}
                  onChange={(event) => onChange({ category: event.target.value })}
                  placeholder="e.g. Pizza"
                />
                <datalist id={`${mode}-category-options`}>
                  {categories.map((entry) => (
                    <option key={entry} value={entry} />
                  ))}
                </datalist>
                <FieldHint>Pick an existing category or type a new one.</FieldHint>
              </div>
            </div>

            <SwitchRow
              id={`${mode}-active`}
              title="Visible in store"
              description="When off, the product is hidden from the public storefront."
              checked={values.isActive}
              onCheckedChange={(checked) => onChange({ isActive: checked })}
            />
          </TabsContent>

          {/* ---------------- Pricing ---------------- */}
          <TabsContent value="pricing" className="grid gap-5">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="grid gap-2">
                <Label htmlFor={`${mode}-price`}>{isCombo ? "Combo price" : "Price"}</Label>
                <Input
                  id={`${mode}-price`}
                  inputMode="decimal"
                  value={values.price}
                  onChange={(event) => onChange({ price: event.target.value })}
                  placeholder={isCombo ? "e.g. 17.50" : "e.g. 10.50"}
                  aria-invalid={!priceIsValid || undefined}
                />
                {!priceIsValid ? (
                  <p className="text-xs text-destructive">Enter a number, e.g. 10.50</p>
                ) : (
                  <FieldHint>Price before any discount.</FieldHint>
                )}
              </div>

              <div className="grid gap-2">
                <Label>Discount type</Label>
                <Select
                  value={values.discountType}
                  onValueChange={(value) => onChange({ discountType: value as Item["discount_type"] })}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No discount</SelectItem>
                    <SelectItem value="percent">Percent (%)</SelectItem>
                    <SelectItem value="fixed">Fixed amount</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor={`${mode}-discount`}>Discount value</Label>
                <Input
                  id={`${mode}-discount`}
                  inputMode="decimal"
                  value={values.discountValue}
                  onChange={(event) => onChange({ discountValue: event.target.value })}
                  placeholder={values.discountType === "percent" ? "e.g. 10" : "e.g. 2.00"}
                />
                <FieldHint>
                  {values.discountType === "percent"
                    ? "Percentage taken off the price."
                    : values.discountType === "fixed"
                      ? "Amount taken off the price."
                      : "Not used while there is no discount."}
                </FieldHint>
              </div>
            </div>

            <div className="flex flex-wrap items-end justify-between gap-4 rounded-lg border bg-muted/30 p-4">
              <div className="grid gap-1">
                <span className="text-xs font-medium text-muted-foreground">Customer pays (estimate)</span>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-semibold tabular-nums tracking-tight">{formatMoney(finalPrice)}</span>
                  {savings > 0 ? (
                    <span className="text-sm text-muted-foreground tabular-nums line-through">{formatMoney(basePrice)}</span>
                  ) : null}
                </div>
              </div>
              {savings > 0 ? (
                <span className="rounded-md bg-success/15 px-2 py-1 text-xs font-medium text-success tabular-nums">
                  Saves {formatMoney(savings)}
                </span>
              ) : (
                <span className="text-xs text-muted-foreground">No discount applied</span>
              )}
            </div>
          </TabsContent>

          {/* ---------------- Inventory ---------------- */}
          <TabsContent value="inventory" className="grid gap-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor={`${mode}-stock`}>Stock quantity</Label>
                <Input
                  id={`${mode}-stock`}
                  inputMode="numeric"
                  value={values.stockQty}
                  onChange={(event) => onChange({ stockQty: event.target.value })}
                />
                <FieldHint>Units currently available to sell.</FieldHint>
              </div>

              <div className="grid gap-2">
                <Label htmlFor={`${mode}-low-stock`}>Low stock alert at</Label>
                <Input
                  id={`${mode}-low-stock`}
                  inputMode="numeric"
                  value={values.lowStockThreshold}
                  onChange={(event) => onChange({ lowStockThreshold: event.target.value })}
                />
                <FieldHint>The product is flagged as low stock at or below this number.</FieldHint>
              </div>
            </div>

            <SwitchRow
              id={`${mode}-show-stock`}
              title="Show quantity to customers"
              description="When off, customers only see whether the product is in stock."
              checked={values.showStockQuantity}
              onCheckedChange={(checked) => onChange({ showStockQuantity: checked })}
            />
          </TabsContent>

          {/* ---------------- Media ---------------- */}
          <TabsContent value="media" className="grid gap-5">
            {gallery ? (
              <div className="grid gap-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <SectionHeading title="Current images" description="Images customers see on the product page." />
                  {gallery.urls.length > 0 ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="text-destructive"
                      onClick={() => setPendingImageDelete("all")}
                      disabled={gallery.busy}
                    >
                      <Trash2 />
                      Delete all images
                    </Button>
                  ) : null}
                </div>
                {gallery.urls.length > 0 ? (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {gallery.urls.map((url, index) => (
                      <div key={`${url}-${index}`} className="group relative overflow-hidden rounded-lg border bg-muted">
                        <img src={url} alt={`${values.name} ${index + 1}`} className="aspect-[4/3] w-full object-cover" />
                        {index === 0 ? (
                          <span className="absolute top-2 left-2 rounded-md bg-background/90 px-1.5 py-0.5 text-[11px] font-medium">
                            Cover
                          </span>
                        ) : null}
                        <Button
                          type="button"
                          variant="secondary"
                          size="icon-sm"
                          className="absolute top-2 right-2 shadow-sm"
                          aria-label={`Delete image ${index + 1}`}
                          onClick={() => setPendingImageDelete(index)}
                          disabled={gallery.busy}
                        >
                          {gallery.busy ? <Spinner /> : <Trash2 />}
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center gap-3 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                    <ImageOff className="size-4" />
                    This product has no images yet.
                  </div>
                )}
                <Separator />
              </div>
            ) : null}

            <div className="grid gap-2">
              <Label htmlFor={fileInputId}>{gallery ? "Upload new images" : "Upload images"}</Label>
              <label
                htmlFor={fileInputId}
                className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed bg-muted/30 px-4 py-6 text-center transition-colors hover:bg-muted/60"
              >
                <span className="flex size-10 items-center justify-center rounded-full bg-background text-muted-foreground shadow-xs">
                  <ImagePlus className="size-5" />
                </span>
                <span className="text-sm font-medium">Click to choose images</span>
                <span className="text-xs text-muted-foreground">
                  {values.imageFiles.length > 0
                    ? `${values.imageFiles.length} ${gallery ? "new " : ""}image${values.imageFiles.length === 1 ? "" : "s"} selected. They upload when you save.`
                    : "You can select several files at once. They upload when you save."}
                </span>
                <input
                  id={fileInputId}
                  type="file"
                  accept="image/*"
                  multiple
                  className="sr-only"
                  onChange={(event) => onChange({ imageFiles: Array.from(event.target.files ?? []) })}
                />
              </label>
              <SelectedFilesPreview files={values.imageFiles} />
            </div>

            <div className="grid gap-2">
              <Label htmlFor={`${mode}-image-url`}>External image URL</Label>
              <Input
                id={`${mode}-image-url`}
                value={values.imageUrl}
                onChange={(event) => onChange({ imageUrl: event.target.value })}
                placeholder="https://..."
              />
              <FieldHint>Optional. Used as a fallback when no image is uploaded.</FieldHint>
            </div>
          </TabsContent>

          {/* ---------------- Options ---------------- */}
          <TabsContent value="options" className="grid gap-6">
            <div className="grid gap-3">
              <SectionHeading
                title="Variants"
                description="Customer choices like size, color or pack type. Extra price is added to the base price."
              />
              <VariantEditor variants={values.variants} onChange={(variants) => onChange({ variants })} />
            </div>
            <Separator />
            <div className="grid gap-3">
              <SectionHeading
                title="Availability schedule"
                description="Leave empty if the product is always available, or add day and time slots (e.g. 09:00 - 18:00)."
              />
              <ScheduleEditor schedule={values.schedule} onChange={(schedule) => onChange({ schedule })} />
            </div>
          </TabsContent>

          {/* ---------------- Ingredients / Combos ---------------- */}
          <TabsContent value="composition" className="grid gap-3">
            {isCombo ? (
              <>
                <SectionHeading
                  title="Combo contents"
                  description="Select the products from this market that are included in this combo."
                />
                <ComboOfferEditor
                  comboOffers={values.comboOffers}
                  availableItems={comboItems}
                  itemKind={values.itemKind}
                  onChange={(comboOffers) => onChange({ comboOffers })}
                />
              </>
            ) : (
              <>
                <SectionHeading
                  title="Ingredients"
                  description="List every ingredient used in this product and mark the optional ones as removable."
                />
                <IngredientEditor ingredients={values.ingredients} onChange={(ingredients) => onChange({ ingredients })} />
                <div className="flex items-center gap-2 rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
                  <Utensils className="size-3.5 shrink-0" />
                  Want to sell a bundle? Switch the product type to Combo in the Basics tab.
                </div>
              </>
            )}
          </TabsContent>

          {error ? (
            <Alert variant="destructive" className="mt-5">
              <AlertCircle />
              <AlertTitle>Could not save the product</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
        </div>
      </Tabs>

      <DialogFooter className="items-center gap-3 border-t bg-muted/30 px-6 py-4 sm:justify-between">
        <p className="text-xs text-muted-foreground sm:mr-auto">
          {missing && missing.length > 0
            ? `Still required: ${missing.join(", ")}`
            : missing
              ? "All required fields are filled in."
              : null}
        </p>
        <div className="flex w-full flex-col-reverse gap-2 sm:w-auto sm:flex-row">
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </DialogClose>
          <Button type="button" onClick={onSubmit} disabled={!canSubmit || submitting}>
            {submitting ? <Spinner /> : null}
            {submitting ? "Saving..." : mode === "create" ? "Add product" : "Save changes"}
          </Button>
        </div>
      </DialogFooter>

      {gallery ? (
        <AlertDialog open={pendingImageDelete !== null} onOpenChange={(open) => !open && setPendingImageDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{pendingImageDelete === "all" ? "Delete all images?" : "Delete this image?"}</AlertDialogTitle>
              <AlertDialogDescription>
                {pendingImageDelete === "all"
                  ? "Every image of this product will be removed right away. This cannot be undone."
                  : "The image will be removed from this product right away. This cannot be undone."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                onClick={() => {
                  if (pendingImageDelete === "all") gallery.onClearAll();
                  else if (typeof pendingImageDelete === "number") gallery.onDelete(pendingImageDelete);
                  setPendingImageDelete(null);
                }}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : null}
    </DialogContent>
  );
}
