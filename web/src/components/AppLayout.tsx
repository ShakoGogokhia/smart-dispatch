import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  BarChart3,
  Compass,
  LogOut,
  Map,
  Menu,
  Package,
  ShoppingBag,
  Sparkles,
  Store,
  Truck,
  Users,
  Warehouse,
  X,
  Zap,
} from "lucide-react";
import { Link, NavLink, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import ThemeToggle from "@/components/ThemeToggle";
import { api } from "@/lib/api";
import { auth } from "@/lib/auth";
import { getActiveMarketId, setActiveMarketId } from "@/lib/cart";
import { useI18n } from "@/lib/i18n";
import { useMe } from "@/lib/useMe";

type MarketLite = { id: number; name: string; code: string };

type NavEntry = {
  label: string;
  to: string;
  icon: typeof Package;
};

function AppNavLink({ entry, onNavigate }: { entry: NavEntry; onNavigate?: () => void }) {
  const Icon = entry.icon;

  return (
    <NavLink
      to={entry.to}
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

  const storedMarketId = getActiveMarketId() || undefined;
  const autoMarketId = myMarketsQ.data?.length === 1 ? String(myMarketsQ.data[0].id) : undefined;
  const currentMarketId = routeMarketId || storedMarketId || autoMarketId;
  const currentMarket = useMemo(
    () => myMarketsQ.data?.find((market) => String(market.id) === currentMarketId) ?? null,
    [currentMarketId, myMarketsQ.data],
  );

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
        ...(isDriver ? [{ label: t("nav.driverHub"), to: "/driver-hub", icon: Truck }] : []),
        { label: t("nav.orders"), to: "/orders", icon: Package },
        { label: t("nav.routes"), to: "/routes", icon: Truck },
        { label: t("nav.liveMap"), to: "/live-map", icon: Map },
        { label: t("nav.analytics"), to: "/analytics", icon: BarChart3 },
      ];

  const marketNav: NavEntry[] = currentMarketId
    ? [
        { label: t("nav.settings"), to: `/markets/${currentMarketId}`, icon: Compass },
        { label: t("nav.items"), to: `/markets/${currentMarketId}/items`, icon: ShoppingBag },
        { label: t("nav.promos"), to: `/markets/${currentMarketId}/promo-codes`, icon: Activity },
      ]
    : [];

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
        </div>
        {currentMarket && (
          <div className="subpanel mt-4 p-4">
            <div className="section-kicker">{t("layout.activeMarket")}</div>
            <div className="theme-ink mt-2 text-base font-semibold">{currentMarket.name}</div>
            <div className="theme-muted text-sm">{currentMarket.code}</div>
          </div>
        )}
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
              entry={{ label: t("nav.drivers"), to: "/drivers", icon: Warehouse }}
              onNavigate={() => setMobileOpen(false)}
            />
            <AppNavLink entry={{ label: t("nav.users"), to: "/users", icon: Users }} onNavigate={() => setMobileOpen(false)} />
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
    <div className="app-shell">
      <div className="editorial-shell">
        <aside className="hidden lg:block">{sidebar}</aside>

        <div className="grid min-w-0 gap-5">
          <div className="paper-panel page-enter page-enter-delay-1 flex flex-wrap items-start justify-between gap-4 px-5 py-4 md:px-6">
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
              </div>
            </div>

            <div className="ml-auto flex items-center gap-3">
              <div className="hidden text-right md:block">
                <div className="section-kicker">{t("layout.signedInAs")}</div>
                <div className="theme-ink mt-2 text-sm font-semibold">{meQ.data?.name || t("common.loadingUser")}</div>
              </div>
              <ThemeToggle />
              <Button
                variant="secondary"
                className="h-12 w-12 rounded-[16px] p-0 lg:hidden"
                onClick={() => setMobileOpen((value) => !value)}
              >
                {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          {mobileOpen && <div className="lg:hidden">{sidebar}</div>}

          <main className="paper-panel page-enter page-enter-delay-2 min-h-[calc(100vh-9rem)] overflow-hidden p-4 md:p-6">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
