import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  Clock3,
  ExternalLink,
  ImagePlus,
  LayoutDashboard,
  Megaphone,
  Package,
  ShieldAlert,
  Sparkles,
  Store,
  TicketPercent,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { api } from "@/lib/api";
import { useMe } from "@/lib/useMe";
import type { StorefrontMarket } from "@/lib/storefront";

import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";
import { LoadingState } from "@/components/app/loading-state";
import { StatusBadge } from "@/components/app/status-badge";
import { MarketBanner, MarketLogo } from "@/components/markets/market-media";
import { marketErrorMessage, resolveMarketMediaUrl } from "@/components/markets/market-utils";

import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

type Market = StorefrontMarket & {
  owner_user_id?: number;
  logo_path?: string | null;
  banner_path?: string | null;
};

type StaffUser = {
  id: number;
  name: string;
  email: string;
  roles?: string[];
  is_owner?: boolean;
  pivot?: { role?: string };
};

type OperatingHour = {
  day: string;
  enabled: boolean;
  open: string;
  close: string;
};

type SettingsTab = "general" | "branding" | "hours" | "staff" | "promotion" | "danger";

const defaultOperatingHours: OperatingHour[] = [
  { day: "monday", enabled: true, open: "09:00", close: "18:00" },
  { day: "tuesday", enabled: true, open: "09:00", close: "18:00" },
  { day: "wednesday", enabled: true, open: "09:00", close: "18:00" },
  { day: "thursday", enabled: true, open: "09:00", close: "18:00" },
  { day: "friday", enabled: true, open: "09:00", close: "18:00" },
  { day: "saturday", enabled: false, open: "10:00", close: "16:00" },
  { day: "sunday", enabled: false, open: "10:00", close: "16:00" },
];

function normalizeOperatingHours(hours?: StorefrontMarket["operating_hours"]): OperatingHour[] {
  return defaultOperatingHours.map((fallback) => {
    const saved = hours?.find((entry) => entry.day === fallback.day);

    return {
      day: fallback.day,
      enabled: saved?.enabled ?? fallback.enabled,
      open: saved?.open || fallback.open,
      close: saved?.close || fallback.close,
    };
  });
}

function dayLabel(day: string) {
  return day.slice(0, 1).toUpperCase() + day.slice(1);
}

