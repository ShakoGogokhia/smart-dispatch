import { useDeferredValue, useMemo, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import {
  BadgeCheck,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  ExternalLink,
  LayoutDashboard,
  MoreHorizontal,
  Package,
  Plus,
  Search,
  Settings,
  Sparkles,
  Store,
  TicketPercent,
  UserRound,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { toast } from "sonner";

import { api } from "@/lib/api";
import { useMe } from "@/lib/useMe";
import { formatMoney, toNumber } from "@/lib/format";
import type { StorefrontMarket } from "@/lib/storefront";

import { PageHeader } from "@/components/app/page-header";
import { StatCard, StatGrid } from "@/components/app/stat-card";
import { EmptyState } from "@/components/app/empty-state";
import { LoadingState } from "@/components/app/loading-state";
import { OrderStatusBadge, StatusBadge } from "@/components/app/status-badge";
import { MarketBanner, MarketLogo } from "@/components/markets/market-media";
import { marketErrorMessage } from "@/components/markets/market-utils";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

type StatusFilter = "all" | "active" | "hidden" | "open" | "featured";

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
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

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
    queryFn: async () => {
      const payload = (await api.get("/api/workflow-approvals")).data as WorkflowApproval[] | { data: WorkflowApproval[] };
      return Array.isArray(payload) ? payload : payload.data;
    },
    enabled: isAdmin,
  });

  const owners = ownersQ.data ?? [];
  const markets = useMemo(() => marketsQ.data ?? [], [marketsQ.data]);

  const filteredMarkets = useMemo(() => {
    const normalized = deferredSearch.trim().toLowerCase();

    return markets.filter((market) => {
      if (statusFilter === "active" && !market.is_active) return false;
      if (statusFilter === "hidden" && market.is_active) return false;
      if (statusFilter === "open" && !market.operating_status?.is_open) return false;
      if (statusFilter === "featured" && !market.is_featured) return false;
      if (!normalized) return true;

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
  }, [deferredSearch, markets, statusFilter]);

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

  const createError = marketErrorMessage(createMarketM.error);
  const assignError = marketErrorMessage(assignOwnerM.error);
  const updateError = marketErrorMessage(updateMarketM.error);

  const canCreate =
    createDraft.name.trim().length >= 2 &&
    createDraft.code.trim().length >= 2 &&
    createDraft.ownerId &&
    Number.isFinite(Number(createDraft.ownerId));

  const featuredCount = markets.filter((market) => market.is_featured).length;
  const activeCount = markets.filter((market) => market.is_active).length;
  const openCount = markets.filter((market) => market.operating_status?.is_open).length;
  const promoCount = markets.filter((market) => market.active_promo).length;
  const reviewApprovalM = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: "approved" | "rejected" }) =>
      (await api.post(`/api/workflow-approvals/${id}/review`, { status })).data,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["workflow-approvals"] });
    },
  });

  const approvals = approvalsQ.data ?? [];
  const badgeRequests = badgeRequestsQ.data ?? [];
  const pendingApprovals = approvals.filter((request) => request.status === "pending").length;
  const pendingBadges = badgeRequests.filter((request) => request.status === "pending").length;

  const openEdit = (market: Market) => {
    setEditMarket(market);
    setEditDraft(toDraft(market));
    setEditOpen(true);
  };

  const openAssign = (market: Market) => {
    setAssignMarket(market);
    setAssignOwnerId(String(market.owner_user_id));
    setAssignOpen(true);
  };

  if (!isAdmin) {
    return (
      <div className="space-y-6">
        <PageHeader title="Markets" description="Manage every market on the platform." />
        <EmptyState icon={Store} title="Admins only" description="You are not an admin, so the full market list is not available to you." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Markets"
        description="Create markets, assign owners, review requests and control how each storefront appears to customers."
        actions={
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus />
                Create market
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
              <DialogHeader>
                <DialogTitle>Create market</DialogTitle>
                <DialogDescription>Add a new storefront and choose who owns it. You can change everything later.</DialogDescription>
              </DialogHeader>

              <MarketFormFields
                idPrefix="create"
                draft={createDraft}
                setDraft={setCreateDraft}
                owners={owners}
                showOwner
                headlinePlaceholder="Fastest weekly essentials"
                copyPlaceholder="This message appears in the public spotlight experience."
                activeLabel="Market active"
                activeHint="Inactive markets stay hidden from the public marketplace."
                featuredLabel="Promote on landing page"
                featuredHint="Featured markets receive the premium public treatment."
              />

              {createError ? (
                <Alert variant="destructive">
                  <AlertDescription>{createError}</AlertDescription>
                </Alert>
              ) : null}

              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={() =>
                    createMarketM.mutate(undefined, {
                      onSuccess: () => toast.success("Market created"),
                      onError: (error) => toast.error(marketErrorMessage(error) ?? "Could not create market"),
                    })
                  }
                  disabled={!canCreate || createMarketM.isPending}
                >
                  {createMarketM.isPending ? <Spinner /> : null}
                  {createMarketM.isPending ? "Creating..." : "Create market"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <StatGrid className="xl:grid-cols-5">
        <StatCard label="Total markets" value={markets.length} icon={Store} tone="primary" onClick={() => setStatusFilter("all")} active={statusFilter === "all"} />
        <StatCard label="Active storefronts" value={activeCount} icon={CheckCircle2} tone="success" onClick={() => setStatusFilter("active")} active={statusFilter === "active"} />
        <StatCard label="Open now" value={openCount} icon={Clock3} tone="info" onClick={() => setStatusFilter("open")} active={statusFilter === "open"} />
        <StatCard label="Promoted markets" value={featuredCount} icon={Sparkles} tone="warning" onClick={() => setStatusFilter("featured")} active={statusFilter === "featured"} />
        <StatCard label="Live promo codes" value={promoCount} icon={TicketPercent} />
      </StatGrid>

      <Tabs defaultValue="markets" className="gap-4">
        <TabsList className="w-full sm:w-fit">
          <TabsTrigger value="markets">Markets</TabsTrigger>
          <TabsTrigger value="approvals">
            Approvals
            {pendingApprovals > 0 ? <Badge className="h-5 min-w-5 px-1.5 tabular-nums">{pendingApprovals}</Badge> : null}
          </TabsTrigger>
          <TabsTrigger value="badges">
            Badge requests
            {pendingBadges > 0 ? <Badge className="h-5 min-w-5 px-1.5 tabular-nums">{pendingBadges}</Badge> : null}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="markets" className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative min-w-0 flex-1 sm:max-w-md">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search markets, owners, promo code"
                className="pl-9"
                aria-label="Search markets"
              />
            </div>
            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as StatusFilter)}>
              <SelectTrigger className="w-full sm:w-44" aria-label="Filter markets">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All markets</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="hidden">Hidden</SelectItem>
                <SelectItem value="open">Open now</SelectItem>
                <SelectItem value="featured">Promoted</SelectItem>
              </SelectContent>
            </Select>
            <div className="text-sm text-muted-foreground sm:ml-auto">
              {filteredMarkets.length} of {markets.length} shown
            </div>
          </div>

          {marketsQ.isLoading ? (
            <LoadingState rows={3} />
          ) : marketsQ.error ? (
            <Alert variant="destructive">
              <AlertDescription>Failed to load markets.</AlertDescription>
            </Alert>
          ) : filteredMarkets.length === 0 ? (
            <EmptyState
              icon={Search}
              title="No markets found"
              description={markets.length === 0 ? "Create the first market to get started." : "No markets matched your search or filter."}
              action={
                markets.length === 0 ? (
                  <Button onClick={() => setCreateOpen(true)}>
                    <Plus />
                    Create market
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSearch("");
                      setStatusFilter("all");
                    }}
                  >
                    Clear filters
                  </Button>
                )
              }
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filteredMarkets.map((market) => (
                <AdminMarketCard key={market.id} market={market} onEdit={() => openEdit(market)} onAssign={() => openAssign(market)} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="approvals">
          <Card>
            <CardHeader>
              <CardTitle>Workflow approvals</CardTitle>
              <CardDescription>Market, promo, badge and refund requests that need an admin decision.</CardDescription>
              <CardAction>
                <StatusBadge tone={pendingApprovals ? "warning" : "neutral"}>{pendingApprovals} pending</StatusBadge>
              </CardAction>
            </CardHeader>
            <CardContent className="grid gap-3">
              {approvalsQ.isLoading ? <LoadingState rows={2} /> : null}
              {!approvalsQ.isLoading && approvals.length === 0 ? (
                <EmptyState compact icon={ClipboardCheck} title="No workflow approvals yet" description="New requests will show up here." />
              ) : null}
              {approvals.slice(0, 8).map((approval) => (
                <div key={approval.id} className="flex flex-col gap-3 rounded-lg border bg-muted/30 p-4 md:flex-row md:items-center md:justify-between">
                  <div className="min-w-0">
                    <div className="font-medium break-words">
                      {humanize(approval.type)} - {approval.market?.name || approval.order?.code || "General request"}
                    </div>
                    <div className="text-sm text-muted-foreground break-words">
                      {approval.requester?.name || "Requester"} - {approval.notes || "No notes"}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <OrderStatusBadge status={approval.status} />
                    {approval.status === "pending" && (
                      <>
                        <Button
                          size="sm"
                          disabled={reviewApprovalM.isPending}
                          onClick={() =>
                            reviewApprovalM.mutate(
                              { id: approval.id, status: "approved" },
                              { onSuccess: () => toast.success("Request approved"), onError: (e) => toast.error(marketErrorMessage(e) ?? "Could not approve") },
                            )
                          }
                        >
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={reviewApprovalM.isPending}
                          onClick={() =>
                            reviewApprovalM.mutate(
                              { id: approval.id, status: "rejected" },
                              { onSuccess: () => toast.success("Request rejected"), onError: (e) => toast.error(marketErrorMessage(e) ?? "Could not reject") },
                            )
                          }
                        >
                          Reject
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="badges">
          <Card>
            <CardHeader>
              <CardTitle>Badge requests</CardTitle>
              <CardDescription>Owner requests for promotional badges waiting for admin review.</CardDescription>
              <CardAction>
                <StatusBadge tone={pendingBadges ? "warning" : "neutral"}>{pendingBadges} pending</StatusBadge>
              </CardAction>
            </CardHeader>
            <CardContent className="grid gap-3">
              {badgeRequestsQ.isLoading ? <LoadingState rows={2} /> : null}
              {!badgeRequestsQ.isLoading && badgeRequests.length === 0 ? (
                <EmptyState compact icon={BadgeCheck} title="No badge requests yet" description="Owners can request badges from the promotion studio." />
              ) : null}
              {badgeRequests.slice(0, 6).map((request) => (
                <div key={request.id} className="flex flex-col gap-3 rounded-lg border bg-muted/30 p-4 md:flex-row md:items-center md:justify-between">
                  <div className="min-w-0">
                    <div className="font-medium break-words">
                      {request.market?.name ?? "Market"} - {request.badge}
                    </div>
                    <div className="text-sm text-muted-foreground break-words">
                      {request.requester?.name ?? "Owner"} - {request.duration_days} days - {request.notes || "No note"}
                    </div>
                  </div>
                  <OrderStatusBadge status={request.status} />
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Assign owner</DialogTitle>
            <DialogDescription>
              Choose who owns <span className="font-medium text-foreground">{assignMarket?.name}</span>. The owner can manage settings, products and staff.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-2">
            <Label htmlFor="assign-owner">Owner</Label>
            <Select value={assignOwnerId} onValueChange={setAssignOwnerId}>
              <SelectTrigger id="assign-owner" className="w-full">
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

          {assignError ? (
            <Alert variant="destructive">
              <AlertDescription>{assignError}</AlertDescription>
            </Alert>
          ) : null}

          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() =>
                assignOwnerM.mutate(undefined, {
                  onSuccess: () => toast.success("Owner updated"),
                  onError: (error) => toast.error(marketErrorMessage(error) ?? "Could not assign owner"),
                })
              }
              disabled={!assignMarket || !assignOwnerId || assignOwnerM.isPending}
            >
              {assignOwnerM.isPending ? <Spinner /> : null}
              {assignOwnerM.isPending ? "Saving..." : "Save owner"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit storefront</DialogTitle>
            <DialogDescription>Update the market details, visibility and promotion placement.</DialogDescription>
          </DialogHeader>

          <MarketFormFields
            idPrefix="edit"
            draft={editDraft}
            setDraft={setEditDraft}
            owners={owners}
            showOwner={false}
            headlinePlaceholder="City's fastest essentials drop"
            copyPlaceholder="Shown on the public landing spotlight."
            activeLabel="Storefront active"
            activeHint="Controls whether the market is visible publicly."
            featuredLabel="Featured promotion placement"
            featuredHint="Moves this market into the premium public spotlight."
          />

          {updateError ? (
            <Alert variant="destructive">
              <AlertDescription>{updateError}</AlertDescription>
            </Alert>
          ) : null}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() =>
                updateMarketM.mutate(undefined, {
                  onSuccess: () => toast.success("Storefront saved"),
                  onError: (error) => toast.error(marketErrorMessage(error) ?? "Could not save storefront"),
                })
              }
              disabled={!editMarket || updateMarketM.isPending || !editDraft.name.trim()}
            >
              {updateMarketM.isPending ? <Spinner /> : null}
              {updateMarketM.isPending ? "Saving..." : "Save storefront"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function humanize(value: string) {
  const s = value.replace(/[_-]+/g, " ").trim().toLowerCase();
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : value;
}

function AdminMarketCard({ market, onEdit, onAssign }: { market: Market; onEdit: () => void; onAssign: () => void }) {
  const isOpen = market.operating_status?.is_open;

  return (
    <Card className="gap-0 overflow-hidden py-0">
      <MarketBanner src={market.banner_url} name={market.name}>
        {market.is_featured ? (
          <StatusBadge tone="warning" className="bg-warning text-warning-foreground">
            <Sparkles className="size-3" />
            {market.featured_badge || "Promoted"}
          </StatusBadge>
        ) : null}
      </MarketBanner>

      <div className="flex flex-1 flex-col gap-4 p-4">
        <div className="flex items-start gap-3">
          <MarketLogo src={market.logo_url ?? market.image_url} name={market.name} className="-mt-10 size-14 border-2 border-card bg-card shadow-sm" />
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="truncate text-base font-semibold">{market.name}</h3>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  <Badge variant="outline" className="font-mono">
                    {market.code}
                  </Badge>
                  <StatusBadge tone={market.is_active ? "success" : "neutral"} dot>
                    {market.is_active ? "Live" : "Hidden"}
                  </StatusBadge>
                  {market.operating_status ? (
                    <StatusBadge tone={isOpen ? "info" : "destructive"}>{isOpen ? "Open" : "Closed"}</StatusBadge>
                  ) : null}
                </div>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon-sm" aria-label={`More actions for ${market.name}`}>
                    <MoreHorizontal />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuLabel>{market.name}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to={`/markets/${market.id}/dashboard`}>
                      <LayoutDashboard />
                      Open dashboard
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to={`/markets/${market.id}`}>
                      <Settings />
                      Settings
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to={`/markets/${market.id}/items`}>
                      <Package />
                      Products
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to={`/markets/${market.id}/promo-codes`}>
                      <TicketPercent />
                      Promo codes
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to={`/m/${market.id}`} target="_blank" rel="noreferrer">
                      <ExternalLink />
                      View storefront
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={onEdit}>
                    <Sparkles />
                    Edit storefront
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={onAssign}>
                    <UserRound />
                    Assign owner
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>

        <p className="line-clamp-2 text-sm text-muted-foreground">{market.featured_headline || market.address || "No public marketing copy yet."}</p>

        <Separator />

        <dl className="grid grid-cols-3 gap-3 text-sm">
          <div className="min-w-0">
            <dt className="text-xs text-muted-foreground">Owner</dt>
            <dd className="truncate font-medium" title={market.owner?.email ?? undefined}>
              {market.owner?.name ?? `User #${market.owner_user_id}`}
            </dd>
            <dd className="truncate text-xs text-muted-foreground">{market.owner?.email ?? "No email loaded"}</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-xs text-muted-foreground">Visible items</dt>
            <dd className="font-medium tabular-nums">{market.active_items_count ?? 0}</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-xs text-muted-foreground">Offer</dt>
            <dd className="truncate font-medium">{market.active_promo ? `${market.active_promo.code} live` : "No live code"}</dd>
            {market.active_promo ? (
              <dd className="truncate text-xs text-muted-foreground">
                {market.active_promo.type === "percent" ? `${toNumber(market.active_promo.value)}% off` : `${formatMoney(market.active_promo.value)} off`}
              </dd>
            ) : null}
          </div>
        </dl>
      </div>

      <CardFooter className="gap-2 border-t bg-muted/20 px-4 py-3">
        <Button variant="outline" size="sm" className="flex-1" onClick={onEdit}>
          <Sparkles />
          Edit storefront
        </Button>
        <Button asChild size="sm" className="flex-1">
          <Link to={`/markets/${market.id}`}>
            <Settings />
            Open settings
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}

function MarketFormFields({
  idPrefix,
  draft,
  setDraft,
  owners,
  showOwner,
  headlinePlaceholder,
  copyPlaceholder,
  activeLabel,
  activeHint,
  featuredLabel,
  featuredHint,
}: {
  idPrefix: string;
  draft: MarketDraft;
  setDraft: Dispatch<SetStateAction<MarketDraft>>;
  owners: UserLite[];
  showOwner: boolean;
  headlinePlaceholder: string;
  copyPlaceholder: string;
  activeLabel: string;
  activeHint: string;
  featuredLabel: string;
  featuredHint: string;
}) {
  const field = (key: keyof MarketDraft) => `${idPrefix}-${key}`;
  const set = <K extends keyof MarketDraft>(key: K, value: MarketDraft[K]) => setDraft((current) => ({ ...current, [key]: value }));

  return (
    <div className="grid gap-6">
      <section className="grid gap-4">
        <div>
          <h3 className="text-sm font-semibold">Market details</h3>
          <p className="text-xs text-muted-foreground">Name, short code and where the market is located.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor={field("name")}>Name</Label>
            <Input id={field("name")} value={draft.name} onChange={(e) => set("name", e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor={field("code")}>Code</Label>
            <Input id={field("code")} value={draft.code} onChange={(e) => set("code", e.target.value)} />
            <p className="text-xs text-muted-foreground">Short unique identifier, at least 2 characters.</p>
          </div>
          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor={field("address")}>Address</Label>
            <Input id={field("address")} value={draft.address} onChange={(e) => set("address", e.target.value)} placeholder="Service address or pickup zone" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor={field("lat")}>Latitude</Label>
            <Input id={field("lat")} inputMode="decimal" value={draft.lat} onChange={(e) => set("lat", e.target.value)} placeholder="41.7151" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor={field("lng")}>Longitude</Label>
            <Input id={field("lng")} inputMode="decimal" value={draft.lng} onChange={(e) => set("lng", e.target.value)} placeholder="44.8271" />
          </div>
          {showOwner ? (
            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor={field("ownerId")}>Owner</Label>
              <Select value={draft.ownerId} onValueChange={(value) => set("ownerId", value)}>
                <SelectTrigger id={field("ownerId")} className="w-full">
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
          ) : null}
        </div>
      </section>

      <Separator />

      <section className="grid gap-4">
        <div>
          <h3 className="text-sm font-semibold">Visibility and promotion</h3>
          <p className="text-xs text-muted-foreground">Control whether customers see this market and how it is featured.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor={field("featuredBadge")}>Featured badge</Label>
            <Input id={field("featuredBadge")} value={draft.featuredBadge} onChange={(e) => set("featuredBadge", e.target.value)} placeholder="Promoted market" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor={field("featuredHeadline")}>Featured headline</Label>
            <Input id={field("featuredHeadline")} value={draft.featuredHeadline} onChange={(e) => set("featuredHeadline", e.target.value)} placeholder={headlinePlaceholder} />
          </div>
          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor={field("featuredCopy")}>Featured copy</Label>
            <Input id={field("featuredCopy")} value={draft.featuredCopy} onChange={(e) => set("featuredCopy", e.target.value)} placeholder={copyPlaceholder} />
          </div>
          <label htmlFor={field("isActive")} className="flex cursor-pointer items-center justify-between gap-4 rounded-lg border bg-muted/30 p-4">
            <div className="min-w-0">
              <div className="text-sm font-medium">{activeLabel}</div>
              <div className="text-xs text-muted-foreground">{activeHint}</div>
            </div>
            <Switch id={field("isActive")} checked={draft.isActive} onCheckedChange={(checked) => set("isActive", checked)} />
          </label>
          <label htmlFor={field("isFeatured")} className="flex cursor-pointer items-center justify-between gap-4 rounded-lg border bg-muted/30 p-4">
            <div className="min-w-0">
              <div className="text-sm font-medium">{featuredLabel}</div>
              <div className="text-xs text-muted-foreground">{featuredHint}</div>
            </div>
            <Switch id={field("isFeatured")} checked={draft.isFeatured} onCheckedChange={(checked) => set("isFeatured", checked)} />
          </label>
        </div>
      </section>
    </div>
  );
}
