import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertCircle,
  AlertTriangle,
  BadgePercent,
  CheckCircle2,
  Download,
  ImageIcon,
  Images,
  LayoutGrid,
  List,
  MoreHorizontal,
  Package,
  Pencil,
  Plus,
  Search,
  SlidersHorizontal,
  Tag,
  Upload,
  Warehouse,
  X,
} from "lucide-react";

import { api } from "@/lib/api";
import type { ComboOffer, ItemIngredient } from "@/lib/cart";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

import { EmptyState } from "@/components/app/empty-state";
import { LoadingState } from "@/components/app/loading-state";
import { PageHeader } from "@/components/app/page-header";
import { StatCard, StatGrid } from "@/components/app/stat-card";
import { StatusBadge } from "@/components/app/status-badge";

import { ItemExtrasSummary, ReviewSummaryBadge } from "@/components/market-items/market-item-editors";
import { MarketItemFormDialog, type ItemFormTab, type ItemFormValues } from "@/components/market-items/market-item-form";
import {
  buildComboPayload,
  computeFinalPrice,
  describeDiscount,
  getComboSelectableItems,
  getItemImageUrls,
  getItemIngredientsPayload,
  getStockState,
  hasDiscount,
  hydrateComboOffers,
  normalizeAvailabilitySchedule,
  normalizeVariants,
  type AvailabilitySlot,
  type Item,
  type ItemVariant,
  type StockState,
} from "@/components/market-items/market-item-helpers";

type StatusFilter = "all" | "active" | "hidden";
type StockFilter = "all" | "in" | "low" | "out" | "attention";
type PriceFilter = "all" | "discounted";
type SortKey = "default" | "name" | "price-asc" | "price-desc" | "stock-asc" | "newest";
type ViewMode = "table" | "grid";

function errorMessage(error: unknown, fallback: string) {
  return (
    (error as { response?: { data?: { message?: string } } })?.response?.data?.message ??
    (error as { message?: string })?.message ??
    fallback
  );
}

function StockBadge({ state }: { state: StockState }) {
  if (state === "out") return <StatusBadge tone="destructive" dot>Out of stock</StatusBadge>;
  if (state === "low") return <StatusBadge tone="warning" dot>Low stock</StatusBadge>;
  return <StatusBadge tone="success" dot>In stock</StatusBadge>;
}

function ActiveBadge({ active }: { active: boolean }) {
  return active ? <StatusBadge tone="success">Active</StatusBadge> : <StatusBadge tone="neutral">Hidden</StatusBadge>;
}

function ItemThumb({ item, className }: { item: Item; className?: string }) {
  const url = getItemImageUrls(item)[0];
  return (
    <div className={cn("shrink-0 overflow-hidden rounded-md border bg-muted", className)}>
      {url ? (
        <img src={url} alt={item.name} className="size-full object-cover" />
      ) : (
        <div className="flex size-full items-center justify-center text-muted-foreground">
          <ImageIcon className="size-4" />
        </div>
      )}
    </div>
  );
}

function PriceCell({ item }: { item: Item }) {
  const discounted = hasDiscount(item);
  const finalPrice = computeFinalPrice(item.price, item.discount_type, item.discount_value);
  return (
    <div className="grid gap-0.5">
      <div className="flex items-baseline gap-1.5 tabular-nums">
        <span className="font-medium">{formatMoney(discounted ? finalPrice : item.price)}</span>
        {discounted ? <span className="text-xs text-muted-foreground line-through">{formatMoney(item.price)}</span> : null}
      </div>
      <span className={cn("text-xs", discounted ? "text-success" : "text-muted-foreground")}>{describeDiscount(item)}</span>
    </div>
  );
}

function StockCell({ item }: { item: Item }) {
  return (
    <div className="grid justify-items-start gap-1">
      <div className="flex items-center gap-2">
        <span className="font-medium tabular-nums">{item.stock_qty}</span>
        <StockBadge state={getStockState(item)} />
      </div>
      <span className="text-xs text-muted-foreground">
        {(item.show_stock_quantity ?? true) ? "Qty shown to customers" : "Qty hidden from customers"}
      </span>
    </div>
  );
}

