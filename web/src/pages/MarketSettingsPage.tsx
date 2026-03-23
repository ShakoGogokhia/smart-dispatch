import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/lib/api";
import { useMe } from "@/lib/useMe";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Market = {
  id: number;
  name: string;
  code: string;
  address?: string | null;
  is_active?: boolean;
  owner_user_id?: number;
  logo_path?: string | null;
  logo_url?: string | null; // if backend provides it
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

  // We don't have GET /api/markets/{id} route in your list.
  // So: admin loads all markets from /api/markets, owner loads /api/my/markets, then we pick by id.
  const marketsQ = useQuery({
    queryKey: ["market-settings-source", id, isAdmin],
    queryFn: async () => {
      const url = isAdmin ? "/api/markets" : "/api/my/markets";
      const list = (await api.get(url)).data as Market[];
      return list;
    },
    enabled: Number.isFinite(id) && !!meQ.data,
  });

  const market: Market | null = useMemo(() => {
    const list = marketsQ.data ?? [];
    return list.find((m) => Number(m.id) === id) ?? null;
  }, [marketsQ.data, id]);

  // Local editable state (filled after market loads)
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [isActive, setIsActive] = useState(true);

  // when market arrives, initialize local state once
  useEffect(() => {
    if (!market) return;
    setName((prev) => (prev ? prev : market.name ?? ""));
    setAddress((prev) => (prev ? prev : market.address ?? ""));
    setIsActive(typeof market.is_active === "boolean" ? market.is_active : true);
  }, [market?.id]);

  // Tabs (simple)
  const [tab, setTab] = useState<"details" | "staff">("details");

  // --- Update Market (PATCH /api/markets/{market}) currently admin-only in your routes
  const updateMarketM = useMutation({
    mutationFn: async () => {
      const payload = {
        name: name.trim(),
        address: address.trim() || null,
        is_active: isActive,
      };
      // Note: your backend has PATCH api/markets/{market}
      const res = await api.patch(`/api/markets/${id}`, payload);
      return res.data as Market;
    },
    onSuccess: async () => {
      // refresh lists
      await qc.invalidateQueries({ queryKey: ["market-settings-source"] });
    },
  });

  // --- Upload Logo (POST /api/markets/{market}/logo) (you may need to add backend route)
  const [logoFile, setLogoFile] = useState<File | null>(null);

  const uploadLogoM = useMutation({
    mutationFn: async () => {
      if (!logoFile) throw new Error("Select a file first");
      const fd = new FormData();
      fd.append("logo", logoFile);

      const res = await api.post(`/api/markets/${id}/logo`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      return res.data;
    },
    onSuccess: async () => {
      setLogoFile(null);
      await qc.invalidateQueries({ queryKey: ["market-settings-source"] });
    },
  });

  // --- Staff endpoints (you may need to add backend routes)
  const staffQ = useQuery({
    queryKey: ["market-staff", id],
    queryFn: async () => {
      const res = await api.get(`/api/markets/${id}/staff`);
      return res.data as StaffUser[];
    },
    enabled: Number.isFinite(id) && tab === "staff",
    retry: false,
  });

  const [staffUserId, setStaffUserId] = useState("");

  const assignableUsersQ = useQuery({
    queryKey: ["market-assignable-users", id],
    queryFn: async () => {
      const res = await api.get(`/api/markets/${id}/assignable-users`);
      return res.data as StaffUser[];
    },
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
    mutationFn: async (userId: number) => {
      return (await api.delete(`/api/markets/${id}/staff/${userId}`)).data;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["market-staff", id] });
    },
  });

  const topError =
    (marketsQ.error as any)?.response?.data?.message ??
    (marketsQ.error as any)?.message ??
    null;

  const updateError =
    (updateMarketM.error as any)?.response?.data?.message ??
    (updateMarketM.error as any)?.message ??
    null;

  const logoError =
    (uploadLogoM.error as any)?.response?.data?.message ??
    (uploadLogoM.error as any)?.message ??
    null;

  const staffError =
    (staffQ.error as any)?.response?.data?.message ??
    (staffQ.error as any)?.message ??
    null;

  const addStaffError =
    (addStaffM.error as any)?.response?.data?.message ??
    (addStaffM.error as any)?.message ??
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
      <Card>
        <CardHeader className="flex flex-col gap-2">
          <CardTitle>Market Settings</CardTitle>

          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Button asChild variant="secondary">
              <Link to={`/markets/${id}/items`}>Items</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link to={`/markets/${id}/promo-codes`}>Promo Codes</Link>
            </Button>

            <div className="ml-auto text-xs text-muted-foreground">
              {meQ.data ? `${meQ.data.name} (${roles.join(", ") || "no-role"})` : "Loading user..."}
            </div>
          </div>
        </CardHeader>

        <CardContent className="grid gap-4">
          {topError && <div className="text-sm text-red-600">{topError}</div>}

          {marketsQ.isLoading ? (
            <div className="text-sm text-muted-foreground">Loading...</div>
          ) : !market ? (
            <div className="text-sm text-red-600">
              Market not found in your accessible list. (If you are owner, make sure you see it in “My Markets”.)
            </div>
          ) : (
            <>
              {/* Tabs */}
              <div className="flex gap-2">
                <Button
                  variant={tab === "details" ? "default" : "secondary"}
                  onClick={() => setTab("details")}
                >
                  Details
                </Button>
                <Button
                  variant={tab === "staff" ? "default" : "secondary"}
                  onClick={() => setTab("staff")}
                >
                  Staff
                </Button>
              </div>

              {tab === "details" && (
                <div className="grid gap-6">
                  {/* Summary */}
                  <div className="rounded-md border p-4 grid gap-1">
                    <div className="text-sm">
                      <span className="text-muted-foreground">ID:</span> <span className="font-medium">{market.id}</span>
                    </div>
                    <div className="text-sm">
                      <span className="text-muted-foreground">Code:</span> <span className="font-medium">{market.code}</span>
                    </div>
                    {typeof market.is_active === "boolean" && (
                      <div className="text-sm">
                        <span className="text-muted-foreground">Active:</span>{" "}
                        <span className="font-medium">{market.is_active ? "Yes" : "No"}</span>
                      </div>
                    )}
                  </div>

                  {/* Edit */}
                  <div className="rounded-md border p-4 grid gap-4">
                    <div className="font-medium">Edit Market</div>

                    <div className="grid gap-2">
                      <Label>Name</Label>
                      <Input value={name} onChange={(e) => setName(e.target.value)} />
                    </div>

                    <div className="grid gap-2">
                      <Label>Address</Label>
                      <Input value={address} onChange={(e) => setAddress(e.target.value)} />
                    </div>

                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={isActive}
                        onChange={(e) => setIsActive(e.target.checked)}
                      />
                      <Label>Active</Label>
                    </div>

                    {updateError && <div className="text-sm text-red-600">{updateError}</div>}

                    <Button
                      onClick={() => updateMarketM.mutate()}
                      disabled={updateMarketM.isPending || !name.trim()}
                    >
                      {updateMarketM.isPending ? "Saving..." : "Save Changes"}
                    </Button>

                    <div className="text-xs text-muted-foreground">
                      Note: if this returns 403, your backend currently allows only admin to PATCH markets.
                    </div>
                  </div>

                  {/* Logo upload */}
                  <div className="rounded-md border p-4 grid gap-4">
                    <div className="font-medium">Market Logo</div>

                    {/* If you store URL in backend, you can show it here */}
                    {(market as any).logo_url && (
                      <img
                        src={(market as any).logo_url}
                        alt="Market logo"
                        className="h-20 w-20 rounded-md border object-cover"
                      />
                    )}

                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => setLogoFile(e.target.files?.[0] ?? null)}
                    />

                    {logoError && (
                      <div className="text-sm text-red-600">
                        {logoError}{" "}
                        <span className="text-xs text-muted-foreground">
                          If you get a 404, confirm the logo upload route exists on the backend.
                        </span>
                      </div>
                    )}

                    <Button
                      variant="secondary"
                      onClick={() => uploadLogoM.mutate()}
                      disabled={!logoFile || uploadLogoM.isPending}
                    >
                      {uploadLogoM.isPending ? "Uploading..." : "Upload Logo"}
                    </Button>
                  </div>
                </div>
              )}

              {tab === "staff" && (
                <div className="grid gap-6">
                  <div className="rounded-md border p-4 grid gap-3">
                    <div className="font-medium">Add Staff</div>

                    <div className="text-sm text-muted-foreground">
                      Select a user to add as staff for this market.
                    </div>

                    <div className="flex gap-2">
                      <div className="flex-1">
                        <select
                          value={staffUserId}
                          onChange={(e) => setStaffUserId(e.target.value)}
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        >
                          <option value="">Select user</option>
                          {(assignableUsersQ.data ?? []).map((user) => (
                            <option key={user.id} value={String(user.id)} disabled={user.is_owner}>
                              {user.name} ({user.email}){user.is_owner ? " - owner" : ""}
                            </option>
                          ))}
                        </select>
                      </div>
                      <Button
                        onClick={() => addStaffM.mutate()}
                        disabled={addStaffM.isPending || !staffUserId.trim()}
                      >
                        {addStaffM.isPending ? "Adding..." : "Add"}
                      </Button>
                    </div>

                    {addStaffError && <div className="text-sm text-red-600">{addStaffError}</div>}
                    {assignableUsersQ.error && (
                      <div className="text-sm text-red-600">
                        Failed to load available users for staff assignment.
                      </div>
                    )}
                  </div>

                  <div className="rounded-md border p-4 grid gap-3">
                    <div className="font-medium">Staff List</div>

                    {staffError && (
                      <div className="text-sm text-red-600">
                        {staffError}{" "}
                        <span className="text-xs text-muted-foreground">
                          If you get a 404, confirm the market staff route exists on the backend.
                        </span>
                      </div>
                    )}

                    {staffQ.isLoading ? (
                      <div className="text-sm text-muted-foreground">Loading staff...</div>
                    ) : (
                      <div className="overflow-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b">
                              <th className="py-2 text-left">ID</th>
                              <th className="py-2 text-left">Name</th>
                              <th className="py-2 text-left">Email</th>
                              <th className="py-2 text-left">Role</th>
                              <th className="py-2 text-right">Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(staffQ.data ?? []).map((u) => (
                              <tr key={u.id} className="border-b">
                                <td className="py-2">{u.id}</td>
                                <td className="py-2">{u.name}</td>
                                <td className="py-2">{u.email}</td>
                                <td className="py-2">{u.pivot?.role ?? "-"}</td>
                                <td className="py-2 text-right">
                                  <Button
                                    variant="destructive"
                                    onClick={() => removeStaffM.mutate(u.id)}
                                    disabled={removeStaffM.isPending}
                                  >
                                    Remove
                                  </Button>
                                </td>
                              </tr>
                            ))}

                            {(staffQ.data ?? []).length === 0 && (
                              <tr>
                                <td className="py-3 text-muted-foreground" colSpan={5}>
                                  No staff loaded (or endpoint not implemented yet).
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
