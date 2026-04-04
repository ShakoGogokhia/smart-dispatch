import { useMemo, useState } from "react";
import { KeyRound, Mail, Shield, UserPlus, Users } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AxiosError } from "axios";

import { api } from "@/lib/api";
import { useMe } from "@/lib/useMe";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

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
    <div className="flex flex-wrap gap-2">
      {ROLE_OPTIONS.map((role) => {
        const active = value.includes(role);
        return (
          <button
            key={role}
            type="button"
            onClick={() =>
              onChange(active ? value.filter((entry) => entry !== role) : [...value, role])
            }
            className={[
              "rounded-full border px-4 py-2 text-sm font-medium transition",
              active
                ? "border-cyan-500 bg-cyan-600 text-white shadow-sm dark:border-cyan-400 dark:bg-cyan-500 dark:text-slate-950"
                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-100 dark:border-white/10 dark:bg-white/6 dark:text-slate-200 dark:hover:bg-white/10",
            ].join(" ")}
          >
            {ROLE_LABELS[role]}
          </button>
        );
      })}
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
    },
  });

  const sortedUsers = useMemo(
    () => [...(usersQ.data ?? [])].sort((a, b) => a.name.localeCompare(b.name)),
    [usersQ.data],
  );

  if (!isAdmin) {
    return (
      <Card className="rounded-[30px]">
        <CardContent className="p-8 text-sm text-slate-600">
          Only admins can manage users.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-6">
      <div className="intro-panel">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="section-kicker text-white/70">Administration</div>
            <h1 className="intro-title">Users</h1>
            <p className="intro-copy">
              Manage accounts, roles, and workspace access from the same admin-style layout used across the app.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="status-chip">{sortedUsers.length} users</span>
            <span className="status-chip">
              {sortedUsers.filter((user) => user.roles.includes("admin")).length} admins
            </span>
            <span className="status-chip">
              {sortedUsers.filter((user) => user.roles.includes("owner")).length} owners
            </span>
          </div>
        </div>
      </div>

      <section className="dashboard-card">
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <div className="section-kicker">Workspace Access</div>
            <CardTitle className="panel-title mt-2">User directory</CardTitle>
          </div>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button className="rounded-2xl">
                <UserPlus className="mr-2 h-4 w-4" />
                Add user
              </Button>
            </DialogTrigger>
            <DialogContent className="app-modal-shell sm:max-w-[min(760px,calc(100%-2rem))]">
              <DialogHeader>
                <div className="app-modal-header">
                  <div className="section-kicker">Create account</div>
                  <DialogTitle className="panel-title mt-2">Create user</DialogTitle>
                </div>
              </DialogHeader>
              <div className="app-modal-body">
                <div className="app-modal-layout">
                  <aside className="app-modal-sidebar">
                    <div className="app-modal-sidebar-sticky">
                      <div className="app-modal-preview">
                        <div className="section-kicker">Preview</div>
                        <div className="theme-ink mt-3 text-3xl font-semibold">
                          {name.trim() || "New user"}
                        </div>
                        <div className="theme-copy mt-2 text-sm leading-6">
                          {email.trim() || "user@workspace.com"}
                        </div>
                        <div className="mt-4 flex flex-wrap gap-2">
                          <span className="status-chip status-neutral">
                            {roles.length} role{roles.length === 1 ? "" : "s"}
                          </span>
                          <span className="status-chip status-neutral">
                            {password ? "Password ready" : "Set password"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </aside>
                  <div className="app-modal-main">
                    <div className="app-modal-card">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-cyan-700 dark:text-cyan-200" />
                        <Label className="field-label">Name</Label>
                      </div>
                      <Input value={name} onChange={(event) => setName(event.target.value)} className="input-shell mt-3" />
                    </div>
                    <div className="app-modal-card">
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-cyan-700 dark:text-cyan-200" />
                        <Label className="field-label">Email</Label>
                      </div>
                      <Input value={email} onChange={(event) => setEmail(event.target.value)} className="input-shell mt-3" />
                    </div>
                    <div className="app-modal-card">
                      <div className="flex items-center gap-2">
                        <KeyRound className="h-4 w-4 text-cyan-700 dark:text-cyan-200" />
                        <Label className="field-label">Password</Label>
                      </div>
                      <Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="input-shell mt-3" />
                    </div>
                    <div className="app-modal-card">
                      <Label className="field-label">Roles</Label>
                      <div className="mt-3">
                        <RolePicker value={roles} onChange={setRoles} />
                      </div>
                    </div>
                  </div>
                  {getErrorMessage(createUserM.error) && (
                    <div className="text-sm text-red-700">{getErrorMessage(createUserM.error)}</div>
                  )}
                </div>
              </div>
              <DialogFooter className="app-modal-footer">
                <Button
                  onClick={() => createUserM.mutate()}
                  disabled={createUserM.isPending || !name.trim() || !email.trim() || !password || roles.length === 0}
                >
                  {createUserM.isPending ? "Creating..." : "Create user"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent className="grid gap-5">
          <div className="data-grid">
            <div className="paper-panel-muted p-5">
              <div className="section-kicker">Total</div>
              <div className="theme-ink mt-3 text-3xl font-semibold">{sortedUsers.length}</div>
              <div className="theme-muted mt-2 text-sm">All registered users in the workspace.</div>
            </div>
            <div className="paper-panel-muted p-5">
              <div className="section-kicker">Admins</div>
              <div className="theme-ink mt-3 text-3xl font-semibold">
                {sortedUsers.filter((user) => user.roles.includes("admin")).length}
              </div>
              <div className="theme-muted mt-2 text-sm">Users with full platform access.</div>
            </div>
            <div className="paper-panel-muted p-5">
              <div className="section-kicker">Owners</div>
              <div className="theme-ink mt-3 text-3xl font-semibold">
                {sortedUsers.filter((user) => user.roles.includes("owner")).length}
              </div>
              <div className="theme-muted mt-2 text-sm">Accounts managing storefronts.</div>
            </div>
            <div className="paper-panel-muted p-5">
              <div className="section-kicker">Drivers</div>
              <div className="theme-ink mt-3 text-3xl font-semibold">
                {sortedUsers.filter((user) => user.roles.includes("driver")).length}
              </div>
              <div className="theme-muted mt-2 text-sm">Delivery accounts active in dispatch.</div>
            </div>
          </div>

          {usersQ.isLoading ? (
            <div className="paper-panel-muted p-6 text-sm text-slate-600 dark:text-slate-300">Loading users...</div>
          ) : usersQ.isError ? (
            <div className="paper-panel-muted p-6 text-sm text-red-700 dark:text-red-300">Failed to load users.</div>
          ) : (
            <div className="table-shell">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Roles</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-semibold">{user.name}</TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-2">
                          {user.roles.map((role) => (
                            <Badge key={role} variant="secondary" className="rounded-full">
                              {ROLE_LABELS[role as keyof typeof ROLE_LABELS] ?? role}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="secondary"
                          className="rounded-2xl"
                          onClick={() => {
                            setEditingUser(user);
                            setEditName(user.name);
                            setEditEmail(user.email);
                            setEditRoles(user.roles);
                            setEditPassword("");
                          }}
                        >
                          <Shield className="mr-2 h-4 w-4" />
                          Edit
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </section>

      <Dialog open={!!editingUser} onOpenChange={(open) => !open && setEditingUser(null)}>
        <DialogContent className="app-modal-shell sm:max-w-[min(760px,calc(100%-2rem))]">
          <DialogHeader>
            <div className="app-modal-header">
              <div className="section-kicker">Update account</div>
              <DialogTitle className="panel-title mt-2">Edit user</DialogTitle>
            </div>
          </DialogHeader>
          <div className="app-modal-body">
            <div className="app-modal-layout">
              <aside className="app-modal-sidebar">
                <div className="app-modal-sidebar-sticky">
                  <div className="app-modal-preview">
                    <div className="section-kicker">Preview</div>
                    <div className="theme-ink mt-3 text-3xl font-semibold">
                      {editName.trim() || editingUser?.name || "User"}
                    </div>
                    <div className="theme-copy mt-2 text-sm leading-6">
                      {editEmail.trim() || editingUser?.email || "user@workspace.com"}
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <span className="status-chip status-neutral">
                        {editRoles.length} role{editRoles.length === 1 ? "" : "s"}
                      </span>
                      <span className="status-chip status-neutral">
                        {editPassword ? "Password will update" : "Keep current password"}
                      </span>
                    </div>
                  </div>
                </div>
              </aside>
              <div className="app-modal-main">
                <div className="app-modal-card">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-cyan-700 dark:text-cyan-200" />
                    <Label className="field-label">Name</Label>
                  </div>
                  <Input value={editName} onChange={(event) => setEditName(event.target.value)} className="input-shell mt-3" />
                </div>
                <div className="app-modal-card">
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-cyan-700 dark:text-cyan-200" />
                    <Label className="field-label">Email</Label>
                  </div>
                  <Input value={editEmail} onChange={(event) => setEditEmail(event.target.value)} className="input-shell mt-3" />
                </div>
                <div className="app-modal-card">
                  <div className="flex items-center gap-2">
                    <KeyRound className="h-4 w-4 text-cyan-700 dark:text-cyan-200" />
                    <Label className="field-label">New password (optional)</Label>
                  </div>
                  <Input type="password" value={editPassword} onChange={(event) => setEditPassword(event.target.value)} className="input-shell mt-3" />
                </div>
                <div className="app-modal-card">
                  <Label className="field-label">Roles</Label>
                  <div className="mt-3">
                    <RolePicker value={editRoles} onChange={setEditRoles} />
                  </div>
                </div>
              </div>
              {getErrorMessage(updateUserM.error) && (
                <div className="text-sm text-red-700">{getErrorMessage(updateUserM.error)}</div>
              )}
            </div>
          </div>
          <DialogFooter className="app-modal-footer">
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
