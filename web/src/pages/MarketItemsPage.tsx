import { useState } from "react";
import { useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/lib/api";
import type { ComboOffer, ItemIngredient } from "@/lib/cart";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";

type Item = {
  id: number;
  market_id: number;
  name: string;
  sku: string;
  category?: string | null;
  image_url?: string | null;
  image_urls?: string[] | null;
  variants?: Array<{ name: string; value: string; price_delta?: number | string }> | null;
  availability_schedule?: Array<{ day: string; from: string; to: string }> | null;
  ingredients?: ItemIngredient[] | null;
  combo_offers?: ComboOffer[] | null;
  price: string | number;
  discount_type: "none" | "percent" | "fixed";
  discount_value: string | number;
  stock_qty: number;
  low_stock_threshold?: number;
  is_low_stock?: boolean;
  is_active: boolean;
  review_summary?: {
    count?: number;
    average?: number | null;
  };
};

type ItemVariant = {
  name: string;
  value: string;
  price_delta?: number | string;
};

type AvailabilitySlot = {
  day: string;
  from: string;
  to: string;
};

const SCHEDULE_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function emptyIngredient(): ItemIngredient {
  return {
    name: "",
    removable: false,
  };
}

function emptyComboOffer(): ComboOffer {
  return {
    name: "",
    description: "",
    combo_price: 0,
  };
}

function emptyVariant(): ItemVariant {
  return {
    name: "",
    value: "",
    price_delta: 0,
  };
}

function emptyAvailabilitySlot(): AvailabilitySlot {
  return {
    day: "Mon",
    from: "",
    to: "",
  };
}

function normalizeIngredients(ingredients: ItemIngredient[]) {
  return ingredients
    .map((ingredient) => ({
      name: ingredient.name.trim(),
      removable: Boolean(ingredient.removable),
    }))
    .filter((ingredient) => ingredient.name.length > 0);
}

function normalizeComboOffers(comboOffers: ComboOffer[]) {
  return comboOffers
    .map((comboOffer) => ({
      name: comboOffer.name.trim(),
      description: comboOffer.description?.trim() ? comboOffer.description.trim() : null,
      combo_price: Number(comboOffer.combo_price || 0),
    }))
    .filter((comboOffer) => comboOffer.name.length > 0);
}

function normalizeVariants(variants: ItemVariant[]) {
  const normalized = variants
    .map((variant) => ({
      name: variant.name.trim(),
      value: variant.value.trim(),
      price_delta: Number(variant.price_delta || 0),
    }))
    .filter((variant) => variant.name.length > 0 && variant.value.length > 0);

  return normalized.length > 0 ? normalized : null;
}

function normalizeAvailabilitySchedule(schedule: AvailabilitySlot[]) {
  const normalized = schedule
    .map((slot) => ({
      day: slot.day.trim(),
      from: slot.from.trim(),
      to: slot.to.trim(),
    }))
    .filter((slot) => slot.day && slot.from && slot.to);

  return normalized.length > 0 ? normalized : null;
}

function resolveMediaUrl(url?: string | null) {
  if (!url) {
    return null;
  }

  try {
    const apiOrigin = new URL(api.defaults.baseURL ?? window.location.origin).origin;
    const parsed = new URL(url, apiOrigin);

    if (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1") {
      return `${apiOrigin}${parsed.pathname}${parsed.search}${parsed.hash}`;
    }

    return parsed.toString();
  } catch {
    return url;
  }
}

function getItemImageUrls(item?: Item | null) {
  const urls = [...(item?.image_urls ?? [])];

  if (item?.image_url) {
    urls.push(item.image_url);
  }

  return Array.from(
    new Set(
      urls
        .map((url) => resolveMediaUrl(url))
        .filter((url): url is string => typeof url === "string" && url.length > 0),
    ),
  );
}

function IngredientEditor({
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
          variant="secondary"
          onClick={() =>
            onChange(ingredients.map((ingredient) => ({ ...ingredient, removable: true })))
          }
          disabled={ingredients.length === 0}
        >
          Mark all removable
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() =>
            onChange(ingredients.map((ingredient) => ({ ...ingredient, removable: false })))
          }
          disabled={ingredients.length === 0}
        >
          Mark all required
        </Button>
      </div>

      {ingredients.map((ingredient, index) => (
        <div key={`ingredient-${index}`} className="rounded-xl border p-3">
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_auto] md:items-center">
            <div className="grid gap-2">
              <Label className="field-label">Ingredient name</Label>
              <Input
                value={ingredient.name}
                onChange={(event) => {
                  const next = ingredients.map((entry, entryIndex) =>
                    entryIndex === index ? { ...entry, name: event.target.value } : entry,
                  );
                  onChange(next);
                }}
                className="input-shell"
                placeholder="Tomato"
              />
            </div>

            <div className="flex items-center justify-between gap-3 rounded-xl border px-3 py-2 md:min-w-[180px]">
              <div>
                <div className="text-sm font-medium">Removable</div>
                <div className="text-xs text-muted-foreground">Customers can remove it</div>
              </div>
              <Switch
                checked={ingredient.removable}
                onCheckedChange={(checked) => {
                  const next = ingredients.map((entry, entryIndex) =>
                    entryIndex === index ? { ...entry, removable: checked } : entry,
                  );
                  onChange(next);
                }}
              />
            </div>

            <Button
              type="button"
              variant="secondary"
              onClick={() => onChange(ingredients.filter((_, entryIndex) => entryIndex !== index))}
            >
              Remove
            </Button>
          </div>
        </div>
      ))}

      <Button type="button" variant="secondary" onClick={() => onChange([...ingredients, emptyIngredient()])}>
        Add ingredient
      </Button>
    </div>
  );
}

