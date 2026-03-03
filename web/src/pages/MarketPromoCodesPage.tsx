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
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type PromoCode = {
  id: number;
  market_id: number;
  code: string;
  type: "percent" | "fixed";
  value: string | number;
  starts_at?: string | null;
  ends_at?: string | null;
  max_uses?: number | null;
  uses: number;
  is_active: boolean;
};

export default function MarketPromoCodesPage() {
  const { marketId } = useParams();
  const id = Number(marketId);
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ["promo-codes", id],
    queryFn: async () => (await api.get(`/api/markets/${id}/promo-codes`)).data as PromoCode[],
    enabled: Number.isFinite(id),
  });

  const promos = q.data ?? [];

  // create
  const [createOpen, setCreateOpen] = useState(false);
  const [code, setCode] = useState("");
  const [type, setType] = useState<PromoCode["type"]>("percent");
  const [value, setValue] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [maxUses, setMaxUses] = useState("");
  const [isActive, setIsActive] = useState(true);

  const createM = useMutation({
    mutationFn: async () => {
      const payload: any = {
        code,
        type,
        value: Number(value),
        is_active: isActive,
      };
      if (startsAt) payload.starts_at = startsAt;
      if (endsAt) payload.ends_at = endsAt;
      if (maxUses) payload.max_uses = Number(maxUses);

      return (await api.post(`/api/markets/${id}/promo-codes`, payload)).data as PromoCode;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["promo-codes", id] });
      setCreateOpen(false);
      setCode(""); setType("percent"); setValue("");
      setStartsAt(""); setEndsAt(""); setMaxUses(""); setIsActive(true);
    },
  });

  // edit
  const [editOpen, setEditOpen] = useState(false);
  const [editPromo, setEditPromo] = useState<PromoCode | null>(null);

  const updateM = useMutation({
    mutationFn: async () => {
      if (!editPromo) throw new Error("No promo selected");
      const payload: any = {
        code: editPromo.code,
        type: editPromo.type,
        value: Number(editPromo.value),
        is_active: !!editPromo.is_active,
        starts_at: editPromo.starts_at ?? null,
        ends_at: editPromo.ends_at ?? null,
        max_uses: editPromo.max_uses ?? null,
      };
      return (
        await api.patch(`/api/markets/${id}/promo-codes/${editPromo.id}`, payload)
      ).data as PromoCode;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["promo-codes", id] });
      setEditOpen(false);
      setEditPromo(null);
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

  const canCreate = code.trim().length >= 2 && value.trim().length >= 1;

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle>Promo Codes (Market #{id})</CardTitle>

          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button>Add Promo Code</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Promo Code</DialogTitle>
              </DialogHeader>

              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label>Code</Label>
                  <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. SAVE10" />
                </div>

                <div className="grid gap-2">
                  <Label>Type</Label>
                  <Select value={type} onValueChange={(v) => setType(v as any)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percent">Percent</SelectItem>
                      <SelectItem value="fixed">Fixed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <Label>Value</Label>
                  <Input
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    placeholder={type === "percent" ? "10 means 10%" : "2.50 means $2.50"}
                  />
                </div>

                <div className="grid gap-2">
                  <Label>Starts At (optional)</Label>
                  <Input value={startsAt} onChange={(e) => setStartsAt(e.target.value)} placeholder="YYYY-MM-DD HH:mm:ss" />
                </div>

                <div className="grid gap-2">
                  <Label>Ends At (optional)</Label>
                  <Input value={endsAt} onChange={(e) => setEndsAt(e.target.value)} placeholder="YYYY-MM-DD HH:mm:ss" />
                </div>

                <div className="grid gap-2">
                  <Label>Max Uses (optional)</Label>
                  <Input value={maxUses} onChange={(e) => setMaxUses(e.target.value)} placeholder="e.g. 100" />
                </div>

                <div className="flex items-center justify-between">
                  <Label>Active</Label>
                  <Switch checked={isActive} onCheckedChange={setIsActive} />
                </div>

                {createError && <div className="text-sm text-red-600">{createError}</div>}
              </div>

              <DialogFooter>
                <Button onClick={() => createM.mutate()} disabled={!canCreate || createM.isPending}>
                  {createM.isPending ? "Saving..." : "Save"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>

        <CardContent className="grid gap-4">
          {q.isLoading ? (
            <div className="text-sm text-muted-foreground">Loading...</div>
          ) : q.error ? (
            <div className="text-sm text-red-600">Failed to load promo codes</div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Value</TableHead>
                    <TableHead>Uses</TableHead>
                    <TableHead>Active</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {promos.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>{p.id}</TableCell>
                      <TableCell className="font-medium">{p.code}</TableCell>
                      <TableCell>{p.type}</TableCell>
                      <TableCell>{p.value}</TableCell>
                      <TableCell>
                        {p.uses}
                        {p.max_uses ? ` / ${p.max_uses}` : ""}
                      </TableCell>
                      <TableCell>{p.is_active ? "Yes" : "No"}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="secondary"
                          onClick={() => {
                            setEditPromo({ ...p });
                            setEditOpen(true);
                          }}
                        >
                          Edit
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {promos.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-sm text-muted-foreground">
                        No promo codes yet.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* edit modal */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Promo Code</DialogTitle>
          </DialogHeader>

          {editPromo && (
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label>Code</Label>
                <Input value={editPromo.code} onChange={(e) => setEditPromo({ ...editPromo, code: e.target.value })} />
              </div>

              <div className="grid gap-2">
                <Label>Type</Label>
                <Select value={editPromo.type} onValueChange={(v) => setEditPromo({ ...editPromo, type: v as any })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percent">Percent</SelectItem>
                    <SelectItem value="fixed">Fixed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label>Value</Label>
                <Input value={String(editPromo.value)} onChange={(e) => setEditPromo({ ...editPromo, value: e.target.value })} />
              </div>

              <div className="grid gap-2">
                <Label>Starts At</Label>
                <Input
                  value={editPromo.starts_at ?? ""}
                  onChange={(e) => setEditPromo({ ...editPromo, starts_at: e.target.value || null })}
                  placeholder="YYYY-MM-DD HH:mm:ss"
                />
              </div>

              <div className="grid gap-2">
                <Label>Ends At</Label>
                <Input
                  value={editPromo.ends_at ?? ""}
                  onChange={(e) => setEditPromo({ ...editPromo, ends_at: e.target.value || null })}
                  placeholder="YYYY-MM-DD HH:mm:ss"
                />
              </div>

              <div className="grid gap-2">
                <Label>Max Uses</Label>
                <Input
                  value={editPromo.max_uses?.toString() ?? ""}
                  onChange={(e) =>
                    setEditPromo({ ...editPromo, max_uses: e.target.value ? Number(e.target.value) : null })
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <Label>Active</Label>
                <Switch
                  checked={!!editPromo.is_active}
                  onCheckedChange={(v) => setEditPromo({ ...editPromo, is_active: v })}
                />
              </div>

              {updateError && <div className="text-sm text-red-600">{updateError}</div>}
            </div>
          )}

          <DialogFooter>
            <Button onClick={() => updateM.mutate()} disabled={!editPromo || updateM.isPending}>
              {updateM.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}