import { useState } from "react";
import { BadgePercent, Boxes, DollarSign, Package, ScanLine, Sparkles } from "lucide-react";
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
  price: string | number;
  discount_type: "none" | "percent" | "fixed";
  discount_value: string | number;
  stock_qty: number;
  is_active: boolean;
};

function getItemValueLabel(item: {
  price: string | number;
  discount_type: Item["discount_type"];
  discount_value: string | number;
}) {
  const basePrice = Number(item.price || 0);
  const discountValue = Number(item.discount_value || 0);

  if (item.discount_type === "percent" && discountValue > 0) {
    return `${basePrice.toFixed(2)} with ${discountValue}% off`;
  }

  if (item.discount_type === "fixed" && discountValue > 0) {
    return `${basePrice.toFixed(2)} with ${discountValue.toFixed(2)} off`;
  }

  return `${basePrice.toFixed(2)} standard price`;
}

function ItemPreviewCard({
  title,
  sku,
  valueLabel,
  stockLabel,
  active,
}: {
  active: boolean;
  sku: string;
  stockLabel: string;
  title: string;
  valueLabel: string;
}) {
  return (
    <div className="rounded-[26px] border border-slate-200 bg-[#f7f4ec] p-5 dark:border-white/10 dark:bg-[#0f1825]">
      <div className="section-kicker">Item preview</div>
      <div className="theme-ink mt-3 text-3xl font-semibold">{title}</div>
      <div className="theme-copy mt-2 text-sm leading-6">{sku}</div>
      <div className="mt-4 flex flex-wrap gap-2">
        <span className={`status-chip ${active ? "status-good" : "status-neutral"}`}>{active ? "Active" : "Hidden"}</span>
        <span className="status-chip status-neutral">{stockLabel}</span>
      </div>
      <div className="theme-copy mt-4 text-sm leading-6">{valueLabel}</div>
    </div>
  );
}