/** Object URL for a locally selected file; the previous URL is revoked when a new file is picked. */
function useFilePreview() {
  const [preview, setPreview] = useState<{ file: File; url: string } | null>(null);
  const select = (file: File | null) => {
    setPreview((current) => {
      if (current) URL.revokeObjectURL(current.url);
      return null;
    });
    if (file) setPreview({ file, url: URL.createObjectURL(file) });
  };
  return [preview, select] as const;
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
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [isFeatured, setIsFeatured] = useState(false);
  const [featuredBadge, setFeaturedBadge] = useState("");
  const [featuredHeadline, setFeaturedHeadline] = useState("");
  const [featuredCopy, setFeaturedCopy] = useState("");
  const [isManuallyClosed, setIsManuallyClosed] = useState(false);
  const [manualCloseComment, setManualCloseComment] = useState("");
  const [usesOperatingSchedule, setUsesOperatingSchedule] = useState(false);
  const [operatingHours, setOperatingHours] = useState<OperatingHour[]>(defaultOperatingHours);

  useEffect(() => {
    if (!market) return;
    setName(market.name ?? "");
    setAddress(market.address ?? "");
    setLat(market.lat != null ? String(market.lat) : "");
    setLng(market.lng != null ? String(market.lng) : "");
    setIsActive(typeof market.is_active === "boolean" ? market.is_active : true);
    setIsFeatured(!!market.is_featured);
    setFeaturedBadge(market.featured_badge ?? "");
    setFeaturedHeadline(market.featured_headline ?? "");
    setFeaturedCopy(market.featured_copy ?? "");
    setIsManuallyClosed(!!market.is_manually_closed);
    setManualCloseComment(market.manual_close_comment ?? "");
    setUsesOperatingSchedule(!!market.uses_operating_schedule);
    setOperatingHours(normalizeOperatingHours(market.operating_hours));
  }, [market]);

  const [tab, setTab] = useState<SettingsTab>("general");

  const updateMarketM = useMutation({
    mutationFn: async () => {
      const payload = {
        name: name.trim(),
        address: address.trim() || null,
        lat: lat.trim() ? Number(lat) : null,
        lng: lng.trim() ? Number(lng) : null,
        uses_operating_schedule: usesOperatingSchedule,
        operating_hours: operatingHours,
        is_manually_closed: isManuallyClosed,
        manual_close_comment: isManuallyClosed ? manualCloseComment.trim() : null,
        ...(isAdmin
          ? {
              is_active: isActive,
              is_featured: isFeatured,
              featured_badge: featuredBadge.trim() || null,
              featured_headline: featuredHeadline.trim() || null,
              featured_copy: featuredCopy.trim() || null,
            }
          : {}),
      };
      const res = await api.patch(`/api/markets/${id}/settings`, payload);
      return res.data as Market;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["market-settings-source"] });
      await qc.invalidateQueries({ queryKey: ["markets"] });
      await qc.invalidateQueries({ queryKey: ["my-markets"] });
      await qc.invalidateQueries({ queryKey: ["public-markets"] });
    },
  });

  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [logoPreviewState, selectLogoPreview] = useFilePreview();
  const [bannerPreviewState, selectBannerPreview] = useFilePreview();
  // Only show the local preview while the selected file is still pending upload.
  const logoPreview = logoFile && logoPreviewState?.file === logoFile ? logoPreviewState.url : null;
  const bannerPreview = bannerFile && bannerPreviewState?.file === bannerFile ? bannerPreviewState.url : null;

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

  const uploadBannerM = useMutation({
    mutationFn: async () => {
      if (!bannerFile) throw new Error("Select a file first");
      const fd = new FormData();
      fd.append("banner", bannerFile);

      return (
        await api.post(`/api/markets/${id}/banner`, fd, {
          headers: { "Content-Type": "multipart/form-data" },
        })
      ).data;
    },
    onSuccess: async () => {
      setBannerFile(null);
      await qc.invalidateQueries({ queryKey: ["market-settings-source"] });
      await qc.invalidateQueries({ queryKey: ["markets"] });
      await qc.invalidateQueries({ queryKey: ["public-markets"] });
      await qc.invalidateQueries({ queryKey: ["public-market", String(id)] });
    },
  });

  const staffQ = useQuery({
    queryKey: ["market-staff", id],
    queryFn: async () => (await api.get(`/api/markets/${id}/staff`)).data as StaffUser[],
    enabled: Number.isFinite(id) && tab === "staff",
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

  const topError = marketErrorMessage(marketsQ.error);
  const updateError = marketErrorMessage(updateMarketM.error);
  const logoError = marketErrorMessage(uploadLogoM.error);
  const bannerError = marketErrorMessage(uploadBannerM.error);
  const staffError = marketErrorMessage(staffQ.error);
  const addStaffError = marketErrorMessage(addStaffM.error);
  const closureCommentMissing = isManuallyClosed && manualCloseComment.trim().length === 0;

  const updateOperatingHour = (day: string, patch: Partial<OperatingHour>) => {
    setOperatingHours((current) => current.map((entry) => (entry.day === day ? { ...entry, ...patch } : entry)));
  };

  const saveSettings = () =>
    updateMarketM.mutate(undefined, {
      onSuccess: () => toast.success("Market settings saved"),
      onError: (error) => toast.error(marketErrorMessage(error) ?? "Could not save settings"),
    });

  const saveDisabled = updateMarketM.isPending || !name.trim() || closureCommentMissing;

  const saveFooter = (
    <SaveFooter
      onSave={saveSettings}
      disabled={saveDisabled}
      pending={updateMarketM.isPending}
      label={isAdmin ? "Save changes" : "Save basic details"}
      error={updateError}
      hint={closureCommentMissing ? "Add a closure reason in the Hours tab before saving." : "Saves all settings on this page."}
    />
  );

  if (!Number.isFinite(id)) {
    return (
      <div className="space-y-6">
        <PageHeader title="Market settings" breadcrumbs={[{ label: "Markets", to: "/my-markets" }, { label: "Settings" }]} />
        <Alert variant="destructive">
          <AlertDescription>Invalid market id.</AlertDescription>
        </Alert>
      </div>
    );
  }

  const logoSrc = logoPreview ?? resolveMarketMediaUrl(market?.logo_url);
  const bannerSrc = bannerPreview ?? resolveMarketMediaUrl(market?.banner_url);

  return (
    <div className="space-y-6">
      <PageHeader
        title={market?.name ?? "Market settings"}
        description="Manage this market's details, branding, opening hours, team and promotion."
        breadcrumbs={[{ label: isAdmin ? "Markets" : "My markets", to: isAdmin ? "/markets" : "/my-markets" }, { label: market?.name ?? "Settings" }]}
        actions={
          <>
            <Button asChild variant="outline">
              <Link to={`/markets/${id}/dashboard`}>
                <LayoutDashboard />
                Dashboard
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link to={`/markets/${id}/items`}>
                <Package />
                Items
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link to={`/markets/${id}/promo-codes`}>
                <TicketPercent />
                Promo codes
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link to={`/m/${id}`} target="_blank" rel="noreferrer">
                <ExternalLink />
                View storefront
              </Link>
            </Button>
          </>
        }
      />

      {topError ? (
        <Alert variant="destructive">
          <AlertDescription>{topError}</AlertDescription>
        </Alert>
      ) : null}

      {marketsQ.isLoading ? (
        <LoadingState rows={4} />
      ) : !market ? (
        <EmptyState
          icon={Store}
          title="Market not found"
          description="This market is not in your accessible list. It may have been removed, or you may not have access to it."
          action={
            <Button asChild variant="outline">
              <Link to={isAdmin ? "/markets" : "/my-markets"}>Back to markets</Link>
            </Button>
          }
        />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryTile label="Market code" value={<span className="font-mono">{market.code}</span>} />
            <SummaryTile
              label="Visibility"
              value={market.operating_status?.label ?? (market.is_active ? "Publicly live" : "Hidden from marketplace")}
              hint={market.operating_status?.reason ?? undefined}
              badge={
                market.operating_status ? (
                  <StatusBadge tone={market.operating_status.is_open ? "success" : "destructive"} dot>
                    {market.operating_status.is_open ? "Open" : "Closed"}
                  </StatusBadge>
                ) : null
              }
            />
            <SummaryTile label="Promotion" value={market.is_featured ? market.featured_badge || "Promoted" : "Standard placement"} />
            <SummaryTile label="Catalog" value={`${market.active_items_count ?? 0} visible items`} />
          </div>

          <Tabs value={tab} onValueChange={(value) => setTab(value as SettingsTab)} className="gap-4">
            <div className="-mx-1 overflow-x-auto px-1 pb-1">
              <TabsList>
                <TabsTrigger value="general">
                  <Store />
                  General
                </TabsTrigger>
                <TabsTrigger value="branding">
                  <ImagePlus />
                  Branding
                </TabsTrigger>
                <TabsTrigger value="hours">
                  <Clock3 />
                  Hours
                </TabsTrigger>
                <TabsTrigger value="staff">
                  <Users />
                  Team
                </TabsTrigger>
                <TabsTrigger value="promotion">
                  <Sparkles />
                  Promotion
                </TabsTrigger>
                <TabsTrigger value="danger">
                  <ShieldAlert />
                  Danger zone
                </TabsTrigger>
              </TabsList>
            </div>

            {/* General */}
            <TabsContent value="general">
              <Card>
                <CardHeader>
                  <CardTitle>General</CardTitle>
                  <CardDescription>The market name and location used for deliveries and shown to customers.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="ms-name">Name</Label>
                    <Input id="ms-name" value={name} onChange={(e) => setName(e.target.value)} />
                    {!name.trim() ? <p className="text-xs text-destructive">A name is required.</p> : null}
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="ms-code">Code</Label>
                    <Input id="ms-code" value={market.code} disabled readOnly />
                    <p className="text-xs text-muted-foreground">The market code can only be changed by an admin from the Markets page.</p>
                  </div>
                  <div className="grid gap-2 sm:col-span-2">
                    <Label htmlFor="ms-address">Address</Label>
                    <Input id="ms-address" value={address} onChange={(e) => setAddress(e.target.value)} />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="ms-lat">Market latitude</Label>
                    <Input id="ms-lat" inputMode="decimal" value={lat} onChange={(e) => setLat(e.target.value)} placeholder="41.7151" />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="ms-lng">Market longitude</Label>
                    <Input id="ms-lng" inputMode="decimal" value={lng} onChange={(e) => setLng(e.target.value)} placeholder="44.8271" />
                  </div>
                </CardContent>
                {saveFooter}
              </Card>
            </TabsContent>

            {/* Branding */}
            <TabsContent value="branding">
              <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
                <div className="grid gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Market logo</CardTitle>
                      <CardDescription>A square image works best. It appears on the storefront and in market lists.</CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-4">
                      <div className="flex flex-wrap items-center gap-4">
                        <MarketLogo src={logoSrc} name={market.name} className="size-20" />
                        <div className="grid min-w-0 flex-1 gap-2">
                          <Label htmlFor="ms-logo">Choose image</Label>
                          <Input id="ms-logo" type="file" accept="image/*" onChange={(e) => {
                              const file = e.target.files?.[0] ?? null;
                              setLogoFile(file);
                              selectLogoPreview(file);
                            }} />
                          {logoFile ? <p className="truncate text-xs text-muted-foreground">Previewing {logoFile.name}. Upload to publish it.</p> : null}
                        </div>
                      </div>
                      {logoError ? (
                        <Alert variant="destructive">
                          <AlertDescription>{logoError}</AlertDescription>
                        </Alert>
                      ) : null}
                    </CardContent>
                    <CardFooter className="flex-wrap gap-3 border-t">
                      <Button
                        onClick={() =>
                          uploadLogoM.mutate(undefined, {
                            onSuccess: () => toast.success("Logo uploaded"),
                            onError: (error) => toast.error(marketErrorMessage(error) ?? "Logo upload failed"),
                          })
                        }
                        disabled={!logoFile || uploadLogoM.isPending}
                      >
                        {uploadLogoM.isPending ? <Spinner /> : <ImagePlus />}
                        {uploadLogoM.isPending ? "Uploading..." : "Upload logo"}
                      </Button>
                      {!isAdmin && (
                        <p className="text-sm text-muted-foreground">
                          You can upload branding here, but only admins can change market visibility and promotion settings.
                        </p>
                      )}
                    </CardFooter>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Market banner</CardTitle>
                      <CardDescription>A wide image shown at the top of the storefront and on market cards.</CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-4">
                      <div className="overflow-hidden rounded-lg border">
                        <MarketBanner src={bannerSrc} name={market.name} className="h-40" />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="ms-banner">Choose image</Label>
                        <Input id="ms-banner" type="file" accept="image/*" onChange={(e) => {
                            const file = e.target.files?.[0] ?? null;
                            setBannerFile(file);
                            selectBannerPreview(file);
                          }} />
                        {bannerFile ? <p className="truncate text-xs text-muted-foreground">Previewing {bannerFile.name}. Upload to publish it.</p> : null}
                      </div>
                      {bannerError ? (
                        <Alert variant="destructive">
                          <AlertDescription>{bannerError}</AlertDescription>
                        </Alert>
                      ) : null}
                    </CardContent>
                    <CardFooter className="border-t">
                      <Button
                        onClick={() =>
                          uploadBannerM.mutate(undefined, {
                            onSuccess: () => toast.success("Banner uploaded"),
                            onError: (error) => toast.error(marketErrorMessage(error) ?? "Banner upload failed"),
                          })
                        }
                        disabled={!bannerFile || uploadBannerM.isPending}
                      >
                        {uploadBannerM.isPending ? <Spinner /> : <ImagePlus />}
                        {uploadBannerM.isPending ? "Uploading..." : "Upload banner"}
                      </Button>
                    </CardFooter>
                  </Card>
                </div>

                <div className="grid content-start gap-2">
                  <div className="text-sm font-medium">Storefront preview</div>
                  <p className="text-xs text-muted-foreground">How your market card looks to customers, including unsaved images.</p>
                  <Card className="gap-0 overflow-hidden py-0">
                    <MarketBanner src={bannerSrc} name={market.name} className="h-32">
                      {isFeatured ? (
                        <StatusBadge tone="warning" className="bg-warning text-warning-foreground">
                          <Sparkles className="size-3" />
                          {featuredBadge.trim() || "Promoted"}
                        </StatusBadge>
                      ) : null}
                    </MarketBanner>
                    <div className="flex items-start gap-3 p-4">
                      <MarketLogo src={logoSrc} name={name || market.name} className="-mt-9 size-14 border-2 border-card bg-card shadow-sm" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-semibold">{name || market.name}</div>
                        <div className="truncate text-xs text-muted-foreground">{address || "No address yet"}</div>
                      </div>
                      {market.operating_status ? (
                        <StatusBadge tone={market.operating_status.is_open ? "success" : "destructive"} dot>
                          {market.operating_status.is_open ? "Open" : "Closed"}
                        </StatusBadge>
                      ) : null}
                    </div>
                    <div className="px-4 pb-4 text-sm text-muted-foreground">
                      <div className="line-clamp-2">{featuredHeadline || `Discover ${name || market.name}`}</div>
                      <div className="mt-2 text-xs">{market.active_items_count ?? 0} items available</div>
                    </div>
                  </Card>
                </div>
              </div>
            </TabsContent>

            {/* Hours */}
            <TabsContent value="hours">
              <Card>
                <CardHeader>
                  <CardTitle>Hours and manual closure</CardTitle>
                  <CardDescription>
                    Close immediately with a required reason, or let the weekly schedule control when the market is open.
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <ToggleRow
                      id="ms-schedule"
                      title="Use weekly schedule"
                      description="When off, the market is open all day unless manually closed."
                      checked={usesOperatingSchedule}
                      onCheckedChange={setUsesOperatingSchedule}
                    />
                    <div className={cn("grid gap-3 rounded-lg border p-4", isManuallyClosed ? "border-destructive/40 bg-destructive/5" : "bg-muted/30")}>
                      <ToggleRow
                        bare
                        id="ms-closed"
                        title="Temporarily close market"
                        description="Customers will still see the market, but it will show as closed."
                        checked={isManuallyClosed}
                        onCheckedChange={setIsManuallyClosed}
                      />
                      {isManuallyClosed ? (
                        <div className="grid gap-2">
                          <Label htmlFor="ms-close-reason">Closure reason</Label>
                          <Input
                            id="ms-close-reason"
                            value={manualCloseComment}
                            onChange={(e) => setManualCloseComment(e.target.value)}
                            placeholder="Example: Closed today for inventory count"
                            aria-invalid={closureCommentMissing}
                          />
                          {closureCommentMissing ? <p className="text-xs text-destructive">A reason is required while the market is closed.</p> : null}
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div className={cn("overflow-hidden rounded-lg border", !usesOperatingSchedule && "opacity-70")}>
                    <div className="hidden grid-cols-[140px_80px_1fr_1fr_110px] items-center gap-3 border-b bg-muted/40 px-4 py-2 text-xs font-medium text-muted-foreground md:grid">
                      <div>Day</div>
                      <div>Open</div>
                      <div>From</div>
                      <div>To</div>
                      <div className="text-right">Summary</div>
                    </div>
                    {operatingHours.map((entry) => (
                      <div
                        key={entry.day}
                        className="grid grid-cols-[1fr_auto] items-center gap-3 border-b px-4 py-3 last:border-b-0 md:grid-cols-[140px_80px_1fr_1fr_110px]"
                      >
                        <Label htmlFor={`ms-day-${entry.day}`} className="font-medium">
                          {dayLabel(entry.day)}
                        </Label>
                        <Switch
                          id={`ms-day-${entry.day}`}
                          checked={entry.enabled}
                          onCheckedChange={(checked) => updateOperatingHour(entry.day, { enabled: checked })}
                          disabled={!usesOperatingSchedule}
                        />
                        <div className="grid gap-1">
                          <Label htmlFor={`ms-open-${entry.day}`} className="text-xs text-muted-foreground md:sr-only">
                            Open
                          </Label>
                          <Input
                            id={`ms-open-${entry.day}`}
                            type="time"
                            value={entry.open}
                            onChange={(e) => updateOperatingHour(entry.day, { open: e.target.value })}
                            disabled={!usesOperatingSchedule || !entry.enabled}
                          />
                        </div>
                        <div className="grid gap-1">
                          <Label htmlFor={`ms-close-${entry.day}`} className="text-xs text-muted-foreground md:sr-only">
                            Close
                          </Label>
                          <Input
                            id={`ms-close-${entry.day}`}
                            type="time"
                            value={entry.close}
                            onChange={(e) => updateOperatingHour(entry.day, { close: e.target.value })}
                            disabled={!usesOperatingSchedule || !entry.enabled}
                          />
                        </div>
                        <div className="col-span-2 text-xs text-muted-foreground tabular-nums md:col-span-1 md:text-right md:text-sm">
                          {!usesOperatingSchedule ? "Ignored" : entry.enabled ? `${entry.open} - ${entry.close}` : "Closed"}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
                {saveFooter}
              </Card>
            </TabsContent>

            {/* Team */}
            <TabsContent value="staff">
              <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
                <Card className="h-fit">
                  <CardHeader>
                    <CardTitle>Add staff</CardTitle>
                    <CardDescription>Select a user and attach them to this market as staff.</CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="ms-staff-user">User</Label>
                      <Select value={staffUserId} onValueChange={setStaffUserId}>
                        <SelectTrigger id="ms-staff-user" className="w-full">
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
                    </div>
                    {addStaffError ? (
                      <Alert variant="destructive">
                        <AlertDescription>{addStaffError}</AlertDescription>
                      </Alert>
                    ) : null}
                    {assignableUsersQ.error ? (
                      <Alert variant="destructive">
                        <AlertDescription>Failed to load available users.</AlertDescription>
                      </Alert>
                    ) : null}
                  </CardContent>
                  <CardFooter className="border-t">
                    <Button
                      className="w-full"
                      onClick={() =>
                        addStaffM.mutate(undefined, {
                          onSuccess: () => toast.success("Staff member added"),
                          onError: (error) => toast.error(marketErrorMessage(error) ?? "Could not add staff"),
                        })
                      }
                      disabled={addStaffM.isPending || !staffUserId.trim()}
                    >
                      {addStaffM.isPending ? <Spinner /> : <UserPlus />}
                      {addStaffM.isPending ? "Adding..." : "Add staff"}
                    </Button>
                  </CardFooter>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Team</CardTitle>
                    <CardDescription>People who can manage orders and products for this market.</CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-3">
                    {staffError ? (
                      <Alert variant="destructive">
                        <AlertDescription>{staffError}</AlertDescription>
                      </Alert>
                    ) : null}

                    {staffQ.isLoading ? (
                      <LoadingState rows={2} />
                    ) : (staffQ.data ?? []).length === 0 ? (
                      <EmptyState compact icon={Users} title="No staff assigned yet" description="Add a user on the left to give them access to this market." />
                    ) : (
                      (staffQ.data ?? []).map((user) => (
                        <div key={user.id} className="flex flex-wrap items-center gap-3 rounded-lg border bg-muted/30 p-3">
                          <Avatar>
                            <AvatarFallback>{user.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <div className="truncate font-medium">{user.name}</div>
                            <div className="truncate text-sm text-muted-foreground">{user.email}</div>
                          </div>
                          <Badge variant="secondary" className="capitalize">
                            {user.pivot?.role ?? "staff"}
                          </Badge>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="destructive" size="sm" disabled={removeStaffM.isPending}>
                                <Trash2 />
                                Remove
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Remove {user.name}?</AlertDialogTitle>
                                <AlertDialogDescription>They will lose access to this market. You can add them again later.</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  variant="destructive"
                                  onClick={() =>
                                    removeStaffM.mutate(user.id, {
                                      onSuccess: () => toast.success(`${user.name} removed`),
                                      onError: (error) => toast.error(marketErrorMessage(error) ?? "Could not remove staff"),
                                    })
                                  }
                                >
                                  Remove
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Promotion */}
            <TabsContent value="promotion">
              <Card>
                <CardHeader>
                  <CardTitle>Promotion</CardTitle>
                  <CardDescription>
                    {isAdmin
                      ? "Feature this market on the public landing page and write the copy customers see."
                      : "Only admins can change promotion settings. Use the promotion studio to request a badge."}
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4">
                  <ToggleRow
                    id="ms-featured"
                    title="Promoted storefront"
                    description="Admins can feature this market on the public landing page."
                    checked={isFeatured}
                    onCheckedChange={setIsFeatured}
                    disabled={!isAdmin}
                  />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="grid gap-2">
                      <Label htmlFor="ms-badge">Featured badge</Label>
                      <Input id="ms-badge" value={featuredBadge} onChange={(e) => setFeaturedBadge(e.target.value)} placeholder="Promoted market" disabled={!isAdmin} />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="ms-headline">Featured headline</Label>
                      <Input
                        id="ms-headline"
                        value={featuredHeadline}
                        onChange={(e) => setFeaturedHeadline(e.target.value)}
                        placeholder="Fast nightly essentials"
                        disabled={!isAdmin}
                      />
                    </div>
                    <div className="grid gap-2 sm:col-span-2">
                      <Label htmlFor="ms-copy">Featured copy</Label>
                      <Input
                        id="ms-copy"
                        value={featuredCopy}
                        onChange={(e) => setFeaturedCopy(e.target.value)}
                        placeholder="Shown on the landing page when the storefront is promoted."
                        disabled={!isAdmin}
                      />
                    </div>
                  </div>
                  {!isAdmin ? (
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/30 p-4">
                      <p className="text-sm text-muted-foreground">
                        You can update branding and basic storefront details here. Only admins can activate or promote the market.
                      </p>
                      <Button asChild variant="outline">
                        <Link to="/badge-pricing">
                          <Megaphone />
                          Open promotion studio
                        </Link>
                      </Button>
                    </div>
                  ) : null}
                </CardContent>
                {saveFooter}
              </Card>
            </TabsContent>

            {/* Danger zone */}
            <TabsContent value="danger">
              <Card className="border-destructive/40">
                <CardHeader>
                  <CardTitle className="text-destructive">Danger zone</CardTitle>
                  <CardDescription>Changes here affect whether customers can find this market at all.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4">
                  <div className="flex items-center justify-between gap-4 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
                    <div className="min-w-0">
                      <Label htmlFor="ms-active" className="font-medium">
                        Storefront active
                      </Label>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Controls public availability. Turning this off hides the market from the marketplace.
                        {!isAdmin ? " Only admins can change this." : ""}
                      </p>
                    </div>
                    <Switch id="ms-active" checked={isActive} onCheckedChange={setIsActive} disabled={!isAdmin} />
                  </div>
                </CardContent>
                {saveFooter}
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}

function SummaryTile({ label, value, hint, badge }: { label: string; value: ReactNode; hint?: string; badge?: ReactNode }) {
  return (
    <Card className="gap-1 px-4 py-3 shadow-xs">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs font-medium text-muted-foreground">{label}</div>
        {badge}
      </div>
      <div className="truncate text-sm font-semibold">{value}</div>
      {hint ? <div className="line-clamp-2 text-xs text-muted-foreground">{hint}</div> : null}
    </Card>
  );
}

function ToggleRow({
  id,
  title,
  description,
  checked,
  onCheckedChange,
  disabled,
  bare,
}: {
  id: string;
  title: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  bare?: boolean;
}) {
  return (
    <div className={cn("flex items-center justify-between gap-4", !bare && "rounded-lg border bg-muted/30 p-4")}>
      <div className="min-w-0">
        <Label htmlFor={id} className="font-medium">
          {title}
        </Label>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} />
    </div>
  );
}

function SaveFooter({
  onSave,
  disabled,
  pending,
  label,
  error,
  hint,
}: {
  onSave: () => void;
  disabled: boolean;
  pending: boolean;
  label: string;
  error: string | null;
  hint: string;
}) {
  return (
    <CardFooter className="flex-col items-stretch gap-3 border-t sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 text-xs text-muted-foreground">
        {error ? <span className="text-destructive">{error}</span> : hint}
      </div>
      <Button onClick={onSave} disabled={disabled}>
        {pending ? <Spinner /> : null}
        {pending ? "Saving..." : label}
      </Button>
    </CardFooter>
  );
}
