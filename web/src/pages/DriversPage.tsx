import { useState } from "react";
import { CarFront, Gauge, Hash, KeyRound, Mail, UserRound, UserRoundPlus } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AxiosError } from "axios";

import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { useMe } from "@/lib/useMe";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
        <Card className="rounded-[30px] border-slate-200/80 dark:border-white/10">
          <CardHeader className="flex flex-row items-center justify-between gap-4 border-b border-slate-200/80 dark:border-white/10">
            <CardTitle className="font-display text-3xl">{t("drivers.vehicles")}</CardTitle>
            <Button className="rounded-2xl" onClick={() => setCreateVehicleOpen(true)}>
              <CarFront className="mr-2 h-4 w-4" />
              {t("drivers.addVehicle")}
            </Button>
          </CardHeader>
          <CardContent className="pt-6">
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

        <Card className="rounded-[30px] border-slate-200/80 dark:border-white/10">
          <CardHeader className="flex flex-row items-center justify-between gap-4 border-b border-slate-200/80 dark:border-white/10">
            <CardTitle className="font-display text-3xl">{t("nav.drivers")}</CardTitle>
            <Button className="rounded-2xl" onClick={() => setCreateDriverOpen(true)}>
              <UserRoundPlus className="mr-2 h-4 w-4" />
              {t("drivers.addDriver")}
            </Button>
          </CardHeader>
          <CardContent className="pt-6">
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

      <Dialog open={createVehicleOpen} onOpenChange={setCreateVehicleOpen}>
        <DialogContent className="grid-rows-[auto_minmax(0,1fr)_auto] gap-0 rounded-[30px] border border-slate-200/80 bg-[#f8f6f0] p-0 dark:border-white/10 dark:bg-[#0d1420] sm:max-w-[min(980px,calc(100%-2rem))]">
          <DialogHeader>
            <div className="border-b border-slate-200 bg-white/92 px-6 py-5 dark:border-white/10 dark:bg-[#131d2b]">
              <div className="section-kicker">{t("drivers.vehicles")}</div>
              <DialogTitle className="panel-title mt-2">{t("drivers.createVehicle")}</DialogTitle>
              <p className="theme-copy mt-2 text-sm leading-6">Give dispatch a clear vehicle profile with capacity and stop limits in one readable form.</p>
            </div>
          </DialogHeader>

          <div className="min-h-0 overflow-y-auto">
            <div className="grid gap-0 lg:grid-cols-[320px_minmax(0,1fr)]">
              <aside className="border-b border-slate-200 bg-white/94 p-5 lg:border-b-0 lg:border-r dark:border-white/10 dark:bg-[#131d2b]">
                <div className="grid gap-4 lg:sticky lg:top-0">
                  <ModalPreviewCard
                    kicker={t("drivers.vehicles")}
                    title={vehicleName || "New vehicle"}
                    subtitle={vehicleType || "Vehicle type"}
                    statusLabel={`${vehicleCapacity || "0"} ${t("drivers.capacity")}`}
                    metaLabel={`${vehicleStops || "0"} ${t("drivers.maxStops")}`}
                  />
                </div>
              </aside>

              <main className="grid gap-4 p-5 sm:p-6 md:grid-cols-2">
                <ModalFieldCard label={t("auth.name")} icon={CarFront}>
                  <Input value={vehicleName} onChange={(event) => setVehicleName(event.target.value)} className="input-shell" />
                </ModalFieldCard>
                <ModalFieldCard label={t("drivers.type")} icon={CarFront}>
                  <Input value={vehicleType} onChange={(event) => setVehicleType(event.target.value)} className="input-shell" />
                </ModalFieldCard>
                <ModalFieldCard label={t("drivers.capacity")} icon={Gauge}>
                  <Input value={vehicleCapacity} onChange={(event) => setVehicleCapacity(event.target.value)} className="input-shell" />
                </ModalFieldCard>
                <ModalFieldCard label={t("drivers.maxStops")} icon={Hash}>
                  <Input value={vehicleStops} onChange={(event) => setVehicleStops(event.target.value)} className="input-shell" />
                </ModalFieldCard>
              </main>
            </div>
          </div>

          {vehicleError && <div className="px-6 text-sm text-red-700">{vehicleError}</div>}

          <DialogFooter className="border-t border-slate-200 bg-slate-50/90 px-6 py-4 dark:border-white/10 dark:bg-white/4">
            <Button onClick={() => createVehicleM.mutate()} disabled={createVehicleM.isPending || !vehicleName.trim()}>
              {createVehicleM.isPending ? t("users.creating") : t("drivers.createVehicle")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={createDriverOpen} onOpenChange={setCreateDriverOpen}>
        <DialogContent className="grid-rows-[auto_minmax(0,1fr)_auto] gap-0 rounded-[30px] border border-slate-200/80 bg-[#f8f6f0] p-0 dark:border-white/10 dark:bg-[#0d1420] sm:max-w-[min(980px,calc(100%-2rem))]">
          <DialogHeader>
            <div className="border-b border-slate-200 bg-white/92 px-6 py-5 dark:border-white/10 dark:bg-[#131d2b]">
              <div className="section-kicker">{t("nav.drivers")}</div>
              <DialogTitle className="panel-title mt-2">{t("drivers.createDriver")}</DialogTitle>
              <p className="theme-copy mt-2 text-sm leading-6">Create the driver account and optional vehicle assignment in a layout that is actually easy to read.</p>
            </div>
          </DialogHeader>

          <div className="min-h-0 overflow-y-auto">
            <div className="grid gap-0 lg:grid-cols-[320px_minmax(0,1fr)]">
              <aside className="border-b border-slate-200 bg-white/94 p-5 lg:border-b-0 lg:border-r dark:border-white/10 dark:bg-[#131d2b]">
                <div className="grid gap-4 lg:sticky lg:top-0">
                  <ModalPreviewCard
                    kicker={t("nav.drivers")}
                    title={driverName || "New driver"}
                    subtitle={driverEmail || "driver@email.com"}
                    statusLabel={(vehiclesQ.data ?? []).find((vehicle) => String(vehicle.id) === driverVehicleId)?.name || t("drivers.optionalVehicle")}
                    metaLabel={driverPassword ? "Password ready" : "Set password"}
                  />
                </div>
              </aside>

              <main className="grid gap-4 p-5 sm:p-6 md:grid-cols-2">
                <ModalFieldCard label={t("auth.name")} icon={UserRound}>
                  <Input value={driverName} onChange={(event) => setDriverName(event.target.value)} className="input-shell" />
                </ModalFieldCard>
                <ModalFieldCard label={t("auth.email")} icon={Mail}>
                  <Input value={driverEmail} onChange={(event) => setDriverEmail(event.target.value)} className="input-shell" />
                </ModalFieldCard>
                <ModalFieldCard label={t("auth.password")} icon={KeyRound}>
                  <Input type="password" value={driverPassword} onChange={(event) => setDriverPassword(event.target.value)} className="input-shell" />
                </ModalFieldCard>
                <ModalFieldCard label={t("drivers.vehicle")} icon={CarFront}>
                  <Select value={driverVehicleId} onValueChange={setDriverVehicleId}>
                    <SelectTrigger className="input-shell w-full">
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
                </ModalFieldCard>
              </main>
            </div>
          </div>

          {driverError && <div className="px-6 text-sm text-red-700">{driverError}</div>}

          <DialogFooter className="border-t border-slate-200 bg-slate-50/90 px-6 py-4 dark:border-white/10 dark:bg-white/4">
            <Button
              onClick={() => createDriverM.mutate()}
              disabled={createDriverM.isPending || !driverName.trim() || !driverEmail.trim() || !driverPassword}
            >
              {createDriverM.isPending ? t("users.creating") : t("drivers.createDriver")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ModalPreviewCard({
  kicker,
  title,
  subtitle,
  statusLabel,
  metaLabel,
}: {
  kicker: string;
  title: string;
  subtitle: string;
  statusLabel: string;
  metaLabel: string;
}) {
  return (
    <div className="rounded-[26px] border border-slate-200 bg-[#f7f4ec] p-5 dark:border-white/10 dark:bg-[#0f1825]">
      <div className="section-kicker">{kicker}</div>
      <div className="theme-ink mt-3 text-3xl font-semibold">{title}</div>
      <div className="theme-copy mt-2 text-sm leading-6">{subtitle}</div>
      <div className="mt-4 flex flex-wrap gap-2">
        <span className="status-chip status-neutral">{statusLabel}</span>
        <span className="status-chip status-neutral">{metaLabel}</span>
      </div>
    </div>
  );
}

function ModalFieldCard({
  label,
  icon: Icon,
  children,
}: {
  label: string;
  icon: typeof CarFront;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-[24px] border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-[#131d2b]">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-cyan-700 dark:text-cyan-200" />
        <Label className="field-label">{label}</Label>
      </div>
      <div className="mt-3">{children}</div>
    </div>
  );
}
