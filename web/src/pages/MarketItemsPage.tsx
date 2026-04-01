import { useState } from "react";
import { useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

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
  variants?: Array<{ name: string; value: string; price_delta?: number | string }> | null;
  availability_schedule?: Array<{ day: string; from: string; to: string }> | null;
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

  // create modal
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
  const [variants, setVariants] = useState("");
  const [availabilitySchedule, setAvailabilitySchedule] = useState("");
  const [lowStockThreshold, setLowStockThreshold] = useState("5");
  const [csvDraft, setCsvDraft] = useState("name,sku,category,price,discount_type,discount_value,stock_qty,low_stock_threshold,is_active,image_url,variants,availability_schedule");

  const createM = useMutation({
    mutationFn: async () => {
      const payload = {
        name,
        sku,
        category: category || null,
        image_url: imageUrl || null,
        variants: variants ? JSON.parse(variants) : null,
        availability_schedule: availabilitySchedule ? JSON.parse(availabilitySchedule) : null,
        price: Number(price),
        discount_type: discountType,
        discount_value: Number(discountValue || 0),
        stock_qty: Number(stockQty || 0),
        low_stock_threshold: Number(lowStockThreshold || 5),
        is_active: isActive,
      };
      return (await api.post(`/api/markets/${id}/items`, payload)).data as Item;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["market-items", id] });
      setCreateOpen(false);
      setName(""); setSku(""); setPrice("");
      setDiscountType("none"); setDiscountValue("");
      setStockQty("0"); setIsActive(true);
      setCategory(""); setImageUrl(""); setVariants(""); setAvailabilitySchedule(""); setLowStockThreshold("5");
    },
  });

  // edit modal
  const [editOpen, setEditOpen] = useState(false);
  const [editItem, setEditItem] = useState<Item | null>(null);

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
        variants: editItem.variants ?? null,
        availability_schedule: editItem.availability_schedule ?? null,
        low_stock_threshold: Number(editItem.low_stock_threshold || 5),
        is_active: !!editItem.is_active,
      };
      return (
        await api.patch(`/api/markets/${id}/items/${editItem.id}`, payload)
      ).data as Item;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["market-items", id] });
      setEditOpen(false);
      setEditItem(null);
    },
  });

  const createError =
    (createM.error as any)?.response?.data?.message ??
    (createM.error as any)?.message ??
    null;

  const updateError =
    (updateM.error as any)?.response?.data?.message ??
    (updateM.error as any)?.message ??
    null;

  const canCreate = name.trim() && sku.trim() && price.trim();

  const importM = useMutation({
    mutationFn: async () => (await api.post(`/api/markets/${id}/items/import-csv`, { csv: csvDraft })).data,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["market-items", id] });
    },
  });

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle>Market Items (Market #{id})</CardTitle>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" asChild>
              <a href={`${api.defaults.baseURL}/api/markets/${id}/items/export-csv`} target="_blank" rel="noreferrer">Export CSV</a>
            </Button>
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <Button>Add Item</Button>
              </DialogTrigger>
            <DialogContent className="app-modal-shell sm:max-w-[min(760px,calc(100%-2rem))]">
              <DialogHeader>
                <div className="app-modal-header">
                  <DialogTitle className="panel-title">Add item</DialogTitle>
                </div>
              </DialogHeader>

              <div className="app-modal-body">
              <div className="app-modal-main">
                <div className="grid gap-2">
                  <Label className="field-label">Name</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} className="input-shell" />
                </div>

                <div className="grid gap-2">
                  <Label className="field-label">SKU</Label>
                  <Input value={sku} onChange={(e) => setSku(e.target.value)} className="input-shell" />
                </div>

                <div className="grid gap-2">
                  <Label className="field-label">Category</Label>
                  <Input value={category} onChange={(e) => setCategory(e.target.value)} className="input-shell" />
                </div>

                <div className="grid gap-2">
                  <Label className="field-label">Price</Label>
                  <Input value={price} onChange={(e) => setPrice(e.target.value)} placeholder="e.g. 10.50" className="input-shell" />
                </div>

                <div className="grid gap-2">
                  <Label className="field-label">Discount Type</Label>
                  <Select value={discountType} onValueChange={(v) => setDiscountType(v as any)}>
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
                    onChange={(e) => setDiscountValue(e.target.value)}
                    placeholder={discountType === "percent" ? "e.g. 10 (means 10%)" : "e.g. 2.00"}
                    className="input-shell"
                  />
                </div>

                <div className="grid gap-2">
                  <Label className="field-label">Stock Qty</Label>
                  <Input value={stockQty} onChange={(e) => setStockQty(e.target.value)} className="input-shell" />
                </div>

                <div className="grid gap-2">
                  <Label className="field-label">Low Stock Threshold</Label>
                  <Input value={lowStockThreshold} onChange={(e) => setLowStockThreshold(e.target.value)} className="input-shell" />
                </div>

                <div className="grid gap-2">
                  <Label className="field-label">Image URL</Label>
                  <Input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} className="input-shell" />
                </div>

                <div className="grid gap-2">
                  <Label className="field-label">Variants JSON</Label>
                  <Input value={variants} onChange={(e) => setVariants(e.target.value)} className="input-shell" placeholder='[{"name":"Size","value":"L"}]' />
                </div>

                <div className="grid gap-2">
                  <Label className="field-label">Availability Schedule JSON</Label>
                  <Input value={availabilitySchedule} onChange={(e) => setAvailabilitySchedule(e.target.value)} className="input-shell" placeholder='[{"day":"Mon","from":"09:00","to":"18:00"}]' />
                </div>

                <div className="flex items-center justify-between">
                  <Label className="field-label">Active</Label>
                  <Switch checked={isActive} onCheckedChange={setIsActive} />
                </div>

                {createError && <div className="text-sm text-red-600">{createError}</div>}
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
            <Input value={csvDraft} onChange={(e) => setCsvDraft(e.target.value)} className="input-shell" />
            <Button variant="secondary" onClick={() => importM.mutate()} disabled={importM.isPending}>
              {importM.isPending ? "Importing..." : "Import CSV"}
            </Button>
          </div>
          {itemsQ.isLoading ? (
            <div className="text-sm text-muted-foreground">Loading...</div>
          ) : itemsQ.error ? (
            <div className="text-sm text-red-600">Failed to load items</div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Discount</TableHead>
                    <TableHead>Stock</TableHead>
                    <TableHead>Reviews</TableHead>
                    <TableHead>Active</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((it) => (
                    <TableRow key={it.id}>
                      <TableCell>{it.id}</TableCell>
                      <TableCell className="font-medium">{it.name}</TableCell>
                      <TableCell>{it.sku}</TableCell>
                      <TableCell>{it.category || "-"}</TableCell>
                      <TableCell>{it.price}</TableCell>
                      <TableCell>
                        {it.discount_type === "none"
                          ? "-"
                          : `${it.discount_type} ${it.discount_value}`}
                      </TableCell>
                      <TableCell>{it.stock_qty}{it.is_low_stock ? " (Low)" : ""}</TableCell>
                      <TableCell>{it.review_summary?.average ?? "-"} / {it.review_summary?.count ?? 0}</TableCell>
                      <TableCell>{it.is_active ? "Yes" : "No"}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="secondary"
                          onClick={() => {
                            setEditItem({ ...it });
                            setEditOpen(true);
                          }}
                        >
                          Edit
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {items.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-sm text-muted-foreground">
                        No items yet.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit modal */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="app-modal-shell sm:max-w-[min(760px,calc(100%-2rem))]">
          <DialogHeader>
            <div className="app-modal-header">
              <DialogTitle className="panel-title">Edit item</DialogTitle>
            </div>
          </DialogHeader>

          <div className="app-modal-body">
          {editItem && (
            <div className="app-modal-main">
              <div className="grid gap-2">
                <Label className="field-label">Name</Label>
                <Input
                  value={editItem.name}
                  onChange={(e) => setEditItem({ ...editItem, name: e.target.value })}
                  className="input-shell"
                />
              </div>

              <div className="grid gap-2">
                <Label className="field-label">SKU</Label>
                <Input
                  value={editItem.sku}
                  onChange={(e) => setEditItem({ ...editItem, sku: e.target.value })}
                  className="input-shell"
                />
              </div>

              <div className="grid gap-2">
                <Label className="field-label">Category</Label>
                <Input
                  value={editItem.category ?? ""}
                  onChange={(e) => setEditItem({ ...editItem, category: e.target.value })}
                  className="input-shell"
                />
              </div>

              <div className="grid gap-2">
                <Label className="field-label">Price</Label>
                <Input
                  value={String(editItem.price)}
                  onChange={(e) => setEditItem({ ...editItem, price: e.target.value })}
                  className="input-shell"
                />
              </div>

              <div className="grid gap-2">
                <Label className="field-label">Discount Type</Label>
                <Select
                  value={editItem.discount_type}
                  onValueChange={(v) => setEditItem({ ...editItem, discount_type: v as any })}
                >
                  <SelectTrigger className="input-shell w-full"><SelectValue /></SelectTrigger>
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
                  onChange={(e) => setEditItem({ ...editItem, discount_value: e.target.value })}
                  className="input-shell"
                />
              </div>

              <div className="grid gap-2">
                <Label className="field-label">Stock Qty</Label>
                <Input
                  value={String(editItem.stock_qty)}
                  onChange={(e) => setEditItem({ ...editItem, stock_qty: Number(e.target.value) })}
                  className="input-shell"
                />
              </div>

              <div className="grid gap-2">
                <Label className="field-label">Low Stock Threshold</Label>
                <Input
                  value={String(editItem.low_stock_threshold ?? 5)}
                  onChange={(e) => setEditItem({ ...editItem, low_stock_threshold: Number(e.target.value) })}
                  className="input-shell"
                />
              </div>

              <div className="grid gap-2">
                <Label className="field-label">Image URL</Label>
                <Input
                  value={editItem.image_url ?? ""}
                  onChange={(e) => setEditItem({ ...editItem, image_url: e.target.value })}
                  className="input-shell"
                />
              </div>

              <div className="flex items-center justify-between">
                <Label className="field-label">Active</Label>
                <Switch
                  checked={!!editItem.is_active}
                  onCheckedChange={(v) => setEditItem({ ...editItem, is_active: v })}
                />
              </div>

              {updateError && <div className="text-sm text-red-600">{updateError}</div>}
            </div>
          )}
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
