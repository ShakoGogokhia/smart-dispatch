import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  CalendarClock,
  CircleSlash,
  Copy,
  MoreHorizontal,
  Pencil,
  Plus,
  Sparkles,
  TicketPercent,
  TimerOff,
  Users,
} from "lucide-react";
import { useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { api } from "@/lib/api";
import { formatDateTime, formatMoney, toNumber } from "@/lib/format";
import { useMe } from "@/lib/useMe";

import { PageHeader } from "@/components/app/page-header";
import { StatCard, StatGrid } from "@/components/app/stat-card";
import { EmptyState } from "@/components/app/empty-state";
import { LoadingState } from "@/components/app/loading-state";
import { StatusBadge } from "@/components/app/status-badge";
import type { Tone } from "@/components/app/status-badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

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
      toast.success("Promo code created");
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
      toast.success("Promo code updated");
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

  const [now] = useState(() => Date.now());
  const stats = (() => {
    let live = 0;
    let expired = 0;
    let scheduled = 0;
    let uses = 0;
    for (const promo of promos) {
      const status = promoStatus(promo, now);
      if (status === "active") live += 1;
      if (status === "expired") expired += 1;
      if (promo.starts_at || promo.ends_at) scheduled += 1;
      uses += toNumber(promo.uses);
    }
    return { live, expired, scheduled, uses };
  })();

  const openEdit = (promo: PromoCode) => {
    setEditPromo({
      ...promo,
      starts_at: toInputDateTime(promo.starts_at),
      ends_at: toInputDateTime(promo.ends_at),
    });
    setEditOpen(true);
  };

  const copyCode = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`Copied ${value}`);
    } catch {
      toast.error("Could not copy the code");
    }
  };

  const scopeLabel = isGlobalMode ? "platform" : "market";

  if (isGlobalMode && !isAdmin) {
    return (
      <div className="space-y-6">
        <PageHeader title="Global promo codes" />
        <EmptyState icon={CircleSlash} title="Admins only" description="Only admins can manage global promo codes." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={isGlobalMode ? "Global promo codes" : "Market promo codes"}
        description={
          isGlobalMode
            ? "Platform-wide discount codes customers can apply at checkout in any market."
            : "Discount codes customers can apply at checkout in this market."
        }
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus />
            Create promo code
          </Button>
        }
      />

      <StatGrid>
        <StatCard label="Live now" value={stats.live} icon={Sparkles} tone="success" hint={`${promos.length} codes in total`} />
        <StatCard label="Expired" value={stats.expired} icon={TimerOff} tone="destructive" />
        <StatCard label="Scheduled windows" value={stats.scheduled} icon={CalendarClock} tone="info" hint="Codes with start or end dates" />
        <StatCard label="Total uses" value={stats.uses} icon={Users} tone="primary" />
      </StatGrid>

      {!q.isLoading && !q.error ? (
        activePromo ? (
          <Alert>
            <Sparkles />
            <AlertTitle className="flex flex-wrap items-center gap-2">
              Active offer: <span className="font-mono">{activePromo.code}</span>
              <Badge variant="secondary">{activePromo.market_id == null ? "Global" : "Market"}</Badge>
              <Badge variant="outline" className="tabular-nums">
                {activePromo.uses} uses
              </Badge>
            </AlertTitle>
            <AlertDescription>
              {activePromo.type === "percent"
                ? `${toNumber(activePromo.value)}% off is live for this ${scopeLabel}.`
                : `${formatMoney(activePromo.value)} off is live for this ${scopeLabel}.`}
            </AlertDescription>
          </Alert>
        ) : promos.length > 0 ? (
          <Alert>
            <TicketPercent />
            <AlertTitle>No active offer</AlertTitle>
            <AlertDescription>
              {isGlobalMode
                ? "No active global promo code yet. Create one to add a platform-wide offer."
                : "No active promo code yet. Create one to add a public-facing offer to this storefront."}
            </AlertDescription>
          </Alert>
        ) : null
      ) : null}

      {q.isLoading ? (
        <LoadingState rows={4} />
      ) : q.error ? (
        <Alert variant="destructive">
          <AlertTitle>Failed to load promo codes.</AlertTitle>
          <AlertDescription>Refresh the page or try again in a moment.</AlertDescription>
        </Alert>
      ) : promos.length === 0 ? (
        <EmptyState
          icon={TicketPercent}
          title="No promo codes yet"
          description={
            isGlobalMode
              ? "Create a platform-wide offer customers can apply at checkout."
              : "Create a public-facing offer customers can apply at checkout in this storefront."
          }
          action={
            <Button onClick={() => setCreateOpen(true)}>
              <Plus />
              Create promo code
            </Button>
          }
        />
      ) : (
        <Card className="gap-0 overflow-hidden py-0">
          <CardHeader className="border-b py-4">
            <CardTitle className="text-base">All promo codes</CardTitle>
            <CardDescription>Usage, validity window and status for every code.</CardDescription>
          </CardHeader>

          <div className="hidden overflow-x-auto md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Code</TableHead>
                  <TableHead>Discount</TableHead>
                  <TableHead className="w-44">Usage</TableHead>
                  <TableHead>Validity</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="pr-6 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {promos.map((promo) => (
                  <TableRow key={promo.id}>
                    <TableCell className="pl-6">
                      <div className="flex items-center gap-1">
                        <span className="font-mono text-sm font-semibold">{promo.code}</span>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon-xs" aria-label={`Copy ${promo.code}`} onClick={() => copyCode(promo.code)}>
                              <Copy />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Copy code</TooltipContent>
                        </Tooltip>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        #{promo.id} · {promo.market_id == null ? "Global" : "Market"}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium tabular-nums">{promoValueLabel(promo)}</TableCell>
                    <TableCell>
                      <PromoUsage promo={promo} />
                    </TableCell>
                    <TableCell>
                      <PromoValidity promo={promo} />
                    </TableCell>
                    <TableCell>
                      <PromoStatusBadge promo={promo} now={now} />
                    </TableCell>
                    <TableCell className="pr-6 text-right">
                      <PromoActions promo={promo} onEdit={openEdit} onCopy={copyCode} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="divide-y md:hidden">
            {promos.map((promo) => (
              <div key={promo.id} className="grid gap-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1">
                      <span className="truncate font-mono font-semibold">{promo.code}</span>
                      <Button variant="ghost" size="icon-xs" aria-label={`Copy ${promo.code}`} onClick={() => copyCode(promo.code)}>
                        <Copy />
                      </Button>
                    </div>
                    <div className="text-sm font-medium tabular-nums">{promoValueLabel(promo)}</div>
                  </div>
                  <div className="flex items-center gap-1">
                    <PromoStatusBadge promo={promo} now={now} />
                    <PromoActions promo={promo} onEdit={openEdit} onCopy={copyCode} />
                  </div>
                </div>
                <PromoUsage promo={promo} />
                <PromoValidity promo={promo} />
                <div className="text-xs text-muted-foreground">
                  #{promo.id} · {promo.market_id == null ? "Global" : "Market"}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Edit promo code</DialogTitle>
            <DialogDescription>
              {editPromo
                ? `${editPromo.code || "Promo code"} · ${promoValueLabel(editPromo)} · used ${editPromo.uses}${editPromo.max_uses ? ` / ${editPromo.max_uses}` : ""} times`
                : "Update the code, schedule, limit and live state."}
            </DialogDescription>
          </DialogHeader>

          {editPromo && (
            <PromoFormFields
              idPrefix="edit-promo"
              code={editPromo.code}
              onCode={(next) => setEditPromo({ ...editPromo, code: next })}
              type={editPromo.type}
              onType={(next) => setEditPromo({ ...editPromo, type: next })}
              value={String(editPromo.value)}
              onValue={(next) => setEditPromo({ ...editPromo, value: next })}
              maxUses={editPromo.max_uses?.toString() ?? ""}
              onMaxUses={(next) => setEditPromo({ ...editPromo, max_uses: next ? Number(next) : null })}
              startsAt={editPromo.starts_at ?? ""}
              onStartsAt={(next) => setEditPromo({ ...editPromo, starts_at: next || null })}
              endsAt={editPromo.ends_at ?? ""}
              onEndsAt={(next) => setEditPromo({ ...editPromo, ends_at: next || null })}
              active={!!editPromo.is_active}
              onActive={(checked) => setEditPromo({ ...editPromo, is_active: checked })}
              activeTitle="Active"
              activeBody="Only active promo codes appear as live offers."
            />
          )}

          {updateError && (
            <Alert variant="destructive">
              <AlertDescription>{updateError}</AlertDescription>
            </Alert>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => updateM.mutate()} disabled={!editPromo || updateM.isPending}>
              {updateM.isPending ? "Saving..." : "Save promo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Create promo code</DialogTitle>
            <DialogDescription>
              {code || value
                ? `${code || "New promo"} · ${
                    value.trim() ? (type === "percent" ? `${toNumber(value)}% off` : `${formatMoney(value)} off`) : "Set discount value"
                  } · ${maxUses.trim() ? `0 / ${maxUses} uses` : "Unlimited uses"}`
                : "Set the discount, an optional schedule and usage limit, and whether it goes live now."}
            </DialogDescription>
          </DialogHeader>

          <PromoFormFields
            idPrefix="new-promo"
            code={code}
            onCode={setCode}
            type={type}
            onType={setType}
            value={value}
            onValue={setValue}
            maxUses={maxUses}
            onMaxUses={setMaxUses}
            startsAt={startsAt}
            onStartsAt={setStartsAt}
            endsAt={endsAt}
            onEndsAt={setEndsAt}
            active={isActive}
            onActive={setIsActive}
            activeTitle="Activate immediately"
            activeBody="When enabled, the public storefront can surface this live offer."
            codePlaceholder="SAVE10"
          />

          {createError && (
            <Alert variant="destructive">
              <AlertDescription>{createError}</AlertDescription>
            </Alert>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
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

type PromoStatus = "active" | "expired" | "scheduled" | "disabled";

function promoStatus(promo: PromoCode, now: number): PromoStatus {
  if (!promo.is_active) return "disabled";
  if (promo.ends_at) {
    const end = new Date(promo.ends_at).getTime();
    if (!Number.isNaN(end) && end < now) return "expired";
  }
  if (promo.max_uses && promo.uses >= promo.max_uses) return "expired";
  if (promo.starts_at) {
    const start = new Date(promo.starts_at).getTime();
    if (!Number.isNaN(start) && start > now) return "scheduled";
  }
  return "active";
}

const STATUS_META: Record<PromoStatus, { label: string; tone: Tone }> = {
  active: { label: "Active", tone: "success" },
  expired: { label: "Expired", tone: "destructive" },
  scheduled: { label: "Scheduled", tone: "info" },
  disabled: { label: "Disabled", tone: "neutral" },
};

function PromoStatusBadge({ promo, now }: { promo: PromoCode; now: number }) {
  const meta = STATUS_META[promoStatus(promo, now)];
  return (
    <StatusBadge tone={meta.tone} dot>
      {meta.label}
    </StatusBadge>
  );
}

function PromoUsage({ promo }: { promo: PromoCode }) {
  const pct = promo.max_uses ? Math.min(100, (toNumber(promo.uses) / promo.max_uses) * 100) : null;
  return (
    <div className="grid gap-1.5">
      <div className="text-sm tabular-nums">
        {promo.uses}
        <span className="text-muted-foreground">{promo.max_uses ? ` / ${promo.max_uses}` : " uses · no limit"}</span>
      </div>
      {pct != null ? <Progress value={pct} className="h-1.5" /> : null}
    </div>
  );
}

function PromoValidity({ promo }: { promo: PromoCode }) {
  return (
    <div className="grid gap-0.5 text-sm">
      <div>
        <span className="text-muted-foreground">From </span>
        {promo.starts_at ? formatDateTime(promo.starts_at) : "Any time"}
      </div>
      <div>
        <span className="text-muted-foreground">Until </span>
        {promo.ends_at ? formatDateTime(promo.ends_at) : "No end set"}
      </div>
      <div className="text-xs text-muted-foreground">
        {promo.starts_at || promo.ends_at
          ? "This offer follows a schedule window."
          : "Unscheduled: governed only by active status."}
      </div>
    </div>
  );
}

function PromoActions({
  promo,
  onEdit,
  onCopy,
}: {
  promo: PromoCode;
  onEdit: (promo: PromoCode) => void;
  onCopy: (code: string) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${promo.code}`}>
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => onEdit(promo)}>
          <Pencil />
          Edit
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onCopy(promo.code)}>
          <Copy />
          Copy code
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function FormField({ id, label, hint, children }: { id: string; label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function PromoFormFields(props: {
  idPrefix: string;
  code: string;
  onCode: (value: string) => void;
  type: PromoCode["type"];
  onType: (value: PromoCode["type"]) => void;
  value: string;
  onValue: (value: string) => void;
  maxUses: string;
  onMaxUses: (value: string) => void;
  startsAt: string;
  onStartsAt: (value: string) => void;
  endsAt: string;
  onEndsAt: (value: string) => void;
  active: boolean;
  onActive: (value: boolean) => void;
  activeTitle: string;
  activeBody: string;
  codePlaceholder?: string;
}) {
  const p = props.idPrefix;
  return (
    <div className="grid gap-4">
      <FormField id={`${p}-code`} label="Code" hint="Customers type this at checkout.">
        <Input
          id={`${p}-code`}
          value={props.code}
          onChange={(e) => props.onCode(e.target.value)}
          placeholder={props.codePlaceholder}
          className="font-mono"
        />
      </FormField>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label>Discount type</Label>
          <ToggleGroup
            type="single"
            variant="outline"
            value={props.type}
            onValueChange={(next) => next && props.onType(next as PromoCode["type"])}
            className="w-full"
          >
            <ToggleGroupItem value="percent" className="flex-1">
              Percent
            </ToggleGroupItem>
            <ToggleGroupItem value="fixed" className="flex-1">
              Fixed amount
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
        <FormField id={`${p}-value`} label={props.type === "percent" ? "Value (%)" : "Value (USD)"}>
          <Input
            id={`${p}-value`}
            inputMode="decimal"
            value={props.value}
            onChange={(e) => props.onValue(e.target.value)}
            placeholder={props.type === "percent" ? "10" : "5.00"}
          />
        </FormField>
      </div>

      <FormField id={`${p}-max`} label="Usage limit" hint="Leave empty for unlimited uses.">
        <Input
          id={`${p}-max`}
          inputMode="numeric"
          value={props.maxUses}
          onChange={(e) => props.onMaxUses(e.target.value)}
          placeholder="100"
        />
      </FormField>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id={`${p}-starts`} label="Starts at" hint="Empty = any time.">
          <Input id={`${p}-starts`} type="datetime-local" value={props.startsAt} onChange={(e) => props.onStartsAt(e.target.value)} />
        </FormField>
        <FormField id={`${p}-ends`} label="Ends at" hint="Empty = no end date.">
          <Input id={`${p}-ends`} type="datetime-local" value={props.endsAt} onChange={(e) => props.onEndsAt(e.target.value)} />
        </FormField>
      </div>

      <div className="flex items-center justify-between gap-4 rounded-lg border bg-muted/30 p-4">
        <div className="min-w-0">
          <Label htmlFor={`${p}-active`}>{props.activeTitle}</Label>
          <p className="mt-1 text-xs text-muted-foreground">{props.activeBody}</p>
        </div>
        <Switch id={`${p}-active`} checked={props.active} onCheckedChange={props.onActive} />
      </div>
    </div>
  );
}
