import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useMe } from "@/lib/useMe";

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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type UserLite = { id: number; name: string; email: string };
type Market = {
  id: number;
  name: string;
  code: string;
  address?: string | null;
  is_active: boolean;
  owner_user_id: number;
  owner?: UserLite;
};

export default function MarketsPage() {
  const qc = useQueryClient();
  const meQ = useMe();
  const isAdmin = (meQ.data?.roles ?? []).includes("admin");

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

  const owners = ownersQ.data ?? [];

  // ---- create market modal state
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [address, setAddress] = useState("");
  const [ownerId, setOwnerId] = useState<string>("");

  const createMarketM = useMutation({
    mutationFn: async () => {
      const payload = {
        name,
        code,
        address: address || null,
        owner_user_id: Number(ownerId),
      };
      return (await api.post("/api/markets", payload)).data as Market;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["markets"] });
      setCreateOpen(false);
      setName("");
      setCode("");
      setAddress("");
      setOwnerId("");
    },
  });

  // ---- assign owner modal state
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

  const markets = marketsQ.data ?? [];

  const createError =
    (createMarketM.error as any)?.response?.data?.message ??
    (createMarketM.error as any)?.message ??
    null;

  const assignError =
    (assignOwnerM.error as any)?.response?.data?.message ??
    (assignOwnerM.error as any)?.message ??
    null;

  const canCreate =
    name.trim().length >= 2 &&
    code.trim().length >= 2 &&
    ownerId &&
    Number.isFinite(Number(ownerId));

  if (!isAdmin) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Markets</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          You are not an admin.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle>Markets (Admin)</CardTitle>

          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button>Create Market</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Market</DialogTitle>
              </DialogHeader>

              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label>Name</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Market #1" />
                </div>

                <div className="grid gap-2">
                  <Label>Code (unique)</Label>
                  <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. MKT001" />
                </div>

                <div className="grid gap-2">
                  <Label>Address (optional)</Label>
                  <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Tbilisi..." />
                </div>

                <div className="grid gap-2">
                  <Label>Owner</Label>
                  <Select value={ownerId} onValueChange={setOwnerId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select owner user" />
                    </SelectTrigger>
                    <SelectContent>
                      {owners.map((u) => (
                        <SelectItem key={u.id} value={String(u.id)}>
                          {u.name} ({u.email})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {createError && <div className="text-sm text-red-600">{createError}</div>}
              </div>

              <DialogFooter>
                <Button
                  onClick={() => createMarketM.mutate()}
                  disabled={!canCreate || createMarketM.isPending}
                >
                  {createMarketM.isPending ? "Creating..." : "Create"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>

        <CardContent className="grid gap-4">
          {marketsQ.isLoading ? (
            <div className="text-sm text-muted-foreground">Loading...</div>
          ) : marketsQ.error ? (
            <div className="text-sm text-red-600">Failed to load markets</div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Owner</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {markets.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell>{m.id}</TableCell>
                      <TableCell className="font-medium">{m.name}</TableCell>
                      <TableCell>{m.code}</TableCell>
                      <TableCell>
                        {m.owner?.name ?? `User #${m.owner_user_id}`}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="secondary"
                          onClick={() => {
                            setAssignMarket(m);
                            setAssignOwnerId(String(m.owner_user_id));
                            setAssignOpen(true);
                          }}
                        >
                          Assign Owner
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}

                  {markets.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-sm text-muted-foreground">
                        No markets yet.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Assign owner modal */}
      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Owner</DialogTitle>
          </DialogHeader>

          <div className="grid gap-2">
            <div className="text-sm text-muted-foreground">
              Market: <span className="font-medium text-foreground">{assignMarket?.name}</span>
            </div>

            <Label>Owner</Label>
            <Select value={assignOwnerId} onValueChange={setAssignOwnerId}>
              <SelectTrigger>
                <SelectValue placeholder="Select owner user" />
              </SelectTrigger>
              <SelectContent>
                {owners.map((u) => (
                  <SelectItem key={u.id} value={String(u.id)}>
                    {u.name} ({u.email})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {assignError && <div className="text-sm text-red-600">{assignError}</div>}
          </div>

          <DialogFooter>
            <Button
              onClick={() => assignOwnerM.mutate()}
              disabled={!assignMarket || !assignOwnerId || assignOwnerM.isPending}
            >
              {assignOwnerM.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}