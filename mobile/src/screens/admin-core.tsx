import { useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import { AppShell } from "@/src/components/app-shell";
import { MarketCard } from "@/src/components/operations/shared";
import type { MarketCardAction } from "@/src/components/operations/shared";
import {
  Alert,
  AppText,
  Avatar,
  Badge,
  Button,
  Card,
  Chip,
  ChipRow,
  EmptyState,
  Input,
  Label,
  LoadingBlock,
  OptionCard,
  Panel,
  Row,
  SegmentedControl,
  Sheet,
  StatCard,
  StatGrid,
  humanizeStatus,
  useColors,
} from "@/src/components/ui";
import type { Tone } from "@/src/components/ui";
import { useProtectedAccess } from "@/src/hooks/use-protected-access";
import { api } from "@/src/lib/api";
import { getErrorMessage } from "@/src/lib/errors";
import { formatDateTime } from "@/src/lib/format";
import { setActiveMarketId } from "@/src/lib/storage";
import { usePreferences } from "@/src/providers/app-providers";
import type { DriverLite, MarketLite, UserLite, UserRecord, Vehicle } from "@/src/types/api";
import type { RootStackParamList } from "@/src/types/navigation";

type DriversProps = NativeStackScreenProps<RootStackParamList, "Drivers">;
type UsersProps = NativeStackScreenProps<RootStackParamList, "Users">;
type MarketsProps = NativeStackScreenProps<RootStackParamList, "Markets">;
type MyMarketsProps = NativeStackScreenProps<RootStackParamList, "MyMarkets">;
type Nav = MarketsProps["navigation"] | MyMarketsProps["navigation"];

const ROLE_OPTIONS = ["admin", "owner", "staff", "customer", "driver"] as const;

const ROLE_LABELS: Record<(typeof ROLE_OPTIONS)[number], string> = {
  admin: "Admin",
  owner: "Owner",
  staff: "Staff",
  customer: "Customer",
  driver: "Driver",
};

const ROLE_TONES: Record<string, Tone> = {
  admin: "primary",
  owner: "warning",
  staff: "info",
  driver: "success",
  customer: "neutral",
};

function roleLabel(role: string) {
  return ROLE_LABELS[role as keyof typeof ROLE_LABELS] ?? role;
}

function RolePicker({ value, onChange }: { value: string[]; onChange: (roles: string[]) => void }) {
  return (
    <View style={styles.field}>
      <Label>Roles</Label>
      <View style={styles.wrap}>
        {ROLE_OPTIONS.map((role) => {
          const active = value.includes(role);
          return (
            <Chip
              key={role}
              label={ROLE_LABELS[role]}
              icon={active ? "checkmark" : undefined}
              selected={active}
              onPress={() => onChange(active ? value.filter((entry) => entry !== role) : [...value, role])}
            />
          );
        })}
      </View>
      {value.length === 0 ? (
        <AppText variant="caption" tone="destructive">
          Select at least one role.
        </AppText>
      ) : null}
    </View>
  );
}

function OptionPicker<T extends { id: number }>({
  label,
  options,
  value,
  onChange,
  getLabel,
  getDescription,
  emptyText = "No options available.",
  allowNone,
}: {
  label: string;
  options: T[];
  value: string;
  onChange: (value: string) => void;
  getLabel: (option: T) => string;
  getDescription?: (option: T) => string | undefined;
  emptyText?: string;
  allowNone?: string;
}) {
  return (
    <View style={styles.field}>
      <Label>{label}</Label>
      {options.length === 0 ? (
        <Panel>
          <AppText variant="small" tone="muted">
            {emptyText}
          </AppText>
        </Panel>
      ) : (
        <View style={styles.optionList}>
          {allowNone ? <OptionCard selected={value === ""} onPress={() => onChange("")} title={allowNone} /> : null}
          {options.map((option) => (
            <OptionCard
              key={option.id}
              selected={value === String(option.id)}
              onPress={() => onChange(String(option.id))}
              title={getLabel(option)}
              description={getDescription?.(option)}
            />
          ))}
        </View>
      )}
    </View>
  );
}

function SheetFooter({ onCancel, onSubmit, submitLabel, loading, disabled, icon }: { onCancel: () => void; onSubmit: () => void; submitLabel: string; loading: boolean; disabled: boolean; icon?: "add" | "checkmark" }) {
  return (
    <>
      <Button variant="outline" onPress={onCancel} style={styles.flex}>
        Cancel
      </Button>
      <Button onPress={onSubmit} loading={loading} disabled={disabled} icon={icon} style={styles.flex}>
        {submitLabel}
      </Button>
    </>
  );
}

function marketActions(navigation: Nav, market: MarketLite): MarketCardAction[] {
  const id = String(market.id);
  const open = (target: "MarketItems" | "MarketPromoCodes" | "MarketSettings") => () => {
    void setActiveMarketId(id);
    navigation.navigate(target, { marketId: id });
  };
  return [
    { label: "Products", icon: "cube-outline", onPress: open("MarketItems") },
    { label: "Promo codes", icon: "pricetag-outline", onPress: open("MarketPromoCodes") },
    { label: "Settings", icon: "settings-outline", onPress: open("MarketSettings"), primary: true },
    { label: "Storefront", icon: "open-outline", onPress: () => navigation.navigate("PublicMarket", { marketId: id }) },
  ];
}

/* -------------------------------------------------------------------------------------------------
 * Markets (admin)
 * -----------------------------------------------------------------------------------------------*/

type MarketFilter = "all" | "live" | "hidden" | "featured";

export function MarketsScreen({ navigation }: MarketsProps) {
  const access = useProtectedAccess("Markets");
  const { language } = usePreferences();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignMarket, setAssignMarket] = useState<MarketLite | null>(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [address, setAddress] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [assignOwnerId, setAssignOwnerId] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<MarketFilter>("all");

  const isAdmin = (access.me?.roles ?? []).includes("admin");

  const marketsQ = useQuery({
    queryKey: ["markets"],
    queryFn: async () => (await api.get("/api/markets")).data as MarketLite[],
    enabled: access.ready && isAdmin,
  });

  const ownersQ = useQuery({
    queryKey: ["owners"],
    queryFn: async () => (await api.get("/api/users/owners")).data as UserLite[],
    enabled: access.ready && isAdmin,
  });

  const createMarketM = useMutation({
    mutationFn: async () =>
      (
        await api.post("/api/markets", {
          name,
          code,
          address: address.trim() || null,
          owner_user_id: Number(ownerId),
        })
      ).data as MarketLite,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["markets"] });
      setCreateOpen(false);
      setName("");
      setCode("");
      setAddress("");
      setOwnerId("");
    },
  });

  const assignOwnerM = useMutation({
    mutationFn: async () => {
      if (!assignMarket) {
        throw new Error("No market selected");
      }

      return (
        await api.post(`/api/markets/${assignMarket.id}/assign-owner`, {
          owner_user_id: Number(assignOwnerId),
        })
      ).data as MarketLite;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["markets"] });
      setAssignOpen(false);
      setAssignMarket(null);
      setAssignOwnerId("");
    },
  });

  const markets = useMemo(() => marketsQ.data ?? [], [marketsQ.data]);

  const visibleMarkets = useMemo(() => {
    const term = search.trim().toLowerCase();
    return markets.filter((market) => {
      if (statusFilter === "live" && market.is_active === false) return false;
      if (statusFilter === "hidden" && market.is_active !== false) return false;
      if (statusFilter === "featured" && !market.is_featured) return false;
      if (!term) return true;
      return [market.name, market.code, market.address ?? "", market.owner?.name ?? "", market.owner?.email ?? "", market.active_promo?.code ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(term);
    });
  }, [markets, search, statusFilter]);

  if (!access.ready) {
    return access.fallback;
  }

  if (!isAdmin) {
    return (
      <AppShell navigation={navigation} screenName="Markets" title="Markets" subtitle="Manage every market on the platform.">
        <EmptyState icon="lock-closed-outline" title="Admins only" description="You are not an admin, so the full market list is not available to you." />
      </AppShell>
    );
  }

  const liveCount = markets.filter((market) => market.is_active !== false).length;
  const featuredCount = markets.filter((market) => market.is_featured).length;
  const promoCount = markets.filter((market) => market.active_promo).length;
  const toggle = (value: MarketFilter) => setStatusFilter((current) => (current === value ? "all" : value));
  const filtersActive = search.trim() !== "" || statusFilter !== "all";
  const owners = ownersQ.data ?? [];

  return (
    <AppShell navigation={navigation} screenName="Markets" title="Markets" subtitle="Create markets, assign owners and manage storefronts.">
      <Row justify="flex-end">
        <Button icon="add" onPress={() => setCreateOpen(true)}>
          Create market
        </Button>
      </Row>

      <StatGrid>
        <StatCard label="Total markets" value={markets.length} icon="storefront-outline" tone="primary" onPress={() => setStatusFilter("all")} active={statusFilter === "all"} />
        <StatCard label="Live storefronts" value={liveCount} icon="checkmark-circle-outline" tone="success" onPress={() => toggle("live")} active={statusFilter === "live"} />
        <StatCard label="Promoted markets" value={featuredCount} icon="sparkles-outline" tone="warning" onPress={() => toggle("featured")} active={statusFilter === "featured"} />
        <StatCard label="Live promo codes" value={promoCount} icon="pricetag-outline" />
      </StatGrid>

      <View style={styles.filters}>
        <Input value={search} onChangeText={setSearch} icon="search" placeholder="Search markets, owners, promo code" />
        <ChipRow>
          <Chip label="All" selected={statusFilter === "all"} onPress={() => setStatusFilter("all")} />
          <Chip label="Live" selected={statusFilter === "live"} onPress={() => setStatusFilter("live")} />
          <Chip label="Hidden" selected={statusFilter === "hidden"} onPress={() => setStatusFilter("hidden")} />
          <Chip label="Promoted" selected={statusFilter === "featured"} onPress={() => setStatusFilter("featured")} />
        </ChipRow>
      </View>

      {marketsQ.isLoading ? (
        <LoadingBlock message="Loading markets..." />
      ) : marketsQ.isError ? (
        <Alert tone="destructive" title="Failed to load markets." description={getErrorMessage(marketsQ.error) ?? undefined} />
      ) : visibleMarkets.length === 0 ? (
        <EmptyState
          icon="storefront-outline"
          title="No markets found"
          description={markets.length === 0 ? "Create the first market to get started." : "No markets matched your search or filter."}
          action={
            markets.length === 0 ? (
              <Button icon="add" onPress={() => setCreateOpen(true)}>
                Create market
              </Button>
            ) : filtersActive ? (
              <Button
                variant="outline"
                onPress={() => {
                  setSearch("");
                  setStatusFilter("all");
                }}
              >
                Clear filters
              </Button>
            ) : undefined
          }
        />
      ) : (
        <View style={styles.list}>
          {visibleMarkets.map((market) => (
            <MarketCard
              key={market.id}
              market={market}
              language={language}
              actions={[
                ...marketActions(navigation, market),
                {
                  label: "Assign owner",
                  icon: "person-outline",
                  onPress: () => {
                    setAssignMarket(market);
                    setAssignOwnerId(String(market.owner_user_id ?? ""));
                    setAssignOpen(true);
                  },
                },
              ]}
            />
          ))}
        </View>
      )}

      <Sheet
        visible={createOpen}
        title="Create market"
        description="Set up a new market and connect it to an owner account."
        onClose={() => setCreateOpen(false)}
        footer={
          <SheetFooter
            onCancel={() => setCreateOpen(false)}
            onSubmit={() => createMarketM.mutate()}
            submitLabel="Create market"
            icon="add"
            loading={createMarketM.isPending}
            disabled={!name.trim() || !code.trim() || !ownerId}
          />
        }
      >
        <Input label="Name" value={name} onChangeText={setName} placeholder="Market name" />
        <Input label="Code" value={code} onChangeText={setCode} placeholder="MKT001" autoCapitalize="characters" />
        <Input label="Address" value={address} onChangeText={setAddress} placeholder="Optional address" icon="location-outline" />
        <OptionPicker label="Owner" options={owners} value={ownerId} onChange={setOwnerId} getLabel={(owner) => owner.name} getDescription={(owner) => owner.email} emptyText="No owner accounts found." />
        {createMarketM.error ? <Alert tone="destructive" title="Could not create market" description={getErrorMessage(createMarketM.error) ?? undefined} /> : null}
      </Sheet>

      <Sheet
        visible={assignOpen}
        title="Assign owner"
        description={assignMarket ? `Market: ${assignMarket.name}` : undefined}
        onClose={() => setAssignOpen(false)}
        footer={
          <SheetFooter
            onCancel={() => setAssignOpen(false)}
            onSubmit={() => assignOwnerM.mutate()}
            submitLabel="Save owner"
            icon="checkmark"
            loading={assignOwnerM.isPending}
            disabled={!assignMarket || !assignOwnerId}
          />
        }
      >
        <OptionPicker label="Owner" options={owners} value={assignOwnerId} onChange={setAssignOwnerId} getLabel={(owner) => owner.name} getDescription={(owner) => owner.email} emptyText="No owner accounts found." />
        {assignOwnerM.error ? <Alert tone="destructive" title="Could not assign owner" description={getErrorMessage(assignOwnerM.error) ?? undefined} /> : null}
      </Sheet>
    </AppShell>
  );
}

