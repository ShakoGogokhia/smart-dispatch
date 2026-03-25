import { useEffect, useMemo, useState } from "react";
import { ImagePlus, Settings2, Sparkles, Users } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/lib/api";
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
  }, [market]);

  const [tab, setTab] = useState<"details" | "staff">("details");

  const updateMarketM = useMutation({
    mutationFn: async () => {
      const payload = {
        name: name.trim(),
        address: address.trim() || null,
        lat: lat.trim() ? Number(lat) : null,
        lng: lng.trim() ? Number(lng) : null,
        is_active: isActive,
        is_featured: isFeatured,
        featured_badge: featuredBadge.trim() || null,
        featured_headline: featuredHeadline.trim() || null,
        featured_copy: featuredCopy.trim() || null,
      };
      const res = await api.patch(`/api/markets/${id}`, payload);
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
                        <Label>Market latitude</Label>
                        <Input value={lat} onChange={(e) => setLat(e.target.value)} placeholder="41.7151" />
                      </div>
                      <div className="field-group">
                        <Label>Market longitude</Label>
                        <Input value={lng} onChange={(e) => setLng(e.target.value)} placeholder="44.8271" />
                      </div>
                      <div className="field-group">
                        <Label>Featured badge</Label>
                        <Input value={featuredBadge} onChange={(e) => setFeaturedBadge(e.target.value)} placeholder="Promoted market" />
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

                    {updateError && <div className="text-sm text-red-600">{updateError}</div>}

                    <div className="flex flex-wrap items-center gap-3">
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
        </>
      )}
    </div>
  );
}
