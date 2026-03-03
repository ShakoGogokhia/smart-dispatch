import { useEffect } from "react";
import { Link, NavLink, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { auth } from "@/lib/auth";
import { api } from "@/lib/api";
import { useMe } from "@/lib/useMe";
import { Button } from "@/components/ui/button";

type MarketLite = { id: number; name: string; code: string };

function NavItem({ to, label }: { to: string; label: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        [
          "block rounded-md px-3 py-2 text-sm transition",
          isActive ? "bg-muted font-medium" : "hover:bg-muted/60",
        ].join(" ")
      }
    >
      {label}
    </NavLink>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const nav = useNavigate();
  const meQ = useMe();

  const roles = meQ.data?.roles ?? [];
  const isAdmin = roles.includes("admin");

  // ✅ URL market id (works on /markets/:marketId/...)
  const { marketId: urlMarketId } = useParams();

  // ✅ Load user markets (owner/staff)
  const myMarketsQ = useQuery({
    queryKey: ["my-markets-lite"],
    queryFn: async () => (await api.get("/api/my/markets")).data as MarketLite[],
    enabled: !!meQ.data, // wait until user loaded
  });

  const storedMarketId = localStorage.getItem("activeMarketId") || undefined;

  // ✅ Choose marketId priority:
  // 1) URL param
  // 2) stored active market
  // 3) if user has exactly 1 market => auto use it
  const autoMarketId =
    myMarketsQ.data?.length === 1 ? String(myMarketsQ.data[0].id) : undefined;

  const marketId = urlMarketId || storedMarketId || autoMarketId;

  // ✅ keep storage updated
  useEffect(() => {
    if (urlMarketId) {
      localStorage.setItem("activeMarketId", urlMarketId);
      return;
    }
    if (!storedMarketId && autoMarketId) {
      localStorage.setItem("activeMarketId", autoMarketId);
    }
  }, [urlMarketId, autoMarketId]); // intentionally not depending on storedMarketId

  async function logout() {
    auth.clear();
    nav("/login", { replace: true });
  }

  return (
    <div className="min-h-screen grid grid-cols-[260px_1fr]">
      {/* Sidebar */}
      <aside className="border-r bg-background flex flex-col">
        <div className="p-4 border-b">
          <Link to="/" className="font-semibold">
            Smart Dispatch
          </Link>
          <div className="text-xs text-muted-foreground mt-1">
            {meQ.data ? `${meQ.data.name} (${roles.join(", ") || "no-role"})` : "Loading..."}
          </div>
        </div>

        <nav className="p-3 grid gap-1">
          {/* Dispatch */}
          <div className="px-3 mt-1 mb-1 text-xs text-muted-foreground">Dispatch</div>
          <NavItem to="/orders" label="Orders" />
          <NavItem to="/routes" label="Routes" />
          <NavItem to="/live-map" label="Live Map" />
          <NavItem to="/analytics" label="Analytics" />

          {/* Markets */}
          <div className="px-3 mt-4 mb-1 text-xs text-muted-foreground">Markets</div>
          {isAdmin ? (
            <NavItem to="/markets" label="Markets (Admin)" />
          ) : (
            <NavItem to="/my-markets" label="My Markets" />
          )}

          {/* ✅ Market-specific links show if user has market OR URL contains market */}
          {marketId && (
            <>
              <div className="px-3 mt-4 mb-1 text-xs text-muted-foreground">
                Current Market #{marketId}
              </div>
              <NavItem to={`/markets/${marketId}`} label="Settings / Staff" />
              <NavItem to={`/markets/${marketId}/items`} label="Items" />
              <NavItem to={`/markets/${marketId}/promo-codes`} label="Promo Codes" />
            </>
          )}
        </nav>

        <div className="p-4 border-t mt-auto">
          <Button variant="secondary" className="w-full" onClick={logout}>
            Logout
          </Button>
        </div>
      </aside>

      {/* Main */}
      <main className="p-6">{children}</main>
    </div>
  );
}