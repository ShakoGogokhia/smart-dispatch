import { useState } from "react";
import type { ReactNode } from "react";
import { CarFront, Coffee, Navigation, PowerOff, Shield, Truck, UserRoundPlus, Users, Wifi } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AxiosError } from "axios";
import { toast } from "sonner";

import { api } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { useMe } from "@/lib/useMe";
import { PageHeader } from "@/components/app/page-header";
import { StatCard, StatGrid } from "@/components/app/stat-card";
import { EmptyState } from "@/components/app/empty-state";
import { LoadingState } from "@/components/app/loading-state";
import { StatusBadge, humanizeStatus } from "@/components/app/status-badge";
import type { Tone } from "@/components/app/status-badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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

const DRIVER_STATUS_TONES: Record<string, Tone> = {
  ONLINE: "success",
  ON_ROUTE: "info",
  BREAK: "warning",
  OFFLINE: "neutral",
};

function DriverStatusBadge({ status }: { status: string }) {
  return (
    <StatusBadge tone={DRIVER_STATUS_TONES[String(status).toUpperCase()] ?? "neutral"} dot>
      {humanizeStatus(status)}
    </StatusBadge>
  );
}

function initials(name?: string) {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

function FormField({ id, label, hint, children }: { id: string; label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function getErrorMessage(error: unknown) {
  if (!error || typeof error !== "object") {
    return null;
  }

  const axiosError = error as AxiosError<{ message?: string }>;
  return axiosError.response?.data?.message ?? (error as Error | null)?.message ?? null;
}

const text = {
  onlyAdmin: "Only admins can view this page.",
  title: "Drivers",
  description: "Driver accounts, their live status, assigned vehicles and the vehicle fleet.",
  vehicles: "Vehicles",
  addVehicle: "Add vehicle",
  name: "Name",
  type: "Type",
  capacity: "Capacity",
  maxStops: "Max stops",
  notAvailable: "N/A",
  status: "Status",
  vehicle: "Vehicle",
  shift: "Shift",
  addDriver: "Add driver",
  unassigned: "Unassigned",
  active: "Active",
  offShift: "Off shift",
  createVehicle: "Create vehicle",
  creating: "Creating...",
  createDriver: "Create driver",
  optionalVehicle: "Optional vehicle",
  email: "Email",
  password: "Password",
} as const;

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
      toast.success("Vehicle created");
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
      toast.success("Driver created");
      setDriverName("");
      setDriverEmail("");
      setDriverPassword("123456");
      setDriverVehicleId("");
    },
  });

  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  if (!isAdmin) {
    return (
      <div className="space-y-6">
        <PageHeader title={text.title} />
        <EmptyState icon={Shield} title="Admins only" description={text.onlyAdmin} />
      </div>
    );
  }

  const vehicleError = getErrorMessage(createVehicleM.error);
  const driverError = getErrorMessage(createDriverM.error);

  const drivers = driversQ.data ?? [];
  const vehicles = vehiclesQ.data ?? [];
  const countStatus = (status: string) => drivers.filter((driver) => String(driver.status).toUpperCase() === status).length;
  const visibleDrivers =
    statusFilter === "ALL" ? drivers : drivers.filter((driver) => String(driver.status).toUpperCase() === statusFilter);
  const toggleFilter = (status: string) => setStatusFilter((current) => (current === status ? "ALL" : status));

  return (
    <div className="space-y-6">
      <PageHeader
        title={text.title}
        description={text.description}
        actions={
          <>
            <Button variant="outline" onClick={() => setCreateVehicleOpen(true)}>
              <CarFront />
              {text.addVehicle}
            </Button>
            <Button onClick={() => setCreateDriverOpen(true)}>
              <UserRoundPlus />
              {text.addDriver}
            </Button>
          </>
        }
      />

      <StatGrid>
        <StatCard
          label="Total drivers"
          value={drivers.length}
          icon={Users}
          hint={`${drivers.filter((driver) => driver.active_shift).length} on shift`}
          onClick={() => setStatusFilter("ALL")}
          active={statusFilter === "ALL"}
        />
        <StatCard label="Online" value={countStatus("ONLINE")} icon={Wifi} tone="success" onClick={() => toggleFilter("ONLINE")} active={statusFilter === "ONLINE"} />
        <StatCard
          label="On delivery"
          value={countStatus("ON_ROUTE")}
          icon={Navigation}
          tone="info"
          hint={`${countStatus("BREAK")} on break`}
          onClick={() => toggleFilter("ON_ROUTE")}
          active={statusFilter === "ON_ROUTE"}
        />
        <StatCard label="Offline" value={countStatus("OFFLINE")} icon={PowerOff} onClick={() => toggleFilter("OFFLINE")} active={statusFilter === "OFFLINE"} />
      </StatGrid>

      <Tabs defaultValue="drivers" className="gap-4">
        <TabsList>
          <TabsTrigger value="drivers">
            {text.title}
            <span className="text-xs text-muted-foreground tabular-nums">{drivers.length}</span>
          </TabsTrigger>
          <TabsTrigger value="vehicles">
            {text.vehicles}
            <span className="text-xs text-muted-foreground tabular-nums">{vehicles.length}</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="drivers">
          <Card className="gap-0 overflow-hidden py-0">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
              <div className="min-w-0">
                <div className="text-base font-semibold">{text.title}</div>
                <p className="text-sm text-muted-foreground">Live status, assigned vehicle and current shift.</p>
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger size="sm" className="w-40" aria-label="Filter by status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All statuses</SelectItem>
                  <SelectItem value="ONLINE">Online</SelectItem>
                  <SelectItem value="ON_ROUTE">On route</SelectItem>
                  <SelectItem value="BREAK">Break</SelectItem>
                  <SelectItem value="OFFLINE">Offline</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {driversQ.isLoading ? (
              <LoadingState rows={3} className="p-4" />
            ) : driversQ.isError ? (
              <div className="p-4">
                <Alert variant="destructive">
                  <AlertDescription>Failed to load drivers.</AlertDescription>
                </Alert>
              </div>
            ) : visibleDrivers.length === 0 ? (
              <EmptyState
                compact
                icon={Truck}
                className="py-10"
                title={drivers.length ? "No drivers with this status" : "No drivers yet"}
                description={drivers.length ? "Choose another status filter." : "Create a driver account so dispatch can assign deliveries."}
                action={
                  drivers.length ? null : (
                    <Button size="sm" onClick={() => setCreateDriverOpen(true)}>
                      <UserRoundPlus />
                      {text.addDriver}
                    </Button>
                  )
                }
              />
            ) : (
              <>
                <div className="hidden overflow-x-auto md:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="pl-4">Driver</TableHead>
                        <TableHead>{text.status}</TableHead>
                        <TableHead>{text.vehicle}</TableHead>
                        <TableHead className="pr-4">{text.shift}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {visibleDrivers.map((driver) => (
                        <TableRow key={driver.id}>
                          <TableCell className="pl-4">
                            <DriverIdentity driver={driver} />
                          </TableCell>
                          <TableCell>
                            <DriverStatusBadge status={driver.status} />
                          </TableCell>
                          <TableCell>
                            <DriverVehicle vehicle={driver.vehicle} unassigned={text.unassigned} />
                          </TableCell>
                          <TableCell className="pr-4">
                            <DriverShift driver={driver} />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="divide-y md:hidden">
                  {visibleDrivers.map((driver) => (
                    <div key={driver.id} className="grid gap-3 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <DriverIdentity driver={driver} />
                        <DriverStatusBadge status={driver.status} />
                      </div>
                      <div className="grid grid-cols-2 gap-3 rounded-lg border bg-muted/30 p-3">
                        <div className="min-w-0">
                          <div className="text-xs text-muted-foreground">{text.vehicle}</div>
                          <DriverVehicle vehicle={driver.vehicle} unassigned={text.unassigned} />
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs text-muted-foreground">{text.shift}</div>
                          <DriverShift driver={driver} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="vehicles">
          <Card className="gap-0 overflow-hidden py-0">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
              <div className="min-w-0">
                <div className="text-base font-semibold">{text.vehicles}</div>
                <p className="text-sm text-muted-foreground">Fleet profiles with capacity and stop limits used by dispatch.</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => setCreateVehicleOpen(true)}>
                <CarFront />
                {text.addVehicle}
              </Button>
            </div>

            {vehiclesQ.isLoading ? (
              <LoadingState rows={3} className="p-4" />
            ) : vehiclesQ.isError ? (
              <div className="p-4">
                <Alert variant="destructive">
                  <AlertDescription>Failed to load vehicles.</AlertDescription>
                </Alert>
              </div>
            ) : vehicles.length === 0 ? (
              <EmptyState
                compact
                icon={CarFront}
                className="py-10"
                title="No vehicles yet"
                description="Add a vehicle so drivers can be assigned to it."
                action={
                  <Button size="sm" onClick={() => setCreateVehicleOpen(true)}>
                    <CarFront />
                    {text.addVehicle}
                  </Button>
                }
              />
            ) : (
              <>
                <div className="hidden overflow-x-auto md:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="pl-4">{text.name}</TableHead>
                        <TableHead>{text.type}</TableHead>
                        <TableHead>{text.capacity}</TableHead>
                        <TableHead className="pr-4">{text.maxStops}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {vehicles.map((vehicle) => (
                        <TableRow key={vehicle.id}>
                          <TableCell className="pl-4 font-medium">{vehicle.name}</TableCell>
                          <TableCell>{vehicle.type ? <Badge variant="secondary">{vehicle.type}</Badge> : text.notAvailable}</TableCell>
                          <TableCell className="tabular-nums">{vehicle.capacity || text.notAvailable}</TableCell>
                          <TableCell className="pr-4 tabular-nums">{vehicle.max_stops || text.notAvailable}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="divide-y md:hidden">
                  {vehicles.map((vehicle) => (
                    <div key={vehicle.id} className="flex items-start justify-between gap-3 p-4">
                      <div className="min-w-0">
                        <div className="truncate font-medium">{vehicle.name}</div>
                        <div className="text-xs text-muted-foreground tabular-nums">
                          {text.capacity}: {vehicle.capacity || text.notAvailable} · {text.maxStops}: {vehicle.max_stops || text.notAvailable}
                        </div>
                      </div>
                      <Badge variant="secondary">{vehicle.type || text.notAvailable}</Badge>
                    </div>
                  ))}
                </div>
              </>
            )}
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={createVehicleOpen} onOpenChange={setCreateVehicleOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{text.createVehicle}</DialogTitle>
            <DialogDescription>Give dispatch a clear vehicle profile with capacity and stop limits.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="vehicle-name" label={text.name}>
              <Input id="vehicle-name" value={vehicleName} onChange={(event) => setVehicleName(event.target.value)} placeholder="Van 01" />
            </FormField>
            <FormField id="vehicle-type" label={text.type} hint="e.g. van, car, bike">
              <Input id="vehicle-type" value={vehicleType} onChange={(event) => setVehicleType(event.target.value)} />
            </FormField>
            <FormField id="vehicle-capacity" label={text.capacity} hint="How many parcels or orders it can carry.">
              <Input id="vehicle-capacity" inputMode="numeric" value={vehicleCapacity} onChange={(event) => setVehicleCapacity(event.target.value)} />
            </FormField>
            <FormField id="vehicle-stops" label={text.maxStops} hint="Maximum stops per route.">
              <Input id="vehicle-stops" inputMode="numeric" value={vehicleStops} onChange={(event) => setVehicleStops(event.target.value)} />
            </FormField>
          </div>

          {vehicleError && (
            <Alert variant="destructive">
              <AlertDescription>{vehicleError}</AlertDescription>
            </Alert>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateVehicleOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => createVehicleM.mutate()} disabled={createVehicleM.isPending || !vehicleName.trim()}>
              {createVehicleM.isPending ? text.creating : text.createVehicle}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={createDriverOpen} onOpenChange={setCreateDriverOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{text.createDriver}</DialogTitle>
            <DialogDescription>Create the driver account and, optionally, assign a vehicle.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="driver-name" label={text.name}>
              <Input id="driver-name" value={driverName} onChange={(event) => setDriverName(event.target.value)} />
            </FormField>
            <FormField id="driver-email" label={text.email}>
              <Input id="driver-email" type="email" value={driverEmail} onChange={(event) => setDriverEmail(event.target.value)} placeholder="driver@email.com" />
            </FormField>
            <FormField id="driver-password" label={text.password} hint={driverPassword ? "Password ready" : "Set password"}>
              <Input id="driver-password" type="password" value={driverPassword} onChange={(event) => setDriverPassword(event.target.value)} />
            </FormField>
            <FormField id="driver-vehicle" label={text.vehicle} hint="Optional. Can be left empty.">
              <Select value={driverVehicleId} onValueChange={setDriverVehicleId}>
                <SelectTrigger id="driver-vehicle" className="w-full">
                  <SelectValue placeholder={text.optionalVehicle} />
                </SelectTrigger>
                <SelectContent>
                  {vehicles.map((vehicle) => (
                    <SelectItem key={vehicle.id} value={String(vehicle.id)}>
                      {vehicle.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          </div>

          {driverError && (
            <Alert variant="destructive">
              <AlertDescription>{driverError}</AlertDescription>
            </Alert>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDriverOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => createDriverM.mutate()}
              disabled={createDriverM.isPending || !driverName.trim() || !driverEmail.trim() || !driverPassword}
            >
              {createDriverM.isPending ? text.creating : text.createDriver}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DriverIdentity({ driver }: { driver: Driver }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <Avatar>
        <AvatarFallback className="text-xs font-medium">{initials(driver.user?.name)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <div className="truncate font-medium">{driver.user?.name}</div>
        <div className="truncate text-xs text-muted-foreground">{driver.user?.email}</div>
      </div>
    </div>
  );
}

function DriverVehicle({ vehicle, unassigned }: { vehicle?: Vehicle | null; unassigned: string }) {
  if (!vehicle) return <span className="text-sm text-muted-foreground">{unassigned}</span>;
  return (
    <div className="min-w-0">
      <div className="truncate text-sm font-medium">{vehicle.name}</div>
      {vehicle.type ? <div className="truncate text-xs text-muted-foreground">{vehicle.type}</div> : null}
    </div>
  );
}

function DriverShift({ driver }: { driver: Driver }) {
  if (!driver.active_shift) {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
        <Coffee className="size-3.5" />
        {text.offShift}
      </span>
    );
  }
  return (
    <div className="min-w-0">
      <StatusBadge tone="success">{text.active}</StatusBadge>
      <div className="mt-1 text-xs text-muted-foreground">since {formatDateTime(driver.active_shift.started_at)}</div>
    </div>
  );
}
