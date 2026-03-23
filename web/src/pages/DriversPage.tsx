import { useState } from "react";
import { CarFront, UserRoundPlus } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AxiosError } from "axios";

import { api } from "@/lib/api";
import { useMe } from "@/lib/useMe";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Vehicle = {
  id: number;
  name: string;
  type?: string | null;
  capacity?: number | string | null;
  max_stops?: number | null;
};

type Driver = {
  id: number;
  status: string;
  user?: { name: string; email: string };
  vehicle?: Vehicle | null;
  active_shift?: { started_at: string } | null;
};

function getErrorMessage(error: unknown) {
  const axiosError = error as AxiosError<{ message?: string }>;
  return axiosError.response?.data?.message ?? (error as Error | null)?.message ?? null;
}

export default function DriversPage() {
  const queryClient = useQueryClient();
  const meQ = useMe();
  const isAdmin = (meQ.data?.roles ?? []).includes("admin");

  const driversQ = useQuery({
    queryKey: ["drivers"],
    queryFn: async () => (await api.get("/api/drivers")).data as Driver[],
    enabled: isAdmin,
  });

  const vehiclesQ = useQuery({
    queryKey: ["vehicles"],
    queryFn: async () => (await api.get("/api/vehicles")).data as Vehicle[],
    enabled: isAdmin,
  });

  const [createVehicleOpen, setCreateVehicleOpen] = useState(false);
  const [vehicleName, setVehicleName] = useState("");
  const [vehicleType, setVehicleType] = useState("van");
  const [vehicleCapacity, setVehicleCapacity] = useState("20");
  const [vehicleStops, setVehicleStops] = useState("10");

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
      setCreateVehicleOpen(false);
      setVehicleName("");
      setVehicleType("van");
      setVehicleCapacity("20");
      setVehicleStops("10");
    },
  });

  const [createDriverOpen, setCreateDriverOpen] = useState(false);
  const [driverName, setDriverName] = useState("");
  const [driverEmail, setDriverEmail] = useState("");
  const [driverPassword, setDriverPassword] = useState("123456");
  const [driverVehicleId, setDriverVehicleId] = useState("");

  const createDriverM = useMutation({
    mutationFn: async () =>
      (
        await api.post("/api/drivers", {
          name: driverName,
          email: driverEmail,
          password: driverPassword,
          vehicle_id: driverVehicleId ? Number(driverVehicleId) : null,
        })
      ).data as Driver,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["drivers"] }),
        queryClient.invalidateQueries({ queryKey: ["users"] }),
      ]);
      setCreateDriverOpen(false);
      setDriverName("");
      setDriverEmail("");
      setDriverPassword("123456");
      setDriverVehicleId("");
    },
  });

  if (!isAdmin) {
    return (
      <Card className="rounded-[30px]">
        <CardContent className="p-8 text-sm text-slate-600">
          Only admins can manage drivers and vehicles.
        </CardContent>
      </Card>
    );
  }

  const vehicleError = getErrorMessage(createVehicleM.error);
  const driverError = getErrorMessage(createDriverM.error);

  return (
    <div className="grid gap-6">
      <div className="rounded-[30px] bg-[linear-gradient(135deg,_rgba(14,165,233,0.15),_rgba(255,255,255,0.96)),linear-gradient(180deg,_#fdfeff_0%,_#f0f8ff_100%)] p-6">
        <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Fleet admin</div>
        <h1 className="font-display mt-2 text-4xl font-semibold tracking-tight text-slate-950">
          Drivers, vehicles, and delivery capacity
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
          Create driver accounts, connect them to vehicles, and monitor who is online and actively working.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="rounded-[30px]">
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <CardTitle className="font-display text-3xl">Vehicles</CardTitle>
            <Dialog open={createVehicleOpen} onOpenChange={setCreateVehicleOpen}>
              <DialogTrigger asChild>
                <Button className="rounded-2xl">
                  <CarFront className="mr-2 h-4 w-4" />
                  Add vehicle
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create vehicle</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4">
                  <div className="grid gap-2">
                    <Label>Name</Label>
                    <Input value={vehicleName} onChange={(event) => setVehicleName(event.target.value)} />
                  </div>
                  <div className="grid gap-2">
                    <Label>Type</Label>
                    <Input value={vehicleType} onChange={(event) => setVehicleType(event.target.value)} />
                  </div>
                  <div className="grid gap-2">
                    <Label>Capacity</Label>
                    <Input value={vehicleCapacity} onChange={(event) => setVehicleCapacity(event.target.value)} />
                  </div>
                  <div className="grid gap-2">
                    <Label>Max stops</Label>
                    <Input value={vehicleStops} onChange={(event) => setVehicleStops(event.target.value)} />
                  </div>
                  {vehicleError && <div className="text-sm text-red-700">{vehicleError}</div>}
                </div>
                <DialogFooter>
                  <Button onClick={() => createVehicleM.mutate()} disabled={createVehicleM.isPending || !vehicleName.trim()}>
                    {createVehicleM.isPending ? "Creating..." : "Create vehicle"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            <div className="overflow-hidden rounded-[24px] border border-slate-200/80">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Capacity</TableHead>
                    <TableHead>Max stops</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(vehiclesQ.data ?? []).map((vehicle) => (
                    <TableRow key={vehicle.id}>
                      <TableCell className="font-semibold">{vehicle.name}</TableCell>
                      <TableCell>{vehicle.type || "n/a"}</TableCell>
                      <TableCell>{vehicle.capacity || "n/a"}</TableCell>
                      <TableCell>{vehicle.max_stops || "n/a"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[30px]">
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <CardTitle className="font-display text-3xl">Drivers</CardTitle>
            <Dialog open={createDriverOpen} onOpenChange={setCreateDriverOpen}>
              <DialogTrigger asChild>
                <Button className="rounded-2xl">
                  <UserRoundPlus className="mr-2 h-4 w-4" />
                  Add driver
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create driver</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4">
                  <div className="grid gap-2">
                    <Label>Name</Label>
                    <Input value={driverName} onChange={(event) => setDriverName(event.target.value)} />
                  </div>
                  <div className="grid gap-2">
                    <Label>Email</Label>
                    <Input value={driverEmail} onChange={(event) => setDriverEmail(event.target.value)} />
                  </div>
                  <div className="grid gap-2">
                    <Label>Password</Label>
                    <Input type="password" value={driverPassword} onChange={(event) => setDriverPassword(event.target.value)} />
                  </div>
                  <div className="grid gap-2">
                    <Label>Vehicle</Label>
                    <Select value={driverVehicleId} onValueChange={setDriverVehicleId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Optional vehicle" />
                      </SelectTrigger>
                      <SelectContent>
                        {(vehiclesQ.data ?? []).map((vehicle) => (
                          <SelectItem key={vehicle.id} value={String(vehicle.id)}>
                            {vehicle.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {driverError && <div className="text-sm text-red-700">{driverError}</div>}
                </div>
                <DialogFooter>
                  <Button
                    onClick={() => createDriverM.mutate()}
                    disabled={createDriverM.isPending || !driverName.trim() || !driverEmail.trim() || !driverPassword}
                  >
                    {createDriverM.isPending ? "Creating..." : "Create driver"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            <div className="overflow-hidden rounded-[24px] border border-slate-200/80">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Vehicle</TableHead>
                    <TableHead>Shift</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(driversQ.data ?? []).map((driver) => (
                    <TableRow key={driver.id}>
                      <TableCell>
                        <div className="font-semibold">{driver.user?.name}</div>
                        <div className="text-xs text-slate-500">{driver.user?.email}</div>
                      </TableCell>
                      <TableCell>{driver.status}</TableCell>
                      <TableCell>{driver.vehicle?.name || "Unassigned"}</TableCell>
                      <TableCell>{driver.active_shift ? "Active" : "Off shift"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