function IngredientSummary({ ingredients }: { ingredients?: ItemIngredient[] | null }) {
  const normalized = normalizeIngredients(ingredients ?? []);

  if (!normalized.length) {
    return <span className="text-sm text-muted-foreground">No ingredients</span>;
  }

  const removableCount = normalized.filter((ingredient) => ingredient.removable).length;

  return (
    <div className="grid gap-1">
      <span className="text-sm font-medium">{normalized.length} ingredients</span>
      <span className="text-xs text-muted-foreground">
        {removableCount > 0 ? `${removableCount} removable` : "All required"}
      </span>
    </div>
  );
}

function ComboOfferEditor({
  comboOffers,
  onChange,
}: {
  comboOffers: ComboOffer[];
  onChange: (comboOffers: ComboOffer[]) => void;
}) {
  return (
    <div className="grid gap-3">
      {comboOffers.map((comboOffer, index) => (
        <div key={`combo-offer-${index}`} className="rounded-xl border p-3">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="grid gap-2">
              <Label className="field-label">Combo name</Label>
              <Input
                value={comboOffer.name}
                onChange={(event) => {
                  const next = comboOffers.map((entry, entryIndex) =>
                    entryIndex === index ? { ...entry, name: event.target.value } : entry,
                  );
                  onChange(next);
                }}
                className="input-shell"
                placeholder="Lunch combo"
              />
            </div>

            <div className="grid gap-2">
              <Label className="field-label">Combo price</Label>
              <Input
                value={String(comboOffer.combo_price ?? "")}
                onChange={(event) => {
                  const next = comboOffers.map((entry, entryIndex) =>
                    entryIndex === index ? { ...entry, combo_price: Number(event.target.value || 0) } : entry,
                  );
                  onChange(next);
                }}
                className="input-shell"
                placeholder="12.99"
              />
            </div>

            <div className="grid gap-2">
              <Label className="field-label">Description</Label>
              <Input
                value={comboOffer.description ?? ""}
                onChange={(event) => {
                  const next = comboOffers.map((entry, entryIndex) =>
                    entryIndex === index ? { ...entry, description: event.target.value } : entry,
                  );
                  onChange(next);
                }}
                className="input-shell"
                placeholder="Drink + fries included"
              />
            </div>
          </div>

          <div className="mt-3 flex justify-end">
            <Button
              type="button"
              variant="secondary"
              onClick={() => onChange(comboOffers.filter((_, entryIndex) => entryIndex !== index))}
            >
              Remove combo
            </Button>
          </div>
        </div>
      ))}

      <Button type="button" variant="secondary" onClick={() => onChange([...comboOffers, emptyComboOffer()])}>
        Add combo offer
      </Button>
    </div>
  );
}

function ComboSummary({ comboOffers }: { comboOffers?: ComboOffer[] | null }) {
  const normalized = normalizeComboOffers(comboOffers ?? []);

  if (!normalized.length) {
    return <span className="text-sm text-muted-foreground">No combos</span>;
  }

  return (
    <div className="grid gap-1">
      <span className="text-sm font-medium">{normalized.length} combo offers</span>
      <span className="text-xs text-muted-foreground">
        {normalized.map((comboOffer) => comboOffer.name).join(", ")}
      </span>
    </div>
  );
}