/* -------------------------------------------------------------------------------------------------
 * My markets
 * -----------------------------------------------------------------------------------------------*/

export function MyMarketsScreen({ navigation }: MyMarketsProps) {
  const access = useProtectedAccess("MyMarkets");
  const { language } = usePreferences();

  const marketsQ = useQuery({
    queryKey: ["my-markets"],
    queryFn: async () => (await api.get("/api/my/markets")).data as MarketLite[],
    enabled: access.ready,
  });

  if (!access.ready) {
    return access.fallback;
  }

  const markets = marketsQ.data ?? [];
  const featuredCount = markets.filter((market) => market.is_featured).length;
  const promoCount = markets.filter((market) => market.active_promo).length;

  return (
    <AppShell navigation={navigation} screenName="MyMarkets" title="My markets" subtitle="Manage products, promotions and settings for your markets.">
      <StatGrid>
        <StatCard label="Assigned markets" value={markets.length} icon="storefront-outline" tone="primary" note="Connected to your account" />
        <StatCard label="Promoted" value={featuredCount} icon="sparkles-outline" tone="warning" note="Using featured visibility" />
        <StatCard label="Live offers" value={promoCount} icon="pricetag-outline" tone="success" note="Promotion running now" />
      </StatGrid>

      {marketsQ.isLoading ? (
        <LoadingBlock message="Loading your markets..." />
      ) : marketsQ.isError ? (
        <Alert tone="destructive" title="Failed to load your markets." description={getErrorMessage(marketsQ.error) ?? undefined} />
      ) : markets.length === 0 ? (
        <EmptyState icon="storefront-outline" title="No markets yet" description="No markets are currently assigned to your account." />
      ) : (
        <View style={styles.list}>
          {markets.map((market) => (
            <MarketCard key={market.id} market={market} language={language} showOwner={false} actions={marketActions(navigation, market)} />
          ))}
        </View>
      )}
    </AppShell>
  );
}

