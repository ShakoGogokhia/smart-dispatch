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
} from "lucide-react";
import { Link, NavLink, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { auth } from "@/lib/auth";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { useMe } from "@/lib/useMe";
import { getActiveMarketId, setActiveMarketId } from "@/lib/cart";
import { Button } from "@/components/ui/button";

type MarketLite = { id: number; name: string; code: string };

type NavEntry = {
  label: string;
  to: string;
  icon: typeof Package;
};

function AppNavLink({ entry }: { entry: NavEntry }) {
  const Icon = entry.icon;

  return (
    <NavLink
      to={entry.to}
      className={({ isActive }) =>
        [
          "group flex items-center gap-3 rounded-[22px] px-4 py-3 text-sm font-medium transition-all duration-300",
          isActive
            ? "spotlight-ring bg-white text-slate-950"
            : "text-slate-300 hover:-translate-y-0.5 hover:bg-white/10 hover:text-white",
        ].join(" ")
      }
    >
      <div
        className={[
          "flex h-10 w-10 items-center justify-center rounded-2xl transition-colors duration-300",
          "bg-white/8 text-slate-200 group-hover:bg-white/14 group-hover:text-white",
        ].join(" ")}
      >
        <Icon className="h-4 w-4" />
      </div>
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
  const isCustomerOnly = roles.includes("customer") && !isAdmin && !roles.includes("owner") && !roles.includes("staff");

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

  async function logout() {
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

  const identity = meQ.data
    ? { title: meQ.data.name, subtitle: roles.length ? roles.join(", ") : t("layout.workspaceMember") }
    : { title: "Loading user", subtitle: "Checking permissions" };

  const sidebar = (
    <div className="flex h-full flex-col gap-5">
      <div className="hero-surface animated-enter p-5">
        <div className="aurora-orb right-[-3rem] top-[-2rem] h-28 w-28 bg-orange-400/30" />
        <div className="aurora-orb bottom-[-1rem] left-[-1.5rem] h-24 w-24 bg-teal-400/20 [animation-delay:1.2s]" />
        <Link to="/" className="relative flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-[22px] bg-gradient-to-br from-amber-300 via-orange-400 to-rose-500 text-slate-950 shadow-[0_18px_40px_rgba(249,115,22,0.35)]">
            <Store className="h-6 w-6" />
          </div>
          <div>
            <div className="font-display text-xl font-bold tracking-[-0.03em] text-white">
              {t("app.name")}
            </div>
            <div className="text-sm text-slate-300">{t("app.tagline")}</div>
          </div>
        </Link>
        <div className="relative mt-5 rounded-[24px] border border-white/10 bg-white/8 p-4">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.28em] text-slate-400">
            <Sparkles className="h-3.5 w-3.5 text-amber-300" />
            Dispatch flow
          </div>
          <div className="mt-3 text-sm leading-6 text-slate-200">
            Real-time operations, sharper decision-making, and a workspace that stays readable under pressure.
          </div>
        </div>
      </div>

      <div className="animated-enter animated-enter-delay-1 rounded-[32px] border border-white/10 bg-slate-950/80 p-4 shadow-[0_30px_80px_rgba(2,6,23,0.42)] backdrop-blur-2xl">
        <div className="rounded-[26px] border border-white/8 bg-white/6 p-4">
          <div className="text-[11px] uppercase tracking-[0.28em] text-slate-400">{t("layout.signedInAs")}</div>
          <div className="mt-3 text-xl font-semibold text-white">{identity.title}</div>
          <div className="mt-1 text-sm text-slate-300">{identity.subtitle}</div>
          {currentMarket && (
            <div className="mt-4 rounded-[22px] border border-emerald-400/18 bg-emerald-400/10 p-4">
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.26em] text-emerald-200">
                <span className="glow-dot h-2 w-2 rounded-full bg-emerald-300" />
                {t("layout.activeMarket")}
              </div>
              <div className="mt-2 font-semibold text-white">{currentMarket.name}</div>
              <div className="text-sm text-emerald-100/80">{currentMarket.code}</div>
            </div>
          )}
        </div>

        <div className="mt-5 space-y-2">
          <div className="px-2 text-[11px] uppercase tracking-[0.28em] text-slate-500">{t("nav.operations")}</div>
          {primaryNav.map((entry) => (
            <AppNavLink key={entry.to} entry={entry} />
          ))}
        </div>

        {!isCustomerOnly && (
          <div className="mt-6 space-y-2">
            <div className="px-2 text-[11px] uppercase tracking-[0.28em] text-slate-500">{t("nav.markets")}</div>
            <AppNavLink
              entry={{
                label: isAdmin ? t("nav.allMarkets") : t("nav.myMarkets"),
                to: isAdmin ? "/markets" : "/my-markets",
                icon: Store,
              }}
            />
            {marketNav.map((entry) => (
              <AppNavLink key={entry.to} entry={entry} />
            ))}
          </div>
        )}

        {isAdmin && (
          <div className="mt-6 space-y-2">
            <div className="px-2 text-[11px] uppercase tracking-[0.28em] text-slate-500">{t("nav.admin")}</div>
            <AppNavLink entry={{ label: "Drivers", to: "/drivers", icon: Warehouse }} />
            <AppNavLink entry={{ label: t("nav.users"), to: "/users", icon: Users }} />
          </div>
        )}

        <div className="mt-6 grid grid-cols-2 gap-2">
          <Button
            variant={language === "ka" ? "default" : "secondary"}
            className="h-11 rounded-2xl"
            onClick={() => setLanguage("ka")}
          >
            {t("lang.ka")}
          </Button>
          <Button
            variant={language === "en" ? "default" : "secondary"}
            className="h-11 rounded-2xl"
            onClick={() => setLanguage("en")}
          >
            {t("lang.en")}
          </Button>
        </div>

        <Button
          variant="secondary"
          className="mt-5 h-12 w-full justify-start rounded-2xl border-0 bg-white/10 px-4 text-white hover:bg-white/16"
          onClick={logout}
        >
          <LogOut className="mr-2 h-4 w-4" />
          {t("nav.logout")}
        </Button>
      </div>
    </div>
  );

  return (
    <div className="relative min-h-screen overflow-hidden px-4 py-4 md:px-6 md:py-6">
      <div className="aurora-orb left-[8%] top-[8%] h-40 w-40 bg-orange-400/22" />
      <div className="aurora-orb right-[10%] top-[14%] h-56 w-56 bg-cyan-400/16 [animation-delay:1.4s]" />
      <div className="aurora-orb bottom-[10%] left-[38%] h-44 w-44 bg-amber-200/16 [animation-delay:2s]" />

      <div className="relative mx-auto flex min-h-[calc(100vh-2rem)] max-w-[1680px] gap-6">
        <aside className="hidden w-[340px] shrink-0 lg:block">{sidebar}</aside>

        <div className="flex min-w-0 min-h-0 flex-1 flex-col gap-4">
          <div className="animated-enter flex items-center justify-between rounded-[28px] border border-white/20 bg-white/70 px-4 py-3 shadow-[0_18px_50px_rgba(8,15,30,0.12)] backdrop-blur-xl lg:hidden">
            <Link to="/" className="font-display text-xl font-bold tracking-[-0.03em] text-slate-950">
              {t("app.name")}
            </Link>
            <Button
              variant="secondary"
              className="h-11 w-11 rounded-2xl p-0"
              onClick={() => setMobileOpen((value) => !value)}
            >
              {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </Button>
          </div>

          {mobileOpen && (
            <div className="lg:hidden">
              <div className="rounded-[32px] border border-white/12 bg-slate-950/92 p-4 shadow-[0_26px_80px_rgba(2,6,23,0.45)] backdrop-blur-2xl">
                {sidebar}
              </div>
            </div>
          )}

          <main className="animated-enter animated-enter-delay-2 relative flex-1 overflow-y-auto rounded-[34px] border border-white/18 bg-white/74 p-4 shadow-[0_28px_90px_rgba(8,15,30,0.14)] backdrop-blur-xl md:p-6 lg:p-7">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/80 to-transparent" />
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
