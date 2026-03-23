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
  Store,
  Truck,
  Users,
  Warehouse,
  X,
} from "lucide-react";
import { Link, NavLink, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
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
        ["rail-link", isActive ? "rail-link-active" : "hover:bg-white/8 hover:text-white"].join(" ")
      }
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-[16px] border border-white/15 bg-white/8">
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
  const { language, setLanguage, t } = useI18n();

  const roles = meQ.data?.roles ?? [];
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
        ...(isDriver ? [{ label: "Driver Hub", to: "/driver-hub", icon: Truck }] : []),
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
    <div className="rail-panel page-enter flex h-full flex-col gap-5">
      <div className="rounded-[24px] border border-white/15 bg-white/8 p-4">
        <Link to="/" onClick={() => setMobileOpen(false)} className="flex items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-[18px] border-2 border-slate-950 bg-[#fff4d7] text-slate-950">
            <Store className="h-6 w-6" />
          </div>
          <div>
            <div className="font-display text-2xl font-semibold tracking-[-0.04em]">{t("app.name")}</div>
            <div className="text-sm text-slate-300">{t("app.tagline")}</div>
          </div>
        </Link>
      </div>

      <div className="paper-panel-muted p-4 text-slate-950">
        <div className="section-kicker text-slate-600">{t("layout.signedInAs")}</div>
        <div className="mt-3 font-display text-2xl font-semibold tracking-[-0.03em]">
          {meQ.data?.name || "Loading user"}
        </div>
        <div className="mt-1 text-sm text-slate-700">
          {roles.length ? roles.join(", ") : t("layout.workspaceMember")}
        </div>
        {currentMarket && (
          <div className="mt-4 rounded-[20px] border-2 border-slate-950 bg-white p-4">
            <div className="section-kicker">{t("layout.activeMarket")}</div>
            <div className="mt-2 font-semibold">{currentMarket.name}</div>
            <div className="text-sm text-slate-600">{currentMarket.code}</div>
          </div>
        )}
      </div>

      <div className="space-y-3">
        <div className="section-kicker px-2 text-slate-300">{t("nav.operations")}</div>
        <div className="space-y-1">
          {primaryNav.map((entry) => (
            <AppNavLink key={entry.to} entry={entry} onNavigate={() => setMobileOpen(false)} />
          ))}
        </div>
      </div>

      {!isCustomerOnly && (
        <div className="space-y-3">
          <div className="section-kicker px-2 text-slate-300">{t("nav.markets")}</div>
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
          <div className="section-kicker px-2 text-slate-300">{t("nav.admin")}</div>
          <div className="space-y-1">
            <AppNavLink entry={{ label: "Drivers", to: "/drivers", icon: Warehouse }} onNavigate={() => setMobileOpen(false)} />
            <AppNavLink entry={{ label: t("nav.users"), to: "/users", icon: Users }} onNavigate={() => setMobileOpen(false)} />
          </div>
        </div>
      )}

      <div className="mt-auto grid gap-3">
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant={language === "ka" ? "default" : "secondary"}
            className="h-11 rounded-[18px]"
            onClick={() => setLanguage("ka")}
          >
            {t("lang.ka")}
          </Button>
          <Button
            variant={language === "en" ? "default" : "secondary"}
            className="h-11 rounded-[18px]"
            onClick={() => setLanguage("en")}
          >
            {t("lang.en")}
          </Button>
        </div>

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
          <div className="paper-panel page-enter page-enter-delay-1 flex items-center justify-between gap-4 px-5 py-4">
            <div>
              <div className="section-kicker">Operations workspace</div>
              <div className="mt-1 font-display text-3xl font-semibold tracking-[-0.04em] text-slate-950">
                Dispatch control room
              </div>
            </div>

            <div className="hidden gap-3 md:flex">
              <div className="metric-block min-w-[150px] py-3">
                <div className="section-kicker">Role set</div>
                <div className="mt-2 text-sm font-semibold text-slate-950">
                  {roles.length ? roles.join(", ") : "Workspace member"}
                </div>
              </div>
              <div className="metric-block min-w-[150px] py-3">
                <div className="section-kicker">Market context</div>
                <div className="mt-2 text-sm font-semibold text-slate-950">
                  {currentMarket?.code || "Global"}
                </div>
              </div>
            </div>

            <Button
              variant="secondary"
              className="h-12 w-12 rounded-[18px] p-0 lg:hidden"
              onClick={() => setMobileOpen((value) => !value)}
            >
              {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </Button>
          </div>

          {mobileOpen && (
            <div className="lg:hidden">
              {sidebar}
            </div>
          )}

          <main className="paper-panel page-enter page-enter-delay-2 min-h-[calc(100vh-9rem)] overflow-hidden p-4 md:p-6">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