/* -------------------------------------------------------------------------------------------------
 * Users
 * -----------------------------------------------------------------------------------------------*/

export function UsersScreen({ navigation }: UsersProps) {
  const access = useProtectedAccess("Users");
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRecord | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [roles, setRoles] = useState<string[]>(["customer"]);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editRoles, setEditRoles] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");

  const isAdmin = (access.me?.roles ?? []).includes("admin");

  const usersQ = useQuery({
    queryKey: ["users"],
    queryFn: async () => (await api.get("/api/users")).data as UserRecord[],
    enabled: access.ready && isAdmin,
  });

  const createUserM = useMutation({
    mutationFn: async () =>
      (
        await api.post("/api/users", {
          name,
          email,
          password,
          roles,
        })
      ).data as UserRecord,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["users"] });
      setCreateOpen(false);
      setName("");
      setEmail("");
      setPassword("");
      setRoles(["customer"]);
    },
  });

  const updateUserM = useMutation({
    mutationFn: async () => {
      if (!editingUser) {
        throw new Error("No user selected");
      }

      return (
        await api.patch(`/api/users/${editingUser.id}`, {
          name: editName,
          email: editEmail,
          password: editPassword || undefined,
          roles: editRoles,
        })
      ).data as UserRecord;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["users"] });
      setEditOpen(false);
      setEditingUser(null);
      setEditPassword("");
    },
  });

  const sortedUsers = useMemo(() => [...(usersQ.data ?? [])].sort((a, b) => a.name.localeCompare(b.name)), [usersQ.data]);

  const visibleUsers = useMemo(() => {
    const term = search.trim().toLowerCase();
    return sortedUsers.filter((user) => {
      if (roleFilter !== "all" && !user.roles.includes(roleFilter)) return false;
      if (!term) return true;
      return `${user.name} ${user.email}`.toLowerCase().includes(term);
    });
  }, [sortedUsers, search, roleFilter]);

  if (!access.ready) {
    return access.fallback;
  }

  if (!isAdmin) {
    return (
      <AppShell navigation={navigation} screenName="Users" title="Users" subtitle="User management is only available to admin accounts.">
        <EmptyState icon="lock-closed-outline" title="Admins only" description="Only admins can manage users and roles." />
      </AppShell>
    );
  }

  const countRole = (role: string) => sortedUsers.filter((user) => user.roles.includes(role)).length;
  const toggleRole = (role: string) => setRoleFilter((current) => (current === role ? "all" : role));
  const openEdit = (user: UserRecord) => {
    setEditingUser(user);
    setEditName(user.name);
    setEditEmail(user.email);
    setEditRoles(user.roles);
    setEditPassword("");
    setEditOpen(true);
  };

  return (
    <AppShell navigation={navigation} screenName="Users" title="Users" subtitle="Create accounts, edit details and assign roles.">
      <Row justify="flex-end">
        <Button icon="person-add-outline" onPress={() => setCreateOpen(true)}>
          Add user
        </Button>
      </Row>

      <StatGrid>
        <StatCard label="Total users" value={sortedUsers.length} icon="people-outline" onPress={() => setRoleFilter("all")} active={roleFilter === "all"} />
        <StatCard label="Admins" value={countRole("admin")} icon="shield-checkmark-outline" tone="primary" onPress={() => toggleRole("admin")} active={roleFilter === "admin"} />
        <StatCard label="Owners" value={countRole("owner")} icon="storefront-outline" tone="warning" onPress={() => toggleRole("owner")} active={roleFilter === "owner"} />
        <StatCard label="Drivers" value={countRole("driver")} icon="car-outline" tone="info" onPress={() => toggleRole("driver")} active={roleFilter === "driver"} />
      </StatGrid>

      <View style={styles.filters}>
        <Input value={search} onChangeText={setSearch} icon="search" placeholder="Search by name or email" autoCapitalize="none" />
        <ChipRow>
          <Chip label="All roles" selected={roleFilter === "all"} onPress={() => setRoleFilter("all")} />
          {ROLE_OPTIONS.map((role) => (
            <Chip key={role} label={ROLE_LABELS[role]} selected={roleFilter === role} onPress={() => setRoleFilter(role)} />
          ))}
        </ChipRow>
      </View>

      {usersQ.isLoading ? (
        <LoadingBlock message="Loading users..." />
      ) : usersQ.isError ? (
        <Alert tone="destructive" title="Failed to load users." description={getErrorMessage(usersQ.error) ?? undefined} />
      ) : visibleUsers.length === 0 ? (
        <EmptyState
          icon="people-outline"
          title={sortedUsers.length === 0 ? "No users yet" : "No users matched"}
          description={sortedUsers.length === 0 ? "Create the first account to get started." : "Try another search or role filter."}
        />
      ) : (
        <View style={styles.list}>
          {visibleUsers.map((user) => (
            <Card key={user.id} onPress={() => openEdit(user)}>
              <Row gap={12} align="flex-start">
                <Avatar name={user.name} size={40} />
                <View style={styles.flexShrink}>
                  <AppText variant="label" numberOfLines={1} style={styles.semibold}>
                    {user.name}
                  </AppText>
                  <AppText variant="caption" numberOfLines={1}>
                    {user.email}
                  </AppText>
                  <Row gap={6} wrap style={styles.mt6}>
                    {user.roles.length === 0 ? <Badge>No role</Badge> : null}
                    {user.roles.map((role) => (
                      <Badge key={role} tone={ROLE_TONES[role] ?? "neutral"}>
                        {roleLabel(role)}
                      </Badge>
                    ))}
                  </Row>
                </View>
                <Button size="sm" variant="outline" icon="create-outline" onPress={() => openEdit(user)}>
                  Edit
                </Button>
              </Row>
            </Card>
          ))}
        </View>
      )}

      <Sheet
        visible={createOpen}
        title="Add user"
        description="Create an account and choose its roles."
        onClose={() => setCreateOpen(false)}
        footer={
          <SheetFooter
            onCancel={() => setCreateOpen(false)}
            onSubmit={() => createUserM.mutate()}
            submitLabel="Create user"
            icon="add"
            loading={createUserM.isPending}
            disabled={!name.trim() || !email.trim() || !password || roles.length === 0}
          />
        }
      >
        <Input label="Name" value={name} onChangeText={setName} placeholder="Full name" />
        <Input label="Email" value={email} onChangeText={setEmail} placeholder="user@workspace.com" keyboardType="email-address" autoCapitalize="none" />
        <Input label="Password" value={password} onChangeText={setPassword} placeholder="Password" secureTextEntry />
        <RolePicker value={roles} onChange={setRoles} />
        {createUserM.error ? <Alert tone="destructive" title="Could not create user" description={getErrorMessage(createUserM.error) ?? undefined} /> : null}
      </Sheet>

      <Sheet
        visible={editOpen}
        title="Edit user"
        description={editingUser?.email}
        onClose={() => setEditOpen(false)}
        footer={
          <SheetFooter
            onCancel={() => setEditOpen(false)}
            onSubmit={() => updateUserM.mutate()}
            submitLabel="Save changes"
            icon="checkmark"
            loading={updateUserM.isPending}
            disabled={!editingUser || !editName.trim() || !editEmail.trim() || editRoles.length === 0}
          />
        }
      >
        <Input label="Name" value={editName} onChangeText={setEditName} placeholder="Full name" />
        <Input label="Email" value={editEmail} onChangeText={setEditEmail} placeholder="user@workspace.com" keyboardType="email-address" autoCapitalize="none" />
        <Input label="New password" value={editPassword} onChangeText={setEditPassword} placeholder="Leave empty to keep current" secureTextEntry />
        <RolePicker value={editRoles} onChange={setEditRoles} />
        {updateUserM.error ? <Alert tone="destructive" title="Could not save user" description={getErrorMessage(updateUserM.error) ?? undefined} /> : null}
      </Sheet>
    </AppShell>
  );
}

