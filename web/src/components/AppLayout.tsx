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
  Zap,
} from "lucide-react";
import { Link, NavLink, useLocation, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import ThemeToggle from "@/components/ThemeToggle";
import { api } from "@/lib/api";
import { auth } from "@/lib/auth";
import { getActiveMarketId, setActiveMarketId } from "@/lib/cart";
import { useI18n } from "@/lib/i18n";
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

function AppNavLink({ entry, onNavigate }: { entry: NavEntry; onNavigate?: () => void }) {
  const Icon = entry.icon;

  return (
    <NavLink
      to={entry.to}
      end={entry.end}
      onClick={onNavigate}
      className={({ isActive }) =>
        [
          "rail-link group",
          isActive
            ? "rail-link-active"
            : "hover:border-slate-200/80 hover:bg-white/80 hover:text-slate-950 dark:hover:border-white/10 dark:hover:bg-white/5 dark:hover:text-white",
        ].join(" ")
      }
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-[14px] border border-slate-200/80 bg-white text-slate-600 dark:border-white/10 dark:bg-white/6 dark:text-slate-200">
        <Icon className="h-4 w-4" />
      </span>
      <span className="truncate">{entry.label}</span>
    </NavLink>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { marketId: routeMarketId } = useParams();
  const meQ = useMe();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { t } = useI18n();

  const roles = meQ.data?.roles ?? [];
  const roleLabels = roles.map((role: string) => t(`role.${role}`));
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
    ? [{ label: t("nav.orders"), to: "/orders", icon: Package }]
    : [
        ...(isDriver ? [{ label: t("nav.driverHub"), to: "/driver-hub", icon: Truck, mobileLabel: "Driver" }] : []),
        { label: t("nav.orders"), to: "/orders", icon: Package, end: true, mobileLabel: "Orders" },
        { label: t("nav.routes"), to: "/routes", icon: Truck, end: true, mobileLabel: "Routes" },
        { label: t("nav.liveMap"), to: "/live-map", icon: Map, end: true, mobileLabel: "Map" },
        { label: t("nav.analytics"), to: "/analytics", icon: BarChart3, end: true, mobileLabel: "Stats" },
      ];

  const marketNav: NavEntry[] = currentMarketId
    ? [
        { label: t("nav.settings"), to: `/markets/${currentMarketId}`, icon: Compass, end: true },
        { label: t("nav.items"), to: `/markets/${currentMarketId}/items`, icon: ShoppingBag, end: true },
        { label: t("nav.promos"), to: `/markets/${currentMarketId}/promo-codes`, icon: Activity, end: true },
      ]
    : [];

  const marketHubEntry: NavEntry | null = isCustomerOnly
    ? null
    : {
        label: isAdmin ? t("nav.allMarkets") : t("nav.myMarkets"),
        to: isAdmin ? "/markets" : "/my-markets",
        icon: Store,
        end: true,
        mobileLabel: "Markets",
      };

  const bottomNav = isCustomerOnly
    ? [{ label: t("nav.orders"), to: "/orders", icon: Home, end: true, mobileLabel: "Orders" }]
    : [
        { label: t("nav.orders"), to: "/orders", icon: Home, end: true, mobileLabel: "Home" },
        isDriver
          ? { label: t("nav.driverHub"), to: "/driver-hub", icon: Truck, end: true, mobileLabel: "Driver" }
          : { label: t("nav.routes"), to: "/routes", icon: Truck, end: true, mobileLabel: "Routes" },
        { label: t("nav.liveMap"), to: "/live-map", icon: Map, end: true, mobileLabel: "Map" },
        marketHubEntry ?? { label: t("nav.orders"), to: "/orders", icon: Package, end: true, mobileLabel: "Orders" },
        { label: t("nav.analytics"), to: "/analytics", icon: BarChart3, end: true, mobileLabel: "Stats" },
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
            { label: t("nav.drivers"), to: "/drivers", icon: Warehouse, end: true },
            { label: "Global promos", to: "/promo-codes", icon: Activity, end: true },
            { label: t("nav.users"), to: "/users", icon: Users, end: true },
          ]
        : []),
    ];

    const matchingEntry = allEntries.find((entry) =>
      entry.end ? currentPath === entry.to : currentPath === entry.to || currentPath.startsWith(`${entry.to}/`),
    );

    return matchingEntry?.label ?? t("layout.workspaceTitle");
  }, [currentPath, isAdmin, marketHubEntry, marketNav, primaryNav, t]);

  useEffect(() => {
    setMobileOpen(false);
  }, [currentPath]);

  const sidebar = (
    <div className="rail-panel page-enter flex h-full flex-col gap-4">
      <div className="control-card p-4">
        <Link to="/" onClick={() => setMobileOpen(false)} className="relative flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-[16px] border border-cyan-200/40 bg-cyan-50 text-cyan-700 dark:border-cyan-300/14 dark:bg-cyan-300/10 dark:text-cyan-50">
            <Zap className="h-5 w-5" />
          </div>
          <div>
            <div className="font-display theme-ink text-xl font-semibold tracking-[-0.04em]">{t("app.name")}</div>
            <div className="theme-muted text-sm">{t("app.tagline")}</div>
          </div>
        </Link>
      </div>

      <div className="paper-panel-muted p-4">
        <div className="section-kicker">{t("layout.signedInAs")}</div>
        <div className="font-display theme-ink mt-3 text-xl font-semibold tracking-[-0.04em]">
          {meQ.data?.name || t("common.loadingUser")}
        </div>
        <div className="theme-muted mt-1 text-sm">
          {roleLabels.length ? roleLabels.join(", ") : t("layout.workspaceMember")}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {roles.map((role: string) => (
            <span key={role} className="data-pill">
              {t(`role.${role}`)}
            </span>
          ))}
          {(meQ.data?.permissions ?? []).slice(0, 3).map((permission: string) => (
            <span key={permission} className="data-pill">
              {permission}
            </span>
          ))}
        </div>
        {currentMarket && (
          <div className="subpanel mt-4 p-4">
            <div className="section-kicker">{t("layout.activeMarket")}</div>
            <div className="theme-ink mt-2 text-base font-semibold">{currentMarket.name}</div>
            <div className="theme-muted text-sm">{currentMarket.code}</div>
          </div>
        )}
        <div className="subpanel mt-4 p-4">
          <div className="section-kicker">Notifications</div>
          <div className="theme-ink mt-2 text-base font-semibold">{notificationsQ.data?.filter((item) => !item.read_at).length ?? 0} unread</div>
          <div className="mt-3 grid gap-2">
            {(notificationsQ.data ?? []).slice(0, 3).map((notification) => (
              <div key={notification.id} className="rounded-[16px] border border-slate-200/80 bg-white/80 px-3 py-3 text-sm dark:border-white/10 dark:bg-white/5">
                <div className="font-semibold">{notification.title}</div>
                <div className="theme-muted mt-1 text-xs">{notification.message}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div className="section-kicker px-2">{t("nav.operations")}</div>
        <div className="space-y-1">
          {primaryNav.map((entry) => (
            <AppNavLink key={entry.to} entry={entry} onNavigate={() => setMobileOpen(false)} />
          ))}
        </div>
      </div>

      {!isCustomerOnly && (
        <div className="space-y-3">
          <div className="section-kicker px-2">{t("nav.markets")}</div>
          <div className="space-y-1">
            <AppNavLink
              entry={{
                label: isAdmin ? t("nav.allMarkets") : t("nav.myMarkets"),
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
        <div className="space-y-3">
          <div className="section-kicker px-2">{t("nav.admin")}</div>
          <div className="space-y-1">
            <AppNavLink
              entry={{ label: t("nav.drivers"), to: "/drivers", icon: Warehouse, end: true }}
              onNavigate={() => setMobileOpen(false)}
            />
            <AppNavLink entry={{ label: "Global promos", to: "/promo-codes", icon: Activity, end: true }} onNavigate={() => setMobileOpen(false)} />
            <AppNavLink entry={{ label: t("nav.users"), to: "/users", icon: Users, end: true }} onNavigate={() => setMobileOpen(false)} />
          </div>
        </div>
      )}

      <div className="mt-auto pt-2">
        <Button variant="secondary" className="h-12 justify-start rounded-[18px]" onClick={logout}>
          <LogOut className="mr-2 h-4 w-4" />
          {t("nav.logout")}
        </Button>
      </div>
    </div>
  );

  return (
    <div className="app-shell app-shell-mobile-safe">
      <div className="editorial-shell editorial-shell-mobile">
        <aside className="hidden xl:block">{sidebar}</aside>

        <div className="grid min-w-0 gap-4 md:gap-5">
          <div className="mobile-device-shell page-enter page-enter-delay-1">
            <div className="mobile-device-shell__topbar xl:hidden">
              <div className="flex items-center gap-3">
                <Button
                  variant="secondary"
                  className="mobile-app-icon p-0"
                  onClick={() => setMobileOpen(true)}
                  aria-label="Open navigation"
                >
                  <PanelLeftOpen className="h-4 w-4" />
                </Button>
                <div className="min-w-0">
                  <div className="section-kicker">{activeBottomEntry?.mobileLabel || t("layout.workspaceLabel")}</div>
                  <div className="truncate font-display text-lg font-semibold tracking-[-0.04em] text-slate-950 dark:text-white">
                    {currentSectionTitle}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="mobile-status-pill">
                  {notificationsQ.data?.filter((item) => !item.read_at).length ?? 0}
                </div>
                <ThemeToggle className="mobile-app-icon" />
              </div>
            </div>

            <div className="paper-panel hidden xl:flex xl:flex-wrap xl:items-start xl:justify-between xl:gap-4 xl:px-5 xl:py-4 2xl:px-6">
              <div>
                <div className="command-chip">
                  <Sparkles className="h-3.5 w-3.5" />
                  {t("layout.workspaceLabel")}
                </div>
                <div className="font-display theme-ink mt-4 text-2xl font-semibold tracking-[-0.05em] md:text-3xl">
                  {t("layout.workspaceTitle")}
                </div>
                <div className="theme-copy mt-2 max-w-2xl text-sm">
                  {t("layout.workspaceCopy")}
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="data-pill">{roleLabels.length ? roleLabels.join(", ") : t("layout.workspaceMember")}</span>
                  <span className="data-pill">{currentMarket?.code || t("layout.globalWorkspace")}</span>
                  <span className="data-pill">{notificationsQ.data?.filter((item) => !item.read_at).length ?? 0} unread</span>
                </div>
              </div>

              <div className="ml-auto flex items-center gap-3">
                <div className="hidden text-right md:block">
                  <div className="section-kicker">{t("layout.signedInAs")}</div>
                  <div className="theme-ink mt-2 text-sm font-semibold">{meQ.data?.name || t("common.loadingUser")}</div>
                </div>
                <ThemeToggle />
              </div>
            </div>

            <main className="paper-panel mobile-main-panel page-enter page-enter-delay-2 overflow-hidden p-4 md:p-6">
              {children}
            </main>
          </div>

          <nav className="mobile-bottom-nav xl:hidden" aria-label="Primary">
            {bottomNav.map((entry) => {
              const Icon = entry.icon;
              const isActive = entry.end ? currentPath === entry.to : currentPath === entry.to || currentPath.startsWith(`${entry.to}/`);

              return (
                <NavLink
                  key={entry.to}
                  to={entry.to}
                  end={entry.end}
                  className={() => ["mobile-bottom-nav__item", isActive ? "mobile-bottom-nav__item-active" : ""].join(" ").trim()}
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
          className="mobile-drawer border-0 p-0 shadow-none sm:max-w-md"
          showCloseButton={false}
        >
          <SheetHeader className="sr-only">
            <SheetTitle>{t("layout.workspaceTitle")}</SheetTitle>
            <SheetDescription>{t("layout.workspaceCopy")}</SheetDescription>
          </SheetHeader>
          <div className="h-full overflow-y-auto p-4">
            {sidebar}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
