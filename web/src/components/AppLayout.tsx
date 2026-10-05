import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Activity,
  BarChart3,
  Bell,
  Boxes,
  ChevronsUpDown,
  ClipboardList,
  Compass,
  DatabaseZap,
  ExternalLink,
  History,
  Home,
  LayoutDashboard,
  LogOut,
  Map,
  Menu,
  MessageSquareText,
  Package,
  ScrollText,
  ShieldCheck,
  ShoppingBag,
  Store,
  Truck,
  UserRound,
  Users,
  Wallet,
  Warehouse,
  type LucideIcon,
} from "lucide-react";
import { motion } from "motion/react";
import { Link, NavLink, useLocation, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import ThemeToggle from "@/components/ThemeToggle";
import { Brand } from "@/components/app/brand";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { api } from "@/lib/api";
import { auth } from "@/lib/auth";
import { getActiveMarketId, setActiveMarketId } from "@/lib/cart";
import { formatDateTime } from "@/lib/format";
import { resolveApiMediaUrl } from "@/lib/media";
import { useMe } from "@/lib/useMe";
import { cn } from "@/lib/utils";
import type { NotificationRecord } from "@/types/api";

type MarketLite = { id: number; name: string; code: string };

type NavEntry = {
  label: string;
  to: string;
  icon: LucideIcon;
  end?: boolean;
  mobileLabel?: string;
  badge?: number;
};

type NavSection = { title: string; items: NavEntry[] };

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  owner: "Owner",
  staff: "Staff",
  customer: "Customer",
  driver: "Driver",
};

function initials(name?: string | null) {
  return (
    (name ?? "User")
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "U"
  );
}

function isEntryActive(entry: NavEntry, path: string) {
  return entry.end ? path === entry.to : path === entry.to || path.startsWith(`${entry.to}/`);
}

function SidebarLink({ entry, onNavigate }: { entry: NavEntry; onNavigate?: () => void }) {
  const Icon = entry.icon;

  return (
    <NavLink
      to={entry.to}
      end={entry.end}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          "group/nav relative flex h-9 items-center gap-2.5 rounded-md px-2.5 text-[13.5px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-sidebar-ring",
          isActive
            ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
            : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
        )
      }
    >
      {({ isActive }) => (
        <>
          {isActive ? (
            <motion.span
              layoutId="sidebar-active"
              className="absolute top-1.5 bottom-1.5 -left-3 w-[3px] rounded-full bg-sidebar-primary"
              transition={{ type: "spring", stiffness: 420, damping: 34 }}
              aria-hidden
            />
          ) : null}
          <Icon
            className={cn(
              "size-4 shrink-0 transition-colors",
              isActive ? "text-sidebar-primary" : "text-muted-foreground group-hover/nav:text-current",
            )}
          />
          <span className="flex-1 truncate">{entry.label}</span>
          {entry.badge ? (
            <span className="rounded-full bg-sidebar-primary px-1.5 text-[10px] font-semibold text-sidebar-primary-foreground tabular-nums">
              {entry.badge > 99 ? "99+" : entry.badge}
            </span>
          ) : null}
        </>
      )}
    </NavLink>
  );
}

