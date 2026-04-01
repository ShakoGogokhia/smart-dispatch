import { useDeferredValue, useMemo, useState } from "react";
import { ArrowRight, Megaphone, Search, Sparkles, TicketPercent, UserRound } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { api } from "@/lib/api";
import { useMe } from "@/lib/useMe";
import { formatMoney, toNumber } from "@/lib/format";
import type { StorefrontMarket } from "@/lib/storefront";

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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

type UserLite = { id: number; name: string; email: string };
type Market = StorefrontMarket & {
  owner_user_id: number;
  owner?: UserLite;
};

type BadgeRequest = {
  id: number;
  badge: string;
  duration_days: number;
  status: string;
  notes?: string | null;
  market?: { id: number; name: string; code: string } | null;
  requester?: { id: number; name: string; email: string } | null;
};

type WorkflowApproval = {
  id: number;
  type: string;
  status: string;
  notes?: string | null;
  requester?: { id: number; name: string; email: string } | null;
  market?: { id: number; name: string; code: string } | null;
  order?: { id: number; code: string } | null;
};

type MarketDraft = {
  name: string;
  code: string;
  address: string;
  lat: string;
  lng: string;
  ownerId: string;
  isActive: boolean;
  isFeatured: boolean;
  featuredBadge: string;
  featuredHeadline: string;
  featuredCopy: string;
};

const emptyDraft: MarketDraft = {
  name: "",
  code: "",
  address: "",
  lat: "",
  lng: "",
  ownerId: "",
  isActive: true,
  isFeatured: false,
  featuredBadge: "",
  featuredHeadline: "",
  featuredCopy: "",
};

function toDraft(market: Market): MarketDraft {
  return {
    name: market.name,
    code: market.code,
    address: market.address ?? "",
    lat: market.lat != null ? String(market.lat) : "",
    lng: market.lng != null ? String(market.lng) : "",
    ownerId: String(market.owner_user_id),
    isActive: market.is_active,
    isFeatured: !!market.is_featured,
    featuredBadge: market.featured_badge ?? "",
    featuredHeadline: market.featured_headline ?? "",
    featuredCopy: market.featured_copy ?? "",
  };
}

