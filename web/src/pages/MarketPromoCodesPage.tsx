import { useMemo, useState } from "react";
import { CalendarRange, Clock3, Percent, Plus, Sparkles, Tag, TicketPercent } from "lucide-react";
import { useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/lib/api";
import { formatDateTime, formatMoney, toNumber } from "@/lib/format";
import { useMe } from "@/lib/useMe";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type PromoCode = {
  id: number;
  market_id: number | null;
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

function serializeDateTimeForApi(value: string) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return normalizeDateTime(value);
  }

  return date.toISOString().slice(0, 19).replace("T", " ");
}

export default function MarketPromoCodesPage() {
  const { marketId } = useParams();
  const meQ = useMe();
  const roles = meQ.data?.roles ?? [];
  const isAdmin = roles.includes("admin");
  const isGlobalMode = !marketId;
  const id = Number(marketId);
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ["promo-codes", isGlobalMode ? "global" : id],
    queryFn: async () =>
      (
        await api.get(isGlobalMode ? "/api/promo-codes" : `/api/markets/${id}/promo-codes`)
      ).data as PromoCode[],
    enabled: isGlobalMode ? isAdmin : Number.isFinite(id),
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
      if (startsAt) payload.starts_at = serializeDateTimeForApi(startsAt);
      if (endsAt) payload.ends_at = serializeDateTimeForApi(endsAt);
      if (maxUses) payload.max_uses = Number(maxUses);

      return (
        await api.post(isGlobalMode ? "/api/promo-codes" : `/api/markets/${id}/promo-codes`, payload)
      ).data as PromoCode;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["promo-codes", isGlobalMode ? "global" : id] });
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
        starts_at: editPromo.starts_at ? serializeDateTimeForApi(editPromo.starts_at) : null,
        ends_at: editPromo.ends_at ? serializeDateTimeForApi(editPromo.ends_at) : null,
        max_uses: editPromo.max_uses ?? null,
      };
      return (
        await api.patch(isGlobalMode ? `/api/promo-codes/${editPromo.id}` : `/api/markets/${id}/promo-codes/${editPromo.id}`, payload)
      ).data as PromoCode;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["promo-codes", isGlobalMode ? "global" : id] });
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

  if (isGlobalMode && !isAdmin) {
    return (
      <Card>
        <CardContent className="p-8 text-sm text-slate-600">Only admins can manage global promo codes.</CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-6">
      <section className="intro-panel">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="intro-title">Promo codes</h1>
          </div>

          <Button size="lg" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            Add promo code
          </Button>
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card className={activePromo ? "market-card-featured" : "border-slate-200/80 dark:border-white/10"}>
          <CardContent className="p-6">
            <div className="section-kicker">Active offer</div>
            {activePromo ? (
              <>
                <div className="font-display theme-ink mt-3 text-4xl font-semibold">{activePromo.code}</div>
                <div className="theme-copy mt-2 text-sm leading-7">
                  {activePromo.type === "percent"
                    ? `${toNumber(activePromo.value)}% off is live for this ${isGlobalMode ? "platform" : "market"}.`
                    : `${formatMoney(activePromo.value)} off is live for this ${isGlobalMode ? "platform" : "market"}.`}
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="status-chip status-good">{activePromo.is_active ? "Live" : "Paused"}</span>
                  <span className="status-chip">{activePromo.market_id == null ? "Global" : "Market"}</span>
                  <span className="status-chip">{activePromo.uses} uses</span>
                </div>
              </>
            ) : (
              <div className="theme-copy mt-3 text-sm leading-7">
                {isGlobalMode
                  ? "No active global promo code yet. Create one to add a platform-wide offer."
                  : "No active promo code yet. Create one to add a public-facing offer to this storefront."}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 dark:border-white/10">
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
            <Card key={promo.id} className={promo.is_active ? "market-card-featured" : "border-slate-200/80 dark:border-white/10"}>
              <CardContent className="grid gap-5 p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="section-kicker">Promo #{promo.id}</span>
                      <span className="status-chip status-neutral">{promo.market_id == null ? "Global" : "Market"}</span>
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
        <DialogContent className="app-modal-shell sm:max-w-[min(1080px,calc(100%-2rem))]">
          <DialogHeader>
            <div className="app-modal-header">
              <div className="section-kicker">Promotion workspace</div>
              <DialogTitle className="panel-title mt-2">Edit promo code</DialogTitle>
              <p className="theme-copy mt-2 text-sm leading-6">Update the code, schedule, limit, and live state without squeezing the form into a tiny modal.</p>
            </div>
          </DialogHeader>

          <div className="min-h-0 overflow-y-auto">
            {editPromo && (
              <PromoModalLayout
                titleValue={editPromo.code || "Promo code"}
                valueTone={editPromo.type}
                valueText={promoValueLabel(editPromo)}
                active={!!editPromo.is_active}
                usageText={`${editPromo.uses}${editPromo.max_uses ? ` / ${editPromo.max_uses}` : ""}`}
                startsAtText={editPromo.starts_at ? formatDateTime(editPromo.starts_at) : "Any time"}
                endsAtText={editPromo.ends_at ? formatDateTime(editPromo.ends_at) : "No end set"}
                controls={
                  <>
                    <PromoFieldGroup label="Code" icon={Tag}>
                      <Input value={editPromo.code} onChange={(e) => setEditPromo({ ...editPromo, code: e.target.value })} className="input-shell" />
                    </PromoFieldGroup>
                    <PromoFieldGroup label="Type" icon={Percent}>
                      <Select value={editPromo.type} onValueChange={(value) => setEditPromo({ ...editPromo, type: value as PromoCode["type"] })}>
                        <SelectTrigger className="input-shell w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="percent">Percent</SelectItem>
                          <SelectItem value="fixed">Fixed amount</SelectItem>
                        </SelectContent>
                      </Select>
                    </PromoFieldGroup>
                    <PromoFieldGroup label="Value" icon={TicketPercent}>
                      <Input value={String(editPromo.value)} onChange={(e) => setEditPromo({ ...editPromo, value: e.target.value })} className="input-shell" />
                    </PromoFieldGroup>
                    <PromoFieldGroup label="Max uses" icon={Sparkles}>
                      <Input
                        value={editPromo.max_uses?.toString() ?? ""}
                        onChange={(e) => setEditPromo({ ...editPromo, max_uses: e.target.value ? Number(e.target.value) : null })}
                        className="input-shell"
                      />
                    </PromoFieldGroup>
                    <PromoFieldGroup label="Starts at" icon={Clock3}>
                      <Input
                        type="datetime-local"
                        value={editPromo.starts_at ?? ""}
                        onChange={(e) => setEditPromo({ ...editPromo, starts_at: e.target.value || null })}
                        className="input-shell"
                      />
                    </PromoFieldGroup>
                    <PromoFieldGroup label="Ends at" icon={CalendarRange}>
                      <Input
                        type="datetime-local"
                        value={editPromo.ends_at ?? ""}
                        onChange={(e) => setEditPromo({ ...editPromo, ends_at: e.target.value || null })}
                        className="input-shell"
                      />
                    </PromoFieldGroup>
                    <PromoSwitchCard
                      title="Active"
                      body="Only active promo codes appear as live offers."
                      checked={!!editPromo.is_active}
                      onCheckedChange={(checked) => setEditPromo({ ...editPromo, is_active: checked })}
                    />
                  </>
                }
              />
            )}
          </div>

          {updateError && <div className="px-6 text-sm text-red-600">{updateError}</div>}

          <DialogFooter className="app-modal-footer">
            <Button onClick={() => updateM.mutate()} disabled={!editPromo || updateM.isPending}>
              {updateM.isPending ? "Saving..." : "Save promo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="app-modal-shell sm:max-w-[min(1080px,calc(100%-2rem))]">
          <DialogHeader>
            <div className="app-modal-header">
              <div className="section-kicker">Promotion workspace</div>
              <DialogTitle className="panel-title mt-2">Add promo code</DialogTitle>
              <p className="theme-copy mt-2 text-sm leading-6">Create a readable offer with clear value, schedule, usage limit, and live visibility settings.</p>
            </div>
          </DialogHeader>

          <div className="min-h-0 overflow-y-auto">
            <PromoModalLayout
              titleValue={code || "New promo"}
              valueTone={type}
              valueText={value.trim() ? (type === "percent" ? `${toNumber(value)}% off` : `${formatMoney(value)} off`) : "Set discount value"}
              active={isActive}
              usageText={maxUses.trim() ? `0 / ${maxUses}` : "Unlimited"}
              startsAtText={startsAt ? formatDateTime(normalizeDateTime(startsAt)) : "Any time"}
              endsAtText={endsAt ? formatDateTime(normalizeDateTime(endsAt)) : "No end set"}
              controls={
                <>
                  <PromoFieldGroup label="Code" icon={Tag}>
                    <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="SAVE10" className="input-shell" />
                  </PromoFieldGroup>
                  <PromoFieldGroup label="Type" icon={Percent}>
                    <Select value={type} onValueChange={(nextValue) => setType(nextValue as PromoCode["type"])}>
                      <SelectTrigger className="input-shell w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="percent">Percent</SelectItem>
                        <SelectItem value="fixed">Fixed amount</SelectItem>
                      </SelectContent>
                    </Select>
                  </PromoFieldGroup>
                  <PromoFieldGroup label="Value" icon={TicketPercent}>
                    <Input
                      value={value}
                      onChange={(e) => setValue(e.target.value)}
                      placeholder={type === "percent" ? "10" : "5.00"}
                      className="input-shell"
                    />
                  </PromoFieldGroup>
                  <PromoFieldGroup label="Max uses" icon={Sparkles}>
                    <Input value={maxUses} onChange={(e) => setMaxUses(e.target.value)} placeholder="100" className="input-shell" />
                  </PromoFieldGroup>
                  <PromoFieldGroup label="Starts at" icon={Clock3}>
                    <Input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} className="input-shell" />
                  </PromoFieldGroup>
                  <PromoFieldGroup label="Ends at" icon={CalendarRange}>
                    <Input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} className="input-shell" />
                  </PromoFieldGroup>
                  <PromoSwitchCard
                    title="Activate immediately"
                    body="When enabled, the public storefront can surface this live offer."
                    checked={isActive}
                    onCheckedChange={setIsActive}
                  />
                </>
              }
            />
          </div>

          {createError && <div className="px-6 text-sm text-red-600">{createError}</div>}

          <DialogFooter className="app-modal-footer">
            <Button onClick={() => createM.mutate()} disabled={!canCreate || createM.isPending}>
              {createM.isPending ? "Saving..." : "Save promo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function promoValueLabel(promo: Pick<PromoCode, "type" | "value">) {
  return promo.type === "percent" ? `${toNumber(promo.value)}% off` : `${formatMoney(promo.value)} off`;
}

function PromoModalLayout({
  titleValue,
  valueTone,
  valueText,
  active,
  usageText,
  startsAtText,
  endsAtText,
  controls,
}: {
  titleValue: string;
  valueTone: PromoCode["type"];
  valueText: string;
  active: boolean;
  usageText: string;
  startsAtText: string;
  endsAtText: string;
  controls: React.ReactNode;
}) {
  return (
    <div className="grid gap-0 lg:grid-cols-[340px_minmax(0,1fr)]">
      <aside className="border-b border-slate-200 bg-white/94 p-5 lg:border-b-0 lg:border-r dark:border-white/10 dark:bg-[#101927]">
        <div className="grid gap-4 lg:sticky lg:top-0">
          <div className="rounded-[26px] border border-slate-200 bg-[#f7f4ec] p-5 dark:border-white/10 dark:bg-[#0c1521]">
            <div className="section-kicker">Offer preview</div>
            <div className="theme-ink mt-3 text-3xl font-semibold">{titleValue}</div>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className={`status-chip ${active ? "status-good" : "status-neutral"}`}>{active ? "Live" : "Paused"}</span>
              <span className="status-chip">{valueTone === "percent" ? "Percent" : "Fixed"}</span>
            </div>
            <div className="theme-copy mt-4 text-sm leading-6">{valueText}</div>
          </div>

          <div className="grid gap-3">
            <PromoStatCard label="Usage window" value={usageText} />
            <PromoStatCard label="Starts" value={startsAtText} />
            <PromoStatCard label="Ends" value={endsAtText} />
          </div>
        </div>
      </aside>

      <main className="grid gap-5 p-5 sm:p-6">
        <section className="grid gap-4 md:grid-cols-2">
          {controls}
        </section>
      </main>
    </div>
  );
}

function PromoFieldGroup({
  label,
  icon: Icon,
  children,
}: {
  label: string;
  icon: typeof Tag;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-[24px] border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/[0.055]">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-cyan-700 dark:text-cyan-200" />
        <Label className="field-label">{label}</Label>
      </div>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function PromoSwitchCard({
  title,
  body,
  checked,
  onCheckedChange,
}: {
  title: string;
  body: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="rounded-[24px] border border-slate-200 bg-white p-4 md:col-span-2 dark:border-white/10 dark:bg-white/[0.055]">
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

function PromoStatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[22px] border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/[0.055]">
      <div className="section-kicker">{label}</div>
      <div className="theme-ink mt-2 text-sm font-semibold leading-6">{value}</div>
    </div>
  );
}
