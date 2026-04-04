import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  BarChart3,
  Compass,
  Home,
  LogOut,
  Map,
  Package,
  PanelLeftOpen,
  ShoppingBag,
  Sparkles,
  Store,
  Truck,
  Users,
  Warehouse,
  Bell,
  ChevronRight,
  PanelTop,
} from "lucide-react";
import { Link, NavLink, useLocation, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import ThemeToggle from "@/components/ThemeToggle";
import { api } from "@/lib/api";
import { auth } from "@/lib/auth";
import { getActiveMarketId, setActiveMarketId } from "@/lib/cart";
import { useMe } from "@/lib/useMe";
import type { NotificationRecord } from "@/types/api";

type MarketLite = { id: number; name: string; code: string };

type NavEntry = {
  label: string;
  to: string;
  icon: typeof Package;
  end?: boolean;
  mobileLabel?: string;
};

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  owner: "Owner",
  staff: "Staff",
  customer: "Customer",
  driver: "Driver",
};

function AppNavLink({
  entry,
  onNavigate,
  badge,
}: {
  entry: NavEntry;
  onNavigate?: () => void;
  badge?: string | number;
}) {
  const Icon = entry.icon;

  return (
    <NavLink
      to={entry.to}
      end={entry.end}
      onClick={onNavigate}
      className={({ isActive }) =>
        [
          "group relative flex items-center gap-3 rounded-[20px] border px-3 py-3 transition-all duration-200",
          isActive
            ? "border-cyan-200 bg-cyan-50 text-slate-950 shadow-[0_10px_30px_rgba(8,145,178,0.10)] dark:border-cyan-500/30 dark:bg-cyan-500/10 dark:text-white dark:shadow-[0_10px_30px_rgba(6,182,212,0.12)]"
            : "border-transparent bg-white/70 text-slate-700 hover:-translate-y-[1px] hover:border-slate-200 hover:bg-white hover:text-slate-950 hover:shadow-[0_10px_24px_rgba(15,23,42,0.06)] dark:bg-slate-900/70 dark:text-slate-200 dark:hover:border-slate-700 dark:hover:bg-slate-900 dark:hover:text-white dark:hover:shadow-[0_12px_28px_rgba(0,0,0,0.25)]",
        ].join(" ")
      }
    >
      {({ isActive }) => (
        <>
          <span
            className={[
              "flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px] border transition-all",
              isActive
                ? "border-cyan-200 bg-white text-cyan-700 shadow-sm dark:border-cyan-500/30 dark:bg-cyan-500/15 dark:text-cyan-200 dark:shadow-none"
                : "border-slate-200/80 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200",
            ].join(" ")}
          >
            <Icon className="h-4 w-4" />
          </span>

          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold">{entry.label}</div>
          </div>

          {badge !== undefined ? (
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
              {badge}
            </span>
          ) : null}

          <ChevronRight
            className={[
              "h-4 w-4 shrink-0 transition-all",
              isActive ? "translate-x-0 text-cyan-600 dark:text-cyan-300" : "text-slate-400 group-hover:translate-x-0.5 dark:text-slate-500",
            ].join(" ")}
          />
        </>
      )}
    </NavLink>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500">
      {children}
    </div>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { marketId: routeMarketId } = useParams();
  const meQ = useMe();
  const [mobileOpen, setMobileOpen] = useState(false);

  const roles = meQ.data?.roles ?? [];
  const roleLabels = roles.map((role: string) => ROLE_LABELS[role] ?? role);
  const isAdmin = roles.includes("admin");
  const isDriver = roles.includes("driver");
  const isCustomerOnly =
    roles.includes("customer") && !isAdmin && !roles.includes("owner") && !roles.includes("staff");

  const myMarketsQ = useQuery({
    queryKey: ["my-markets-lite"],
    queryFn: async () => (await api.get("/api/my/markets")).data as MarketLite[],
    enabled: !!meQ.data && !roles.includes("customer"),
    retry: false,
  });

  const notificationsQ = useQuery({
    queryKey: ["notifications"],
    queryFn: async () => (await api.get("/api/notifications")).data as NotificationRecord[],
    enabled: !!meQ.data,
    refetchInterval: 15000,
  });

  const unreadCount = notificationsQ.data?.filter((item) => !item.read_at).length ?? 0;

  const storedMarketId = getActiveMarketId() || undefined;
  const autoMarketId = myMarketsQ.data?.length === 1 ? String(myMarketsQ.data[0].id) : undefined;
  const currentMarketId = routeMarketId || storedMarketId || autoMarketId;
  const currentMarket = useMemo(
    () => myMarketsQ.data?.find((market) => String(market.id) === currentMarketId) ?? null,
    [currentMarketId, myMarketsQ.data],
  );

  const currentPath = location.pathname;

  useEffect(() => {
    if (routeMarketId) {
      setActiveMarketId(routeMarketId);
      return;
    }

    if (!storedMarketId && autoMarketId) {
      setActiveMarketId(autoMarketId);
    }
  }, [autoMarketId, routeMarketId, storedMarketId]);

  function logout() {
    auth.clear();
    navigate("/login", { replace: true });
  }

  const primaryNav: NavEntry[] = isCustomerOnly
    ? [{ label: "Orders", to: "/orders", icon: Package }]
    : [
        ...(isDriver ? [{ label: "Driver hub", to: "/driver-hub", icon: Truck, mobileLabel: "Driver" }] : []),
        { label: "Orders", to: "/orders", icon: Package, end: true, mobileLabel: "Orders" },
        { label: "Routes", to: "/routes", icon: Truck, end: true, mobileLabel: "Routes" },
        { label: "Live map", to: "/live-map", icon: Map, end: true, mobileLabel: "Map" },
        { label: "Analytics", to: "/analytics", icon: BarChart3, end: true, mobileLabel: "Stats" },
      ];

  const marketNav: NavEntry[] = currentMarketId
    ? [
        { label: "Settings", to: `/markets/${currentMarketId}`, icon: Compass, end: true },
        { label: "Items", to: `/markets/${currentMarketId}/items`, icon: ShoppingBag, end: true },
        { label: "Promo codes", to: `/markets/${currentMarketId}/promo-codes`, icon: Activity, end: true },
      ]
    : [];

  const marketHubEntry: NavEntry | null = isCustomerOnly
    ? null
    : {
        label: isAdmin ? "Markets" : "My markets",
        to: isAdmin ? "/markets" : "/my-markets",
        icon: Store,
        end: true,
        mobileLabel: "Markets",
      };

  const bottomNav = isCustomerOnly
    ? [{ label: "Orders", to: "/orders", icon: Home, end: true, mobileLabel: "Orders" }]
    : [
        { label: "Orders", to: "/orders", icon: Home, end: true, mobileLabel: "Home" },
        isDriver
          ? { label: "Driver hub", to: "/driver-hub", icon: Truck, end: true, mobileLabel: "Driver" }
          : { label: "Routes", to: "/routes", icon: Truck, end: true, mobileLabel: "Routes" },
        { label: "Live map", to: "/live-map", icon: Map, end: true, mobileLabel: "Map" },
        marketHubEntry ?? { label: "Orders", to: "/orders", icon: Package, end: true, mobileLabel: "Orders" },
        { label: "Analytics", to: "/analytics", icon: BarChart3, end: true, mobileLabel: "Stats" },
      ];

  const activeBottomEntry = bottomNav.find((entry) =>
    entry.end ? currentPath === entry.to : currentPath === entry.to || currentPath.startsWith(`${entry.to}/`),
  );

  const currentSectionTitle = useMemo(() => {
    const allEntries = [
      ...primaryNav,
      ...(marketHubEntry ? [marketHubEntry] : []),
      ...marketNav,
      ...(isAdmin
        ? [
            { label: "Drivers", to: "/drivers", icon: Warehouse, end: true },
            { label: "Global promos", to: "/promo-codes", icon: Activity, end: true },
            { label: "Users", to: "/users", icon: Users, end: true },
          ]
        : []),
    ];

    const matchingEntry = allEntries.find((entry) =>
      entry.end ? currentPath === entry.to : currentPath === entry.to || currentPath.startsWith(`${entry.to}/`),
    );

    return matchingEntry?.label ?? "Smart Dispatch workspace";
  }, [currentPath, isAdmin, marketHubEntry, marketNav, primaryNav]);

  useEffect(() => {
    setMobileOpen(false);
  }, [currentPath]);

  const sidebar = (
    <div className="flex h-full flex-col gap-4">
      <div className="relative overflow-hidden rounded-[30px] border border-slate-200/70 bg-white p-5 shadow-[0_18px_50px_rgba(15,23,42,0.08)] dark:border-slate-800 dark:bg-[#0b1220] dark:shadow-[0_18px_50px_rgba(0,0,0,0.40)]">
        <div className="absolute -bottom-10 -left-10 h-32 w-32 rounded-full bg-sky-400/10 blur-3xl dark:bg-sky-400/10" />

        <Link to="/" onClick={() => setMobileOpen(false)} className="relative flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-[20px] bg-slate-900 text-white shadow-[0_18px_40px_rgba(15,23,42,0.18)] dark:bg-cyan-500/14 dark:text-cyan-100 dark:shadow-none">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-[22px] font-semibold tracking-[-0.05em] text-slate-950 dark:text-white">
              Smart Dispatch
            </div>
            <div className="mt-1 text-sm text-slate-500 dark:text-slate-300">
              Markets, deliveries, and dispatch in one workspace
            </div>
          </div>
        </Link>
      </div>

      <div className="rounded-[30px] border border-slate-200/70 bg-white/80 p-4 shadow-[0_16px_40px_rgba(15,23,42,0.05)] backdrop-blur-sm dark:border-slate-800 dark:bg-slate-950/90 dark:shadow-[0_16px_40px_rgba(0,0,0,0.34)]">
        <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500">
          Signed in as
        </div>

        <div className="mt-3 text-xl font-semibold tracking-[-0.04em] text-slate-950 dark:text-white">
          {meQ.data?.name || "Loading user..."}
        </div>

        <div className="mt-1 text-sm text-slate-500 dark:text-slate-300">
          {roleLabels.length ? roleLabels.join(", ") : "Workspace member"}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {roles.map((role: string) => (
            <span
              key={role}
              className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              {ROLE_LABELS[role] ?? role}
            </span>
          ))}
          {(meQ.data?.permissions ?? []).slice(0, 3).map((permission: string) => (
            <span
              key={permission}
              className="rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-xs font-medium text-cyan-700 dark:border-cyan-500/25 dark:bg-cyan-500/10 dark:text-cyan-200"
            >
              {permission}
            </span>
          ))}
        </div>

        {currentMarket && (
          <div className="mt-4 rounded-[22px] border border-slate-200/70 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900">
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500">
              Active market
            </div>
            <div className="mt-2 text-base font-semibold text-slate-950 dark:text-white">{currentMarket.name}</div>
            <div className="text-sm text-slate-500 dark:text-slate-300">{currentMarket.code}</div>
          </div>
        )}

        <div className="mt-4 rounded-[22px] border border-slate-200/70 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900">
          <div className="flex items-center justify-between gap-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500">
              Notifications
            </div>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-white dark:bg-cyan-500/15 dark:text-cyan-200">
              <Bell className="h-4 w-4" />
            </div>
          </div>

          <div className="mt-3 text-lg font-semibold text-slate-950 dark:text-white">{unreadCount} unread</div>

          <div className="mt-3 grid gap-2">
            {(notificationsQ.data ?? []).slice(0, 3).map((notification) => (
              <div
                key={notification.id}
                className="rounded-[18px] border border-slate-200/70 bg-white px-3 py-3 text-sm shadow-sm dark:border-slate-700 dark:bg-slate-800/90"
              >
                <div className="font-semibold text-slate-900 dark:text-white">{notification.title}</div>
                <div className="mt-1 line-clamp-2 text-xs text-slate-500 dark:text-slate-300">
                  {notification.message}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-3 rounded-[30px] border border-slate-200/70 bg-white/80 p-4 shadow-[0_16px_40px_rgba(15,23,42,0.05)] backdrop-blur-sm dark:border-slate-800 dark:bg-slate-950/90 dark:shadow-[0_16px_40px_rgba(0,0,0,0.34)]">
        <SectionLabel>Operations</SectionLabel>
        <div className="space-y-2">
          {primaryNav.map((entry) => (
            <AppNavLink key={entry.to} entry={entry} onNavigate={() => setMobileOpen(false)} />
          ))}
        </div>
      </div>

      {!isCustomerOnly && (
        <div className="space-y-3 rounded-[30px] border border-slate-200/70 bg-white/80 p-4 shadow-[0_16px_40px_rgba(15,23,42,0.05)] backdrop-blur-sm dark:border-slate-800 dark:bg-slate-950/90 dark:shadow-[0_16px_40px_rgba(0,0,0,0.34)]">
          <SectionLabel>Markets</SectionLabel>
          <div className="space-y-2">
            <AppNavLink
              entry={{
                label: isAdmin ? "Markets" : "My markets",
                to: isAdmin ? "/markets" : "/my-markets",
                icon: Store,
                end: true,
              }}
              onNavigate={() => setMobileOpen(false)}
            />
            {marketNav.map((entry) => (
              <AppNavLink key={entry.to} entry={entry} onNavigate={() => setMobileOpen(false)} />
            ))}
          </div>
        </div>
      )}

      {isAdmin && (
        <div className="space-y-3 rounded-[30px] border border-slate-200/70 bg-white/80 p-4 shadow-[0_16px_40px_rgba(15,23,42,0.05)] backdrop-blur-sm dark:border-slate-800 dark:bg-slate-950/90 dark:shadow-[0_16px_40px_rgba(0,0,0,0.34)]">
          <SectionLabel>Admin</SectionLabel>
          <div className="space-y-2">
            <AppNavLink
              entry={{ label: "Drivers", to: "/drivers", icon: Warehouse, end: true }}
              onNavigate={() => setMobileOpen(false)}
            />
            <AppNavLink
              entry={{ label: "Global promos", to: "/promo-codes", icon: Activity, end: true }}
              onNavigate={() => setMobileOpen(false)}
            />
            <AppNavLink
              entry={{ label: "Users", to: "/users", icon: Users, end: true }}
              onNavigate={() => setMobileOpen(false)}
            />
          </div>
        </div>
      )}

      <div className="mt-auto">
        <Button
          variant="secondary"
          className="h-14 w-full justify-start rounded-[22px] border border-slate-200 bg-white text-slate-900 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:hover:bg-slate-800"
          onClick={logout}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Log out
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 dark:bg-[#020617] dark:text-white">
      <div className="mx-auto flex min-h-screen max-w-[1700px] gap-5 px-3 py-3 md:px-5 md:py-5">
        <aside className="hidden w-[340px] shrink-0 xl:block">{sidebar}</aside>

        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <div className="xl:hidden">
            <div className="rounded-[28px] border border-slate-200/70 bg-white/85 p-3 shadow-[0_16px_40px_rgba(15,23,42,0.07)] backdrop-blur-sm dark:border-slate-800 dark:bg-[#0f172a] dark:shadow-[0_16px_40px_rgba(0,0,0,0.30)]">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <Button
                    variant="secondary"
                    className="h-11 w-11 rounded-[16px] border border-slate-200 bg-white p-0 shadow-sm dark:border-slate-700 dark:bg-slate-800"
                    onClick={() => setMobileOpen(true)}
                    aria-label="Open navigation"
                  >
                    <PanelLeftOpen className="h-4 w-4" />
                  </Button>

                  <div className="min-w-0">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400 dark:text-slate-500">
                      {activeBottomEntry?.mobileLabel || "Workspace"}
                    </div>
                    <div className="truncate text-lg font-semibold tracking-[-0.04em] text-slate-950 dark:text-white">
                      {currentSectionTitle}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex h-10 min-w-[40px] items-center justify-center rounded-full bg-slate-900 px-3 text-sm font-semibold text-white dark:bg-cyan-500/15 dark:text-cyan-200">
                    {unreadCount}
                  </div>
                  <ThemeToggle className="h-11 w-11 rounded-[16px] border border-slate-200 bg-white p-0 shadow-sm dark:border-slate-700 dark:bg-slate-800" />
                </div>
              </div>
            </div>
          </div>

          <div className="hidden overflow-hidden rounded-[34px] border border-white/10 bg-slate-950 px-6 py-6 shadow-[0_25px_80px_rgba(0,0,0,0.22)] xl:flex xl:items-start xl:justify-between dark:bg-[#08111b]">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-white/85">
                <PanelTop className="h-3.5 w-3.5" />
                Workspace
              </div>

              <div className="mt-4 text-3xl font-semibold tracking-[-0.05em] text-white">
                Smart Dispatch control center
              </div>

              <div className="mt-2 text-sm leading-6 text-white/70">
                Orders, routes, live operations, users, analytics, and market tools in one high-end workspace.
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                <span className="rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm text-white/85">
                  {roleLabels.length ? roleLabels.join(", ") : "Workspace member"}
                </span>
                <span className="rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm text-white/85">
                  {currentMarket?.code || "Global workspace"}
                </span>
                <span className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-4 py-2 text-sm text-cyan-100">
                  {unreadCount} unread notifications
                </span>
              </div>
            </div>

            <div className="ml-6 flex items-center gap-3">
              <div className="hidden text-right md:block">
                <div className="text-xs uppercase tracking-[0.22em] text-white/50">Signed in as</div>
                <div className="mt-2 text-sm font-semibold text-white">{meQ.data?.name || "Loading user..."}</div>
              </div>
              <ThemeToggle />
            </div>
          </div>

          <main className="min-w-0 flex-1 overflow-hidden rounded-[34px] border border-slate-200/70 bg-white/88 p-4 shadow-[0_18px_50px_rgba(15,23,42,0.08)] backdrop-blur-sm md:p-6 dark:border-slate-800 dark:bg-[#0b1220] dark:shadow-[0_18px_50px_rgba(0,0,0,0.32)]">
            {children}
          </main>

          <nav
            className="fixed bottom-3 left-3 right-3 z-40 grid grid-cols-5 gap-2 rounded-[24px] border border-slate-200/70 bg-white/92 p-2 shadow-[0_20px_40px_rgba(15,23,42,0.12)] backdrop-blur-xl xl:hidden dark:border-slate-800 dark:bg-[#0b1220]/95 dark:shadow-[0_20px_40px_rgba(0,0,0,0.35)]"
            aria-label="Primary"
          >
            {bottomNav.map((entry) => {
              const Icon = entry.icon;
              const isActive = entry.end
                ? currentPath === entry.to
                : currentPath === entry.to || currentPath.startsWith(`${entry.to}/`);

              return (
                <NavLink
                  key={entry.to}
                  to={entry.to}
                  end={entry.end}
                  className={[
                    "flex flex-col items-center justify-center gap-1 rounded-[18px] px-2 py-2.5 text-[11px] font-semibold transition-all",
                    isActive
                      ? "bg-slate-950 text-white shadow-sm dark:bg-cyan-500/14 dark:text-cyan-200 dark:shadow-none"
                      : "text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white",
                  ].join(" ")}
                >
                  <Icon className="h-4 w-4" />
                  <span>{entry.mobileLabel ?? entry.label}</span>
                </NavLink>
              );
            })}
          </nav>
        </div>
      </div>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent
          side="left"
          className="border-0 bg-transparent p-0 shadow-none sm:max-w-md"
          showCloseButton={false}
        >
          <SheetHeader className="sr-only">
            <SheetTitle>Smart Dispatch workspace</SheetTitle>
            <SheetDescription>Orders, routes, live operations, and market tools in one place.</SheetDescription>
          </SheetHeader>
          <div className="h-full overflow-y-auto p-3">
            <div className="h-full rounded-[30px] border border-slate-200/70 bg-slate-100/95 p-3 shadow-[0_25px_80px_rgba(15,23,42,0.12)] backdrop-blur-xl dark:border-slate-800 dark:bg-[#020817]/98 dark:shadow-[0_25px_80px_rgba(0,0,0,0.45)]">
              {sidebar}
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