/* -------------------------------------------------------------------------------------------------
 * Drivers
 * -----------------------------------------------------------------------------------------------*/

const DRIVER_STATUS_TONES: Record<string, Tone> = {
  ONLINE: "success",
  ON_ROUTE: "info",
  BREAK: "warning",
  OFFLINE: "neutral",
};

function DriverCard({ driver, language }: { driver: DriverLite; language: "en" | "ka" }) {
  const c = useColors();
  const status = String(driver.status).toUpperCase();
  return (
    <Card>
      <Row gap={12} align="flex-start">
        <Avatar name={driver.user?.name || `Driver ${driver.id}`} size={40} />
        <View style={styles.flexShrink}>
          <AppText variant="label" numberOfLines={1} style={styles.semibold}>
            {driver.user?.name || `Driver #${driver.id}`}
          </AppText>
          <AppText variant="caption" numberOfLines={1}>
            {driver.user?.email || "No email"}
          </AppText>
        </View>
        <Badge tone={DRIVER_STATUS_TONES[status] ?? "neutral"} dot>
          {humanizeStatus(driver.status, language)}
        </Badge>
      </Row>
      <Panel style={styles.driverPanel}>
        <View style={styles.flex}>
          <AppText variant="caption">Vehicle</AppText>
          {driver.vehicle ? (
            <>
              <AppText variant="small" numberOfLines={1} style={styles.medium}>
                {driver.vehicle.name}
              </AppText>
              {driver.vehicle.type ? <AppText variant="caption">{driver.vehicle.type}</AppText> : null}
            </>
          ) : (
            <AppText variant="small" tone="muted">
              Unassigned
            </AppText>
          )}
        </View>
        <View style={styles.flex}>
          <AppText variant="caption">Shift</AppText>
          {driver.active_shift ? (
            <View style={styles.shift}>
              <Badge tone="success">Active</Badge>
              <AppText variant="caption">since {formatDateTime(driver.active_shift.started_at, language)}</AppText>
            </View>
          ) : (
            <Row gap={4}>
              <Ionicons name="cafe-outline" size={13} color={c.mutedForeground} />
              <AppText variant="small" tone="muted">
                Off shift
              </AppText>
            </Row>
          )}
        </View>
      </Panel>
    </Card>
  );
}