function ItemFieldCard({
  children,
  icon: Icon,
  label,
}: {
  children: React.ReactNode;
  icon: typeof Package;
  label: string;
}) {
  return (
    <div className="rounded-[24px] border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-[#131d2b]">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-cyan-700 dark:text-cyan-200" />
        <Label className="field-label">{label}</Label>
      </div>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function ItemSwitchCard({
  body,
  checked,
  onCheckedChange,
  title,
}: {
  body: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  title: string;
}) {
  return (
    <div className="rounded-[24px] border border-slate-200 bg-white p-4 md:col-span-2 dark:border-white/10 dark:bg-[#131d2b]">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="theme-ink font-medium">{title}</div>
          <div className="theme-muted mt-1 text-sm leading-6">{body}</div>
        </div>
        <Switch checked={checked} onCheckedChange={onCheckedChange} />
      </div>
    </div>
  );
}

function ItemModalLayout({
  controls,
  preview,
}: {
  controls: React.ReactNode;
  preview: React.ReactNode;
}) {
  return (
    <div className="grid gap-0 lg:grid-cols-[320px_minmax(0,1fr)]">
      <aside className="border-b border-slate-200 bg-white/94 p-5 lg:border-b-0 lg:border-r dark:border-white/10 dark:bg-[#131d2b]">
        <div className="grid gap-4 lg:sticky lg:top-0">{preview}</div>
      </aside>

      <main className="grid gap-4 p-5 sm:p-6 md:grid-cols-2">{controls}</main>
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

  const createM = useMutation({
    mutationFn: async () => {
      const payload = {
        name,
        sku,
        price: Number(price),
        discount_type: discountType,
        discount_value: Number(discountValue || 0),
        stock_qty: Number(stockQty || 0),
        is_active: isActive,
      };
      return (await api.post(`/api/markets/${id}/items`, payload)).data as Item;
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
    },
  });

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
        is_active: !!editItem.is_active,
      };

      return (await api.patch(`/api/markets/${id}/items/${editItem.id}`, payload)).data as Item;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["market-items", id] });
      setEditOpen(false);
      setEditItem(null);
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

          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button>Add Item</Button>
            </DialogTrigger>
            <DialogContent className="grid-rows-[auto_minmax(0,1fr)_auto] gap-0 rounded-[30px] border border-slate-200/80 bg-[#f8f6f0] p-0 dark:border-white/10 dark:bg-[#0d1420] sm:max-w-[min(1080px,calc(100%-2rem))]">
              <DialogHeader>
                <div className="border-b border-slate-200 bg-white/92 px-6 py-5 dark:border-white/10 dark:bg-[#131d2b]">
                  <div className="section-kicker">Catalog workspace</div>
                  <DialogTitle className="panel-title mt-2">Add item</DialogTitle>
                  <p className="theme-copy mt-2 text-sm leading-6">
                    Create a market item with cleaner pricing, stock, and visibility controls in the same dialog style as the rest of the app.
                  </p>
                </div>
              </DialogHeader>

              <div className="min-h-0 overflow-y-auto">
                <ItemModalLayout
                  preview={
                    <ItemPreviewCard
                      title={name || "New item"}
                      sku={sku || "SKU preview"}
                      valueLabel={getItemValueLabel({
                        price,
                        discount_type: discountType,
                        discount_value: discountValue,
                      })}
                      stockLabel={`${stockQty || "0"} in stock`}
                      active={isActive}
                    />
                  }
                  controls={
                    <>
                      <ItemFieldCard label="Name" icon={Package}>
                        <Input value={name} onChange={(e) => setName(e.target.value)} className="input-shell" />
                      </ItemFieldCard>
                      <ItemFieldCard label="SKU" icon={ScanLine}>
                        <Input value={sku} onChange={(e) => setSku(e.target.value)} className="input-shell" />
                      </ItemFieldCard>
                      <ItemFieldCard label="Price" icon={DollarSign}>
                        <Input value={price} onChange={(e) => setPrice(e.target.value)} placeholder="10.50" className="input-shell" />
                      </ItemFieldCard>
                      <ItemFieldCard label="Discount type" icon={BadgePercent}>
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
                      </ItemFieldCard>
                      <ItemFieldCard label="Discount value" icon={Sparkles}>
                        <Input
                          value={discountValue}
                          onChange={(e) => setDiscountValue(e.target.value)}
                          placeholder={discountType === "percent" ? "10 means 10%" : "2.00"}
                          className="input-shell"
                        />
                      </ItemFieldCard>
                      <ItemFieldCard label="Stock quantity" icon={Boxes}>
                        <Input value={stockQty} onChange={(e) => setStockQty(e.target.value)} className="input-shell" />
                      </ItemFieldCard>
                      <ItemSwitchCard
                        title="Item active"
                        body="Inactive items stay in the system but do not show up in the public storefront."
                        checked={isActive}
                        onCheckedChange={setIsActive}
                      />
                    </>
                  }
                />
              </div>

              {createError && <div className="px-6 text-sm text-red-700">{createError}</div>}

              <DialogFooter className="border-t border-slate-200 bg-slate-50/90 px-6 py-4 dark:border-white/10 dark:bg-white/4">
                <Button onClick={() => createM.mutate()} disabled={!canCreate || createM.isPending}>
                  {createM.isPending ? "Saving..." : "Save item"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>

        <CardContent className="grid gap-4">
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
                    <TableHead>Price</TableHead>
                    <TableHead>Discount</TableHead>
                    <TableHead>Stock</TableHead>
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
                      <TableCell>{it.price}</TableCell>
                      <TableCell>{it.discount_type === "none" ? "-" : `${it.discount_type} ${it.discount_value}`}</TableCell>
                      <TableCell>{it.stock_qty}</TableCell>
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

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="grid-rows-[auto_minmax(0,1fr)_auto] gap-0 rounded-[30px] border border-slate-200/80 bg-[#f8f6f0] p-0 dark:border-white/10 dark:bg-[#0d1420] sm:max-w-[min(1080px,calc(100%-2rem))]">
          <DialogHeader>
            <div className="border-b border-slate-200 bg-white/92 px-6 py-5 dark:border-white/10 dark:bg-[#131d2b]">
              <div className="section-kicker">Catalog workspace</div>
              <DialogTitle className="panel-title mt-2">Edit item</DialogTitle>
              <p className="theme-copy mt-2 text-sm leading-6">
                Update pricing, stock, discount behavior, and visibility using the same structured item workspace.
              </p>
            </div>
          </DialogHeader>

          <div className="min-h-0 overflow-y-auto">
            {editItem && (
              <ItemModalLayout
                preview={
                  <ItemPreviewCard
                    title={editItem.name || "Item"}
                    sku={editItem.sku || "SKU"}
                    valueLabel={getItemValueLabel({
                      price: editItem.price,
                      discount_type: editItem.discount_type,
                      discount_value: editItem.discount_value,
                    })}
                    stockLabel={`${editItem.stock_qty || 0} in stock`}
                    active={!!editItem.is_active}
                  />
                }
                controls={
                  <>
                    <ItemFieldCard label="Name" icon={Package}>
                      <Input value={editItem.name} onChange={(e) => setEditItem({ ...editItem, name: e.target.value })} className="input-shell" />
                    </ItemFieldCard>
                    <ItemFieldCard label="SKU" icon={ScanLine}>
                      <Input value={editItem.sku} onChange={(e) => setEditItem({ ...editItem, sku: e.target.value })} className="input-shell" />
                    </ItemFieldCard>
                    <ItemFieldCard label="Price" icon={DollarSign}>
                      <Input
                        value={String(editItem.price)}
                        onChange={(e) => setEditItem({ ...editItem, price: e.target.value })}
                        className="input-shell"
                      />
                    </ItemFieldCard>
                    <ItemFieldCard label="Discount type" icon={BadgePercent}>
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
                    </ItemFieldCard>
                    <ItemFieldCard label="Discount value" icon={Sparkles}>
                      <Input
                        value={String(editItem.discount_value)}
                        onChange={(e) => setEditItem({ ...editItem, discount_value: e.target.value })}
                        className="input-shell"
                      />
                    </ItemFieldCard>
                    <ItemFieldCard label="Stock quantity" icon={Boxes}>
                      <Input
                        value={String(editItem.stock_qty)}
                        onChange={(e) => setEditItem({ ...editItem, stock_qty: Number(e.target.value) })}
                        className="input-shell"
                      />
                    </ItemFieldCard>
                    <ItemSwitchCard
                      title="Item active"
                      body="Keep this enabled if the item should stay visible in the market catalog."
                      checked={!!editItem.is_active}
                      onCheckedChange={(value) => setEditItem({ ...editItem, is_active: value })}
                    />
                  </>
                }
              />
            )}
          </div>

          {updateError && <div className="px-6 text-sm text-red-700">{updateError}</div>}

          <DialogFooter className="border-t border-slate-200 bg-slate-50/90 px-6 py-4 dark:border-white/10 dark:bg-white/4">
            <Button onClick={() => updateM.mutate()} disabled={!editItem || updateM.isPending}>
              {updateM.isPending ? "Saving..." : "Save item"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
