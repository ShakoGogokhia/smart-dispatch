import { useMemo, useState } from "react";
import { Car, Crown, Search, Shield, ShieldCheck, Store, UserPlus, Users } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AxiosError } from "axios";
import { toast } from "sonner";

import { api } from "@/lib/api";
import { useMe } from "@/lib/useMe";
import { PageHeader } from "@/components/app/page-header";
import { StatCard, StatGrid } from "@/components/app/stat-card";
import { EmptyState } from "@/components/app/empty-state";
import { LoadingState } from "@/components/app/loading-state";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

type UserRecord = {
  id: number;
  name: string;
  email: string;
  roles: string[];
};

const ROLE_OPTIONS = ["admin", "owner", "staff", "customer", "driver"] as const;

const ROLE_LABELS: Record<(typeof ROLE_OPTIONS)[number], string> = {
  admin: "Admin",
  owner: "Owner",
  staff: "Staff",
  customer: "Customer",
  driver: "Driver",
};

function roleLabel(role: string) {
  return ROLE_LABELS[role as keyof typeof ROLE_LABELS] ?? role;
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

function getErrorMessage(error: unknown) {
  if (!error || typeof error !== "object") {
    return null;
  }

  const axiosError = error as AxiosError<{ message?: string }>;
  return axiosError.response?.data?.message ?? (error as Error | null)?.message ?? null;
}

function RolePicker({
  value,
  onChange,
}: {
  value: string[];
  onChange: (roles: string[]) => void;
}) {
  return (
    <ToggleGroup
      type="multiple"
      variant="outline"
      spacing={2}
      value={value}
      onValueChange={onChange}
      className="flex w-full flex-wrap"
    >
      {ROLE_OPTIONS.map((role) => (
        <ToggleGroupItem key={role} value={role} size="sm" className="data-[state=on]:border-primary data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
          {ROLE_LABELS[role]}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

function RoleBadges({ roles }: { roles: string[] }) {
  if (!roles.length) return <span className="text-xs text-muted-foreground">No roles</span>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {roles.map((role) => (
        <Badge key={role} variant={role === "admin" ? "default" : "secondary"}>
          {roleLabel(role)}
        </Badge>
      ))}
    </div>
  );
}

function UserFormFields({
  idPrefix,
  name,
  onName,
  email,
  onEmail,
  password,
  onPassword,
  passwordLabel,
  passwordHint,
  roles,
  onRoles,
}: {
  idPrefix: string;
  name: string;
  onName: (value: string) => void;
  email: string;
  onEmail: (value: string) => void;
  password: string;
  onPassword: (value: string) => void;
  passwordLabel: string;
  passwordHint?: string;
  roles: string[];
  onRoles: (value: string[]) => void;
}) {
  return (
    <div className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor={`${idPrefix}-name`}>Name</Label>
          <Input id={`${idPrefix}-name`} value={name} onChange={(event) => onName(event.target.value)} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`${idPrefix}-email`}>Email</Label>
          <Input id={`${idPrefix}-email`} type="email" value={email} onChange={(event) => onEmail(event.target.value)} placeholder="user@workspace.com" />
        </div>
      </div>
      <div className="grid gap-2">
        <Label htmlFor={`${idPrefix}-password`}>{passwordLabel}</Label>
        <Input id={`${idPrefix}-password`} type="password" value={password} onChange={(event) => onPassword(event.target.value)} />
        {passwordHint ? <p className="text-xs text-muted-foreground">{passwordHint}</p> : null}
      </div>
      <div className="grid gap-2">
        <Label>Roles</Label>
        <RolePicker value={roles} onChange={onRoles} />
        <p className="text-xs text-muted-foreground">
          {roles.length} role{roles.length === 1 ? "" : "s"} selected. At least one role is required.
        </p>
      </div>
    </div>
  );
}

export default function UsersPage() {
  const queryClient = useQueryClient();
  const meQ = useMe();
  const isAdmin = (meQ.data?.roles ?? []).includes("admin");

  const usersQ = useQuery({
    queryKey: ["users"],
    queryFn: async () => (await api.get("/api/users")).data as UserRecord[],
    enabled: isAdmin,
  });

  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [roles, setRoles] = useState<string[]>(["customer"]);

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
      toast.success("User created");
      setName("");
      setEmail("");
      setPassword("");
      setRoles(["customer"]);
    },
  });

  const [editingUser, setEditingUser] = useState<UserRecord | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editRoles, setEditRoles] = useState<string[]>([]);

  const updateUserM = useMutation({
    mutationFn: async () => {
      if (!editingUser) throw new Error("Select a user first");
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
      setEditingUser(null);
      setEditPassword("");
      toast.success("User updated");
    },
  });

  const sortedUsers = useMemo(
    () => [...(usersQ.data ?? [])].sort((a, b) => a.name.localeCompare(b.name)),
    [usersQ.data],
  );

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");

  const roleCount = (role: string) => sortedUsers.filter((user) => user.roles.includes(role)).length;

  const visibleUsers = useMemo(() => {
    const term = search.trim().toLowerCase();
    return sortedUsers.filter((user) => {
      if (roleFilter !== "all" && !user.roles.includes(roleFilter)) return false;
      if (!term) return true;
      return user.name.toLowerCase().includes(term) || user.email.toLowerCase().includes(term);
    });
  }, [sortedUsers, search, roleFilter]);

  const openEdit = (user: UserRecord) => {
    setEditingUser(user);
    setEditName(user.name);
    setEditEmail(user.email);
    setEditRoles(user.roles);
    setEditPassword("");
  };

  if (!isAdmin) {
    return (
      <div className="space-y-6">
        <PageHeader title="Users" />
        <EmptyState icon={Shield} title="Admins only" description="Only admins can manage users." />
      </div>
    );
  }

  const createError = getErrorMessage(createUserM.error);
  const updateError = getErrorMessage(updateUserM.error);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Users"
        description="Manage accounts, roles, and workspace access."
        actions={
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <UserPlus />
                Add user
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Create user</DialogTitle>
                <DialogDescription>
                  {name.trim() || email.trim()
                    ? `${name.trim() || "New user"} · ${email.trim() || "user@workspace.com"} · ${password ? "Password ready" : "Set password"}`
                    : "Create an account and choose what the person can access."}
                </DialogDescription>
              </DialogHeader>
              <UserFormFields
                idPrefix="new-user"
                name={name}
                onName={setName}
                email={email}
                onEmail={setEmail}
                password={password}
                onPassword={setPassword}
                passwordLabel="Password"
                roles={roles}
                onRoles={setRoles}
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
                <Button
                  onClick={() => createUserM.mutate()}
                  disabled={createUserM.isPending || !name.trim() || !email.trim() || !password || roles.length === 0}
                >
                  {createUserM.isPending ? "Creating..." : "Create user"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <StatGrid>
        <StatCard
          label="Total users"
          value={sortedUsers.length}
          icon={Users}
          hint="All registered users"
          onClick={() => setRoleFilter("all")}
          active={roleFilter === "all"}
        />
        <StatCard
          label="Admins"
          value={roleCount("admin")}
          icon={ShieldCheck}
          tone="primary"
          hint="Full platform access"
          onClick={() => setRoleFilter("admin")}
          active={roleFilter === "admin"}
        />
        <StatCard
          label="Owners"
          value={roleCount("owner")}
          icon={Crown}
          tone="warning"
          hint="Manage storefronts"
          onClick={() => setRoleFilter("owner")}
          active={roleFilter === "owner"}
        />
        <StatCard
          label="Drivers"
          value={roleCount("driver")}
          icon={Car}
          tone="info"
          hint="Delivery accounts"
          onClick={() => setRoleFilter("driver")}
          active={roleFilter === "driver"}
        />
      </StatGrid>

      <Card className="gap-0 overflow-hidden py-0">
        <div className="flex flex-col gap-3 border-b p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full lg:max-w-xs">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by name or email"
              className="pl-8"
              aria-label="Search users"
            />
          </div>
          <Tabs value={roleFilter} onValueChange={setRoleFilter} className="min-w-0">
            <div className="overflow-x-auto">
              <TabsList>
                <TabsTrigger value="all">All</TabsTrigger>
                {ROLE_OPTIONS.map((role) => (
                  <TabsTrigger key={role} value={role}>
                    {ROLE_LABELS[role]}
                    <span className="text-xs text-muted-foreground tabular-nums">{roleCount(role)}</span>
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>
          </Tabs>
        </div>

        {usersQ.isLoading ? (
          <LoadingState rows={4} className="p-4" />
        ) : usersQ.isError ? (
          <div className="p-4">
            <Alert variant="destructive">
              <AlertDescription>Failed to load users.</AlertDescription>
            </Alert>
          </div>
        ) : visibleUsers.length === 0 ? (
          <EmptyState
            compact
            icon={Store}
            title={sortedUsers.length ? "No matching users" : "No users yet"}
            description={sortedUsers.length ? "Try a different search or role filter." : "Add the first user to get started."}
            className="py-10"
          />
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4">User</TableHead>
                    <TableHead>Roles</TableHead>
                    <TableHead className="pr-4 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="pl-4">
                        <UserIdentity user={user} />
                      </TableCell>
                      <TableCell>
                        <RoleBadges roles={user.roles} />
                      </TableCell>
                      <TableCell className="pr-4 text-right">
                        <Button variant="outline" size="sm" onClick={() => openEdit(user)}>
                          <Shield />
                          Edit
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="divide-y md:hidden">
              {visibleUsers.map((user) => (
                <div key={user.id} className="grid gap-3 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <UserIdentity user={user} />
                    <Button variant="outline" size="sm" onClick={() => openEdit(user)}>
                      <Shield />
                      Edit
                    </Button>
                  </div>
                  <RoleBadges roles={user.roles} />
                </div>
              ))}
            </div>
          </>
        )}

        {!usersQ.isLoading && !usersQ.isError && sortedUsers.length > 0 ? (
          <div className="border-t px-4 py-3 text-xs text-muted-foreground tabular-nums">
            Showing {visibleUsers.length} of {sortedUsers.length} users
          </div>
        ) : null}
      </Card>

      <Dialog open={!!editingUser} onOpenChange={(open) => !open && setEditingUser(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit user</DialogTitle>
            <DialogDescription>
              {(editName.trim() || editingUser?.name || "User") + " · " + (editPassword ? "Password will update" : "Keep current password")}
            </DialogDescription>
          </DialogHeader>
          <UserFormFields
            idPrefix="edit-user"
            name={editName}
            onName={setEditName}
            email={editEmail}
            onEmail={setEditEmail}
            password={editPassword}
            onPassword={setEditPassword}
            passwordLabel="New password (optional)"
            passwordHint="Leave empty to keep the current password."
            roles={editRoles}
            onRoles={setEditRoles}
          />
          {updateError && (
            <Alert variant="destructive">
              <AlertDescription>{updateError}</AlertDescription>
            </Alert>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingUser(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => updateUserM.mutate()}
              disabled={!editingUser || updateUserM.isPending || !editName.trim() || !editEmail.trim() || editRoles.length === 0}
            >
              {updateUserM.isPending ? "Saving..." : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function UserIdentity({ user }: { user: UserRecord }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <Avatar>
        <AvatarFallback className="text-xs font-medium">{initials(user.name)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <div className="truncate font-medium">{user.name}</div>
        <div className="truncate text-xs text-muted-foreground">{user.email}</div>
      </div>
    </div>
  );
}
