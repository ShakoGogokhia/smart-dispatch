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
} from "lucide-react";
import { Link, NavLink, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { auth } from "@/lib/auth";
import { api } from "@/lib/api";
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
          "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm transition-all",
          isActive
            ? "bg-white text-slate-950 shadow-[0_14px_36px_rgba(15,23,42,0.18)]"
            : "text-slate-300 hover:bg-white/8 hover:text-white",
        ].join(" ")
      }
    >
      <Icon className="h-4 w-4" />
      <span>{entry.label}</span>
    </NavLink>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const { marketId: routeMarketId } = useParams();
  const meQ = useMe();
  const [mobileOpen, setMobileOpen] = useState(false);

  const roles = meQ.data?.roles ?? [];
  const isAdmin = roles.includes("admin");
  const isCustomerOnly = roles.includes("customer") && !isAdmin && !roles.includes("owner") && !roles.includes("staff");

  const myMarketsQ = useQuery({
    queryKey: ["my-markets-lite"],
    queryFn: async () => (await api.get("/api/my/markets")).data as MarketLite[],
    enabled: !!meQ.data && !roles.includes("customer"),
    retry: false,
  });

  const storedMarketId = getActiveMarketId() || undefined;
  const autoMarketId =
    myMarketsQ.data?.length === 1 ? String(myMarketsQ.data[0].id) : undefined;
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
    ? [{ label: "Orders", to: "/orders", icon: Package }]
    : [
        { label: "Orders", to: "/orders", icon: Package },
        { label: "Routes", to: "/routes", icon: Truck },
        { label: "Live Map", to: "/live-map", icon: Map },
        { label: "Analytics", to: "/analytics", icon: BarChart3 },
      ];

  const marketNav: NavEntry[] = currentMarketId
    ? [
        { label: "Settings", to: `/markets/${currentMarketId}`, icon: Compass },
        { label: "Items", to: `/markets/${currentMarketId}/items`, icon: ShoppingBag },
        { label: "Promo Codes", to: `/markets/${currentMarketId}/promo-codes`, icon: Activity },
      ]
    : [];

  const identity = meQ.data
    ? { title: meQ.data.name, subtitle: roles.length ? roles.join(", ") : "workspace member" }
    : { title: "Loading user", subtitle: "Checking permissions" };

  const sidebar = (
    <div className="flex h-full flex-col gap-6">
      <div className="rounded-[28px] border border-white/10 bg-white/6 p-5 backdrop-blur">
        <Link to="/" className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-300 via-orange-400 to-rose-500 text-slate-950 shadow-lg shadow-orange-950/30">
            <Store className="h-5 w-5" />
          </div>
          <div>
            <div className="font-display text-lg font-semibold tracking-tight text-white">
              Smart Dispatch
            </div>
            <div className="text-xs text-slate-300">Dispatch and market operations</div>
          </div>
        </Link>
      </div>

      <div className="rounded-[28px] border border-white/10 bg-slate-950/70 p-4 shadow-2xl shadow-slate-950/40">
        <div className="mb-4 rounded-2xl bg-white/6 p-4">
          <div className="text-xs uppercase tracking-[0.24em] text-slate-400">Signed in as</div>
          <div className="mt-2 text-lg font-semibold text-white">{identity.title}</div>
          <div className="text-sm text-slate-300">{identity.subtitle}</div>
          {currentMarket && (
            <div className="mt-4 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-3">
              <div className="text-xs uppercase tracking-[0.2em] text-emerald-200">Active market</div>
              <div className="mt-1 font-medium text-white">{currentMarket.name}</div>
              <div className="text-sm text-emerald-100/80">{currentMarket.code}</div>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <div className="px-2 text-xs uppercase tracking-[0.24em] text-slate-500">Operations</div>
          {primaryNav.map((entry) => (
            <AppNavLink key={entry.to} entry={entry} />
          ))}
        </div>

        {!isCustomerOnly && (
          <div className="mt-6 space-y-2">
            <div className="px-2 text-xs uppercase tracking-[0.24em] text-slate-500">Markets</div>
            <AppNavLink
              entry={{
                label: isAdmin ? "All Markets" : "My Markets",
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
            <div className="px-2 text-xs uppercase tracking-[0.24em] text-slate-500">Admin</div>
            <AppNavLink entry={{ label: "Users", to: "/users", icon: Users }} />
          </div>
        )}

        <Button
          variant="secondary"
          className="mt-6 w-full justify-start rounded-2xl border-0 bg-white/10 px-4 py-6 text-white hover:bg-white/16"
          onClick={logout}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Logout
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(251,191,36,0.22),_transparent_30%),radial-gradient(circle_at_top_right,_rgba(45,212,191,0.14),_transparent_28%),linear-gradient(180deg,_#09111f_0%,_#0f172a_42%,_#f4efe7_42%,_#f7f1e8_100%)]">
      <div className="mx-auto flex min-h-screen max-w-[1600px] gap-6 px-4 py-4 lg:px-6 lg:py-6">
        <aside className="hidden w-[320px] shrink-0 lg:block">{sidebar}</aside>

        <div className="flex min-h-screen min-w-0 flex-1 flex-col gap-4">
          <div className="flex items-center justify-between rounded-[28px] border border-white/20 bg-white/65 px-4 py-3 shadow-[0_20px_50px_rgba(15,23,42,0.10)] backdrop-blur lg:hidden">
            <Link to="/" className="font-display text-lg font-semibold tracking-tight text-slate-950">
              Smart Dispatch
            </Link>
            <Button
              variant="secondary"
              className="rounded-2xl"
              onClick={() => setMobileOpen((value) => !value)}
            >
              <Menu className="h-4 w-4" />
            </Button>
          </div>

          {mobileOpen && (
            <div className="lg:hidden">
              <div className="rounded-[28px] border border-white/20 bg-slate-900/94 p-4 shadow-2xl">
                {sidebar}
              </div>
            </div>
          )}

          <main className="flex-1 rounded-[32px] border border-white/20 bg-white/70 p-4 shadow-[0_24px_60px_rgba(15,23,42,0.12)] backdrop-blur md:p-6">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
