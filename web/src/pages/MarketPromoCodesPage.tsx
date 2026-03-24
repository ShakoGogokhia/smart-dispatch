import { useMemo, useState } from "react";
import { CalendarRange, Plus, Sparkles, TicketPercent } from "lucide-react";
import { useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/lib/api";
import { formatDateTime, formatMoney, toNumber } from "@/lib/format";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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

function toInputDateTime(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 16);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function normalizeDateTime(value: string) {
  return value ? value.replace("T", " ") : "";
}

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
  const activePromo = useMemo(() => promos.find((promo) => promo.is_active) ?? null, [promos]);

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
      const payload: Record<string, number | string | boolean | null> = {
        code,
        type,
        value: Number(value),
        is_active: isActive,
      };
      if (startsAt) payload.starts_at = normalizeDateTime(startsAt);
      if (endsAt) payload.ends_at = normalizeDateTime(endsAt);
      if (maxUses) payload.max_uses = Number(maxUses);

      return (await api.post(`/api/markets/${id}/promo-codes`, payload)).data as PromoCode;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["promo-codes", id] });
      setCreateOpen(false);
      setCode("");
      setType("percent");
      setValue("");
      setStartsAt("");
      setEndsAt("");
      setMaxUses("");
      setIsActive(true);
    },
  });

  const [editOpen, setEditOpen] = useState(false);
  const [editPromo, setEditPromo] = useState<PromoCode | null>(null);

  const updateM = useMutation({
    mutationFn: async () => {
      if (!editPromo) throw new Error("No promo selected");
      const payload: Record<string, number | string | boolean | null> = {
        code: editPromo.code,
        type: editPromo.type,
        value: Number(editPromo.value),
        is_active: !!editPromo.is_active,
        starts_at: editPromo.starts_at ? normalizeDateTime(editPromo.starts_at) : null,
        ends_at: editPromo.ends_at ? normalizeDateTime(editPromo.ends_at) : null,
        max_uses: editPromo.max_uses ?? null,
      };
      return (await api.patch(`/api/markets/${id}/promo-codes/${editPromo.id}`, payload)).data as PromoCode;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["promo-codes", id] });
      setEditOpen(false);
      setEditPromo(null);
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

  const canCreate = code.trim().length >= 2 && value.trim().length >= 1;

  return (
    <div className="grid gap-6">
      <section className="intro-panel">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="command-chip">
              <TicketPercent className="h-3.5 w-3.5" />
              Promotion workspace
            </div>
            <h1 className="intro-title">Market #{id} promo codes</h1>
            <p className="intro-copy">
              Create and refine the discount layer while admins control which storefront gets the public spotlight.
            </p>
          </div>

          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button size="lg">
                <Plus className="h-4 w-4" />
                Add promo code
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Add promo code</DialogTitle>
              </DialogHeader>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="field-group">
                  <Label>Code</Label>
                  <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="SAVE10" />
                </div>
                <div className="field-group">
                  <Label>Type</Label>
                  <Select value={type} onValueChange={(value) => setType(value as PromoCode["type"])}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percent">Percent</SelectItem>
                      <SelectItem value="fixed">Fixed amount</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="field-group">
                  <Label>Value</Label>
                  <Input
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    placeholder={type === "percent" ? "10" : "5.00"}
                  />
                </div>
                <div className="field-group">
                  <Label>Max uses</Label>
                  <Input value={maxUses} onChange={(e) => setMaxUses(e.target.value)} placeholder="100" />
                </div>
                <div className="field-group">
                  <Label>Starts at</Label>
                  <Input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
                </div>
                <div className="field-group">
                  <Label>Ends at</Label>
                  <Input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
                </div>
                <div className="subpanel flex items-center justify-between p-4 md:col-span-2">
                  <div>
                    <div className="theme-ink font-medium">Activate immediately</div>
                    <div className="theme-muted text-sm">When enabled, the public storefront can surface this live offer.</div>
                  </div>
                  <Switch checked={isActive} onCheckedChange={setIsActive} />
                </div>
              </div>

              {createError && <div className="text-sm text-red-600">{createError}</div>}

              <DialogFooter>
                <Button onClick={() => createM.mutate()} disabled={!canCreate || createM.isPending}>
                  {createM.isPending ? "Saving..." : "Save promo"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card className={activePromo ? "market-card-featured" : ""}>
          <CardContent className="p-6">
            <div className="section-kicker">Active offer</div>
            {activePromo ? (
              <>
                <div className="font-display theme-ink mt-3 text-4xl font-semibold">{activePromo.code}</div>
                <div className="theme-copy mt-2 text-sm leading-7">
                  {activePromo.type === "percent"
                    ? `${toNumber(activePromo.value)}% off is live for this market.`
                    : `${formatMoney(activePromo.value)} off is live for this market.`}
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="status-chip status-good">{activePromo.is_active ? "Live" : "Paused"}</span>
                  <span className="status-chip">{activePromo.uses} uses</span>
                </div>
              </>
            ) : (
              <div className="theme-copy mt-3 text-sm leading-7">
                No active promo code yet. Create one to add a public-facing offer to this storefront.
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="grid gap-4 p-6">
            <div>
              <div className="section-kicker">Offer summary</div>
              <div className="font-display theme-ink mt-2 text-3xl font-semibold">{promos.length}</div>
            </div>
            <div className="metric-block p-4">
              <div className="section-kicker">Currently live</div>
              <div className="theme-ink mt-2 text-2xl font-semibold">{promos.filter((promo) => promo.is_active).length}</div>
            </div>
            <div className="metric-block p-4">
              <div className="section-kicker">Scheduled windows</div>
              <div className="theme-ink mt-2 text-2xl font-semibold">
                {promos.filter((promo) => promo.starts_at || promo.ends_at).length}
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        {q.isLoading ? (
          <Card>
            <CardContent className="p-8 text-sm text-muted-foreground">Loading promo codes...</CardContent>
          </Card>
        ) : q.error ? (
          <Card>
            <CardContent className="p-8 text-sm text-red-600">Failed to load promo codes.</CardContent>
          </Card>
        ) : (
          promos.map((promo) => (
            <Card key={promo.id} className={promo.is_active ? "market-card-featured" : ""}>
              <CardContent className="grid gap-5 p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="section-kicker">Promo #{promo.id}</span>
                      {promo.is_active && (
                        <span className="status-chip status-good">
                          <Sparkles className="h-3.5 w-3.5" />
                          Live
                        </span>
                      )}
                    </div>
                    <h3 className="font-display theme-ink mt-2 text-3xl font-semibold tracking-[-0.05em]">{promo.code}</h3>
                  </div>
                  <div className="status-chip">
                    {promo.type === "percent" ? `${toNumber(promo.value)}% off` : `${formatMoney(promo.value)} off`}
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  <div className="subpanel p-4">
                    <div className="section-kicker">Usage</div>
                    <div className="theme-ink mt-2 font-semibold">
                      {promo.uses}
                      {promo.max_uses ? ` / ${promo.max_uses}` : ""}
                    </div>
                  </div>
                  <div className="subpanel p-4">
                    <div className="section-kicker">Starts</div>
                    <div className="theme-ink mt-2 text-sm font-semibold">{promo.starts_at ? formatDateTime(promo.starts_at) : "Any time"}</div>
                  </div>
                  <div className="subpanel p-4">
                    <div className="section-kicker">Ends</div>
                    <div className="theme-ink mt-2 text-sm font-semibold">{promo.ends_at ? formatDateTime(promo.ends_at) : "No end set"}</div>
                  </div>
                </div>

                <div className="subpanel flex items-center gap-3 p-4 text-sm">
                  <CalendarRange className="h-4 w-4 text-cyan-600 dark:text-cyan-200" />
                  <span className="theme-copy">
                    {promo.starts_at || promo.ends_at
                      ? "This offer follows a schedule window."
                      : "This offer is unscheduled and governed only by active status."}
                  </span>
                </div>

                <div className="flex justify-end">
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setEditPromo({
                        ...promo,
                        starts_at: toInputDateTime(promo.starts_at),
                        ends_at: toInputDateTime(promo.ends_at),
                      });
                      setEditOpen(true);
                    }}
                  >
                    Edit
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}

        {!q.isLoading && !q.error && promos.length === 0 && (
          <Card>
            <CardContent className="p-8 text-sm text-muted-foreground">No promo codes yet.</CardContent>
          </Card>
        )}
      </section>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit promo code</DialogTitle>
          </DialogHeader>

          {editPromo && (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="field-group">
                <Label>Code</Label>
                <Input value={editPromo.code} onChange={(e) => setEditPromo({ ...editPromo, code: e.target.value })} />
              </div>
              <div className="field-group">
                <Label>Type</Label>
                <Select value={editPromo.type} onValueChange={(value) => setEditPromo({ ...editPromo, type: value as PromoCode["type"] })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percent">Percent</SelectItem>
                    <SelectItem value="fixed">Fixed amount</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="field-group">
                <Label>Value</Label>
                <Input value={String(editPromo.value)} onChange={(e) => setEditPromo({ ...editPromo, value: e.target.value })} />
              </div>
              <div className="field-group">
                <Label>Max uses</Label>
                <Input
                  value={editPromo.max_uses?.toString() ?? ""}
                  onChange={(e) => setEditPromo({ ...editPromo, max_uses: e.target.value ? Number(e.target.value) : null })}
                />
              </div>
              <div className="field-group">
                <Label>Starts at</Label>
                <Input
                  type="datetime-local"
                  value={editPromo.starts_at ?? ""}
                  onChange={(e) => setEditPromo({ ...editPromo, starts_at: e.target.value || null })}
                />
              </div>
              <div className="field-group">
                <Label>Ends at</Label>
                <Input
                  type="datetime-local"
                  value={editPromo.ends_at ?? ""}
                  onChange={(e) => setEditPromo({ ...editPromo, ends_at: e.target.value || null })}
                />
              </div>
              <div className="subpanel flex items-center justify-between p-4 md:col-span-2">
                <div>
                  <div className="theme-ink font-medium">Active</div>
                  <div className="theme-muted text-sm">Only active promo codes appear as live offers.</div>
                </div>
                <Switch checked={!!editPromo.is_active} onCheckedChange={(checked) => setEditPromo({ ...editPromo, is_active: checked })} />
              </div>
            </div>
          )}

          {updateError && <div className="text-sm text-red-600">{updateError}</div>}

          <DialogFooter>
            <Button onClick={() => updateM.mutate()} disabled={!editPromo || updateM.isPending}>
              {updateM.isPending ? "Saving..." : "Save promo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