function VariantEditor({
  variants,
  onChange,
}: {
  variants: ItemVariant[];
  onChange: (variants: ItemVariant[]) => void;
}) {
  return (
    <div className="grid gap-3">
      {variants.map((variant, index) => (
        <div key={`variant-${index}`} className="rounded-xl border p-3">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="grid gap-2">
              <Label className="field-label">Option group</Label>
              <Input
                value={variant.name}
                onChange={(event) => {
                  const next = variants.map((entry, entryIndex) =>
                    entryIndex === index ? { ...entry, name: event.target.value } : entry,
                  );
                  onChange(next);
                }}
                className="input-shell"
                placeholder="Size"
              />
            </div>

            <div className="grid gap-2">
              <Label className="field-label">Option value</Label>
              <Input
                value={variant.value}
                onChange={(event) => {
                  const next = variants.map((entry, entryIndex) =>
                    entryIndex === index ? { ...entry, value: event.target.value } : entry,
                  );
                  onChange(next);
                }}
                className="input-shell"
                placeholder="Large"
              />
            </div>

            <div className="grid gap-2">
              <Label className="field-label">Price delta</Label>
              <Input
                value={String(variant.price_delta ?? 0)}
                onChange={(event) => {
                  const next = variants.map((entry, entryIndex) =>
                    entryIndex === index ? { ...entry, price_delta: event.target.value } : entry,
                  );
                  onChange(next);
                }}
                className="input-shell"
                placeholder="0 or 1.50"
              />
            </div>
          </div>

          <div className="mt-3 flex justify-end">
            <Button
              type="button"
              variant="secondary"
              onClick={() => onChange(variants.filter((_, entryIndex) => entryIndex !== index))}
            >
              Remove variant
            </Button>
          </div>
        </div>
      ))}

      <Button type="button" variant="secondary" onClick={() => onChange([...variants, emptyVariant()])}>
        Add variant
      </Button>
    </div>
  );
}

function VariantSummary({ variants }: { variants?: ItemVariant[] | null }) {
  const normalized = normalizeVariants(variants ?? []);

  if (!normalized?.length) {
    return <span className="text-sm text-muted-foreground">No variants</span>;
  }

  return (
    <div className="grid gap-1">
      <span className="text-sm font-medium">{normalized.length} options</span>
      <span className="text-xs text-muted-foreground">
        {normalized.slice(0, 2).map((variant) => `${variant.name}: ${variant.value}`).join(", ")}
      </span>
    </div>
  );
}

function ScheduleEditor({
  schedule,
  onChange,
}: {
  schedule: AvailabilitySlot[];
  onChange: (schedule: AvailabilitySlot[]) => void;
}) {
  return (
    <div className="grid gap-3">
      {schedule.map((slot, index) => (
        <div key={`schedule-${index}`} className="rounded-xl border p-3">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="grid gap-2">
              <Label className="field-label">Day</Label>
              <Select
                value={slot.day}
                onValueChange={(value) => {
                  const next = schedule.map((entry, entryIndex) =>
                    entryIndex === index ? { ...entry, day: value } : entry,
                  );
                  onChange(next);
                }}
              >
                <SelectTrigger className="input-shell w-full">
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
              <Label className="field-label">From</Label>
              <Input
                value={slot.from}
                onChange={(event) => {
                  const next = schedule.map((entry, entryIndex) =>
                    entryIndex === index ? { ...entry, from: event.target.value } : entry,
                  );
                  onChange(next);
                }}
                className="input-shell"
                placeholder="09:00"
              />
            </div>

            <div className="grid gap-2">
              <Label className="field-label">To</Label>
              <Input
                value={slot.to}
                onChange={(event) => {
                  const next = schedule.map((entry, entryIndex) =>
                    entryIndex === index ? { ...entry, to: event.target.value } : entry,
                  );
                  onChange(next);
                }}
                className="input-shell"
                placeholder="18:00"
              />
            </div>
          </div>

          <div className="mt-3 flex justify-end">
            <Button
              type="button"
              variant="secondary"
              onClick={() => onChange(schedule.filter((_, entryIndex) => entryIndex !== index))}
            >
              Remove slot
            </Button>
          </div>
        </div>
      ))}

      <Button type="button" variant="secondary" onClick={() => onChange([...schedule, emptyAvailabilitySlot()])}>
        Add schedule row
      </Button>
    </div>
  );
}