function VehicleList({ vehicles }: { vehicles: Vehicle[] }) {
  const c = useColors();
  return (
    <Card title="Vehicles" description="Fleet profiles with capacity and stop limits used by dispatch.">
      {vehicles.map((vehicle, index) => (
        <View key={vehicle.id}>
          {index > 0 ? <View style={[styles.hairline, { backgroundColor: c.border }]} /> : null}
          <View style={styles.vehicleRow}>
            <View style={styles.flexShrink}>
              <AppText variant="label" numberOfLines={1} style={styles.medium}>
                {vehicle.name}
              </AppText>
              <AppText variant="caption">
                Capacity: {vehicle.capacity || "n/a"} · Max stops: {vehicle.max_stops || "n/a"}
              </AppText>
            </View>
            <Badge>{vehicle.type || "n/a"}</Badge>
          </View>
        </View>
      ))}
    </Card>
  );
}

export function DriversScreen({ navigation }: DriversProps) {
  const access = useProtectedAccess("Drivers");
  const { language } = usePreferences();
  const queryClient = useQueryClient();
  const [vehicleOpen, setVehicleOpen] = useState(false);
  const [driverOpen, setDriverOpen] = useState(false);
  const [vehicleName, setVehicleName] = useState("");
  const [vehicleType, setVehicleType] = useState("van");
  const [vehicleCapacity, setVehicleCapacity] = useState("20");
  const [vehicleStops, setVehicleStops] = useState("10");
  const [driverName, setDriverName] = useState("");
  const [driverEmail, setDriverEmail] = useState("");
  const [driverPassword, setDriverPassword] = useState("123456");
  const [driverVehicleId, setDriverVehicleId] = useState("");
  const [tab, setTab] = useState<"drivers" | "vehicles">("drivers");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const isAdmin = (access.me?.roles ?? []).includes("admin");

  const driversQ = useQuery({
    queryKey: ["drivers"],
    queryFn: async () => (await api.get("/api/drivers")).data as DriverLite[],
    enabled: access.ready && isAdmin,
  });

  const vehiclesQ = useQuery({
    queryKey: ["vehicles"],
    queryFn: async () => (await api.get("/api/vehicles")).data as Vehicle[],
    enabled: access.ready && isAdmin,
  });

  const createVehicleM = useMutation({
    mutationFn: async () =>
      (
        await api.post("/api/vehicles", {
          name: vehicleName,
          type: vehicleType,
          capacity: Number(vehicleCapacity),
          max_stops: Number(vehicleStops),
        })
      ).data as Vehicle,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["vehicles"] });
      setVehicleOpen(false);
      setVehicleName("");
      setVehicleType("van");
      setVehicleCapacity("20");
      setVehicleStops("10");
    },
  });

  const createDriverM = useMutation({
    mutationFn: async () =>
      (
        await api.post("/api/drivers", {
          name: driverName,
          email: driverEmail,
          password: driverPassword,
          vehicle_id: driverVehicleId ? Number(driverVehicleId) : null,
        })
      ).data as DriverLite,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["drivers"] }),
        queryClient.invalidateQueries({ queryKey: ["users"] }),
      ]);
      setDriverOpen(false);
      setDriverName("");
      setDriverEmail("");
      setDriverPassword("123456");
      setDriverVehicleId("");
    },
  });

  if (!access.ready) {
    return access.fallback;
  }

  if (!isAdmin) {
    return (
      <AppShell navigation={navigation} screenName="Drivers" title="Drivers" subtitle="Fleet management is only available to admin accounts.">
        <EmptyState icon="lock-closed-outline" title="Admins only" description="Only admins can manage drivers and vehicles." />
      </AppShell>
    );
  }

  const drivers = driversQ.data ?? [];
  const vehicles = vehiclesQ.data ?? [];
  const countStatus = (status: string) => drivers.filter((driver) => String(driver.status).toUpperCase() === status).length;
  const visibleDrivers = statusFilter === "ALL" ? drivers : drivers.filter((driver) => String(driver.status).toUpperCase() === statusFilter);
  const toggleFilter = (status: string) => {
    setTab("drivers");
    setStatusFilter((current) => (current === status ? "ALL" : status));
  };

  return (
    <AppShell navigation={navigation} screenName="Drivers" title="Drivers" subtitle="Driver accounts, vehicles and delivery capacity.">
      <Row gap={8} justify="flex-end" wrap>
        <Button variant="outline" icon="car-outline" onPress={() => setVehicleOpen(true)}>
          Add vehicle
        </Button>
        <Button icon="person-add-outline" onPress={() => setDriverOpen(true)}>
          Add driver
        </Button>
      </Row>

      <StatGrid>
        <StatCard
          label="Total drivers"
          value={drivers.length}
          icon="people-outline"
          note={`${drivers.filter((driver) => driver.active_shift).length} on shift`}
          onPress={() => {
            setTab("drivers");
            setStatusFilter("ALL");
          }}
          active={statusFilter === "ALL"}
        />
        <StatCard label="Online" value={countStatus("ONLINE")} icon="wifi-outline" tone="success" onPress={() => toggleFilter("ONLINE")} active={statusFilter === "ONLINE"} />
        <StatCard
          label="On delivery"
          value={countStatus("ON_ROUTE")}
          icon="navigate-outline"
          tone="info"
          note={`${countStatus("BREAK")} on break`}
          onPress={() => toggleFilter("ON_ROUTE")}
          active={statusFilter === "ON_ROUTE"}
        />
        <StatCard label="Offline" value={countStatus("OFFLINE")} icon="power-outline" onPress={() => toggleFilter("OFFLINE")} active={statusFilter === "OFFLINE"} />
      </StatGrid>

      <SegmentedControl
        value={tab}
        onChange={setTab}
        options={[
          { value: "drivers", label: "Drivers", icon: "people-outline", count: drivers.length },
          { value: "vehicles", label: "Vehicles", icon: "car-outline", count: vehicles.length },
        ]}
      />

      {tab === "drivers" ? (
        <>
          <ChipRow>
            {["ALL", "ONLINE", "ON_ROUTE", "BREAK", "OFFLINE"].map((status) => (
              <Chip
                key={status}
                label={status === "ALL" ? "All statuses" : humanizeStatus(status, language)}
                selected={statusFilter === status}
                onPress={() => setStatusFilter(status)}
              />
            ))}
          </ChipRow>
          {driversQ.isLoading ? (
            <LoadingBlock message="Loading drivers..." />
          ) : driversQ.isError ? (
            <Alert tone="destructive" title="Failed to load drivers." />
          ) : visibleDrivers.length === 0 ? (
            <EmptyState
              icon="car-outline"
              title={drivers.length ? "No drivers with this status" : "No drivers yet"}
              description={drivers.length ? "Choose another status filter." : "Create a driver account so dispatch can assign deliveries."}
              action={
                drivers.length ? undefined : (
                  <Button size="sm" icon="person-add-outline" onPress={() => setDriverOpen(true)}>
                    Add driver
                  </Button>
                )
              }
            />
          ) : (
            <View style={styles.list}>
              {visibleDrivers.map((driver) => (
                <DriverCard key={driver.id} driver={driver} language={language} />
              ))}
            </View>
          )}
        </>
      ) : vehiclesQ.isLoading ? (
        <LoadingBlock message="Loading vehicles..." />
      ) : vehiclesQ.isError ? (
        <Alert tone="destructive" title="Failed to load vehicles." />
      ) : vehicles.length === 0 ? (
        <EmptyState
          icon="car-outline"
          title="No vehicles yet"
          description="Add a vehicle so drivers can be assigned to it."
          action={
            <Button size="sm" icon="car-outline" onPress={() => setVehicleOpen(true)}>
              Add vehicle
            </Button>
          }
        />
      ) : (
        <VehicleList vehicles={vehicles} />
      )}

      <Sheet
        visible={vehicleOpen}
        title="Add vehicle"
        description="Vehicles define capacity and stop limits for dispatch."
        onClose={() => setVehicleOpen(false)}
        footer={
          <SheetFooter
            onCancel={() => setVehicleOpen(false)}
            onSubmit={() => createVehicleM.mutate()}
            submitLabel="Create vehicle"
            icon="add"
            loading={createVehicleM.isPending}
            disabled={!vehicleName.trim()}
          />
        }
      >
        <Input label="Name" value={vehicleName} onChangeText={setVehicleName} placeholder="Van 01" />
        <Input label="Type" value={vehicleType} onChangeText={setVehicleType} placeholder="van" helper="e.g. van, car, bike" autoCapitalize="none" />
        <Row gap={12} align="flex-start">
          <View style={styles.flex}>
            <Input label="Capacity" value={vehicleCapacity} onChangeText={setVehicleCapacity} keyboardType="numeric" helper="Parcels per trip" />
          </View>
          <View style={styles.flex}>
            <Input label="Max stops" value={vehicleStops} onChangeText={setVehicleStops} keyboardType="numeric" helper="Per route" />
          </View>
        </Row>
        {createVehicleM.error ? <Alert tone="destructive" title="Could not create vehicle" description={getErrorMessage(createVehicleM.error) ?? undefined} /> : null}
      </Sheet>

      <Sheet
        visible={driverOpen}
        title="Add driver"
        description="Creates a driver login and optionally connects a vehicle."
        onClose={() => setDriverOpen(false)}
        footer={
          <SheetFooter
            onCancel={() => setDriverOpen(false)}
            onSubmit={() => createDriverM.mutate()}
            submitLabel="Create driver"
            icon="add"
            loading={createDriverM.isPending}
            disabled={!driverName.trim() || !driverEmail.trim() || !driverPassword}
          />
        }
      >
        <Input label="Name" value={driverName} onChangeText={setDriverName} placeholder="Driver name" />
        <Input label="Email" value={driverEmail} onChangeText={setDriverEmail} placeholder="driver@email.com" keyboardType="email-address" autoCapitalize="none" />
        <Input label="Password" value={driverPassword} onChangeText={setDriverPassword} placeholder="Password" secureTextEntry helper={driverPassword ? "Password ready" : "Set password"} />
        <OptionPicker
          label="Vehicle (optional)"
          options={vehicles}
          value={driverVehicleId}
          onChange={setDriverVehicleId}
          getLabel={(vehicle) => vehicle.name}
          getDescription={(vehicle) => [vehicle.type, vehicle.capacity ? `capacity ${vehicle.capacity}` : null].filter(Boolean).join(" · ") || undefined}
          emptyText="No vehicles yet. Create a vehicle first or leave this unassigned."
          allowNone="Unassigned"
        />
        {createDriverM.error ? <Alert tone="destructive" title="Could not create driver" description={getErrorMessage(createDriverM.error) ?? undefined} /> : null}
      </Sheet>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  flexShrink: { flexShrink: 1, flexGrow: 1 },
  semibold: { fontWeight: "600" },
  medium: { fontWeight: "500" },
  mt6: { marginTop: 6 },
  list: { gap: 12 },
  filters: { gap: 10 },
  field: { gap: 8 },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  optionList: { gap: 8 },
  driverPanel: { flexDirection: "row", gap: 12 },
  shift: { gap: 4, alignItems: "flex-start", marginTop: 2 },
  hairline: { height: StyleSheet.hairlineWidth * 2, marginBottom: 12 },
  vehicleRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
});