export default function MarketsPage() {
  const qc = useQueryClient();
  const meQ = useMe();
  const isAdmin = (meQ.data?.roles ?? []).includes("admin");
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);

  const marketsQ = useQuery({
    queryKey: ["markets"],
    queryFn: async () => (await api.get("/api/markets")).data as Market[],
    enabled: isAdmin,
  });

  const ownersQ = useQuery({
    queryKey: ["owners"],
    queryFn: async () => (await api.get("/api/users/owners")).data as UserLite[],
    enabled: isAdmin,
  });

  const badgeRequestsQ = useQuery({
    queryKey: ["badge-requests"],
    queryFn: async () => (await api.get("/api/badge-requests")).data as BadgeRequest[],
    enabled: isAdmin,
  });

  const approvalsQ = useQuery({
    queryKey: ["workflow-approvals"],
    queryFn: async () => (await api.get("/api/workflow-approvals")).data as WorkflowApproval[],
    enabled: isAdmin,
  });

  const owners = ownersQ.data ?? [];
  const markets = marketsQ.data ?? [];

  const filteredMarkets = useMemo(() => {
    const normalized = deferredSearch.trim().toLowerCase();
    if (!normalized) return markets;

    return markets.filter((market) => {
      const haystack = [
        market.name,
        market.code,
        market.address,
        market.owner?.name,
        market.owner?.email,
        market.featured_badge,
        market.featured_headline,
        market.active_promo?.code,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalized);
    });
  }, [deferredSearch, markets]);

  const [createOpen, setCreateOpen] = useState(false);
  const [createDraft, setCreateDraft] = useState<MarketDraft>(emptyDraft);

  const createMarketM = useMutation({
    mutationFn: async () => {
      const payload = {
        name: createDraft.name.trim(),
        code: createDraft.code.trim(),
        address: createDraft.address.trim() || null,
        lat: createDraft.lat.trim() ? Number(createDraft.lat) : null,
        lng: createDraft.lng.trim() ? Number(createDraft.lng) : null,
        owner_user_id: Number(createDraft.ownerId),
        is_active: createDraft.isActive,
        is_featured: createDraft.isFeatured,
        featured_badge: createDraft.featuredBadge.trim() || null,
        featured_headline: createDraft.featuredHeadline.trim() || null,
        featured_copy: createDraft.featuredCopy.trim() || null,
      };
      return (await api.post("/api/markets", payload)).data as Market;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["markets"] });
      setCreateOpen(false);
      setCreateDraft(emptyDraft);
    },
  });

  const [assignOpen, setAssignOpen] = useState(false);
  const [assignMarket, setAssignMarket] = useState<Market | null>(null);
  const [assignOwnerId, setAssignOwnerId] = useState<string>("");

  const assignOwnerM = useMutation({
    mutationFn: async () => {
      if (!assignMarket) throw new Error("No market selected");
      return (
        await api.post(`/api/markets/${assignMarket.id}/assign-owner`, {
          owner_user_id: Number(assignOwnerId),
        })
      ).data as Market;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["markets"] });
      setAssignOpen(false);
      setAssignMarket(null);
      setAssignOwnerId("");
    },
  });

  const [editOpen, setEditOpen] = useState(false);
  const [editMarket, setEditMarket] = useState<Market | null>(null);
  const [editDraft, setEditDraft] = useState<MarketDraft>(emptyDraft);

  const updateMarketM = useMutation({
    mutationFn: async () => {
      if (!editMarket) throw new Error("No market selected");
      return (
        await api.patch(`/api/markets/${editMarket.id}`, {
          name: editDraft.name.trim(),
          code: editDraft.code.trim(),
          address: editDraft.address.trim() || null,
          lat: editDraft.lat.trim() ? Number(editDraft.lat) : null,
          lng: editDraft.lng.trim() ? Number(editDraft.lng) : null,
          is_active: editDraft.isActive,
          is_featured: editDraft.isFeatured,
          featured_badge: editDraft.featuredBadge.trim() || null,
          featured_headline: editDraft.featuredHeadline.trim() || null,
          featured_copy: editDraft.featuredCopy.trim() || null,
        })
      ).data as Market;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["markets"] });
      setEditOpen(false);
      setEditMarket(null);
      setEditDraft(emptyDraft);
    },
  });

  const createError =
    (createMarketM.error as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message ??
    (createMarketM.error as { message?: string })?.message ??
    null;

  const assignError =
    (assignOwnerM.error as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message ??
    (assignOwnerM.error as { message?: string })?.message ??
    null;

  const updateError =
    (updateMarketM.error as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message ??
    (updateMarketM.error as { message?: string })?.message ??
    null;

  const canCreate =
    createDraft.name.trim().length >= 2 &&
    createDraft.code.trim().length >= 2 &&
    createDraft.ownerId &&
    Number.isFinite(Number(createDraft.ownerId));

  const featuredCount = markets.filter((market) => market.is_featured).length;
  const activeCount = markets.filter((market) => market.is_active).length;
  const promoCount = markets.filter((market) => market.active_promo).length;
  const reviewApprovalM = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: "approved" | "rejected" }) =>
      (await api.post(`/api/workflow-approvals/${id}/review`, { status })).data,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["workflow-approvals"] });
    },
  });

  if (!isAdmin) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Markets</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">You are not an admin.</CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-6">
      <section className="intro-panel">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="command-chip">
              <Megaphone className="h-3.5 w-3.5" />
              Market promotion control
            </div>
            <h1 className="intro-title">Spotlight, assign, and tune every storefront from one board.</h1>
            <p className="intro-copy max-w-3xl">
              Promoted markets surface first on the public landing page. Admins can switch spotlight status, adjust the
              featured message, and keep owner assignment close to the same workflow.
            </p>
          </div>

          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button size="lg">Create market</Button>
            </DialogTrigger>
            <DialogContent className="app-modal-shell sm:max-w-[min(840px,calc(100%-2rem))]">
              <DialogHeader>
                <div className="app-modal-header">
                  <DialogTitle className="panel-title">Create market</DialogTitle>
                </div>
              </DialogHeader>

              <div className="app-modal-body">
              <div className="app-modal-main">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="field-group">
                  <Label className="field-label">Name</Label>
                  <Input value={createDraft.name} onChange={(e) => setCreateDraft((current) => ({ ...current, name: e.target.value }))} className="input-shell" />
                </div>
                <div className="field-group">
                  <Label className="field-label">Code</Label>
                  <Input value={createDraft.code} onChange={(e) => setCreateDraft((current) => ({ ...current, code: e.target.value }))} className="input-shell" />
                </div>
                <div className="field-group md:col-span-2">
                  <Label className="field-label">Address</Label>
                  <Input
                    value={createDraft.address}
                    onChange={(e) => setCreateDraft((current) => ({ ...current, address: e.target.value }))}
                    placeholder="Service address or pickup zone"
                    className="input-shell"
                  />
                </div>
                <div className="field-group">
                  <Label className="field-label">Latitude</Label>
                  <Input value={createDraft.lat} onChange={(e) => setCreateDraft((current) => ({ ...current, lat: e.target.value }))} placeholder="41.7151" className="input-shell" />
                </div>
                <div className="field-group">
                  <Label className="field-label">Longitude</Label>
                  <Input value={createDraft.lng} onChange={(e) => setCreateDraft((current) => ({ ...current, lng: e.target.value }))} placeholder="44.8271" className="input-shell" />
                </div>
                <div className="field-group md:col-span-2">
                  <Label className="field-label">Owner</Label>
                  <Select value={createDraft.ownerId} onValueChange={(value) => setCreateDraft((current) => ({ ...current, ownerId: value }))}>
                    <SelectTrigger className="input-shell w-full">
                      <SelectValue placeholder="Select owner user" />
                    </SelectTrigger>
                    <SelectContent>
                      {owners.map((owner) => (
                        <SelectItem key={owner.id} value={String(owner.id)}>
                          {owner.name} ({owner.email})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="section-divider" />

              <div className="grid gap-4 md:grid-cols-2">
                <div className="field-group">
                  <Label className="field-label">Featured badge</Label>
                  <Input
                    value={createDraft.featuredBadge}
                    onChange={(e) => setCreateDraft((current) => ({ ...current, featuredBadge: e.target.value }))}
                    placeholder="Promoted market"
                    className="input-shell"
                  />
                </div>
                <div className="field-group">
                  <Label className="field-label">Featured headline</Label>
                  <Input
                    value={createDraft.featuredHeadline}
                    onChange={(e) => setCreateDraft((current) => ({ ...current, featuredHeadline: e.target.value }))}
                    placeholder="Fastest weekly essentials"
                    className="input-shell"
                  />
                </div>
                <div className="field-group md:col-span-2">
                  <Label className="field-label">Featured copy</Label>
                  <Input
                    value={createDraft.featuredCopy}
                    onChange={(e) => setCreateDraft((current) => ({ ...current, featuredCopy: e.target.value }))}
                    placeholder="This message appears in the public spotlight experience."
                    className="input-shell"
                  />
                </div>
                <div className="subpanel flex items-center justify-between p-4">
                  <div>
                    <div className="theme-ink font-medium">Market active</div>
                    <div className="theme-muted text-sm">Inactive markets stay hidden from the public marketplace.</div>
                  </div>
                  <Switch
                    checked={createDraft.isActive}
                    onCheckedChange={(checked) => setCreateDraft((current) => ({ ...current, isActive: checked }))}
                  />
                </div>
                <div className="subpanel flex items-center justify-between p-4">
                  <div>
                    <div className="theme-ink font-medium">Promote on landing page</div>
                    <div className="theme-muted text-sm">Featured markets receive the premium public treatment.</div>
                  </div>
                  <Switch
                    checked={createDraft.isFeatured}
                    onCheckedChange={(checked) => setCreateDraft((current) => ({ ...current, isFeatured: checked }))}
                  />
                </div>
              </div>

              {createError && <div className="text-sm text-red-600">{createError}</div>}
              </div>
              </div>

              <DialogFooter className="app-modal-footer">
                <Button onClick={() => createMarketM.mutate()} disabled={!canCreate || createMarketM.isPending}>
                  {createMarketM.isPending ? "Creating..." : "Create market"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </section>

      <section className="data-grid">
        <Card>
          <CardContent className="p-6">
            <div className="section-kicker">Total markets</div>
            <div className="font-display theme-ink mt-3 text-4xl font-semibold">{markets.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="section-kicker">Active storefronts</div>
            <div className="font-display theme-ink mt-3 text-4xl font-semibold">{activeCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="section-kicker">Promoted markets</div>
            <div className="font-display theme-ink mt-3 text-4xl font-semibold">{featuredCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="section-kicker">Live promo codes</div>
            <div className="font-display theme-ink mt-3 text-4xl font-semibold">{promoCount}</div>
          </CardContent>
        </Card>
      </section>

      <section className="dashboard-card">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="section-kicker">Approvals</div>
            <h2 className="panel-title mt-2">Market, promo, badge, and refund workflow</h2>
          </div>
          <span className="status-chip">{(approvalsQ.data ?? []).filter((request) => request.status === "pending").length} pending</span>
        </div>

        <div className="mt-5 grid gap-3">
          {(approvalsQ.data ?? []).slice(0, 8).map((approval) => (
            <div key={approval.id} className="subpanel flex flex-col gap-3 px-4 py-4 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="theme-ink font-semibold">{approval.type} - {approval.market?.name || approval.order?.code || "General request"}</div>
                <div className="theme-copy text-sm">{approval.requester?.name || "Requester"} - {approval.notes || "No notes"}</div>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="status-chip">{approval.status}</span>
                {approval.status === "pending" && (
                  <>
                    <Button size="sm" onClick={() => reviewApprovalM.mutate({ id: approval.id, status: "approved" })}>Approve</Button>
                    <Button size="sm" variant="secondary" onClick={() => reviewApprovalM.mutate({ id: approval.id, status: "rejected" })}>Reject</Button>
                  </>
                )}
              </div>
            </div>
          ))}

          {approvalsQ.isLoading && <div className="theme-copy text-sm">Loading approvals...</div>}
          {!approvalsQ.isLoading && !(approvalsQ.data ?? []).length && <div className="theme-copy text-sm">No workflow approvals yet.</div>}
        </div>
      </section>

      <section className="dashboard-card">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="section-kicker">Badge requests</div>
            <h2 className="panel-title mt-2">Owner requests waiting for admin review</h2>
          </div>
          <span className="status-chip">{(badgeRequestsQ.data ?? []).filter((request) => request.status === "pending").length} pending</span>
        </div>

        <div className="mt-5 grid gap-3">
          {(badgeRequestsQ.data ?? []).slice(0, 6).map((request) => (
            <div key={request.id} className="subpanel flex flex-col gap-3 px-4 py-4 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="theme-ink font-semibold">{request.market?.name ?? "Market"} - {request.badge}</div>
                <div className="theme-copy text-sm">{request.requester?.name ?? "Owner"} - {request.duration_days} days - {request.notes || "No note"}</div>
              </div>
              <span className="status-chip">{request.status}</span>
            </div>
          ))}

          {badgeRequestsQ.isLoading && <div className="theme-copy text-sm">Loading badge requests...</div>}
          {!badgeRequestsQ.isLoading && !(badgeRequestsQ.data ?? []).length && <div className="theme-copy text-sm">No badge requests yet.</div>}
        </div>
      </section>

      <section className="dashboard-card">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="section-kicker">Storefront finder</div>
            <h2 className="panel-title mt-2">Search by market, owner, or active promo</h2>
          </div>
          <div className="relative w-full lg:max-w-md">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search markets, owners, promo code"
              className="input-shell pl-11"
            />
          </div>
        </div>
      </section>

      {marketsQ.isLoading ? (
        <Card>
          <CardContent className="p-8 text-sm text-muted-foreground">Loading markets...</CardContent>
        </Card>
      ) : marketsQ.error ? (
        <Card>
          <CardContent className="p-8 text-sm text-red-600">Failed to load markets.</CardContent>
        </Card>
      ) : (
        <div className="grid gap-5 xl:grid-cols-2">
          {filteredMarkets.map((market) => (
            <Card key={market.id} className={market.is_featured ? "market-card-featured" : ""}>
              <CardContent className="grid gap-5 p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="section-kicker">{market.code}</span>
                      {market.is_featured && <span className="status-chip status-good">{market.featured_badge || "Promoted"}</span>}
                      {market.active_promo && <span className="status-chip status-warn">{market.active_promo.code}</span>}
                    </div>
                    <h3 className="font-display theme-ink mt-2 text-3xl font-semibold tracking-[-0.05em]">{market.name}</h3>
                    <p className="theme-copy mt-2 text-sm leading-6">{market.featured_headline || market.address || "No public marketing copy yet."}</p>
                  </div>
                  <span className={`status-chip ${market.is_active ? "status-good" : "status-neutral"}`}>
                    {market.is_active ? "Live" : "Hidden"}
                  </span>
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  <div className="subpanel p-4">
                    <div className="section-kicker">Owner</div>
                    <div className="theme-ink mt-2 font-semibold">{market.owner?.name ?? `User #${market.owner_user_id}`}</div>
                    <div className="theme-muted mt-1 text-sm">{market.owner?.email ?? "No email loaded"}</div>
                  </div>
                  <div className="subpanel p-4">
                    <div className="section-kicker">Visible items</div>
                    <div className="theme-ink mt-2 text-2xl font-semibold">{market.active_items_count ?? 0}</div>
                  </div>
                  <div className="subpanel p-4">
                    <div className="section-kicker">Offer state</div>
                    <div className="theme-ink mt-2 font-semibold">
                      {market.active_promo ? `${market.active_promo.code} live` : "No live code"}
                    </div>
                    {market.active_promo && (
                      <div className="theme-muted mt-1 text-sm">
                        {market.active_promo.type === "percent"
                          ? `${toNumber(market.active_promo.value)}% off`
                          : `${formatMoney(market.active_promo.value)} off`}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setEditMarket(market);
                      setEditDraft(toDraft(market));
                      setEditOpen(true);
                    }}
                  >
                    <Sparkles className="h-4 w-4" />
                    Edit storefront
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setAssignMarket(market);
                      setAssignOwnerId(String(market.owner_user_id));
                      setAssignOpen(true);
                    }}
                  >
                    <UserRound className="h-4 w-4" />
                    Assign owner
                  </Button>
                  <Button asChild variant="secondary">
                    <Link to={`/markets/${market.id}/promo-codes`}>
                      <TicketPercent className="h-4 w-4" />
                      Promo codes
                    </Link>
                  </Button>
                  <Button asChild>
                    <Link to={`/markets/${market.id}`}>
                      Open settings
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}

          {filteredMarkets.length === 0 && (
            <Card>
              <CardContent className="p-8 text-sm text-muted-foreground">No markets matched your search.</CardContent>
            </Card>
          )}
        </div>
      )}

      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent className="app-modal-shell sm:max-w-[min(760px,calc(100%-2rem))]">
          <DialogHeader>
            <div className="app-modal-header">
              <DialogTitle className="panel-title">Assign owner</DialogTitle>
            </div>
          </DialogHeader>

          <div className="app-modal-body">
          <div className="app-modal-main">
            <div className="subpanel p-4 text-sm">
              Market: <span className="font-semibold">{assignMarket?.name}</span>
            </div>

            <div className="field-group">
              <Label className="field-label">Owner</Label>
              <Select value={assignOwnerId} onValueChange={setAssignOwnerId}>
                <SelectTrigger className="input-shell w-full">
                  <SelectValue placeholder="Select owner user" />
                </SelectTrigger>
                <SelectContent>
                  {owners.map((owner) => (
                    <SelectItem key={owner.id} value={String(owner.id)}>
                      {owner.name} ({owner.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {assignError && <div className="text-sm text-red-600">{assignError}</div>}
          </div>
          </div>

          <DialogFooter className="app-modal-footer">
            <Button onClick={() => assignOwnerM.mutate()} disabled={!assignMarket || !assignOwnerId || assignOwnerM.isPending}>
              {assignOwnerM.isPending ? "Saving..." : "Save owner"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="app-modal-shell sm:max-w-[min(840px,calc(100%-2rem))]">
          <DialogHeader>
            <div className="app-modal-header">
              <DialogTitle className="panel-title">Edit storefront</DialogTitle>
            </div>
          </DialogHeader>

          <div className="app-modal-body">
          <div className="app-modal-main">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="field-group">
              <Label className="field-label">Name</Label>
              <Input value={editDraft.name} onChange={(e) => setEditDraft((current) => ({ ...current, name: e.target.value }))} className="input-shell" />
            </div>
            <div className="field-group">
              <Label className="field-label">Code</Label>
              <Input value={editDraft.code} onChange={(e) => setEditDraft((current) => ({ ...current, code: e.target.value }))} className="input-shell" />
            </div>
            <div className="field-group md:col-span-2">
              <Label className="field-label">Address</Label>
              <Input value={editDraft.address} onChange={(e) => setEditDraft((current) => ({ ...current, address: e.target.value }))} className="input-shell" />
            </div>
            <div className="field-group">
              <Label className="field-label">Latitude</Label>
              <Input value={editDraft.lat} onChange={(e) => setEditDraft((current) => ({ ...current, lat: e.target.value }))} placeholder="41.7151" className="input-shell" />
            </div>
            <div className="field-group">
              <Label className="field-label">Longitude</Label>
              <Input value={editDraft.lng} onChange={(e) => setEditDraft((current) => ({ ...current, lng: e.target.value }))} placeholder="44.8271" className="input-shell" />
            </div>
          </div>
          <div className="section-divider" />

          <div className="grid gap-4 md:grid-cols-2">
            <div className="field-group">
              <Label className="field-label">Featured badge</Label>
              <Input
                value={editDraft.featuredBadge}
                onChange={(e) => setEditDraft((current) => ({ ...current, featuredBadge: e.target.value }))}
                placeholder="Promoted market"
                className="input-shell"
              />
            </div>
            <div className="field-group">
              <Label className="field-label">Featured headline</Label>
              <Input
                value={editDraft.featuredHeadline}
                onChange={(e) => setEditDraft((current) => ({ ...current, featuredHeadline: e.target.value }))}
                placeholder="City's fastest essentials drop"
                className="input-shell"
              />
            </div>
            <div className="field-group md:col-span-2">
              <Label className="field-label">Featured copy</Label>
              <Input
                value={editDraft.featuredCopy}
                onChange={(e) => setEditDraft((current) => ({ ...current, featuredCopy: e.target.value }))}
                placeholder="Shown on the public landing spotlight."
                className="input-shell"
              />
            </div>
            <div className="subpanel flex items-center justify-between p-4">
              <div>
                <div className="theme-ink font-medium">Storefront active</div>
                <div className="theme-muted text-sm">Controls whether the market is visible publicly.</div>
              </div>
              <Switch checked={editDraft.isActive} onCheckedChange={(checked) => setEditDraft((current) => ({ ...current, isActive: checked }))} />
            </div>
            <div className="subpanel flex items-center justify-between p-4">
              <div>
                <div className="theme-ink font-medium">Featured promotion placement</div>
                <div className="theme-muted text-sm">Moves this market into the premium public spotlight.</div>
              </div>
              <Switch
                checked={editDraft.isFeatured}
                onCheckedChange={(checked) => setEditDraft((current) => ({ ...current, isFeatured: checked }))}
              />
            </div>
            </div>
          </div>
          </div>

          {updateError && <div className="text-sm text-red-600">{updateError}</div>}

          <DialogFooter className="app-modal-footer">
            <Button onClick={() => updateMarketM.mutate()} disabled={!editMarket || updateMarketM.isPending || !editDraft.name.trim()}>
              {updateMarketM.isPending ? "Saving..." : "Save storefront"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