function NotificationsButton({ notifications, unreadCount }: { notifications: NotificationRecord[]; unreadCount: number }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label={`Notifications (${unreadCount} unread)`}>
          <Bell className="size-[18px]" />
          {unreadCount > 0 ? (
            <span className="absolute top-1 right-1 flex min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] leading-4 font-semibold text-white tabular-nums">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="text-sm font-semibold">Notifications</div>
          <span className="text-xs text-muted-foreground">{unreadCount} unread</span>
        </div>
        <div className="max-h-80 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">You're all caught up.</div>
          ) : (
            notifications.slice(0, 6).map((notification) => (
              <div key={notification.id} className="flex gap-3 border-b px-4 py-3 last:border-0">
                <span
                  className={cn("mt-1.5 size-2 shrink-0 rounded-full", notification.read_at ? "bg-transparent" : "bg-primary")}
                  aria-hidden
                />
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{notification.title}</div>
                  <div className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{notification.message}</div>
                  {notification.created_at ? (
                    <div className="mt-1 text-[11px] text-muted-foreground/80">{formatDateTime(notification.created_at)}</div>
                  ) : null}
                </div>
              </div>
            ))
          )}
        </div>
        <div className="border-t p-2">
          <Button asChild variant="ghost" size="sm" className="w-full">
            <Link to="/notifications">View all notifications</Link>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default function AppLayout({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { marketId: routeMarketId } = useParams();
  const meQ = useMe();
  const [mobileOpen, setMobileOpen] = useState(false);

  const user = meQ.data;
  const roles = user?.roles ?? [];
  const roleLabels = roles.map((role: string) => ROLE_LABELS[role] ?? role);
  const isAdmin = roles.includes("admin");
  const isDriver = roles.includes("driver");
  const isCustomerOnly =
    roles.includes("customer") && !isAdmin && !roles.includes("owner") && !roles.includes("staff");
  const profilePhotoUrl = resolveApiMediaUrl(user?.profile_photo_url);

  const myMarketsQ = useQuery({
    queryKey: ["my-markets-lite"],
    queryFn: async () => (await api.get("/api/my/markets")).data as MarketLite[],
    enabled: !!user && !roles.includes("customer"),
    retry: false,
  });

  const notificationsQ = useQuery({
    queryKey: ["notifications"],
    queryFn: async () => (await api.get("/api/notifications")).data as NotificationRecord[],
    enabled: !!user,
    refetchInterval: 15000,
  });

  const notifications = notificationsQ.data ?? [];
  const unreadCount = notifications.filter((item) => !item.read_at).length;

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

  useEffect(() => {
    setMobileOpen(false);
  }, [currentPath]);

  function logout() {
    auth.clear();
    navigate("/login", { replace: true });
  }

  function switchMarket(market: MarketLite) {
    setActiveMarketId(String(market.id));
    navigate(`/markets/${market.id}/dashboard`);
  }

  const sections: NavSection[] = useMemo(() => {
    if (isCustomerOnly) {
      return [
        {
          title: "My account",
          items: [
            { label: "Orders", to: "/orders", icon: Package, end: true },
            { label: "Order history", to: "/order-history", icon: History, end: true },
            { label: "Notifications", to: "/notifications", icon: Bell, end: true, badge: unreadCount },
          ],
        },
      ];
    }

    const result: NavSection[] = [];

    if (isDriver) {
      result.push({
        title: "Driver",
        items: [
          { label: "Driver hub", to: "/driver-hub", icon: Truck, end: true, mobileLabel: "Driver" },
          { label: "Earnings", to: "/driver-earnings", icon: Wallet, end: true, mobileLabel: "Earn" },
        ],
      });
    }

    result.push({
      title: "Operations",
      items: [
        { label: "Orders", to: "/orders", icon: Package, end: true, mobileLabel: "Orders" },
        { label: "Dispatch", to: "/dispatch", icon: ClipboardList, end: true, mobileLabel: "Dispatch" },
        { label: "Routes", to: "/routes", icon: Truck, end: true, mobileLabel: "Routes" },
        { label: "Live map", to: "/live-map", icon: Map, end: true, mobileLabel: "Map" },
        { label: "Analytics", to: "/analytics", icon: BarChart3, end: true, mobileLabel: "Stats" },
        { label: "Notifications", to: "/notifications", icon: Bell, end: true, badge: unreadCount },
        { label: "Support", to: "/support", icon: MessageSquareText, end: true },
      ],
    });

    result.push({
      title: currentMarket ? currentMarket.name : "Markets",
      items: [
        { label: isAdmin ? "All markets" : "My markets", to: isAdmin ? "/markets" : "/my-markets", icon: Store, end: true, mobileLabel: "Markets" },
        ...(currentMarketId
          ? [
              { label: "Dashboard", to: `/markets/${currentMarketId}/dashboard`, icon: LayoutDashboard, end: true },
              { label: "Products", to: `/markets/${currentMarketId}/items`, icon: ShoppingBag, end: true },
              { label: "Inventory alerts", to: `/markets/${currentMarketId}/inventory-alerts`, icon: Boxes, end: true },
              { label: "Promo codes", to: `/markets/${currentMarketId}/promo-codes`, icon: Activity, end: true },
              { label: "Market settings", to: `/markets/${currentMarketId}`, icon: Compass, end: true },
            ]
          : []),
      ],
    });

    if (isAdmin) {
      result.push({
        title: "Admin",
        items: [
          { label: "Drivers", to: "/drivers", icon: Warehouse, end: true },
          { label: "Users", to: "/users", icon: Users, end: true },
          { label: "Global promos", to: "/promo-codes", icon: Activity, end: true },
          { label: "Badge pricing", to: "/badge-pricing", icon: ShieldCheck, end: true },
          { label: "Approvals", to: "/approvals", icon: ShieldCheck, end: true },
          { label: "Audit logs", to: "/audit-logs", icon: ScrollText, end: true },
          { label: "Demo scenario", to: "/demo-scenario", icon: DatabaseZap, end: true },
        ],
      });
    }

    return result;
  }, [currentMarket, currentMarketId, isAdmin, isCustomerOnly, isDriver, unreadCount]);

  const allEntries = sections.flatMap((section) => section.items);
  const currentEntry = allEntries.find((entry) => isEntryActive(entry, currentPath));
  const currentSection = sections.find((section) => section.items.includes(currentEntry as NavEntry));
  const pageTitle =
    currentEntry?.label ??
    (currentPath === "/profile" ? "Profile" : currentPath.startsWith("/markets/") ? "Market" : "Workspace");

  const bottomNav: NavEntry[] = isCustomerOnly
    ? [
        { label: "Orders", to: "/orders", icon: Home, end: true },
        { label: "History", to: "/order-history", icon: History, end: true },
        { label: "Alerts", to: "/notifications", icon: Bell, end: true },
        { label: "Shop", to: "/", icon: Store, end: true },
      ]
    : [
        { label: "Orders", to: "/orders", icon: Package, end: true },
        isDriver
          ? { label: "Driver", to: "/driver-hub", icon: Truck, end: true }
          : { label: "Routes", to: "/routes", icon: Truck, end: true },
        { label: "Map", to: "/live-map", icon: Map, end: true },
        { label: "Markets", to: isAdmin ? "/markets" : "/my-markets", icon: Store, end: true },
        { label: "Stats", to: "/analytics", icon: BarChart3, end: true },
      ];

  const showMarketSwitcher = !isCustomerOnly && (myMarketsQ.data?.length ?? 0) > 0;

  const sidebar = (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex h-14 shrink-0 items-center border-b border-sidebar-border px-4">
        <Brand to="/" subtitle="Workspace" />
      </div>

      {showMarketSwitcher ? (
        <div className="shrink-0 border-b border-sidebar-border p-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex w-full items-center gap-2.5 rounded-md border border-sidebar-border bg-sidebar-accent/40 px-2.5 py-2 text-left outline-none transition-colors hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-sidebar-ring"
              >
                <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Store className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[11px] text-muted-foreground">Active market</span>
                  <span className="block truncate text-sm font-medium">{currentMarket?.name ?? "Choose a market"}</span>
                </span>
                <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-(--radix-dropdown-menu-trigger-width) min-w-56">
              <DropdownMenuLabel className="text-xs text-muted-foreground">Switch market</DropdownMenuLabel>
              {(myMarketsQ.data ?? []).map((market) => (
                <DropdownMenuItem
                  key={market.id}
                  onClick={() => switchMarket(market)}
                  className={cn(String(market.id) === currentMarketId && "bg-accent font-medium")}
                >
                  <Store />
                  <span className="flex-1 truncate">{market.name}</span>
                  <span className="text-xs text-muted-foreground">{market.code}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ) : null}

      <ScrollArea className="min-h-0 flex-1">
        <nav className="flex flex-col gap-5 p-3 pb-6">
          {sections.map((section) => (
            <div key={section.title} className="flex flex-col gap-0.5">
              <div className="truncate px-2.5 pb-1.5 text-[11px] font-semibold tracking-wider text-muted-foreground/80 uppercase">
                {section.title}
              </div>
              {section.items.map((entry) => (
                <SidebarLink key={entry.to} entry={entry} onNavigate={() => setMobileOpen(false)} />
              ))}
            </div>
          ))}
        </nav>
      </ScrollArea>

      <div className="shrink-0 border-t border-sidebar-border p-3">
        <Link
          to="/profile"
          className="flex items-center gap-2.5 rounded-md p-1.5 transition-colors hover:bg-sidebar-accent"
        >
          <Avatar className="size-8">
            {profilePhotoUrl ? <AvatarImage src={profilePhotoUrl} alt={user?.name ?? "Profile"} /> : null}
            <AvatarFallback className="bg-primary text-xs font-semibold text-primary-foreground">{initials(user?.name)}</AvatarFallback>
          </Avatar>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">{user?.name ?? "Loading..."}</span>
            <span className="block truncate text-xs text-muted-foreground">
              {roleLabels.length ? roleLabels.join(", ") : "Workspace member"}
            </span>
          </span>
        </Link>
      </div>
    </div>
  );

  return (
    <div className="flex h-svh overflow-hidden bg-background">
      <aside className="hidden w-64 shrink-0 border-r border-sidebar-border lg:block">{sidebar}</aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-2 border-b bg-background/80 px-3 backdrop-blur-xl md:px-5">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open navigation">
            <Menu className="size-5" />
          </Button>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 text-sm">
              {currentSection ? (
                <span className="hidden truncate text-muted-foreground sm:inline">{currentSection.title}</span>
              ) : null}
              {currentSection ? <span className="hidden text-muted-foreground/50 sm:inline">/</span> : null}
              <span className="truncate font-medium">{pageTitle}</span>
            </div>
          </div>

          <Button asChild variant="ghost" size="sm" className="hidden md:inline-flex">
            <Link to="/">
              <ExternalLink />
              Storefront
            </Link>
          </Button>
          <NotificationsButton notifications={notifications} unreadCount={unreadCount} />
          <ThemeToggle compact />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full" aria-label="Account menu">
                <Avatar className="size-7">
                  {profilePhotoUrl ? <AvatarImage src={profilePhotoUrl} alt={user?.name ?? "Profile"} /> : null}
                  <AvatarFallback className="bg-primary text-xs font-semibold text-primary-foreground">{initials(user?.name)}</AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              <DropdownMenuLabel className="font-normal">
                <div className="truncate text-sm font-medium">{user?.name ?? "Loading..."}</div>
                <div className="truncate text-xs text-muted-foreground">{user?.email ?? ""}</div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to="/profile">
                  <UserRound />
                  Profile settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/">
                  <Store />
                  Open storefront
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={logout}>
                <LogOut />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        <main className="scrollbar-thin min-w-0 flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-7xl px-4 py-5 pb-24 md:px-6 md:py-6 lg:pb-8">{children}</div>
        </main>

        <nav
          className="fixed inset-x-0 bottom-0 z-40 grid border-t bg-background/90 px-2 pt-1.5 backdrop-blur-xl lg:hidden"
          style={{
            gridTemplateColumns: `repeat(${bottomNav.length}, minmax(0, 1fr))`,
            paddingBottom: "calc(0.375rem + env(safe-area-inset-bottom, 0px))",
          }}
          aria-label="Primary"
        >
          {bottomNav.map((entry) => {
            const Icon = entry.icon;
            const active = isEntryActive(entry, currentPath);

            return (
              <NavLink
                key={entry.to}
                to={entry.to}
                end={entry.end}
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5 rounded-md py-1.5 text-[11px] font-medium transition-colors",
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="size-5" />
                <span>{entry.label}</span>
              </NavLink>
            );
          })}
        </nav>
      </div>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-72 gap-0 p-0" showCloseButton={false}>
          <SheetTitle className="sr-only">Smart Dispatch navigation</SheetTitle>
          <SheetDescription className="sr-only">Orders, routes, live operations, and market tools.</SheetDescription>
          {sidebar}
        </SheetContent>
      </Sheet>
    </div>
  );
}
