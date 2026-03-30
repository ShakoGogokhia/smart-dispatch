import { useDeferredValue, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ArrowRight,
  BadgePercent,
  BarChart3,
  GripVertical,
  Hash,
  ImagePlus,
  MapPinned,
  Megaphone,
  Search,
  Sparkles,
  Store,
  TicketPercent,
  Type,
  UserRound,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { api } from "@/lib/api";
import { useMe } from "@/lib/useMe";
import { formatDateTime, formatMoney, toNumber } from "@/lib/format";
import type { MarketBanner, StorefrontMarket } from "@/lib/storefront";

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

type PublicMarketplaceAnalytics = {
  total_clicks: number;
  top_markets: Array<{
    market_id: number;
    market_name: string;
    market_code: string;
    featured_badge?: string | null;
    clicks: number;
    latest_click_at?: string | null;
  }>;
  top_sources: Array<{
    source: string;
    clicks: number;
  }>;
};

type BannerDraft = {
  title: string;
  subtitle: string;
  ctaLabel: string;
  ctaUrl: string;
  theme: string;
  marketId: string;
  isActive: boolean;
  sortOrder: string;
  startsAt: string;
  endsAt: string;
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

const emptyBannerDraft: BannerDraft = {
  title: "",
  subtitle: "",
  ctaLabel: "",
  ctaUrl: "",
  theme: "cyan",
  marketId: "none",
  isActive: true,
  sortOrder: "0",
  startsAt: "",
  endsAt: "",
};

const badgePresets = ["VIP Market", "Staff Pick", "New Market", "Discounted", "Seasonal"];

function toDateTimeInput(value?: string | null) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const pad = (part: number) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function fromDateTimeInput(value: string) {
  return value.trim() ? value : null;
}

function buildFeaturedPayload(draft: MarketDraft) {
  const featuredBadge = draft.featuredBadge.trim();
  const shouldFeature = draft.isFeatured || Boolean(featuredBadge);

  return {
    is_featured: shouldFeature,
    featured_badge: shouldFeature ? featuredBadge || "Featured" : null,
    featured_headline: draft.featuredHeadline.trim() || null,
    featured_copy: draft.featuredCopy.trim() || null,
  };
}

function toBannerDraft(banner: MarketBanner): BannerDraft {
  return {
    title: banner.title,
    subtitle: banner.subtitle ?? "",
    ctaLabel: banner.cta_label ?? "",
    ctaUrl: banner.cta_url ?? "",
    theme: banner.theme,
    marketId: banner.market ? String(banner.market.id) : "none",
    isActive: banner.is_active,
    sortOrder: String(banner.sort_order ?? 0),
    startsAt: toDateTimeInput(banner.starts_at),
    endsAt: toDateTimeInput(banner.ends_at),
  };
}

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

function WorkspaceFieldCard({
  children,
  icon: Icon,
  label,
}: {
  children: ReactNode;
  icon: typeof Store;
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

function WorkspaceSwitchCard({
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

function WorkspaceModalLayout({
  controls,
  preview,
}: {
  controls: ReactNode;
  preview: ReactNode;
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

function StorefrontPreviewCard({ draft, mode }: { draft: MarketDraft; mode: "create" | "edit" }) {
  const headline = draft.featuredHeadline.trim() || draft.name.trim() || "New storefront";
  const copy = draft.featuredCopy.trim() || draft.address.trim() || "Add public-facing copy, featured badge, and core identity details here.";

  return (
    <div className="rounded-[26px] border border-slate-200 bg-[#f7f4ec] p-5 dark:border-white/10 dark:bg-[#0f1825]">
      <div className="section-kicker">{mode === "create" ? "Storefront workspace" : "Storefront editor"}</div>
      <div className="theme-ink mt-3 text-3xl font-semibold">{headline}</div>
      <div className="theme-copy mt-2 text-sm leading-6">{draft.code.trim() || "MARKET-CODE"}</div>
      <div className="mt-4 flex flex-wrap gap-2">
        <span className={`status-chip ${draft.isActive ? "status-good" : "status-neutral"}`}>{draft.isActive ? "Live" : "Hidden"}</span>
        <span className={`status-chip ${draft.isFeatured ? "status-warn" : "status-neutral"}`}>{draft.isFeatured ? "Promoted" : "Standard"}</span>
        {draft.featuredBadge.trim() && <span className="status-chip status-good">{draft.featuredBadge.trim()}</span>}
      </div>
      <div className="theme-copy mt-4 text-sm leading-6">{copy}</div>
    </div>
  );
}

function BannerPreviewCard({ draft, mode }: { draft: BannerDraft; mode: "create" | "edit" }) {
  return (
    <div className="rounded-[26px] border border-slate-200 bg-[#f7f4ec] p-5 dark:border-white/10 dark:bg-[#0f1825]">
      <div className="section-kicker">{mode === "create" ? "Campaign workspace" : "Campaign editor"}</div>
      <div className="theme-ink mt-3 text-3xl font-semibold">{draft.title.trim() || "Homepage campaign"}</div>
      <div className="theme-copy mt-2 text-sm leading-6">{draft.theme} theme • sort #{draft.sortOrder || "0"}</div>
      <div className="mt-4 flex flex-wrap gap-2">
        <span className={`status-chip ${draft.isActive ? "status-good" : "status-neutral"}`}>{draft.isActive ? "Live when scheduled" : "Inactive"}</span>
        <span className="status-chip status-neutral">{draft.marketId === "none" ? "Generic banner" : "Linked market"}</span>
      </div>
      <div className="theme-copy mt-4 text-sm leading-6">
        {draft.subtitle.trim() || "Add a campaign message, CTA, and schedule to control the public homepage blocks."}
      </div>
    </div>
  );
}

function OwnerPreviewCard({ marketName, ownerId }: { marketName?: string | null; ownerId: string }) {
  return (
    <div className="rounded-[26px] border border-slate-200 bg-[#f7f4ec] p-5 dark:border-white/10 dark:bg-[#0f1825]">
      <div className="section-kicker">Ownership change</div>
      <div className="theme-ink mt-3 text-3xl font-semibold">{marketName || "Select market"}</div>
      <div className="theme-copy mt-2 text-sm leading-6">
        Assign a new owner and keep account responsibility aligned with the storefront.
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <span className="status-chip status-neutral">Owner ID {ownerId || "not selected"}</span>
      </div>
    </div>
  );
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

  const bannersQ = useQuery({
    queryKey: ["market-banners"],
    queryFn: async () => (await api.get("/api/banners")).data as MarketBanner[],
    enabled: isAdmin,
  });

  const publicAnalyticsQ = useQuery({
    queryKey: ["public-marketplace-analytics"],
    queryFn: async () => (await api.get("/api/analytics/public-marketplace")).data as PublicMarketplaceAnalytics,
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
        market.category,
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
        ...buildFeaturedPayload(createDraft),
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
  const [featuredOrder, setFeaturedOrder] = useState<number[]>([]);
  const [draggingMarketId, setDraggingMarketId] = useState<number | null>(null);
  const [bannerOpen, setBannerOpen] = useState(false);
  const [editingBanner, setEditingBanner] = useState<MarketBanner | null>(null);
  const [bannerDraft, setBannerDraft] = useState<BannerDraft>(emptyBannerDraft);

  useEffect(() => {
    setFeaturedOrder(
      [...markets]
        .filter((market) => market.is_featured)
        .sort((left, right) => (left.featured_sort_order ?? 0) - (right.featured_sort_order ?? 0))
        .map((market) => market.id),
    );
  }, [markets]);

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
          ...buildFeaturedPayload(editDraft),
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

  const saveFeaturedOrderM = useMutation({
    mutationFn: async () => {
      await api.patch("/api/markets/featured-order", { market_ids: featuredOrder });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["markets"] });
    },
  });

  const saveBannerM = useMutation({
    mutationFn: async () => {
      const payload = {
        title: bannerDraft.title.trim(),
        subtitle: bannerDraft.subtitle.trim() || null,
        cta_label: bannerDraft.ctaLabel.trim() || null,
        cta_url: bannerDraft.ctaUrl.trim() || null,
        theme: bannerDraft.theme,
        market_id: bannerDraft.marketId === "none" ? null : Number(bannerDraft.marketId),
        is_active: bannerDraft.isActive,
        sort_order: Number(bannerDraft.sortOrder || 0),
        starts_at: fromDateTimeInput(bannerDraft.startsAt),
        ends_at: fromDateTimeInput(bannerDraft.endsAt),
      };

      if (editingBanner) {
        return (await api.patch(`/api/banners/${editingBanner.id}`, payload)).data as MarketBanner;
      }

      return (await api.post("/api/banners", payload)).data as MarketBanner;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["market-banners"] });
      setBannerOpen(false);
      setEditingBanner(null);
      setBannerDraft(emptyBannerDraft);
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

  const bannerError =
    (saveBannerM.error as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message ??
    (saveBannerM.error as { message?: string })?.message ??
    null;

  const canCreate =
    createDraft.name.trim().length >= 2 &&
    createDraft.code.trim().length >= 2 &&
    createDraft.ownerId &&
    Number.isFinite(Number(createDraft.ownerId));

  const featuredCount = markets.filter((market) => market.is_featured).length;
  const activeCount = markets.filter((market) => market.is_active).length;
  const promoCount = markets.filter((market) => market.active_promo).length;
  const featuredMarkets = featuredOrder
    .map((marketId) => markets.find((market) => market.id === marketId))
    .filter((market): market is Market => Boolean(market));

  function moveFeaturedMarket(targetId: number) {
    if (draggingMarketId == null || draggingMarketId === targetId) {
      return;
    }

    setFeaturedOrder((current) => {
      const next = current.filter((id) => id !== draggingMarketId);
      const targetIndex = next.indexOf(targetId);
      next.splice(targetIndex, 0, draggingMarketId);
      return next;
    });
  }

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

          <div className="flex flex-wrap gap-3">
            <Dialog open={bannerOpen} onOpenChange={setBannerOpen}>
              <DialogTrigger asChild>
                <Button
                  size="lg"
                  variant="secondary"
                  onClick={() => {
                    setEditingBanner(null);
                    setBannerDraft(emptyBannerDraft);
                  }}
                >
                  <ImagePlus className="h-4 w-4" />
                  New banner
                </Button>
              </DialogTrigger>
              <DialogContent className="grid-rows-[auto_minmax(0,1fr)_auto] gap-0 rounded-[30px] border border-slate-200/80 bg-[#f8f6f0] p-0 dark:border-white/10 dark:bg-[#0d1420] sm:max-w-[min(1080px,calc(100%-2rem))]">
                <DialogHeader>
                  <div className="border-b border-slate-200 bg-white/92 px-6 py-5 dark:border-white/10 dark:bg-[#131d2b]">
                    <div className="section-kicker">Campaign workspace</div>
                    <DialogTitle className="panel-title mt-2">{editingBanner ? "Edit homepage banner" : "Create homepage banner"}</DialogTitle>
                    <p className="theme-copy mt-2 text-sm leading-6">
                      Build a cleaner promo block with a linked market, CTA, schedule, and activation state in one place.
                    </p>
                  </div>
                </DialogHeader>

                <div className="min-h-0 overflow-y-auto">
                  <WorkspaceModalLayout
                    preview={<BannerPreviewCard draft={bannerDraft} mode={editingBanner ? "edit" : "create"} />}
                    controls={
                      <>
                        <WorkspaceFieldCard label="Title" icon={Type}>
                          <Input value={bannerDraft.title} onChange={(e) => setBannerDraft((current) => ({ ...current, title: e.target.value }))} className="input-shell" />
                        </WorkspaceFieldCard>
                        <WorkspaceFieldCard label="Theme" icon={Sparkles}>
                          <Select value={bannerDraft.theme} onValueChange={(value) => setBannerDraft((current) => ({ ...current, theme: value }))}>
                            <SelectTrigger className="input-shell w-full">
                              <SelectValue placeholder="Select theme" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="cyan">cyan</SelectItem>
                              <SelectItem value="warm">warm</SelectItem>
                              <SelectItem value="emerald">emerald</SelectItem>
                              <SelectItem value="midnight">midnight</SelectItem>
                            </SelectContent>
                          </Select>
                        </WorkspaceFieldCard>
                        <WorkspaceFieldCard label="Subtitle" icon={Megaphone}>
                          <Input value={bannerDraft.subtitle} onChange={(e) => setBannerDraft((current) => ({ ...current, subtitle: e.target.value }))} className="input-shell" />
                        </WorkspaceFieldCard>
                        <WorkspaceFieldCard label="CTA label" icon={BadgePercent}>
                          <Input value={bannerDraft.ctaLabel} onChange={(e) => setBannerDraft((current) => ({ ...current, ctaLabel: e.target.value }))} className="input-shell" />
                        </WorkspaceFieldCard>
                        <WorkspaceFieldCard label="CTA URL" icon={Hash}>
                          <Input value={bannerDraft.ctaUrl} onChange={(e) => setBannerDraft((current) => ({ ...current, ctaUrl: e.target.value }))} className="input-shell" />
                        </WorkspaceFieldCard>
                        <WorkspaceFieldCard label="Linked market" icon={Store}>
                          <Select value={bannerDraft.marketId} onValueChange={(value) => setBannerDraft((current) => ({ ...current, marketId: value }))}>
                            <SelectTrigger className="input-shell w-full">
                              <SelectValue placeholder="Select market" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">No linked market</SelectItem>
                              {markets.map((market) => (
                                <SelectItem key={market.id} value={String(market.id)}>
                                  {market.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </WorkspaceFieldCard>
                        <WorkspaceFieldCard label="Sort order" icon={Hash}>
                          <Input value={bannerDraft.sortOrder} onChange={(e) => setBannerDraft((current) => ({ ...current, sortOrder: e.target.value }))} className="input-shell" />
                        </WorkspaceFieldCard>
                        <WorkspaceFieldCard label="Starts at" icon={Sparkles}>
                          <Input type="datetime-local" value={bannerDraft.startsAt} onChange={(e) => setBannerDraft((current) => ({ ...current, startsAt: e.target.value }))} className="input-shell" />
                        </WorkspaceFieldCard>
                        <WorkspaceFieldCard label="Ends at" icon={Sparkles}>
                          <Input type="datetime-local" value={bannerDraft.endsAt} onChange={(e) => setBannerDraft((current) => ({ ...current, endsAt: e.target.value }))} className="input-shell" />
                        </WorkspaceFieldCard>
                        <WorkspaceSwitchCard
                          title="Banner active"
                          body="Inactive campaigns stay editable but do not appear publicly."
                          checked={bannerDraft.isActive}
                          onCheckedChange={(checked) => setBannerDraft((current) => ({ ...current, isActive: checked }))}
                        />
                      </>
                    }
                  />
                </div>

                {bannerError && <div className="px-6 text-sm text-red-700">{bannerError}</div>}

                <DialogFooter className="border-t border-slate-200 bg-slate-50/90 px-6 py-4 dark:border-white/10 dark:bg-white/4">
                  <Button onClick={() => saveBannerM.mutate()} disabled={!bannerDraft.title.trim() || saveBannerM.isPending}>
                    {saveBannerM.isPending ? "Saving..." : editingBanner ? "Save banner" : "Create banner"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <Button size="lg">Create market</Button>
              </DialogTrigger>
              <DialogContent className="grid-rows-[auto_minmax(0,1fr)_auto] gap-0 rounded-[30px] border border-slate-200/80 bg-[#f8f6f0] p-0 dark:border-white/10 dark:bg-[#0d1420] sm:max-w-[min(1080px,calc(100%-2rem))]">
                <DialogHeader>
                  <div className="border-b border-slate-200 bg-white/92 px-6 py-5 dark:border-white/10 dark:bg-[#131d2b]">
                    <div className="section-kicker">Storefront workspace</div>
                    <DialogTitle className="panel-title mt-2">Create market</DialogTitle>
                    <p className="theme-copy mt-2 text-sm leading-6">
                      Launch a new storefront with cleaner identity, location, ownership, and promotion settings in one polished workflow.
                    </p>
                  </div>
                </DialogHeader>

                <div className="min-h-0 overflow-y-auto">
                  <WorkspaceModalLayout
                    preview={<StorefrontPreviewCard draft={createDraft} mode="create" />}
                    controls={
                      <>
                        <WorkspaceFieldCard label="Name" icon={Type}>
                          <Input value={createDraft.name} onChange={(e) => setCreateDraft((current) => ({ ...current, name: e.target.value }))} className="input-shell" />
                        </WorkspaceFieldCard>
                        <WorkspaceFieldCard label="Code" icon={Hash}>
                          <Input value={createDraft.code} onChange={(e) => setCreateDraft((current) => ({ ...current, code: e.target.value }))} className="input-shell" />
                        </WorkspaceFieldCard>
                        <WorkspaceFieldCard label="Address" icon={MapPinned}>
                          <Input
                            value={createDraft.address}
                            onChange={(e) => setCreateDraft((current) => ({ ...current, address: e.target.value }))}
                            placeholder="Service address or pickup zone"
                            className="input-shell"
                          />
                        </WorkspaceFieldCard>
                        <WorkspaceFieldCard label="Owner" icon={UserRound}>
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
                        </WorkspaceFieldCard>
                        <WorkspaceFieldCard label="Latitude" icon={MapPinned}>
                          <Input value={createDraft.lat} onChange={(e) => setCreateDraft((current) => ({ ...current, lat: e.target.value }))} placeholder="41.7151" className="input-shell" />
                        </WorkspaceFieldCard>
                        <WorkspaceFieldCard label="Longitude" icon={MapPinned}>
                          <Input value={createDraft.lng} onChange={(e) => setCreateDraft((current) => ({ ...current, lng: e.target.value }))} placeholder="44.8271" className="input-shell" />
                        </WorkspaceFieldCard>
                        <WorkspaceFieldCard label="Featured badge" icon={BadgePercent}>
                          <Input
                            value={createDraft.featuredBadge}
                            onChange={(e) => setCreateDraft((current) => ({ ...current, featuredBadge: e.target.value }))}
                            placeholder="Promoted market"
                            className="input-shell"
                          />
                          <div className="mt-2 flex flex-wrap gap-2">
                            {badgePresets.map((badge) => (
                              <button
                                key={badge}
                                type="button"
                                className="status-chip"
                                onClick={() =>
                                  setCreateDraft((current) => ({
                                    ...current,
                                    isFeatured: true,
                                    featuredBadge: badge,
                                  }))
                                }
                              >
                                {badge}
                              </button>
                            ))}
                          </div>
                        </WorkspaceFieldCard>
                        <WorkspaceFieldCard label="Featured headline" icon={Sparkles}>
                          <Input
                            value={createDraft.featuredHeadline}
                            onChange={(e) => setCreateDraft((current) => ({ ...current, featuredHeadline: e.target.value }))}
                            placeholder="Fastest weekly essentials"
                            className="input-shell"
                          />
                        </WorkspaceFieldCard>
                        <WorkspaceFieldCard label="Featured copy" icon={Megaphone}>
                          <Input
                            value={createDraft.featuredCopy}
                            onChange={(e) => setCreateDraft((current) => ({ ...current, featuredCopy: e.target.value }))}
                            placeholder="This message appears in the public spotlight experience."
                            className="input-shell"
                          />
                        </WorkspaceFieldCard>
                        <WorkspaceSwitchCard
                          title="Market active"
                          body="Inactive markets stay hidden from the public marketplace."
                          checked={createDraft.isActive}
                          onCheckedChange={(checked) => setCreateDraft((current) => ({ ...current, isActive: checked }))}
                        />
                        <WorkspaceSwitchCard
                          title="Promote on landing page"
                          body="Featured markets receive the premium public treatment."
                          checked={createDraft.isFeatured}
                          onCheckedChange={(checked) => setCreateDraft((current) => ({ ...current, isFeatured: checked }))}
                        />
                      </>
                    }
                  />
                </div>

                {createError && <div className="px-6 text-sm text-red-700">{createError}</div>}

                <DialogFooter className="border-t border-slate-200 bg-slate-50/90 px-6 py-4 dark:border-white/10 dark:bg-white/4">
                  <Button onClick={() => createMarketM.mutate()} disabled={!canCreate || createMarketM.isPending}>
                    {createMarketM.isPending ? "Creating..." : "Create market"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
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

      <section className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardContent className="grid gap-4 p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="section-kicker">Public marketplace analytics</div>
                <h2 className="panel-title mt-2">Which markets get the most clicks</h2>
              </div>
              <div className="status-chip">
                <BarChart3 className="h-4 w-4" />
                {publicAnalyticsQ.data?.total_clicks ?? 0} clicks
              </div>
            </div>

            {publicAnalyticsQ.isLoading ? (
              <div className="theme-copy text-sm">Loading marketplace analytics...</div>
            ) : (
              <div className="grid gap-3">
                {(publicAnalyticsQ.data?.top_markets ?? []).slice(0, 5).map((entry) => (
                  <div key={entry.market_id} className="subpanel flex items-center justify-between gap-4 px-4 py-4">
                    <div>
                      <div className="theme-ink font-semibold">{entry.market_name}</div>
                      <div className="theme-copy text-sm">
                        {entry.market_code}
                        {entry.featured_badge ? ` • ${entry.featured_badge}` : ""}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="theme-ink font-semibold">{entry.clicks}</div>
                      <div className="theme-muted text-xs">{entry.latest_click_at ? formatDateTime(entry.latest_click_at) : "No clicks yet"}</div>
                    </div>
                  </div>
                ))}

                {!publicAnalyticsQ.data?.top_markets?.length && <div className="theme-copy text-sm">No public click data yet.</div>}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="grid gap-4 p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="section-kicker">Featured order</div>
                <h2 className="panel-title mt-2">Drag promoted markets into public-page order</h2>
              </div>
              <Button variant="secondary" onClick={() => saveFeaturedOrderM.mutate()} disabled={saveFeaturedOrderM.isPending || !featuredMarkets.length}>
                {saveFeaturedOrderM.isPending ? "Saving..." : "Save order"}
              </Button>
            </div>

            <div className="grid gap-3">
              {featuredMarkets.map((market) => (
                <div
                  key={market.id}
                  draggable
                  onDragStart={() => setDraggingMarketId(market.id)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => moveFeaturedMarket(market.id)}
                  className="subpanel flex items-center justify-between gap-4 px-4 py-4"
                >
                  <div className="flex items-center gap-3">
                    <GripVertical className="h-4 w-4 text-slate-400" />
                    <div>
                      <div className="theme-ink font-semibold">{market.name}</div>
                      <div className="theme-copy text-sm">
                        #{market.featured_sort_order ?? 0}
                        {market.featured_badge ? ` • ${market.featured_badge}` : ""}
                      </div>
                    </div>
                  </div>
                  <span className="status-chip">{market.public_clicks_count ?? 0} clicks</span>
                </div>
              ))}

              {!featuredMarkets.length && <div className="theme-copy text-sm">Mark some storefronts as promoted to order them here.</div>}
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="dashboard-card">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="section-kicker">Homepage banners</div>
            <h2 className="panel-title mt-2">Campaign manager for public promo blocks</h2>
          </div>
          <span className="status-chip">{(bannersQ.data ?? []).filter((banner) => banner.is_live).length} live</span>
        </div>

        <div className="mt-5 grid gap-3">
          {(bannersQ.data ?? []).map((banner) => (
            <div key={banner.id} className="subpanel flex flex-col gap-3 px-4 py-4 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="theme-ink font-semibold">{banner.title}</div>
                <div className="theme-copy text-sm">
                  {banner.subtitle || "No subtitle"} • {banner.theme} • sort #{banner.sort_order}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className={`status-chip ${banner.is_live ? "status-good" : "status-neutral"}`}>{banner.is_live ? "Live" : "Scheduled"}</span>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setEditingBanner(banner);
                    setBannerDraft(toBannerDraft(banner));
                    setBannerOpen(true);
                  }}
                >
                  Edit banner
                </Button>
              </div>
            </div>
          ))}

          {bannersQ.isLoading && <div className="theme-copy text-sm">Loading banners...</div>}
          {!bannersQ.isLoading && !(bannersQ.data ?? []).length && <div className="theme-copy text-sm">No promo banners yet.</div>}
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
                <div className="theme-ink font-semibold">{request.market?.name ?? "Market"} • {request.badge}</div>
                <div className="theme-copy text-sm">{request.requester?.name ?? "Owner"} • {request.duration_days} days • {request.notes || "No note"}</div>
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
                      {market.category && <span className="status-chip">{market.category}</span>}
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

                {market.cover_url ? (
                  <img src={market.cover_url} alt={`${market.name} cover`} className="h-40 w-full rounded-[24px] object-cover" />
                ) : (
                  <div className="rounded-[24px] bg-gradient-to-br from-cyan-200 via-white to-amber-100 p-6 text-sm text-slate-700">
                    No cover image yet. Upload one in market settings to replace this placeholder.
                  </div>
                )}

                <div className="grid gap-3 md:grid-cols-4">
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
                  <div className="subpanel p-4">
                    <div className="section-kicker">Public card</div>
                    <div className="theme-ink mt-2 font-semibold">
                      {market.delivery_eta_minutes ? `${market.delivery_eta_minutes} min ETA` : "ETA not set"}
                    </div>
                    <div className="theme-muted mt-1 text-sm">
                      {formatMoney(market.minimum_order ?? 0)} minimum
                    </div>
                  </div>
                  <div className="subpanel p-4">
                    <div className="section-kicker">Customer rating</div>
                    <div className="theme-ink mt-2 font-semibold">
                      {market.average_rating ? `${market.average_rating.toFixed(1)} / 5` : "No ratings yet"}
                    </div>
                    <div className="theme-muted mt-1 text-sm">{market.rating_count ?? 0} reviews</div>
                  </div>
                </div>

                {(market.badge_expires_at || market.featured_starts_at || market.featured_ends_at) && (
                  <div className="grid gap-1 text-sm text-slate-600">
                    {market.badge_expires_at && <div>Badge expiry: {formatDateTime(market.badge_expires_at)}</div>}
                    {(market.featured_starts_at || market.featured_ends_at) && (
                      <div>
                        Promo window: {market.featured_starts_at ? formatDateTime(market.featured_starts_at) : "now"} to{" "}
                        {market.featured_ends_at ? formatDateTime(market.featured_ends_at) : "open ended"}
                      </div>
                    )}
                  </div>
                )}

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
        <DialogContent className="grid-rows-[auto_minmax(0,1fr)_auto] gap-0 rounded-[30px] border border-slate-200/80 bg-[#f8f6f0] p-0 dark:border-white/10 dark:bg-[#0d1420] sm:max-w-[min(920px,calc(100%-2rem))]">
          <DialogHeader>
            <div className="border-b border-slate-200 bg-white/92 px-6 py-5 dark:border-white/10 dark:bg-[#131d2b]">
              <div className="section-kicker">Ownership workspace</div>
              <DialogTitle className="panel-title mt-2">Assign owner</DialogTitle>
              <p className="theme-copy mt-2 text-sm leading-6">Move storefront ownership cleanly without digging through separate admin forms.</p>
            </div>
          </DialogHeader>

          <div className="min-h-0 overflow-y-auto">
            <WorkspaceModalLayout
              preview={<OwnerPreviewCard marketName={assignMarket?.name} ownerId={assignOwnerId} />}
              controls={
                <WorkspaceFieldCard label="Owner" icon={UserRound}>
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
                </WorkspaceFieldCard>
              }
            />
          </div>

          {assignError && <div className="px-6 text-sm text-red-700">{assignError}</div>}

          <DialogFooter className="border-t border-slate-200 bg-slate-50/90 px-6 py-4 dark:border-white/10 dark:bg-white/4">
            <Button onClick={() => assignOwnerM.mutate()} disabled={!assignMarket || !assignOwnerId || assignOwnerM.isPending}>
              {assignOwnerM.isPending ? "Saving..." : "Save owner"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="grid-rows-[auto_minmax(0,1fr)_auto] gap-0 rounded-[30px] border border-slate-200/80 bg-[#f8f6f0] p-0 dark:border-white/10 dark:bg-[#0d1420] sm:max-w-[min(1080px,calc(100%-2rem))]">
          <DialogHeader>
            <div className="border-b border-slate-200 bg-white/92 px-6 py-5 dark:border-white/10 dark:bg-[#131d2b]">
              <div className="section-kicker">Storefront editor</div>
              <DialogTitle className="panel-title mt-2">Edit storefront</DialogTitle>
              <p className="theme-copy mt-2 text-sm leading-6">
                Refine the storefront identity, featured messaging, and visibility controls in the same polished workspace.
              </p>
            </div>
          </DialogHeader>

          <div className="min-h-0 overflow-y-auto">
            <WorkspaceModalLayout
              preview={<StorefrontPreviewCard draft={editDraft} mode="edit" />}
              controls={
                <>
                  <WorkspaceFieldCard label="Name" icon={Type}>
                    <Input value={editDraft.name} onChange={(e) => setEditDraft((current) => ({ ...current, name: e.target.value }))} className="input-shell" />
                  </WorkspaceFieldCard>
                  <WorkspaceFieldCard label="Code" icon={Hash}>
                    <Input value={editDraft.code} onChange={(e) => setEditDraft((current) => ({ ...current, code: e.target.value }))} className="input-shell" />
                  </WorkspaceFieldCard>
                  <WorkspaceFieldCard label="Address" icon={MapPinned}>
                    <Input value={editDraft.address} onChange={(e) => setEditDraft((current) => ({ ...current, address: e.target.value }))} className="input-shell" />
                  </WorkspaceFieldCard>
                  <WorkspaceFieldCard label="Latitude" icon={MapPinned}>
                    <Input value={editDraft.lat} onChange={(e) => setEditDraft((current) => ({ ...current, lat: e.target.value }))} placeholder="41.7151" className="input-shell" />
                  </WorkspaceFieldCard>
                  <WorkspaceFieldCard label="Longitude" icon={MapPinned}>
                    <Input value={editDraft.lng} onChange={(e) => setEditDraft((current) => ({ ...current, lng: e.target.value }))} placeholder="44.8271" className="input-shell" />
                  </WorkspaceFieldCard>
                  <WorkspaceFieldCard label="Featured badge" icon={BadgePercent}>
                    <Input
                      value={editDraft.featuredBadge}
                      onChange={(e) => setEditDraft((current) => ({ ...current, featuredBadge: e.target.value }))}
                      placeholder="Promoted market"
                      className="input-shell"
                    />
                    <div className="mt-2 flex flex-wrap gap-2">
                      {badgePresets.map((badge) => (
                        <button
                          key={badge}
                          type="button"
                          className="status-chip"
                          onClick={() =>
                            setEditDraft((current) => ({
                              ...current,
                              isFeatured: true,
                              featuredBadge: badge,
                            }))
                          }
                        >
                          {badge}
                        </button>
                      ))}
                    </div>
                  </WorkspaceFieldCard>
                  <WorkspaceFieldCard label="Featured headline" icon={Sparkles}>
                    <Input
                      value={editDraft.featuredHeadline}
                      onChange={(e) => setEditDraft((current) => ({ ...current, featuredHeadline: e.target.value }))}
                      placeholder="City's fastest essentials drop"
                      className="input-shell"
                    />
                  </WorkspaceFieldCard>
                  <WorkspaceFieldCard label="Featured copy" icon={Megaphone}>
                    <Input
                      value={editDraft.featuredCopy}
                      onChange={(e) => setEditDraft((current) => ({ ...current, featuredCopy: e.target.value }))}
                      placeholder="Shown on the public landing spotlight."
                      className="input-shell"
                    />
                  </WorkspaceFieldCard>
                  <WorkspaceSwitchCard
                    title="Storefront active"
                    body="Controls whether the market is visible publicly."
                    checked={editDraft.isActive}
                    onCheckedChange={(checked) => setEditDraft((current) => ({ ...current, isActive: checked }))}
                  />
                  <WorkspaceSwitchCard
                    title="Featured promotion placement"
                    body="Moves this market into the premium public spotlight."
                    checked={editDraft.isFeatured}
                    onCheckedChange={(checked) => setEditDraft((current) => ({ ...current, isFeatured: checked }))}
                  />
                </>
              }
            />
          </div>

          {updateError && <div className="px-6 text-sm text-red-700">{updateError}</div>}

          <DialogFooter className="border-t border-slate-200 bg-slate-50/90 px-6 py-4 dark:border-white/10 dark:bg-white/4">
            <Button onClick={() => updateMarketM.mutate()} disabled={!editMarket || updateMarketM.isPending || !editDraft.name.trim()}>
              {updateMarketM.isPending ? "Saving..." : "Save storefront"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
