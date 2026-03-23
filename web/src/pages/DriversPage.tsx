import { useState } from "react";
import { CarFront, UserRoundPlus } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AxiosError } from "axios";

import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
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
  if (!error || typeof error !== "object") {
    return null;
  }

  const axiosError = error as AxiosError<{ message?: string }>;
  return axiosError.response?.data?.message ?? (error as Error | null)?.message ?? null;
}

export default function DriversPage() {
  const { t } = useI18n();
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
          {t("drivers.onlyAdmin")}
        </CardContent>
      </Card>
    );
  }

  const vehicleError = getErrorMessage(createVehicleM.error);
  const driverError = getErrorMessage(createDriverM.error);

  return (
    <div className="grid gap-6">
      <div className="intro-panel">
        <div className="section-kicker">{t("drivers.kicker")}</div>
        <h1 className="intro-title">{t("drivers.title")}</h1>
        <p className="intro-copy">{t("drivers.copy")}</p>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="rounded-[30px]">
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <CardTitle className="font-display text-3xl">{t("drivers.vehicles")}</CardTitle>
            <Dialog open={createVehicleOpen} onOpenChange={setCreateVehicleOpen}>
              <DialogTrigger asChild>
                <Button className="rounded-2xl">
                  <CarFront className="mr-2 h-4 w-4" />
                  {t("drivers.addVehicle")}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t("drivers.createVehicle")}</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4">
                  <div className="grid gap-2">
                    <Label>{t("auth.name")}</Label>
                    <Input value={vehicleName} onChange={(event) => setVehicleName(event.target.value)} />
                  </div>
                  <div className="grid gap-2">
                    <Label>{t("drivers.type")}</Label>
                    <Input value={vehicleType} onChange={(event) => setVehicleType(event.target.value)} />
                  </div>
                  <div className="grid gap-2">
                    <Label>{t("drivers.capacity")}</Label>
                    <Input value={vehicleCapacity} onChange={(event) => setVehicleCapacity(event.target.value)} />
                  </div>
                  <div className="grid gap-2">
                    <Label>{t("drivers.maxStops")}</Label>
                    <Input value={vehicleStops} onChange={(event) => setVehicleStops(event.target.value)} />
                  </div>
                  {vehicleError && <div className="text-sm text-red-700">{vehicleError}</div>}
                </div>
                <DialogFooter>
                  <Button onClick={() => createVehicleM.mutate()} disabled={createVehicleM.isPending || !vehicleName.trim()}>
                    {createVehicleM.isPending ? t("users.creating") : t("drivers.createVehicle")}
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
                    <TableHead>{t("auth.name")}</TableHead>
                    <TableHead>{t("drivers.type")}</TableHead>
                    <TableHead>{t("drivers.capacity")}</TableHead>
                    <TableHead>{t("drivers.maxStops")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(vehiclesQ.data ?? []).map((vehicle) => (
                    <TableRow key={vehicle.id}>
                      <TableCell className="font-semibold">{vehicle.name}</TableCell>
                      <TableCell>{vehicle.type || t("drivers.nA")}</TableCell>
                      <TableCell>{vehicle.capacity || t("drivers.nA")}</TableCell>
                      <TableCell>{vehicle.max_stops || t("drivers.nA")}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[30px]">
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <CardTitle className="font-display text-3xl">{t("nav.drivers")}</CardTitle>
            <Dialog open={createDriverOpen} onOpenChange={setCreateDriverOpen}>
              <DialogTrigger asChild>
                <Button className="rounded-2xl">
                  <UserRoundPlus className="mr-2 h-4 w-4" />
                  {t("drivers.addDriver")}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t("drivers.createDriver")}</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4">
                  <div className="grid gap-2">
                    <Label>{t("auth.name")}</Label>
                    <Input value={driverName} onChange={(event) => setDriverName(event.target.value)} />
                  </div>
                  <div className="grid gap-2">
                    <Label>{t("auth.email")}</Label>
                    <Input value={driverEmail} onChange={(event) => setDriverEmail(event.target.value)} />
                  </div>
                  <div className="grid gap-2">
                    <Label>{t("auth.password")}</Label>
                    <Input type="password" value={driverPassword} onChange={(event) => setDriverPassword(event.target.value)} />
                  </div>
                  <div className="grid gap-2">
                    <Label>{t("drivers.vehicle")}</Label>
                    <Select value={driverVehicleId} onValueChange={setDriverVehicleId}>
                      <SelectTrigger>
                        <SelectValue placeholder={t("drivers.optionalVehicle")} />
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
                    {createDriverM.isPending ? t("users.creating") : t("drivers.createDriver")}
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
                    <TableHead>{t("auth.name")}</TableHead>
                    <TableHead>{t("common.status")}</TableHead>
                    <TableHead>{t("drivers.vehicle")}</TableHead>
                    <TableHead>{t("drivers.shift")}</TableHead>
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
                      <TableCell>{driver.vehicle?.name || t("common.unassigned")}</TableCell>
                      <TableCell>{driver.active_shift ? t("drivers.active") : t("drivers.offShift")}</TableCell>
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