function ScheduleSummary({ schedule }: { schedule?: AvailabilitySlot[] | null }) {
  const normalized = normalizeAvailabilitySchedule(schedule ?? []);

  if (!normalized?.length) {
    return <span className="text-sm text-muted-foreground">Always available</span>;
  }

  return (
    <div className="grid gap-1">
      <span className="text-sm font-medium">{normalized.length} slots</span>
      <span className="text-xs text-muted-foreground">
        {normalized.slice(0, 2).map((slot) => `${slot.day} ${slot.from}-${slot.to}`).join(", ")}
      </span>
    </div>
  );
}

export default function MarketItemsPage() {
  const { marketId } = useParams();
  const id = Number(marketId);
  const qc = useQueryClient();

  const itemsQ = useQuery({
    queryKey: ["market-items", id],
    queryFn: async () => (await api.get(`/api/markets/${id}/items`)).data as Item[],
    enabled: Number.isFinite(id),
  });

  const items = itemsQ.data ?? [];

  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [price, setPrice] = useState("");
  const [discountType, setDiscountType] = useState<Item["discount_type"]>("none");
  const [discountValue, setDiscountValue] = useState("");
  const [stockQty, setStockQty] = useState("0");
  const [isActive, setIsActive] = useState(true);
  const [category, setCategory] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [createImageFiles, setCreateImageFiles] = useState<File[]>([]);
  const [variants, setVariants] = useState<ItemVariant[]>([]);
  const [availabilitySchedule, setAvailabilitySchedule] = useState<AvailabilitySlot[]>([]);
  const [createIngredients, setCreateIngredients] = useState<ItemIngredient[]>([]);
  const [createComboOffers, setCreateComboOffers] = useState<ComboOffer[]>([]);
  const [lowStockThreshold, setLowStockThreshold] = useState("5");
  const [csvDraft, setCsvDraft] = useState(
    "name,sku,category,price,discount_type,discount_value,stock_qty,low_stock_threshold,is_active,image_url,variants,availability_schedule,ingredients,combo_offers",
  );

  const createM = useMutation({
    mutationFn: async () => {
      const payload = {
        name,
        sku,
        category: category || null,
        image_url: imageUrl || null,
        variants: normalizeVariants(variants),
        availability_schedule: normalizeAvailabilitySchedule(availabilitySchedule),
        ingredients: normalizeIngredients(createIngredients),
        combo_offers: normalizeComboOffers(createComboOffers),
        price: Number(price),
        discount_type: discountType,
        discount_value: Number(discountValue || 0),
        stock_qty: Number(stockQty || 0),
        low_stock_threshold: Number(lowStockThreshold || 5),
        is_active: isActive,
      };

      const created = (await api.post(`/api/markets/${id}/items`, payload)).data as Item;

      if (createImageFiles.length === 0) {
        return created;
      }

      const formData = new FormData();
      createImageFiles.forEach((file) => {
        formData.append("images[]", file);
      });

      return (
        await api.post(`/api/markets/${id}/items/${created.id}/image`, formData, {
          headers: { "Content-Type": "multipart/form-data" },
        })
      ).data as Item;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["market-items", id] });
      setCreateOpen(false);
      setName("");
      setSku("");
      setPrice("");
      setDiscountType("none");
      setDiscountValue("");
      setStockQty("0");
      setIsActive(true);
      setCategory("");
      setImageUrl("");
      setCreateImageFiles([]);
      setVariants([]);
      setAvailabilitySchedule([]);
      setCreateIngredients([]);
      setCreateComboOffers([]);
      setLowStockThreshold("5");
    },
  });

  const [editOpen, setEditOpen] = useState(false);
  const [editItem, setEditItem] = useState<Item | null>(null);
  const [editImageFiles, setEditImageFiles] = useState<File[]>([]);

  const updateM = useMutation({
    mutationFn: async () => {
      if (!editItem) throw new Error("No item selected");

      const payload = {
        name: editItem.name,
        sku: editItem.sku,
        price: Number(editItem.price),
        discount_type: editItem.discount_type,
        discount_value: Number(editItem.discount_value || 0),
        stock_qty: Number(editItem.stock_qty || 0),
        category: editItem.category ?? null,
        image_url: editItem.image_url ?? null,
        variants: normalizeVariants((editItem.variants as ItemVariant[] | null) ?? []),
        availability_schedule: normalizeAvailabilitySchedule((editItem.availability_schedule as AvailabilitySlot[] | null) ?? []),
        ingredients: normalizeIngredients(editItem.ingredients ?? []),
        combo_offers: normalizeComboOffers(editItem.combo_offers ?? []),
        low_stock_threshold: Number(editItem.low_stock_threshold || 5),
        is_active: !!editItem.is_active,
      };

      const updated = (
        await api.patch(`/api/markets/${id}/items/${editItem.id}`, payload)
      ).data as Item;

      if (editImageFiles.length === 0) {
        return updated;
      }

      const formData = new FormData();
      editImageFiles.forEach((file) => {
        formData.append("images[]", file);
      });

      return (
        await api.post(`/api/markets/${id}/items/${editItem.id}/image`, formData, {
          headers: { "Content-Type": "multipart/form-data" },
        })
      ).data as Item;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["market-items", id] });
      setEditOpen(false);
      setEditItem(null);
      setEditImageFiles([]);
    },
  });

  const deleteImageM = useMutation({
    mutationFn: async (imageIndex: number) => {
      if (!editItem) {
        throw new Error("No item selected");
      }

      return (await api.delete(`/api/markets/${id}/items/${editItem.id}/images/${imageIndex}`)).data as Item;
    },
    onSuccess: async (updatedItem) => {
      await qc.invalidateQueries({ queryKey: ["market-items", id] });
      setEditItem({
        ...updatedItem,
        variants: updatedItem.variants ?? [],
        availability_schedule: updatedItem.availability_schedule ?? [],
        ingredients: updatedItem.ingredients ?? [],
        combo_offers: updatedItem.combo_offers ?? [],
      });
    },
  });

  const clearImagesM = useMutation({
    mutationFn: async () => {
      if (!editItem) {
        throw new Error("No item selected");
      }

      return (await api.delete(`/api/markets/${id}/items/${editItem.id}/images`)).data as Item;
    },
    onSuccess: async (updatedItem) => {
      await qc.invalidateQueries({ queryKey: ["market-items", id] });
      setEditItem({
        ...updatedItem,
        variants: updatedItem.variants ?? [],
        availability_schedule: updatedItem.availability_schedule ?? [],
        ingredients: updatedItem.ingredients ?? [],
        combo_offers: updatedItem.combo_offers ?? [],
      });
    },
  });

  const importM = useMutation({
    mutationFn: async () => (await api.post(`/api/markets/${id}/items/import-csv`, { csv: csvDraft })).data,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["market-items", id] });
    },
  });

  const createError =
    (createM.error as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message ??
    (createM.error as { message?: string })?.message ??
    null;

  const updateError =
    (updateM.error as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message ??
    (updateM.error as { message?: string })?.message ??
    null;

  const canCreate = name.trim() && sku.trim() && price.trim();

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle>Market Items (Market #{id})</CardTitle>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" asChild>
              <a href={`${api.defaults.baseURL}/api/markets/${id}/items/export-csv`} target="_blank" rel="noreferrer">
                Export CSV
              </a>
            </Button>

            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <Button>Add Item</Button>
              </DialogTrigger>

              <DialogContent className="app-modal-shell sm:max-w-[min(900px,calc(100%-2rem))]">
                <DialogHeader>
                  <div className="app-modal-header">
                    <DialogTitle className="panel-title">Add item</DialogTitle>
                  </div>
                </DialogHeader>

                <div className="app-modal-body">
                  <div className="app-modal-main">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="grid gap-2">
                        <Label className="field-label">Name</Label>
                        <Input value={name} onChange={(event) => setName(event.target.value)} className="input-shell" />
                      </div>

                      <div className="grid gap-2">
                        <Label className="field-label">SKU</Label>
                        <Input value={sku} onChange={(event) => setSku(event.target.value)} className="input-shell" />
                      </div>

                      <div className="grid gap-2">
                        <Label className="field-label">Category</Label>
                        <Input value={category} onChange={(event) => setCategory(event.target.value)} className="input-shell" />
                      </div>

                      <div className="grid gap-2">
                        <Label className="field-label">Price</Label>
                        <Input
                          value={price}
                          onChange={(event) => setPrice(event.target.value)}
                          placeholder="e.g. 10.50"
                          className="input-shell"
                        />
                      </div>

                      <div className="grid gap-2">
                        <Label className="field-label">Discount Type</Label>
                        <Select value={discountType} onValueChange={(value) => setDiscountType(value as Item["discount_type"])}>
                          <SelectTrigger className="input-shell w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">None</SelectItem>
                            <SelectItem value="percent">Percent</SelectItem>
                            <SelectItem value="fixed">Fixed</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="grid gap-2">
                        <Label className="field-label">Discount Value</Label>
                        <Input
                          value={discountValue}
                          onChange={(event) => setDiscountValue(event.target.value)}
                          placeholder={discountType === "percent" ? "e.g. 10" : "e.g. 2.00"}
                          className="input-shell"
                        />
                      </div>

                      <div className="grid gap-2">
                        <Label className="field-label">Stock Qty</Label>
                        <Input value={stockQty} onChange={(event) => setStockQty(event.target.value)} className="input-shell" />
                      </div>

                      <div className="grid gap-2">
                        <Label className="field-label">Low Stock Threshold</Label>
                        <Input
                          value={lowStockThreshold}
                          onChange={(event) => setLowStockThreshold(event.target.value)}
                          className="input-shell"
                        />
                      </div>

                      <div className="grid gap-2">
                        <Label className="field-label">Upload Images</Label>
                        <Input
                          type="file"
                          accept="image/*"
                          multiple
                          onChange={(event) => setCreateImageFiles(Array.from(event.target.files ?? []))}
                          className="input-shell"
                        />
                        {createImageFiles.length > 0 ? (
                          <div className="text-xs text-muted-foreground">
                            {createImageFiles.length} image{createImageFiles.length === 1 ? "" : "s"} selected
                          </div>
                        ) : null}
                      </div>

                      <div className="grid gap-2">
                        <Label className="field-label">External Image URL</Label>
                        <Input
                          value={imageUrl}
                          onChange={(event) => setImageUrl(event.target.value)}
                          className="input-shell"
                          placeholder="Optional fallback"
                        />
                      </div>

                      <div className="md:col-span-2 rounded-xl border p-4">
                        <div className="mb-3">
                          <Label className="field-label">Variants</Label>
                          <div className="text-sm text-muted-foreground">
                            Add customer choices like size, color, or pack type without writing JSON.
                          </div>
                        </div>

                        <VariantEditor variants={variants} onChange={setVariants} />
                      </div>

                      <div className="md:col-span-2 rounded-xl border p-4">
                        <div className="mb-3">
                          <Label className="field-label">Availability schedule</Label>
                          <div className="text-sm text-muted-foreground">
                            Leave this empty if the item is always available, or add day and time rows below.
                          </div>
                        </div>

                        <ScheduleEditor schedule={availabilitySchedule} onChange={setAvailabilitySchedule} />
                      </div>

                      <div className="md:col-span-2 rounded-xl border p-4">
                        <div className="mb-3">
                          <Label className="field-label">Ingredients</Label>
                          <div className="text-sm text-muted-foreground">
                            Add every ingredient the market uses in this item and mark the ones customers can remove.
                          </div>
                        </div>

                        <IngredientEditor ingredients={createIngredients} onChange={setCreateIngredients} />
                      </div>

                      <div className="md:col-span-2 rounded-xl border p-4">
                        <div className="mb-3">
                          <Label className="field-label">Combo offers</Label>
                          <div className="text-sm text-muted-foreground">
                            Add discount bundles like meal deals, drink combos, or add-on offers.
                          </div>
                        </div>

                        <ComboOfferEditor comboOffers={createComboOffers} onChange={setCreateComboOffers} />
                      </div>

                      <div className="md:col-span-2 flex items-center justify-between rounded-xl border p-4">
                        <div>
                          <Label className="field-label">Active</Label>
                          <div className="text-sm text-muted-foreground">Visible on the public storefront.</div>
                        </div>
                        <Switch checked={isActive} onCheckedChange={setIsActive} />
                      </div>
                    </div>

                    {createError ? <div className="text-sm text-red-600">{createError}</div> : null}
                  </div>
                </div>

                <DialogFooter className="app-modal-footer">
                  <Button onClick={() => createM.mutate()} disabled={!canCreate || createM.isPending}>
                    {createM.isPending ? "Saving..." : "Save"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>

        <CardContent className="grid gap-4">
          <div className="grid gap-2">
            <Label className="field-label">Bulk CSV import</Label>
            <Input value={csvDraft} onChange={(event) => setCsvDraft(event.target.value)} className="input-shell" />
            <Button variant="secondary" onClick={() => importM.mutate()} disabled={importM.isPending}>
              {importM.isPending ? "Importing..." : "Import CSV"}
            </Button>
          </div>

          {itemsQ.isLoading ? (
            <div className="text-sm text-muted-foreground">Loading...</div>
          ) : itemsQ.isError ? (
            <div className="text-sm text-red-600">Failed to load items</div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Item</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Variants</TableHead>
                    <TableHead>Schedule</TableHead>
                    <TableHead>Ingredients</TableHead>
                    <TableHead>Combos</TableHead>
                    <TableHead>Stock</TableHead>
                    <TableHead>Reviews</TableHead>
                    <TableHead>Active</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>{item.id}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="h-12 w-12 overflow-hidden rounded-xl border bg-muted">
                            {getItemImageUrls(item)[0] ? (
                              <img src={getItemImageUrls(item)[0]} alt={item.name} className="h-full w-full object-cover" />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
                                No image
                              </div>
                            )}
                          </div>
                          <div className="grid gap-1">
                            <div className="font-medium">{item.name}</div>
                            <div className="text-xs text-muted-foreground">{item.sku}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{item.category || "-"}</TableCell>
                      <TableCell>
                        <div className="grid gap-1">
                          <span>{item.price}</span>
                          <span className="text-xs text-muted-foreground">
                            {item.discount_type === "none" ? "No discount" : `${item.discount_type} ${item.discount_value}`}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <VariantSummary variants={item.variants as ItemVariant[] | null} />
                      </TableCell>
                      <TableCell>
                        <ScheduleSummary schedule={item.availability_schedule as AvailabilitySlot[] | null} />
                      </TableCell>
                      <TableCell>
                        <IngredientSummary ingredients={item.ingredients} />
                      </TableCell>
                      <TableCell>
                        <ComboSummary comboOffers={item.combo_offers} />
                      </TableCell>
                      <TableCell>{item.stock_qty}{item.is_low_stock ? " (Low)" : ""}</TableCell>
                      <TableCell>{item.review_summary?.average ?? "-"} / {item.review_summary?.count ?? 0}</TableCell>
                      <TableCell>{item.is_active ? "Yes" : "No"}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="secondary"
                          onClick={() => {
                            setEditItem({
                              ...item,
                              variants: item.variants ?? [],
                              availability_schedule: item.availability_schedule ?? [],
                              ingredients: item.ingredients ?? [],
                              combo_offers: item.combo_offers ?? [],
                            });
                            setEditImageFiles([]);
                            setEditOpen(true);
                          }}
                        >
                          Edit
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}

                  {items.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={12} className="text-sm text-muted-foreground">
                        No items yet.
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="app-modal-shell sm:max-w-[min(900px,calc(100%-2rem))]">
          <DialogHeader>
            <div className="app-modal-header">
              <DialogTitle className="panel-title">Edit item</DialogTitle>
            </div>
          </DialogHeader>

          <div className="app-modal-body">
            {editItem ? (
              <div className="app-modal-main">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="grid gap-2">
                    <Label className="field-label">Name</Label>
                    <Input
                      value={editItem.name}
                      onChange={(event) => setEditItem({ ...editItem, name: event.target.value })}
                      className="input-shell"
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label className="field-label">SKU</Label>
                    <Input
                      value={editItem.sku}
                      onChange={(event) => setEditItem({ ...editItem, sku: event.target.value })}
                      className="input-shell"
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label className="field-label">Category</Label>
                    <Input
                      value={editItem.category ?? ""}
                      onChange={(event) => setEditItem({ ...editItem, category: event.target.value })}
                      className="input-shell"
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label className="field-label">Price</Label>
                    <Input
                      value={String(editItem.price)}
                      onChange={(event) => setEditItem({ ...editItem, price: event.target.value })}
                      className="input-shell"
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label className="field-label">Discount Type</Label>
                    <Select
                      value={editItem.discount_type}
                      onValueChange={(value) => setEditItem({ ...editItem, discount_type: value as Item["discount_type"] })}
                    >
                      <SelectTrigger className="input-shell w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        <SelectItem value="percent">Percent</SelectItem>
                        <SelectItem value="fixed">Fixed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid gap-2">
                    <Label className="field-label">Discount Value</Label>
                    <Input
                      value={String(editItem.discount_value)}
                      onChange={(event) => setEditItem({ ...editItem, discount_value: event.target.value })}
                      className="input-shell"
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label className="field-label">Stock Qty</Label>
                    <Input
                      value={String(editItem.stock_qty)}
                      onChange={(event) => setEditItem({ ...editItem, stock_qty: Number(event.target.value) })}
                      className="input-shell"
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label className="field-label">Low Stock Threshold</Label>
                    <Input
                      value={String(editItem.low_stock_threshold ?? 5)}
                      onChange={(event) => setEditItem({ ...editItem, low_stock_threshold: Number(event.target.value) })}
                      className="input-shell"
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label className="field-label">Upload New Images</Label>
                    <Input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={(event) => setEditImageFiles(Array.from(event.target.files ?? []))}
                      className="input-shell"
                    />
                    {editImageFiles.length > 0 ? (
                      <div className="text-xs text-muted-foreground">
                        {editImageFiles.length} new image{editImageFiles.length === 1 ? "" : "s"} selected
                      </div>
                    ) : null}
                  </div>

                  <div className="grid gap-2">
                    <Label className="field-label">External Image URL</Label>
                    <Input
                      value={editItem.image_url ?? ""}
                      onChange={(event) => setEditItem({ ...editItem, image_url: event.target.value })}
                      className="input-shell"
                    />
                  </div>

                  <div className="md:col-span-2 rounded-xl border p-4">
                    <div className="mb-3">
                      <Label className="field-label">Variants</Label>
                      <div className="text-sm text-muted-foreground">
                        Add customer-selectable options here instead of raw JSON.
                      </div>
                    </div>

                    <VariantEditor
                      variants={(editItem.variants as ItemVariant[] | null) ?? []}
                      onChange={(variants) => setEditItem({ ...editItem, variants })}
                    />
                  </div>

                  <div className="md:col-span-2 rounded-xl border p-4">
                    <div className="mb-3">
                      <Label className="field-label">Availability schedule</Label>
                      <div className="text-sm text-muted-foreground">
                        Add rows for limited windows, or leave it empty to keep the item available all day.
                      </div>
                    </div>

                    <ScheduleEditor
                      schedule={(editItem.availability_schedule as AvailabilitySlot[] | null) ?? []}
                      onChange={(availability_schedule) => setEditItem({ ...editItem, availability_schedule })}
                    />
                  </div>

                  <div className="md:col-span-2 rounded-xl border p-4">
                    <div className="mb-3">
                      <Label className="field-label">Ingredients</Label>
                      <div className="text-sm text-muted-foreground">
                        Mark only optional ingredients as removable so customers can order without them.
                      </div>
                    </div>

                    <IngredientEditor
                      ingredients={editItem.ingredients ?? []}
                      onChange={(ingredients) => setEditItem({ ...editItem, ingredients })}
                    />
                  </div>

                  <div className="md:col-span-2 rounded-xl border p-4">
                    <div className="mb-3">
                      <Label className="field-label">Combo offers</Label>
                      <div className="text-sm text-muted-foreground">
                        Add optional bundle prices customers can choose during checkout.
                      </div>
                    </div>

                    <ComboOfferEditor
                      comboOffers={editItem.combo_offers ?? []}
                      onChange={(combo_offers) => setEditItem({ ...editItem, combo_offers })}
                    />
                  </div>

                  <div className="md:col-span-2 flex items-center justify-between rounded-xl border p-4">
                    <div>
                      <Label className="field-label">Active</Label>
                      <div className="text-sm text-muted-foreground">Visible on the public storefront.</div>
                    </div>
                    <Switch
                      checked={!!editItem.is_active}
                      onCheckedChange={(checked) => setEditItem({ ...editItem, is_active: checked })}
                    />
                  </div>
                </div>

                {getItemImageUrls(editItem).length > 0 ? (
                  <div className="rounded-xl border p-4">
                    <div className="mb-2 text-sm font-medium">Current gallery</div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {getItemImageUrls(editItem).map((url, index) => (
                        <div key={`${url}-${index}`} className="grid gap-2">
                          <img src={url} alt={`${editItem.name} ${index + 1}`} className="h-40 w-full rounded-xl object-cover" />
                          <Button
                            type="button"
                            variant="secondary"
                            onClick={() => void deleteImageM.mutate(index)}
                            disabled={deleteImageM.isPending || clearImagesM.isPending}
                          >
                            Delete this image
                          </Button>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3">
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => void clearImagesM.mutate()}
                        disabled={deleteImageM.isPending || clearImagesM.isPending}
                      >
                        Delete all images
                      </Button>
                    </div>
                  </div>
                ) : null}

                {updateError ? <div className="text-sm text-red-600">{updateError}</div> : null}
              </div>
            ) : null}
          </div>

          <DialogFooter className="app-modal-footer">
            <Button onClick={() => updateM.mutate()} disabled={!editItem || updateM.isPending}>
              {updateM.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
