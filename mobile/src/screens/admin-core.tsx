import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import { AppShell } from "@/src/components/app-shell";
import { AppButton, AppModal, EmptyBlock, HelperText, InputField, LoadingBlock, Pill, SectionCard, uiStyles } from "@/src/components/ui";
import { useProtectedAccess } from "@/src/hooks/use-protected-access";
import { api } from "@/src/lib/api";
import { getErrorMessage } from "@/src/lib/errors";
import { setActiveMarketId } from "@/src/lib/storage";
import type { DriverLite, MarketLite, UserLite, UserRecord, Vehicle } from "@/src/types/api";
import type { RootStackParamList } from "@/src/types/navigation";

type DriversProps = NativeStackScreenProps<RootStackParamList, "Drivers">;
type UsersProps = NativeStackScreenProps<RootStackParamList, "Users">;
type MarketsProps = NativeStackScreenProps<RootStackParamList, "Markets">;
type MyMarketsProps = NativeStackScreenProps<RootStackParamList, "MyMarkets">;

const ROLE_OPTIONS = ["admin", "owner", "staff", "customer", "driver"] as const;

function RolePicker({ value, onChange }: { value: string[]; onChange: (roles: string[]) => void }) {
  return (
    <View style={styles.choiceWrap}>
      {ROLE_OPTIONS.map((role) => {
        const active = value.includes(role);
        return (
          <Pressable
            key={role}
            onPress={() => onChange(active ? value.filter((entry) => entry !== role) : [...value, role])}
            style={[styles.choiceChip, active && styles.choiceChipActive]}
          >
            <Text style={styles.choiceChipText}>{role}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function OptionPicker<T extends { id: number }>({
  options,
  value,
  onChange,
  getLabel,
  emptyText = "No options available.",
}: {
  options: T[];
  value: string;
  onChange: (value: string) => void;
  getLabel: (option: T) => string;
  emptyText?: string;
}) {
  if (options.length === 0) {
    return <HelperText>{emptyText}</HelperText>;
  }

  return (
    <View style={uiStyles.listGap}>
      {options.map((option) => {
        const selected = value === String(option.id);
        return (
          <Pressable
            key={option.id}
            onPress={() => onChange(String(option.id))}
            style={[styles.optionRow, selected && styles.optionRowSelected]}
          >
            <Text style={styles.optionLabel}>{getLabel(option)}</Text>
            {selected ? <Pill tone="success">Selected</Pill> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

export function MarketsScreen({ navigation }: MarketsProps) {
  const access = useProtectedAccess("Markets");
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignMarket, setAssignMarket] = useState<MarketLite | null>(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [address, setAddress] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [assignOwnerId, setAssignOwnerId] = useState("");

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

  if (!access.ready) {
    return access.fallback;
  }

  if (!isAdmin) {
    return (
      <AppShell navigation={navigation} screenName="Markets" title="Markets" subtitle="All markets are only visible to admin accounts.">
        <EmptyBlock message="You are not an admin." />
      </AppShell>
    );
  }

  return (
    <AppShell navigation={navigation} screenName="Markets" title="Markets" subtitle="Admin market creation, ownership assignment, and quick access to market tools.">
      <SectionCard title="Admin markets">
        <AppButton onPress={() => setCreateOpen(true)}>Create market</AppButton>
      </SectionCard>

      {marketsQ.isLoading ? (
        <LoadingBlock message="Loading markets..." />
      ) : marketsQ.isError ? (
        <EmptyBlock message="Failed to load markets." />
      ) : (
        <View style={uiStyles.listGap}>
          {(marketsQ.data ?? []).map((market) => (
            <SectionCard
              key={market.id}
              title={market.name}
              subtitle={`${market.code} • ${market.address || "No address set"}`}
              right={<Pill tone={market.is_active === false ? "warning" : "success"}>{market.is_active === false ? "Inactive" : "Active"}</Pill>}
            >
              <HelperText>Owner: {market.owner?.name || `User #${market.owner_user_id}`}</HelperText>
              <View style={styles.row}>
                <AppButton
                  compact
                  onPress={() => {
                    void setActiveMarketId(String(market.id));
                    navigation.navigate("MarketSettings", { marketId: String(market.id) });
                  }}
                >
                  Open settings
                </AppButton>
                <AppButton
                  compact
                  variant="secondary"
                  onPress={() => {
                    setAssignMarket(market);
                    setAssignOwnerId(String(market.owner_user_id ?? ""));
                    setAssignOpen(true);
                  }}
                >
                  Assign owner
                </AppButton>
              </View>
            </SectionCard>
          ))}
        </View>
      )}

      <AppModal visible={createOpen} title="Create market" onClose={() => setCreateOpen(false)}>
        <InputField label="Name" value={name} onChangeText={setName} placeholder="Market name" />
        <InputField label="Code" value={code} onChangeText={setCode} placeholder="MKT001" />
        <InputField label="Address" value={address} onChangeText={setAddress} placeholder="Optional address" />
        <HelperText>Select owner</HelperText>
        <OptionPicker options={ownersQ.data ?? []} value={ownerId} onChange={setOwnerId} getLabel={(owner) => `${owner.name} (${owner.email})`} />
        {createMarketM.error ? <HelperText tone="danger">{getErrorMessage(createMarketM.error)}</HelperText> : null}
        <AppButton onPress={() => createMarketM.mutate()} disabled={createMarketM.isPending || !name.trim() || !code.trim() || !ownerId}>
          {createMarketM.isPending ? "Creating..." : "Create market"}
        </AppButton>
      </AppModal>

      <AppModal visible={assignOpen} title="Assign owner" onClose={() => setAssignOpen(false)}>
        <HelperText>{assignMarket ? `Market: ${assignMarket.name}` : "Select owner"}</HelperText>
        <OptionPicker options={ownersQ.data ?? []} value={assignOwnerId} onChange={setAssignOwnerId} getLabel={(owner) => `${owner.name} (${owner.email})`} />
        {assignOwnerM.error ? <HelperText tone="danger">{getErrorMessage(assignOwnerM.error)}</HelperText> : null}
        <AppButton onPress={() => assignOwnerM.mutate()} disabled={assignOwnerM.isPending || !assignMarket || !assignOwnerId}>
          {assignOwnerM.isPending ? "Saving..." : "Save owner"}
        </AppButton>
      </AppModal>
    </AppShell>
  );
}

export function MyMarketsScreen({ navigation }: MyMarketsProps) {
  const access = useProtectedAccess("MyMarkets");

  const marketsQ = useQuery({
    queryKey: ["my-markets"],
    queryFn: async () => (await api.get("/api/my/markets")).data as MarketLite[],
    enabled: access.ready,
  });

  if (!access.ready) {
    return access.fallback;
  }

  return (
    <AppShell navigation={navigation} screenName="MyMarkets" title="My Markets" subtitle="Choose a market to manage settings, items, team members, and promotions.">
      {marketsQ.isLoading ? (
        <LoadingBlock message="Loading your markets..." />
      ) : marketsQ.isError ? (
        <EmptyBlock message="Failed to load your markets." />
      ) : (marketsQ.data ?? []).length === 0 ? (
        <EmptyBlock message="No markets are currently assigned to your account." />
      ) : (
        <View style={uiStyles.listGap}>
          {(marketsQ.data ?? []).map((market) => (
            <SectionCard key={market.id} title={market.name} subtitle={`${market.code} • ${market.address || "No address set"}`}>
              <View style={styles.row}>
                <AppButton
                  compact
                  onPress={() => {
                    void setActiveMarketId(String(market.id));
                    navigation.navigate("MarketSettings", { marketId: String(market.id) });
                  }}
                >
                  Settings
                </AppButton>
                <AppButton
                  compact
                  variant="secondary"
                  onPress={() => {
                    void setActiveMarketId(String(market.id));
                    navigation.navigate("MarketItems", { marketId: String(market.id) });
                  }}
                >
                  Items
                </AppButton>
                <AppButton
                  compact
                  variant="secondary"
                  onPress={() => {
                    void setActiveMarketId(String(market.id));
                    navigation.navigate("MarketPromoCodes", { marketId: String(market.id) });
                  }}
                >
                  Promos
                </AppButton>
              </View>
            </SectionCard>
          ))}
        </View>
      )}
    </AppShell>
  );
}

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

  if (!access.ready) {
    return access.fallback;
  }

  if (!isAdmin) {
    return (
      <AppShell navigation={navigation} screenName="Users" title="Users" subtitle="User management is only available to admin accounts.">
        <EmptyBlock message="Only admins can manage users and roles." />
      </AppShell>
    );
  }

  const sortedUsers = [...(usersQ.data ?? [])].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <AppShell navigation={navigation} screenName="Users" title="Users" subtitle="Create users, edit accounts, and assign backend roles.">
      <SectionCard title="Admin users">
        <AppButton onPress={() => setCreateOpen(true)}>Add user</AppButton>
      </SectionCard>

      {usersQ.isLoading ? (
        <LoadingBlock message="Loading users..." />
      ) : usersQ.isError ? (
        <EmptyBlock message="Failed to load users." />
      ) : (
        <View style={uiStyles.listGap}>
          {sortedUsers.map((user) => (
            <SectionCard key={user.id} title={user.name} subtitle={user.email}>
              <View style={styles.choiceWrap}>
                {user.roles.map((role) => (
                  <Pill key={role}>{role}</Pill>
                ))}
              </View>
              <AppButton
                compact
                variant="secondary"
                onPress={() => {
                  setEditingUser(user);
                  setEditName(user.name);
                  setEditEmail(user.email);
                  setEditRoles(user.roles);
                  setEditPassword("");
                  setEditOpen(true);
                }}
              >
                Edit user
              </AppButton>
            </SectionCard>
          ))}
        </View>
      )}

      <AppModal visible={createOpen} title="Create user" onClose={() => setCreateOpen(false)}>
        <InputField label="Name" value={name} onChangeText={setName} placeholder="Name" />
        <InputField label="Email" value={email} onChangeText={setEmail} placeholder="Email" />
        <InputField label="Password" value={password} onChangeText={setPassword} placeholder="Password" secureTextEntry />
        <HelperText>Roles</HelperText>
        <RolePicker value={roles} onChange={setRoles} />
        {createUserM.error ? <HelperText tone="danger">{getErrorMessage(createUserM.error)}</HelperText> : null}
        <AppButton onPress={() => createUserM.mutate()} disabled={createUserM.isPending || !name.trim() || !email.trim() || !password || roles.length === 0}>
          {createUserM.isPending ? "Creating..." : "Create user"}
        </AppButton>
      </AppModal>

      <AppModal visible={editOpen} title="Edit user" onClose={() => setEditOpen(false)}>
        <InputField label="Name" value={editName} onChangeText={setEditName} placeholder="Name" />
        <InputField label="Email" value={editEmail} onChangeText={setEditEmail} placeholder="Email" />
        <InputField label="New password" value={editPassword} onChangeText={setEditPassword} placeholder="Optional" secureTextEntry />
        <HelperText>Roles</HelperText>
        <RolePicker value={editRoles} onChange={setEditRoles} />
        {updateUserM.error ? <HelperText tone="danger">{getErrorMessage(updateUserM.error)}</HelperText> : null}
        <AppButton onPress={() => updateUserM.mutate()} disabled={updateUserM.isPending || !editingUser || !editName.trim() || !editEmail.trim() || editRoles.length === 0}>
          {updateUserM.isPending ? "Saving..." : "Save changes"}
        </AppButton>
      </AppModal>
    </AppShell>
  );
}

export function DriversScreen({ navigation }: DriversProps) {
  const access = useProtectedAccess("Drivers");
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
        <EmptyBlock message="Only admins can manage drivers and vehicles." />
      </AppShell>
    );
  }

  return (
    <AppShell navigation={navigation} screenName="Drivers" title="Drivers" subtitle="Create driver accounts, connect vehicles, and monitor delivery capacity.">
      <SectionCard title="Fleet admin">
        <View style={styles.row}>
          <AppButton compact onPress={() => setVehicleOpen(true)}>
            Add vehicle
          </AppButton>
          <AppButton compact variant="secondary" onPress={() => setDriverOpen(true)}>
            Add driver
          </AppButton>
        </View>
      </SectionCard>

      <SectionCard title="Vehicles">
        {vehiclesQ.isLoading ? (
          <LoadingBlock message="Loading vehicles..." />
        ) : (
          <View style={uiStyles.listGap}>
            {(vehiclesQ.data ?? []).map((vehicle) => (
              <SectionCard key={vehicle.id} title={vehicle.name} subtitle={vehicle.type || "n/a"}>
                <HelperText>Capacity: {vehicle.capacity || "n/a"}</HelperText>
                <HelperText>Max stops: {vehicle.max_stops || "n/a"}</HelperText>
              </SectionCard>
            ))}
          </View>
        )}
      </SectionCard>

      <SectionCard title="Drivers">
        {driversQ.isLoading ? (
          <LoadingBlock message="Loading drivers..." />
        ) : (
          <View style={uiStyles.listGap}>
            {(driversQ.data ?? []).map((driver) => (
              <SectionCard key={driver.id} title={driver.user?.name || `Driver #${driver.id}`} subtitle={driver.user?.email || driver.status}>
                <HelperText>Status: {driver.status}</HelperText>
                <HelperText>Vehicle: {driver.vehicle?.name || "Unassigned"}</HelperText>
                <HelperText>Shift: {driver.active_shift ? "Active" : "Off shift"}</HelperText>
              </SectionCard>
            ))}
          </View>
        )}
      </SectionCard>

      <AppModal visible={vehicleOpen} title="Create vehicle" onClose={() => setVehicleOpen(false)}>
        <InputField label="Name" value={vehicleName} onChangeText={setVehicleName} placeholder="Vehicle name" />
        <InputField label="Type" value={vehicleType} onChangeText={setVehicleType} placeholder="van" />
        <InputField label="Capacity" value={vehicleCapacity} onChangeText={setVehicleCapacity} keyboardType="numeric" />
        <InputField label="Max stops" value={vehicleStops} onChangeText={setVehicleStops} keyboardType="numeric" />
        {createVehicleM.error ? <HelperText tone="danger">{getErrorMessage(createVehicleM.error)}</HelperText> : null}
        <AppButton onPress={() => createVehicleM.mutate()} disabled={createVehicleM.isPending || !vehicleName.trim()}>
          {createVehicleM.isPending ? "Creating..." : "Create vehicle"}
        </AppButton>
      </AppModal>

      <AppModal visible={driverOpen} title="Create driver" onClose={() => setDriverOpen(false)}>
        <InputField label="Name" value={driverName} onChangeText={setDriverName} placeholder="Driver name" />
        <InputField label="Email" value={driverEmail} onChangeText={setDriverEmail} placeholder="Driver email" />
        <InputField label="Password" value={driverPassword} onChangeText={setDriverPassword} placeholder="Password" secureTextEntry />
        <HelperText>Select vehicle (optional)</HelperText>
        <OptionPicker
          options={vehiclesQ.data ?? []}
          value={driverVehicleId}
          onChange={setDriverVehicleId}
          getLabel={(vehicle) => vehicle.name}
          emptyText="No vehicles yet. Create a vehicle first or leave this unassigned."
        />
        {createDriverM.error ? <HelperText tone="danger">{getErrorMessage(createDriverM.error)}</HelperText> : null}
        <AppButton onPress={() => createDriverM.mutate()} disabled={createDriverM.isPending || !driverName.trim() || !driverEmail.trim() || !driverPassword}>
          {createDriverM.isPending ? "Creating..." : "Create driver"}
        </AppButton>
      </AppModal>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  choiceWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  choiceChip: {
    minHeight: 40,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#d7deed",
    backgroundColor: "#eef2ff",
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  choiceChipActive: {
    backgroundColor: "#bae6fd",
    borderColor: "#38bdf8",
  },
  choiceChipText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0f172a",
  },
  optionRow: {
    minHeight: 54,
    borderWidth: 1,
    borderColor: "#d7deed",
    borderRadius: 16,
    backgroundColor: "#ffffff",
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  optionRowSelected: {
    backgroundColor: "#ecfeff",
    borderColor: "#06b6d4",
  },
  optionLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    color: "#0f172a",
  },
});
