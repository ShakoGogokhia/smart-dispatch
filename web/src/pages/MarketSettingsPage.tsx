import { useEffect, useMemo, useState } from "react";
import { ImagePlus, Settings2, Sparkles, Users } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { clearMarketDraft, loadMarketDraft, saveMarketDraft } from "@/lib/publicMarketplace";
import { useMe } from "@/lib/useMe";
import type { StorefrontMarket } from "@/lib/storefront";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

type Market = StorefrontMarket & {
  owner_user_id?: number;
  logo_path?: string | null;
};

type StaffUser = {
  id: number;
  name: string;
  email: string;
  roles?: string[];
  is_owner?: boolean;
  pivot?: { role?: string };
};

type BadgeAudit = {
  id: number;
  action: string;
  previous_badge?: string | null;
  next_badge?: string | null;
  previous_badge_expires_at?: string | null;
  next_badge_expires_at?: string | null;
  created_at?: string | null;
  user?: { id: number; name: string; email: string } | null;
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

function buildFeaturedPayload({
  badgeExpiresAt,
  featuredBadge,
  featuredCopy,
  featuredHeadline,
  featuredEndsAt,
  featuredStartsAt,
  featuredSortOrder,
  isFeatured,
}: {
  badgeExpiresAt: string;
  featuredBadge: string;
  featuredCopy: string;
  featuredHeadline: string;
  featuredEndsAt: string;
  featuredStartsAt: string;
  featuredSortOrder: string;
  isFeatured: boolean;
}) {
  const nextBadge = featuredBadge.trim();
  const shouldFeature = isFeatured || Boolean(nextBadge);

  return {
    is_featured: shouldFeature,
    featured_badge: shouldFeature ? nextBadge || "Featured" : null,
    featured_headline: featuredHeadline.trim() || null,
    featured_copy: featuredCopy.trim() || null,
    badge_expires_at: fromDateTimeInput(badgeExpiresAt),
    featured_starts_at: fromDateTimeInput(featuredStartsAt),
    featured_ends_at: fromDateTimeInput(featuredEndsAt),
    featured_sort_order: Number(featuredSortOrder || 0),
  };
}

export default function MarketSettingsPage() {
  const { marketId } = useParams();
  const id = Number(marketId);
  const qc = useQueryClient();

  const meQ = useMe();
  const roles = meQ.data?.roles ?? [];
  const isAdmin = roles.includes("admin");

  const marketsQ = useQuery({
    queryKey: ["market-settings-source", id, isAdmin],
    queryFn: async () => {
      const url = isAdmin ? "/api/markets" : "/api/my/markets";
      return (await api.get(url)).data as Market[];
    },
    enabled: Number.isFinite(id) && !!meQ.data,
  });

  const market = useMemo(() => {
    const list = marketsQ.data ?? [];
    return list.find((entry) => Number(entry.id) === id) ?? null;
  }, [id, marketsQ.data]);

  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [category, setCategory] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [isFeatured, setIsFeatured] = useState(false);
  const [featuredBadge, setFeaturedBadge] = useState("");
  const [featuredHeadline, setFeaturedHeadline] = useState("");
  const [featuredCopy, setFeaturedCopy] = useState("");
  const [minimumOrder, setMinimumOrder] = useState("0");
  const [deliveryEtaMinutes, setDeliveryEtaMinutes] = useState("");
  const [featuredSortOrder, setFeaturedSortOrder] = useState("0");
  const [badgeExpiresAt, setBadgeExpiresAt] = useState("");
  const [featuredStartsAt, setFeaturedStartsAt] = useState("");
  const [featuredEndsAt, setFeaturedEndsAt] = useState("");
  const [opensAt, setOpensAt] = useState("");
  const [closesAt, setClosesAt] = useState("");
  const draftKey = `market-settings-${id}`;

  useEffect(() => {
    if (!market) return;
    const draft = loadMarketDraft(draftKey, {
      name: market.name ?? "",
      address: market.address ?? "",
      category: market.category ?? "",
      lat: market.lat != null ? String(market.lat) : "",
      lng: market.lng != null ? String(market.lng) : "",
      isActive: typeof market.is_active === "boolean" ? market.is_active : true,
      isFeatured: !!market.is_featured,
      featuredBadge: market.featured_badge ?? "",
      featuredHeadline: market.featured_headline ?? "",
      featuredCopy: market.featured_copy ?? "",
      minimumOrder: String(market.minimum_order ?? 0),
      deliveryEtaMinutes: market.delivery_eta_minutes != null ? String(market.delivery_eta_minutes) : "",
      featuredSortOrder: String(market.featured_sort_order ?? 0),
      badgeExpiresAt: toDateTimeInput(market.badge_expires_at),
      featuredStartsAt: toDateTimeInput(market.featured_starts_at),
      featuredEndsAt: toDateTimeInput(market.featured_ends_at),
      opensAt: market.opens_at ?? "",
      closesAt: market.closes_at ?? "",
    });

    setName(draft.name);
    setAddress(draft.address);
    setCategory(draft.category);
    setLat(draft.lat);
    setLng(draft.lng);
    setIsActive(draft.isActive);
    setIsFeatured(draft.isFeatured);
    setFeaturedBadge(draft.featuredBadge);
    setFeaturedHeadline(draft.featuredHeadline);
    setFeaturedCopy(draft.featuredCopy);
    setMinimumOrder(draft.minimumOrder);
    setDeliveryEtaMinutes(draft.deliveryEtaMinutes);
    setFeaturedSortOrder(draft.featuredSortOrder);
    setBadgeExpiresAt(draft.badgeExpiresAt);
    setFeaturedStartsAt(draft.featuredStartsAt);
    setFeaturedEndsAt(draft.featuredEndsAt);
    setOpensAt(draft.opensAt);
    setClosesAt(draft.closesAt);
  }, [market]);

  useEffect(() => {
    if (!market) return;

    saveMarketDraft(draftKey, {
      name,
      address,
      category,
      lat,
      lng,
      isActive,
      isFeatured,
      featuredBadge,
      featuredHeadline,
      featuredCopy,
      minimumOrder,
      deliveryEtaMinutes,
      featuredSortOrder,
      badgeExpiresAt,
      featuredStartsAt,
      featuredEndsAt,
      opensAt,
      closesAt,
    });
  }, [
    address,
    badgeExpiresAt,
    category,
    closesAt,
    deliveryEtaMinutes,
    draftKey,
    featuredBadge,
    featuredCopy,
    featuredEndsAt,
    featuredHeadline,
    featuredSortOrder,
    featuredStartsAt,
    isActive,
    isFeatured,
    lat,
    lng,
    market,
    minimumOrder,
    name,
    opensAt,
  ]);

  const [tab, setTab] = useState<"details" | "staff">("details");

  const updateMarketM = useMutation({
    mutationFn: async () => {
      const payload = {
        name: name.trim(),
        address: address.trim() || null,
        category: category.trim() || null,
        lat: lat.trim() ? Number(lat) : null,
        lng: lng.trim() ? Number(lng) : null,
        is_active: isActive,
        minimum_order: Number(minimumOrder || 0),
        delivery_eta_minutes: deliveryEtaMinutes.trim() ? Number(deliveryEtaMinutes) : null,
        opens_at: opensAt || null,
        closes_at: closesAt || null,
        ...buildFeaturedPayload({
          badgeExpiresAt,
          featuredBadge,
          featuredCopy,
          featuredEndsAt,
          featuredHeadline,
          featuredSortOrder,
          featuredStartsAt,
          isFeatured,
        }),
      };
      const res = await api.patch(`/api/markets/${id}`, payload);
      return res.data as Market;
    },
    onSuccess: async () => {
      clearMarketDraft(draftKey);
      await qc.invalidateQueries({ queryKey: ["market-settings-source"] });
      await qc.invalidateQueries({ queryKey: ["markets"] });
      await qc.invalidateQueries({ queryKey: ["my-markets"] });
      await qc.invalidateQueries({ queryKey: ["public-markets"] });
    },
  });

  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);

  const uploadLogoM = useMutation({
    mutationFn: async () => {
      if (!logoFile) throw new Error("Select a file first");
      const fd = new FormData();
      fd.append("logo", logoFile);

      return (
        await api.post(`/api/markets/${id}/logo`, fd, {
          headers: { "Content-Type": "multipart/form-data" },
        })
      ).data;
    },
    onSuccess: async () => {
      setLogoFile(null);
      await qc.invalidateQueries({ queryKey: ["market-settings-source"] });
      await qc.invalidateQueries({ queryKey: ["markets"] });
      await qc.invalidateQueries({ queryKey: ["public-markets"] });
    },
  });

  const uploadCoverM = useMutation({
    mutationFn: async () => {
      if (!coverFile) throw new Error("Select a file first");
      const formData = new FormData();
      formData.append("cover", coverFile);

      return (
        await api.post(`/api/markets/${id}/cover`, formData, {
          headers: { "Content-Type": "multipart/form-data" },
        })
      ).data;
    },
    onSuccess: async () => {
      setCoverFile(null);
      await qc.invalidateQueries({ queryKey: ["market-settings-source"] });
      await qc.invalidateQueries({ queryKey: ["markets"] });
      await qc.invalidateQueries({ queryKey: ["public-markets"] });
    },
  });

  const staffQ = useQuery({
    queryKey: ["market-staff", id],
    queryFn: async () => (await api.get(`/api/markets/${id}/staff`)).data as StaffUser[],
    enabled: Number.isFinite(id) && tab === "staff",
    retry: false,
  });

  const badgeAuditsQ = useQuery({
    queryKey: ["market-badge-audits", id],
    queryFn: async () => (await api.get(`/api/markets/${id}/badge-audits`)).data as BadgeAudit[],
    enabled: Number.isFinite(id),
    retry: false,
  });

  const [staffUserId, setStaffUserId] = useState("");

  const assignableUsersQ = useQuery({
    queryKey: ["market-assignable-users", id],
    queryFn: async () => (await api.get(`/api/markets/${id}/assignable-users`)).data as StaffUser[],
    enabled: Number.isFinite(id) && tab === "staff",
    retry: false,
  });

  const addStaffM = useMutation({
    mutationFn: async () => {
      const uid = Number(staffUserId);
      if (!Number.isFinite(uid) || uid <= 0) throw new Error("User ID must be a number");
      return (await api.post(`/api/markets/${id}/staff`, { user_id: uid, role: "staff" })).data;
    },
    onSuccess: async () => {
      setStaffUserId("");
      await qc.invalidateQueries({ queryKey: ["market-staff", id] });
    },
  });

  const removeStaffM = useMutation({
    mutationFn: async (userId: number) => (await api.delete(`/api/markets/${id}/staff/${userId}`)).data,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["market-staff", id] });
    },
  });

  const topError =
    (marketsQ.error as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message ??
    (marketsQ.error as { message?: string })?.message ??
    null;

  const updateError =
    (updateMarketM.error as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message ??
    (updateMarketM.error as { message?: string })?.message ??
    null;

  const logoError =
    (uploadLogoM.error as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message ??
    (uploadLogoM.error as { message?: string })?.message ??
    null;

  const coverError =
    (uploadCoverM.error as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message ??
    (uploadCoverM.error as { message?: string })?.message ??
    null;

  const staffError =
    (staffQ.error as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message ??
    (staffQ.error as { message?: string })?.message ??
    null;

  const addStaffError =
    (addStaffM.error as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message ??
    (addStaffM.error as { message?: string })?.message ??
    null;

  if (!Number.isFinite(id)) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Market Settings</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-red-600">Invalid market id.</CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-6">
      <section className="intro-panel">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="command-chip">
              <Settings2 className="h-3.5 w-3.5" />
              Market settings
            </div>
            <h1 className="intro-title">{market?.name || `Market #${id}`}</h1>
            <p className="intro-copy">
              Tune the public storefront details, upload branding, and manage who can operate inside this market.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button asChild variant="secondary">
              <Link to={`/markets/${id}/items`}>Items</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link to={`/markets/${id}/promo-codes`}>Promo codes</Link>
            </Button>
          </div>
        </div>
      </section>

      {topError && <div className="text-sm text-red-600">{topError}</div>}

      {marketsQ.isLoading ? (
        <Card>
          <CardContent className="p-8 text-sm text-muted-foreground">Loading market...</CardContent>
        </Card>
      ) : !market ? (
        <Card>
          <CardContent className="p-8 text-sm text-red-600">Market not found in your accessible list.</CardContent>
        </Card>
      ) : (
        <>
          <section className="grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
            <Card className={market.is_featured ? "market-card-featured" : ""}>
              <CardContent className="grid gap-4 p-6">
                <div>
                  <div className="section-kicker">Storefront summary</div>
                  <div className="font-display theme-ink mt-2 text-3xl font-semibold">{market.code}</div>
                </div>
                <div className="subpanel p-4">
                  <div className="section-kicker">Visibility</div>
                  <div className="theme-ink mt-2 font-semibold">{market.is_active ? "Publicly live" : "Hidden from marketplace"}</div>
                </div>
                <div className="subpanel p-4">
                  <div className="section-kicker">Promotion state</div>
                  <div className="theme-ink mt-2 font-semibold">{market.is_featured ? market.featured_badge || "Promoted" : "Standard placement"}</div>
                </div>
                <div className="subpanel p-4">
                  <div className="section-kicker">Catalog</div>
                  <div className="theme-ink mt-2 font-semibold">{market.active_items_count ?? 0} visible items</div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="grid gap-5 p-6">
                <div className="flex flex-wrap gap-2">
                  <Button variant={tab === "details" ? "default" : "secondary"} onClick={() => setTab("details")}>
                    <Sparkles className="h-4 w-4" />
                    Details
                  </Button>
                  <Button variant={tab === "staff" ? "default" : "secondary"} onClick={() => setTab("staff")}>
                    <Users className="h-4 w-4" />
                    Staff
                  </Button>
                </div>

                {tab === "details" ? (
                  <div className="grid gap-6">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="field-group">
                        <Label>Name</Label>
                        <Input value={name} onChange={(e) => setName(e.target.value)} />
                      </div>
                      <div className="field-group">
                        <Label>Address</Label>
                        <Input value={address} onChange={(e) => setAddress(e.target.value)} />
                      </div>
                      <div className="field-group">
                        <Label>Category</Label>
                        <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Grocery" />
                      </div>
                      <div className="field-group">
                        <Label>Market latitude</Label>
                        <Input value={lat} onChange={(e) => setLat(e.target.value)} placeholder="41.7151" />
                      </div>
                      <div className="field-group">
                        <Label>Market longitude</Label>
                        <Input value={lng} onChange={(e) => setLng(e.target.value)} placeholder="44.8271" />
                      </div>
                      <div className="field-group">
                        <Label>Minimum order</Label>
                        <Input value={minimumOrder} onChange={(e) => setMinimumOrder(e.target.value)} placeholder="20" />
                      </div>
                      <div className="field-group">
                        <Label>Delivery ETA minutes</Label>
                        <Input value={deliveryEtaMinutes} onChange={(e) => setDeliveryEtaMinutes(e.target.value)} placeholder="35" />
                      </div>
                      <div className="field-group">
                        <Label>Opens at</Label>
                        <Input type="time" value={opensAt} onChange={(e) => setOpensAt(e.target.value)} />
                      </div>
                      <div className="field-group">
                        <Label>Closes at</Label>
                        <Input type="time" value={closesAt} onChange={(e) => setClosesAt(e.target.value)} />
                      </div>
                      <div className="field-group">
                        <Label>Featured badge</Label>
                        <Input value={featuredBadge} onChange={(e) => setFeaturedBadge(e.target.value)} placeholder="Promoted market" />
                        <div className="mt-2 flex flex-wrap gap-2">
                          {badgePresets.map((badge) => (
                            <button
                              key={badge}
                              type="button"
                              className="status-chip"
                              onClick={() => {
                                setIsFeatured(true);
                                setFeaturedBadge(badge);
                              }}
                            >
                              {badge}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="field-group">
                        <Label>Featured headline</Label>
                        <Input
                          value={featuredHeadline}
                          onChange={(e) => setFeaturedHeadline(e.target.value)}
                          placeholder="Fast nightly essentials"
                        />
                      </div>
                      <div className="field-group md:col-span-2">
                        <Label>Featured copy</Label>
                        <Input
                          value={featuredCopy}
                          onChange={(e) => setFeaturedCopy(e.target.value)}
                          placeholder="Shown on the landing page when the storefront is promoted."
                        />
                      </div>
                      <div className="field-group">
                        <Label>Badge expires at</Label>
                        <Input type="datetime-local" value={badgeExpiresAt} onChange={(e) => setBadgeExpiresAt(e.target.value)} />
                      </div>
                      <div className="field-group">
                        <Label>Featured sort order</Label>
                        <Input value={featuredSortOrder} onChange={(e) => setFeaturedSortOrder(e.target.value)} placeholder="0" />
                      </div>
                      <div className="field-group">
                        <Label>Promotion starts at</Label>
                        <Input type="datetime-local" value={featuredStartsAt} onChange={(e) => setFeaturedStartsAt(e.target.value)} />
                      </div>
                      <div className="field-group">
                        <Label>Promotion ends at</Label>
                        <Input type="datetime-local" value={featuredEndsAt} onChange={(e) => setFeaturedEndsAt(e.target.value)} />
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="subpanel flex items-center justify-between p-4">
                        <div>
                          <div className="theme-ink font-medium">Storefront active</div>
                          <div className="theme-muted text-sm">Controls public availability.</div>
                        </div>
                        <Switch checked={isActive} onCheckedChange={setIsActive} disabled={!isAdmin} />
                      </div>
                      <div className="subpanel flex items-center justify-between p-4">
                        <div>
                          <div className="theme-ink font-medium">Promoted storefront</div>
                          <div className="theme-muted text-sm">Admins can feature this market on the public landing page.</div>
                        </div>
                        <Switch checked={isFeatured} onCheckedChange={setIsFeatured} disabled={!isAdmin} />
                      </div>
                    </div>

                    <div className="subpanel grid gap-4 p-4">
                      <div className="flex items-center gap-2">
                        <ImagePlus className="h-4 w-4 text-cyan-600 dark:text-cyan-200" />
                        <div className="theme-ink font-medium">Market logo</div>
                      </div>

                      {market.logo_url && (
                        <img src={market.logo_url} alt={`${market.name} logo`} className="h-24 w-24 rounded-2xl border object-cover" />
                      )}

                      <Input
                        type="file"
                        accept="image/*"
                        onChange={(e) => setLogoFile(e.target.files?.[0] ?? null)}
                        className="input-shell"
                      />

                      <div className="flex flex-wrap gap-3">
                        <Button variant="secondary" onClick={() => uploadLogoM.mutate()} disabled={!logoFile || uploadLogoM.isPending}>
                          {uploadLogoM.isPending ? "Uploading..." : "Upload logo"}
                        </Button>
                        {!isAdmin && (
                          <div className="theme-muted text-sm">
                            You can upload branding here, but only admins can change market visibility and promotion settings.
                          </div>
                        )}
                      </div>

                      {logoError && <div className="text-sm text-red-600">{logoError}</div>}
                    </div>

                    <div className="subpanel grid gap-4 p-4">
                      <div className="flex items-center gap-2">
                        <ImagePlus className="h-4 w-4 text-cyan-600 dark:text-cyan-200" />
                        <div className="theme-ink font-medium">Market cover image</div>
                      </div>

                      {market.cover_url ? (
                        <img src={market.cover_url} alt={`${market.name} cover`} className="h-40 w-full rounded-2xl border object-cover" />
                      ) : (
                        <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-8 text-sm text-slate-500">
                          No cover uploaded yet. This image will be used on public market cards.
                        </div>
                      )}

                      <Input
                        type="file"
                        accept="image/*"
                        onChange={(e) => setCoverFile(e.target.files?.[0] ?? null)}
                        className="input-shell"
                      />

                      <div className="flex flex-wrap gap-3">
                        <Button variant="secondary" onClick={() => uploadCoverM.mutate()} disabled={!coverFile || uploadCoverM.isPending}>
                          {uploadCoverM.isPending ? "Uploading..." : "Upload cover"}
                        </Button>
                      </div>

                      {coverError && <div className="text-sm text-red-600">{coverError}</div>}
                    </div>

                    {updateError && <div className="text-sm text-red-600">{updateError}</div>}

                    <div className="flex flex-wrap items-center gap-3">
                      <Button
                        variant="secondary"
                        onClick={() => {
                          clearMarketDraft(draftKey);
                          if (!market) return;
                          setName(market.name ?? "");
                          setAddress(market.address ?? "");
                          setCategory(market.category ?? "");
                          setLat(market.lat != null ? String(market.lat) : "");
                          setLng(market.lng != null ? String(market.lng) : "");
                          setIsActive(typeof market.is_active === "boolean" ? market.is_active : true);
                          setIsFeatured(!!market.is_featured);
                          setFeaturedBadge(market.featured_badge ?? "");
                          setFeaturedHeadline(market.featured_headline ?? "");
                          setFeaturedCopy(market.featured_copy ?? "");
                          setMinimumOrder(String(market.minimum_order ?? 0));
                          setDeliveryEtaMinutes(market.delivery_eta_minutes != null ? String(market.delivery_eta_minutes) : "");
                          setFeaturedSortOrder(String(market.featured_sort_order ?? 0));
                          setBadgeExpiresAt(toDateTimeInput(market.badge_expires_at));
                          setFeaturedStartsAt(toDateTimeInput(market.featured_starts_at));
                          setFeaturedEndsAt(toDateTimeInput(market.featured_ends_at));
                          setOpensAt(market.opens_at ?? "");
                          setClosesAt(market.closes_at ?? "");
                        }}
                      >
                        Reset draft
                      </Button>
                      <Button onClick={() => updateMarketM.mutate()} disabled={updateMarketM.isPending || !name.trim() || !isAdmin}>
                        {updateMarketM.isPending ? "Saving..." : "Save changes"}
                      </Button>
                      {!isAdmin && <div className="theme-muted text-sm">Only admins can save market detail and promotion changes.</div>}
                    </div>
                  </div>
                ) : (
                  <div className="grid gap-6">
                    <div className="subpanel grid gap-4 p-4">
                      <div className="theme-ink font-medium">Add staff</div>
                      <div className="theme-muted text-sm">Select a user and attach them to this market as staff.</div>

                      <Select value={staffUserId} onValueChange={setStaffUserId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select user" />
                        </SelectTrigger>
                        <SelectContent>
                          {(assignableUsersQ.data ?? []).map((user) => (
                            <SelectItem key={user.id} value={String(user.id)} disabled={user.is_owner}>
                              {user.name} ({user.email}){user.is_owner ? " - owner" : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <div className="flex flex-wrap gap-3">
                        <Button onClick={() => addStaffM.mutate()} disabled={addStaffM.isPending || !staffUserId.trim()}>
                          {addStaffM.isPending ? "Adding..." : "Add staff"}
                        </Button>
                      </div>

                      {addStaffError && <div className="text-sm text-red-600">{addStaffError}</div>}
                      {assignableUsersQ.error && <div className="text-sm text-red-600">Failed to load available users.</div>}
                    </div>

                    <div className="grid gap-4">
                      {staffError && <div className="text-sm text-red-600">{staffError}</div>}

                      {staffQ.isLoading ? (
                        <Card>
                          <CardContent className="p-6 text-sm text-muted-foreground">Loading staff...</CardContent>
                        </Card>
                      ) : (
                        (staffQ.data ?? []).map((user) => (
                          <Card key={user.id}>
                            <CardContent className="flex flex-col gap-4 p-6 md:flex-row md:items-center md:justify-between">
                              <div>
                                <div className="theme-ink font-semibold">{user.name}</div>
                                <div className="theme-muted text-sm">{user.email}</div>
                                <div className="theme-muted mt-2 text-xs uppercase tracking-[0.16em]">{user.pivot?.role ?? "staff"}</div>
                              </div>
                              <Button
                                variant="destructive"
                                onClick={() => removeStaffM.mutate(user.id)}
                                disabled={removeStaffM.isPending}
                              >
                                Remove
                              </Button>
                            </CardContent>
                          </Card>
                        ))
                      )}

                      {!staffQ.isLoading && (staffQ.data ?? []).length === 0 && (
                        <Card>
                          <CardContent className="p-6 text-sm text-muted-foreground">No staff assigned yet.</CardContent>
                        </Card>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </section>

          <section className="dashboard-card">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="section-kicker">Badge audit log</div>
                <h2 className="panel-title mt-2">Who changed market badges and when</h2>
              </div>
              <span className="status-chip">{(badgeAuditsQ.data ?? []).length} entries</span>
            </div>

            <div className="mt-5 grid gap-3">
              {badgeAuditsQ.isLoading ? (
                <div className="theme-copy text-sm">Loading badge audit log...</div>
              ) : (
                (badgeAuditsQ.data ?? []).slice(0, 8).map((audit) => (
                  <div key={audit.id} className="subpanel flex flex-col gap-2 px-4 py-4 md:flex-row md:items-center md:justify-between">
                    <div>
                      <div className="theme-ink font-semibold">
                        {audit.user?.name ?? "System"} • {audit.action}
                      </div>
                      <div className="theme-copy text-sm">
                        {audit.previous_badge || "No badge"} to {audit.next_badge || "No badge"}
                      </div>
                    </div>
                    <div className="text-sm text-slate-500">
                      {audit.created_at ? formatDateTime(audit.created_at) : "No timestamp"}
                    </div>
                  </div>
                ))
              )}

              {!badgeAuditsQ.isLoading && !(badgeAuditsQ.data ?? []).length && (
                <div className="theme-copy text-sm">No badge changes have been recorded yet.</div>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
