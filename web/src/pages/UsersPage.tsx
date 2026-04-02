import { useMemo, useState } from "react";
import { Shield, UserPlus } from "lucide-react";
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
              "rounded-full px-4 py-2 text-sm transition",
              active ? "bg-slate-950 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200",
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
        <h1 className="intro-title">Users</h1>
      </div>

      <Card className="rounded-[30px]">
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle className="font-display text-3xl">Users</CardTitle>
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
                  <DialogTitle className="panel-title">Create user</DialogTitle>
                </div>
              </DialogHeader>
              <div className="app-modal-body">
                <div className="app-modal-main">
                  <div className="grid gap-2">
                    <Label className="field-label">Name</Label>
                    <Input value={name} onChange={(event) => setName(event.target.value)} className="input-shell" />
                  </div>
                  <div className="grid gap-2">
                    <Label className="field-label">Email</Label>
                    <Input value={email} onChange={(event) => setEmail(event.target.value)} className="input-shell" />
                  </div>
                  <div className="grid gap-2">
                    <Label className="field-label">Password</Label>
                    <Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="input-shell" />
                  </div>
                  <div className="grid gap-2">
                    <Label className="field-label">Roles</Label>
                    <RolePicker value={roles} onChange={setRoles} />
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
        <CardContent>
          {usersQ.isLoading ? (
            <div className="text-sm text-slate-600">Loading users...</div>
          ) : usersQ.isError ? (
            <div className="text-sm text-red-700">Failed to load users.</div>
          ) : (
            <div className="overflow-hidden rounded-[24px] border border-slate-200/80">
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
      </Card>

      <Dialog open={!!editingUser} onOpenChange={(open) => !open && setEditingUser(null)}>
        <DialogContent className="app-modal-shell sm:max-w-[min(760px,calc(100%-2rem))]">
          <DialogHeader>
            <div className="app-modal-header">
              <DialogTitle className="panel-title">Edit user</DialogTitle>
            </div>
          </DialogHeader>
          <div className="app-modal-body">
            <div className="app-modal-main">
              <div className="grid gap-2">
                <Label className="field-label">Name</Label>
                <Input value={editName} onChange={(event) => setEditName(event.target.value)} className="input-shell" />
              </div>
              <div className="grid gap-2">
                <Label className="field-label">Email</Label>
                <Input value={editEmail} onChange={(event) => setEditEmail(event.target.value)} className="input-shell" />
              </div>
              <div className="grid gap-2">
                <Label className="field-label">New password (optional)</Label>
                <Input type="password" value={editPassword} onChange={(event) => setEditPassword(event.target.value)} className="input-shell" />
              </div>
              <div className="grid gap-2">
                <Label className="field-label">Roles</Label>
                <RolePicker value={editRoles} onChange={setEditRoles} />
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