function ItemActions({ item, onEdit }: { item: Item; onEdit: (item: Item, tab: ItemFormTab) => void }) {
  return (
    <div className="flex items-center justify-end gap-1">
      <Button variant="outline" size="sm" onClick={() => onEdit(item, "basics")}>
        <Pencil />
        Edit
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={`More actions for ${item.name}`}>
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuLabel className="truncate">{item.name}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => onEdit(item, "basics")}>
            <Pencil />
            Edit details
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => onEdit(item, "pricing")}>
            <BadgePercent />
            Price & discount
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => onEdit(item, "inventory")}>
            <Warehouse />
            Update stock
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => onEdit(item, "media")}>
            <Images />
            Manage images
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => onEdit(item, "options")}>
            <SlidersHorizontal />
            Variants & schedule
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => onEdit(item, "composition")}>
            <Tag />
            {item.item_kind === "combo" ? "Combo contents" : "Ingredients & combos"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function ProductCard({
  item,
  layout,
  onEdit,
}: {
  item: Item;
  layout: "grid" | "row";
  onEdit: (item: Item, tab: ItemFormTab) => void;
}) {
  const extras = (
    <ItemExtrasSummary
      variants={item.variants as ItemVariant[] | null}
      schedule={item.availability_schedule as AvailabilitySlot[] | null}
      ingredients={item.ingredients}
      comboOffers={item.combo_offers}
    />
  );

  if (layout === "grid") {
    return (
      <Card className="gap-0 overflow-hidden py-0">
        <div className="relative">
          <ItemThumb item={item} className="aspect-[4/3] w-full rounded-none border-0 border-b" />
          <div className="absolute top-2 left-2 flex flex-wrap gap-1">
            <ActiveBadge active={item.is_active} />
            {hasDiscount(item) ? <StatusBadge tone="primary">{describeDiscount(item)}</StatusBadge> : null}
          </div>
        </div>
        <div className="grid flex-1 gap-3 p-4">
          <div className="min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="truncate font-medium">{item.name}</div>
              {item.item_kind === "combo" ? <Badge variant="secondary">Combo</Badge> : null}
            </div>
            <div className="truncate text-xs text-muted-foreground">
              {item.sku} · #{item.id} · {item.category || "No category"}
            </div>
          </div>
          <div className="flex items-end justify-between gap-3">
            <PriceCell item={item} />
            <ReviewSummaryBadge average={item.review_summary?.average} count={item.review_summary?.count} />
          </div>
          <StockCell item={item} />
          {extras}
        </div>
        <div className="border-t bg-muted/30 px-4 py-2">
          <ItemActions item={item} onEdit={onEdit} />
        </div>
      </Card>
    );
  }

  return (
    <Card className="gap-3 p-4">
      <div className="flex min-w-0 items-start gap-3">
        <ItemThumb item={item} className="size-14" />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="truncate font-medium">{item.name}</div>
            <ActiveBadge active={item.is_active} />
          </div>
          <div className="truncate text-xs text-muted-foreground">
            {item.sku} · #{item.id} · {item.category || "No category"}
            {item.item_kind === "combo" ? " · Combo" : ""}
          </div>
          <div className="mt-2">
            <PriceCell item={item} />
          </div>
        </div>
      </div>
      <div className="grid gap-3 rounded-lg border bg-muted/30 p-3 sm:grid-cols-2">
        <StockCell item={item} />
        <div className="grid gap-1">
          <ReviewSummaryBadge average={item.review_summary?.average} count={item.review_summary?.count} />
          {extras}
        </div>
      </div>
      <ItemActions item={item} onEdit={onEdit} />
    </Card>
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

  const items = useMemo(() => itemsQ.data ?? [], [itemsQ.data]);
  const createComboSelectableItems = getComboSelectableItems(items);

  /* ---------------- create state (unchanged fields) ---------------- */
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [price, setPrice] = useState("");
  const [discountType, setDiscountType] = useState<Item["discount_type"]>("none");
  const [discountValue, setDiscountValue] = useState("");
  const [stockQty, setStockQty] = useState("0");
  const [showStockQuantity, setShowStockQuantity] = useState(true);
  const [isActive, setIsActive] = useState(true);
  const [category, setCategory] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [createImageFiles, setCreateImageFiles] = useState<File[]>([]);
  const [variants, setVariants] = useState<ItemVariant[]>([]);
  const [availabilitySchedule, setAvailabilitySchedule] = useState<AvailabilitySlot[]>([]);
  const [createIngredients, setCreateIngredients] = useState<ItemIngredient[]>([]);
  const [createItemKind, setCreateItemKind] = useState<"regular" | "combo">("regular");
  const [createComboOffers, setCreateComboOffers] = useState<ComboOffer[]>([]);
  const [lowStockThreshold, setLowStockThreshold] = useState("5");
  const [csvDraft, setCsvDraft] = useState(
    "name,sku,category,price,discount_type,discount_value,stock_qty,show_stock_quantity,low_stock_threshold,is_active,image_url,variants,availability_schedule,ingredients,combo_offers",
  );
  const [importOpen, setImportOpen] = useState(false);

  /* ---------------- list presentation state ---------------- */
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [stockFilter, setStockFilter] = useState<StockFilter>("all");
  const [priceFilter, setPriceFilter] = useState<PriceFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("default");
  const [view, setView] = useState<ViewMode>("table");

  const createM = useMutation({
    mutationFn: async () => {
      const payload = {
        name,
        sku,
        item_kind: createItemKind,
        category: category || null,
        image_url: imageUrl || null,
        variants: normalizeVariants(variants),
        availability_schedule: normalizeAvailabilitySchedule(availabilitySchedule),
        ingredients: getItemIngredientsPayload(createItemKind, createIngredients),
        combo_offers: buildComboPayload(createItemKind, createComboOffers, price),
        price: Number(price),
        discount_type: discountType,
        discount_value: Number(discountValue || 0),
        stock_qty: Number(stockQty || 0),
        show_stock_quantity: showStockQuantity,
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
      setShowStockQuantity(true);
      setIsActive(true);
      setCategory("");
      setImageUrl("");
      setCreateImageFiles([]);
      setVariants([]);
      setAvailabilitySchedule([]);
      setCreateIngredients([]);
      setCreateItemKind("regular");
      setCreateComboOffers([]);
      setLowStockThreshold("5");
    },
  });

  const [editOpen, setEditOpen] = useState(false);
  const [editItem, setEditItem] = useState<Item | null>(null);
  const [editImageFiles, setEditImageFiles] = useState<File[]>([]);
  const [editTab, setEditTab] = useState<ItemFormTab>("basics");
  const editComboSelectableItems = getComboSelectableItems(items, editItem?.id ?? null);

  const updateM = useMutation({
    mutationFn: async () => {
      if (!editItem) throw new Error("No item selected");

      const payload = {
        name: editItem.name,
        sku: editItem.sku,
        item_kind: editItem.item_kind ?? "regular",
        price: Number(editItem.price),
        discount_type: editItem.discount_type,
        discount_value: Number(editItem.discount_value || 0),
        stock_qty: Number(editItem.stock_qty || 0),
        show_stock_quantity: editItem.show_stock_quantity ?? true,
        category: editItem.category ?? null,
        image_url: editItem.image_url ?? null,
        variants: normalizeVariants((editItem.variants as ItemVariant[] | null) ?? []),
        availability_schedule: normalizeAvailabilitySchedule((editItem.availability_schedule as AvailabilitySlot[] | null) ?? []),
        ingredients: getItemIngredientsPayload(editItem.item_kind === "combo" ? "combo" : "regular", editItem.ingredients ?? []),
        combo_offers: buildComboPayload(editItem.item_kind === "combo" ? "combo" : "regular", editItem.combo_offers ?? [], editItem.price),
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
        combo_offers: hydrateComboOffers(updatedItem.combo_offers, getComboSelectableItems(items, updatedItem.id)),
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
        combo_offers: hydrateComboOffers(updatedItem.combo_offers, getComboSelectableItems(items, updatedItem.id)),
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

  const canCreate =
    Boolean(name.trim() && sku.trim() && price.trim()) &&
    (createItemKind === "regular" || buildComboPayload("combo", createComboOffers, price).length > 0);

  const createMissing = [
    !name.trim() ? "Name" : null,
    !sku.trim() ? "SKU" : null,
    !price.trim() ? "Price" : null,
    createItemKind === "combo" && buildComboPayload("combo", createComboOffers, price).length === 0
      ? "Combo products"
      : null,
  ].filter((entry): entry is string => Boolean(entry));

  /* ---------------- form adapters (presentation only) ---------------- */
  const createValues: ItemFormValues = {
    itemKind: createItemKind,
    name,
    sku,
    category,
    price,
    discountType,
    discountValue,
    stockQty,
    showStockQuantity,
    lowStockThreshold,
    isActive,
    imageUrl,
    imageFiles: createImageFiles,
    variants,
    schedule: availabilitySchedule,
    ingredients: createIngredients,
    comboOffers: createComboOffers,
  };

  const patchCreate = (patch: Partial<ItemFormValues>) => {
    if (patch.itemKind !== undefined) setCreateItemKind(patch.itemKind);
    if (patch.name !== undefined) setName(patch.name);
    if (patch.sku !== undefined) setSku(patch.sku);
    if (patch.category !== undefined) setCategory(patch.category);
    if (patch.price !== undefined) setPrice(patch.price);
    if (patch.discountType !== undefined) setDiscountType(patch.discountType);
    if (patch.discountValue !== undefined) setDiscountValue(patch.discountValue);
    if (patch.stockQty !== undefined) setStockQty(patch.stockQty);
    if (patch.showStockQuantity !== undefined) setShowStockQuantity(patch.showStockQuantity);
    if (patch.lowStockThreshold !== undefined) setLowStockThreshold(patch.lowStockThreshold);
    if (patch.isActive !== undefined) setIsActive(patch.isActive);
    if (patch.imageUrl !== undefined) setImageUrl(patch.imageUrl);
    if (patch.imageFiles !== undefined) setCreateImageFiles(patch.imageFiles);
    if (patch.variants !== undefined) setVariants(patch.variants);
    if (patch.schedule !== undefined) setAvailabilitySchedule(patch.schedule);
    if (patch.ingredients !== undefined) setCreateIngredients(patch.ingredients);
    if (patch.comboOffers !== undefined) setCreateComboOffers(patch.comboOffers);
  };

  const editValues: ItemFormValues | null = editItem
    ? {
        itemKind: editItem.item_kind === "combo" ? "combo" : "regular",
        name: editItem.name,
        sku: editItem.sku,
        category: editItem.category ?? "",
        price: String(editItem.price),
        discountType: editItem.discount_type,
        discountValue: String(editItem.discount_value),
        stockQty: String(editItem.stock_qty),
        showStockQuantity: editItem.show_stock_quantity ?? true,
        lowStockThreshold: String(editItem.low_stock_threshold ?? 5),
        isActive: !!editItem.is_active,
        imageUrl: editItem.image_url ?? "",
        imageFiles: editImageFiles,
        variants: (editItem.variants as ItemVariant[] | null) ?? [],
        schedule: (editItem.availability_schedule as AvailabilitySlot[] | null) ?? [],
        ingredients: editItem.ingredients ?? [],
        comboOffers: editItem.combo_offers ?? [],
      }
    : null;

  const patchEdit = (patch: Partial<ItemFormValues>) => {
    if (patch.imageFiles !== undefined) setEditImageFiles(patch.imageFiles);
    if (!editItem) return;
    const next: Item = { ...editItem };
    if (patch.itemKind !== undefined) next.item_kind = patch.itemKind;
    if (patch.name !== undefined) next.name = patch.name;
    if (patch.sku !== undefined) next.sku = patch.sku;
    if (patch.category !== undefined) next.category = patch.category;
    if (patch.price !== undefined) next.price = patch.price;
    if (patch.discountType !== undefined) next.discount_type = patch.discountType;
    if (patch.discountValue !== undefined) next.discount_value = patch.discountValue;
    if (patch.stockQty !== undefined) next.stock_qty = Number(patch.stockQty);
    if (patch.showStockQuantity !== undefined) next.show_stock_quantity = patch.showStockQuantity;
    if (patch.lowStockThreshold !== undefined) next.low_stock_threshold = Number(patch.lowStockThreshold);
    if (patch.isActive !== undefined) next.is_active = patch.isActive;
    if (patch.imageUrl !== undefined) next.image_url = patch.imageUrl;
    if (patch.variants !== undefined) next.variants = patch.variants;
    if (patch.schedule !== undefined) next.availability_schedule = patch.schedule;
    if (patch.ingredients !== undefined) next.ingredients = patch.ingredients;
    if (patch.comboOffers !== undefined) next.combo_offers = patch.comboOffers;
    if (Object.keys(patch).some((key) => key !== "imageFiles")) setEditItem(next);
  };

  const openEdit = (item: Item, tab: ItemFormTab) => {
    setEditItem({
      ...item,
      item_kind: item.item_kind ?? "regular",
      variants: item.variants ?? [],
      availability_schedule: item.availability_schedule ?? [],
      ingredients: item.ingredients ?? [],
      combo_offers: hydrateComboOffers(item.combo_offers, getComboSelectableItems(items, item.id)),
    });
    setEditImageFiles([]);
    setEditTab(tab);
    setEditOpen(true);
  };

  /* ---------------- derived list data ---------------- */
  const categories = useMemo(
    () =>
      Array.from(new Set(items.map((item) => item.category?.trim()).filter((value): value is string => Boolean(value)))).sort(
        (a, b) => a.localeCompare(b),
      ),
    [items],
  );

  const stats = useMemo(() => {
    let active = 0;
    let low = 0;
    let out = 0;
    let discounted = 0;
    for (const item of items) {
      if (item.is_active) active += 1;
      const state = getStockState(item);
      if (state === "low") low += 1;
      if (state === "out") out += 1;
      if (hasDiscount(item)) discounted += 1;
    }
    return { total: items.length, active, hidden: items.length - active, low, out, discounted };
  }, [items]);

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    const result = items.filter((item) => {
      if (query) {
        const haystack = `${item.name} ${item.sku} ${item.category ?? ""} ${item.id}`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      if (categoryFilter !== "all") {
        if (categoryFilter === "__none__" ? Boolean(item.category?.trim()) : item.category?.trim() !== categoryFilter) return false;
      }
      if (statusFilter === "active" && !item.is_active) return false;
      if (statusFilter === "hidden" && item.is_active) return false;
      if (stockFilter !== "all") {
        const state = getStockState(item);
        if (stockFilter === "attention" ? state === "in" : state !== stockFilter) return false;
      }
      if (priceFilter === "discounted" && !hasDiscount(item)) return false;
      return true;
    });

    const finalPrice = (item: Item) => computeFinalPrice(item.price, item.discount_type, item.discount_value);
    switch (sortKey) {
      case "name":
        return [...result].sort((a, b) => a.name.localeCompare(b.name));
      case "price-asc":
        return [...result].sort((a, b) => finalPrice(a) - finalPrice(b));
      case "price-desc":
        return [...result].sort((a, b) => finalPrice(b) - finalPrice(a));
      case "stock-asc":
        return [...result].sort((a, b) => Number(a.stock_qty || 0) - Number(b.stock_qty || 0));
      case "newest":
        return [...result].sort((a, b) => b.id - a.id);
      default:
        return result;
    }
  }, [items, search, categoryFilter, statusFilter, stockFilter, priceFilter, sortKey]);

  const filtersActive =
    search.trim() !== "" || categoryFilter !== "all" || statusFilter !== "all" || stockFilter !== "all" || priceFilter !== "all";

  const resetFilters = () => {
    setSearch("");
    setCategoryFilter("all");
    setStatusFilter("all");
    setStockFilter("all");
    setPriceFilter("all");
  };

  /* ---------------- actions with feedback ---------------- */
  const submitCreate = () =>
    createM.mutate(undefined, {
      onSuccess: () => toast.success("Product added"),
      onError: (error) => toast.error(errorMessage(error, "Could not add the product")),
    });

  const submitUpdate = () =>
    updateM.mutate(undefined, {
      onSuccess: () => toast.success("Product saved"),
      onError: (error) => toast.error(errorMessage(error, "Could not save the product")),
    });

  const submitImport = () =>
    importM.mutate(undefined, {
      onSuccess: () => {
        toast.success("CSV imported");
        setImportOpen(false);
      },
      onError: (error) => toast.error(errorMessage(error, "CSV import failed")),
    });

  const exportHref = `${api.defaults.baseURL}/api/markets/${id}/items/export-csv`;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Products"
        description="Manage what this market sells: prices and discounts, stock, images, ingredients and combo offers."
        breadcrumbs={[
          { label: "Markets", to: "/markets" },
          { label: `Market #${id}`, to: `/markets/${id}` },
          { label: "Products" },
        ]}
        className="mb-0"
        actions={
          <>
            <Dialog open={importOpen} onOpenChange={setImportOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Upload />
                  Import CSV
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Import products from CSV</DialogTitle>
                  <DialogDescription>
                    Paste CSV text below. The first line must be the header row with the column names shown.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-2">
                  <Label htmlFor="csv-draft">CSV content</Label>
                  <Textarea
                    id="csv-draft"
                    value={csvDraft}
                    onChange={(event) => setCsvDraft(event.target.value)}
                    className="min-h-48 font-mono text-xs"
                    spellCheck={false}
                  />
                  <p className="text-xs text-muted-foreground">
                    Tip: use Export CSV first to get a file in the right format, edit it, then paste it here.
                  </p>
                </div>
                {importM.isError ? (
                  <Alert variant="destructive">
                    <AlertCircle />
                    <AlertTitle>Import failed</AlertTitle>
                    <AlertDescription>{errorMessage(importM.error, "CSV import failed")}</AlertDescription>
                  </Alert>
                ) : null}
                <DialogFooter>
                  <Button variant="outline" onClick={() => setImportOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={submitImport} disabled={importM.isPending}>
                    {importM.isPending ? <Spinner /> : <Upload />}
                    {importM.isPending ? "Importing..." : "Import CSV"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Button variant="outline" asChild>
              <a href={exportHref} target="_blank" rel="noreferrer">
                <Download />
                Export CSV
              </a>
            </Button>

            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus />
                  Add product
                </Button>
              </DialogTrigger>
              <MarketItemFormDialog
                mode="create"
                values={createValues}
                onChange={patchCreate}
                comboItems={createComboSelectableItems}
                categories={categories}
                error={createError}
                missing={createMissing}
                canSubmit={canCreate}
                submitting={createM.isPending}
                onSubmit={submitCreate}
              />
            </Dialog>
          </>
        }
      />

      <StatGrid>
        <StatCard
          label="Total products"
          value={stats.total}
          icon={Package}
          tone="primary"
          hint={`${categories.length} categor${categories.length === 1 ? "y" : "ies"}`}
          onClick={resetFilters}
          active={!filtersActive && stats.total > 0}
        />
        <StatCard
          label="Active"
          value={stats.active}
          icon={CheckCircle2}
          tone="success"
          hint={stats.hidden > 0 ? `${stats.hidden} hidden` : "All visible in store"}
          onClick={() => setStatusFilter(statusFilter === "active" ? "all" : "active")}
          active={statusFilter === "active"}
        />
        <StatCard
          label="Low / out of stock"
          value={`${stats.low} / ${stats.out}`}
          icon={AlertTriangle}
          tone={stats.out > 0 ? "destructive" : stats.low > 0 ? "warning" : "default"}
          hint={stats.low + stats.out > 0 ? "Needs restocking" : "Stock looks healthy"}
          onClick={() => setStockFilter(stockFilter === "attention" ? "all" : "attention")}
          active={stockFilter === "attention"}
        />
        <StatCard
          label="Discounted"
          value={stats.discounted}
          icon={BadgePercent}
          tone="info"
          hint="Products with an active discount"
          onClick={() => setPriceFilter(priceFilter === "discounted" ? "all" : "discounted")}
          active={priceFilter === "discounted"}
        />
      </StatGrid>

      <Card className="gap-0 overflow-hidden py-0">
        <div className="flex flex-col gap-3 border-b p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by name, SKU or category"
                className="pl-8"
                aria-label="Search products"
              />
            </div>
            <div className="flex items-center gap-2">
              <Select value={sortKey} onValueChange={(value) => setSortKey(value as SortKey)}>
                <SelectTrigger className="w-full sm:w-44" aria-label="Sort products">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">Default order</SelectItem>
                  <SelectItem value="name">Name A-Z</SelectItem>
                  <SelectItem value="price-asc">Price: low to high</SelectItem>
                  <SelectItem value="price-desc">Price: high to low</SelectItem>
                  <SelectItem value="stock-asc">Stock: lowest first</SelectItem>
                  <SelectItem value="newest">Newest first</SelectItem>
                </SelectContent>
              </Select>
              <ToggleGroup
                type="single"
                variant="outline"
                value={view}
                onValueChange={(value) => value && setView(value as ViewMode)}
                aria-label="View mode"
                className="shrink-0"
              >
                <ToggleGroupItem value="table" aria-label="Table view">
                  <List />
                </ToggleGroupItem>
                <ToggleGroupItem value="grid" aria-label="Grid view">
                  <LayoutGrid />
                </ToggleGroupItem>
              </ToggleGroup>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full sm:w-44" aria-label="Filter by category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {categories.map((entry) => (
                  <SelectItem key={entry} value={entry}>
                    {entry}
                  </SelectItem>
                ))}
                <SelectItem value="__none__">No category</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as StatusFilter)}>
              <SelectTrigger className="w-full sm:w-36" aria-label="Filter by status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="hidden">Hidden</SelectItem>
              </SelectContent>
            </Select>
            <Select value={stockFilter} onValueChange={(value) => setStockFilter(value as StockFilter)}>
              <SelectTrigger className="w-full sm:w-40" aria-label="Filter by stock">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any stock</SelectItem>
                <SelectItem value="in">In stock</SelectItem>
                <SelectItem value="attention">Low or out</SelectItem>
                <SelectItem value="low">Low stock</SelectItem>
                <SelectItem value="out">Out of stock</SelectItem>
              </SelectContent>
            </Select>
            <Select value={priceFilter} onValueChange={(value) => setPriceFilter(value as PriceFilter)}>
              <SelectTrigger className="w-full sm:w-40" aria-label="Filter by discount">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any price</SelectItem>
                <SelectItem value="discounted">Discounted only</SelectItem>
              </SelectContent>
            </Select>
            {filtersActive ? (
              <Button variant="ghost" size="sm" onClick={resetFilters} className="col-span-2 justify-self-start">
                <X />
                Clear filters
              </Button>
            ) : null}
            <span className="col-span-2 text-xs text-muted-foreground tabular-nums sm:ml-auto">
              Showing {filteredItems.length} of {items.length}
            </span>
          </div>
        </div>

        {itemsQ.isLoading ? (
          <div className="p-4">
            <LoadingState rows={4} />
          </div>
        ) : itemsQ.isError ? (
          <div className="p-4">
            <Alert variant="destructive">
              <AlertCircle />
              <AlertTitle>Failed to load products</AlertTitle>
              <AlertDescription>
                <span>{errorMessage(itemsQ.error, "Something went wrong while loading this market's products.")}</span>
                <Button variant="outline" size="sm" className="mt-2" onClick={() => void itemsQ.refetch()}>
                  Try again
                </Button>
              </AlertDescription>
            </Alert>
          </div>
        ) : items.length === 0 ? (
          <CardContent className="py-6">
            <EmptyState
              icon={Package}
              title="No products yet"
              description="Add your first product, or import a CSV to bring in your whole catalog at once."
              action={
                <div className="flex flex-wrap justify-center gap-2">
                  <Button onClick={() => setCreateOpen(true)}>
                    <Plus />
                    Add product
                  </Button>
                  <Button variant="outline" onClick={() => setImportOpen(true)}>
                    <Upload />
                    Import CSV
                  </Button>
                </div>
              }
            />
          </CardContent>
        ) : filteredItems.length === 0 ? (
          <CardContent className="py-6">
            <EmptyState
              icon={Search}
              title="No products match your filters"
              description="Try a different search term or clear the filters to see all products."
              action={
                <Button variant="outline" onClick={resetFilters}>
                  <X />
                  Clear filters
                </Button>
              }
            />
          </CardContent>
        ) : view === "grid" ? (
          <div className="grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3">
            {filteredItems.map((item) => (
              <ProductCard key={item.id} item={item} layout="grid" onEdit={openEdit} />
            ))}
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto lg:block">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead className="pl-4">Product</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Stock</TableHead>
                    <TableHead>Details</TableHead>
                    <TableHead>Reviews</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="pr-4 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredItems.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="pl-4">
                        <div className="flex min-w-0 items-center gap-3">
                          <ItemThumb item={item} className="size-10" />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="max-w-[220px] truncate font-medium">{item.name}</span>
                              {item.item_kind === "combo" ? <Badge variant="secondary">Combo</Badge> : null}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {item.sku} · #{item.id}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{item.category || "-"}</TableCell>
                      <TableCell>
                        <PriceCell item={item} />
                      </TableCell>
                      <TableCell>
                        <StockCell item={item} />
                      </TableCell>
                      <TableCell>
                        <ItemExtrasSummary
                          variants={item.variants as ItemVariant[] | null}
                          schedule={item.availability_schedule as AvailabilitySlot[] | null}
                          ingredients={item.ingredients}
                          comboOffers={item.combo_offers}
                        />
                      </TableCell>
                      <TableCell>
                        <ReviewSummaryBadge average={item.review_summary?.average} count={item.review_summary?.count} />
                      </TableCell>
                      <TableCell>
                        <ActiveBadge active={item.is_active} />
                      </TableCell>
                      <TableCell className="pr-4 text-right">
                        <ItemActions item={item} onEdit={openEdit} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="grid gap-3 p-4 lg:hidden">
              {filteredItems.map((item) => (
                <ProductCard key={item.id} item={item} layout="row" onEdit={openEdit} />
              ))}
            </div>
          </>
        )}
      </Card>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        {editValues ? (
          <MarketItemFormDialog
            key={`${editItem?.id ?? "none"}-${editTab}`}
            mode="edit"
            values={editValues}
            onChange={patchEdit}
            comboItems={editComboSelectableItems}
            categories={categories}
            initialTab={editTab}
            gallery={{
              urls: getItemImageUrls(editItem),
              onDelete: (index) =>
                void deleteImageM.mutate(index, {
                  onSuccess: () => toast.success("Image deleted"),
                  onError: (error) => toast.error(errorMessage(error, "Could not delete the image")),
                }),
              onClearAll: () =>
                void clearImagesM.mutate(undefined, {
                  onSuccess: () => toast.success("All images deleted"),
                  onError: (error) => toast.error(errorMessage(error, "Could not delete the images")),
                }),
              busy: deleteImageM.isPending || clearImagesM.isPending,
            }}
            error={updateError}
            canSubmit={!!editItem}
            submitting={updateM.isPending}
            onSubmit={submitUpdate}
          />
        ) : null}
      </Dialog>
    </div>
  );
}
