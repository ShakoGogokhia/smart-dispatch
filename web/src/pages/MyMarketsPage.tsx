import { ExternalLink, LayoutDashboard, Megaphone, Package, Settings, Sparkles, Store, TicketPercent } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { api } from "@/lib/api";
import { setActiveMarketId } from "@/lib/cart";
import { formatMoney, toNumber } from "@/lib/format";
import type { StorefrontMarket } from "@/lib/storefront";

import { PageHeader } from "@/components/app/page-header";
import { StatCard, StatGrid } from "@/components/app/stat-card";
import { EmptyState } from "@/components/app/empty-state";
import { LoadingState } from "@/components/app/loading-state";
import { StatusBadge } from "@/components/app/status-badge";
import { MarketBanner, MarketLogo } from "@/components/markets/market-media";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardFooter } from "@/components/ui/card";

type Market = StorefrontMarket;

export default function MyMarketsPage() {
  const marketsQ = useQuery({
    queryKey: ["my-markets"],
    queryFn: async () => (await api.get("/api/my/markets")).data as Market[],
  });

  const markets = marketsQ.data ?? [];
  const featuredCount = markets.filter((market) => market.is_featured).length;
  const promoCount = markets.filter((market) => market.active_promo).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="My markets"
        description="Every market you own or work in. Jump to the dashboard, products, promotions or settings for each one."
        actions={
          <Button asChild variant="outline">
            <Link to="/badge-pricing">
              <Megaphone />
              Promotion studio
            </Link>
          </Button>
        }
      />

      <StatGrid className="md:grid-cols-3 xl:grid-cols-3">
        <StatCard label="Assigned markets" value={markets.length} icon={Store} tone="primary" hint="Connected to your account" />
        <StatCard label="Promoted" value={featuredCount} icon={Sparkles} tone="warning" hint="Using featured visibility" />
        <StatCard label="Live offers" value={promoCount} icon={TicketPercent} tone="success" hint="Promotion running now" />
      </StatGrid>

      {marketsQ.isLoading ? (
        <LoadingState rows={3} />
      ) : marketsQ.isError ? (
        <Alert variant="destructive">
          <AlertDescription>Failed to load markets.</AlertDescription>
        </Alert>
      ) : markets.length === 0 ? (
        <EmptyState
          icon={Store}
          title="No markets yet"
          description="No markets are assigned to your account yet. Ask an admin to add you as an owner or staff member."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {markets.map((market) => {
            const select = () => setActiveMarketId(String(market.id));
            const isOpen = market.operating_status?.is_open;

            return (
              <Card key={market.id} className="gap-0 overflow-hidden py-0">
                <MarketBanner src={market.banner_url} name={market.name}>
                  {market.is_featured ? (
                    <StatusBadge tone="warning" className="bg-warning text-warning-foreground">
                      <Sparkles className="size-3" />
                      {market.featured_badge || "Promoted"}
                    </StatusBadge>
                  ) : null}
                </MarketBanner>

                <div className="flex flex-1 flex-col gap-4 p-4">
                  <div className="flex items-start gap-3">
                    <MarketLogo src={market.logo_url ?? market.image_url} name={market.name} className="-mt-10 size-14 border-2 border-card bg-card shadow-sm" />
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-base font-semibold">{market.name}</h3>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <Badge variant="outline" className="font-mono">
                          {market.code}
                        </Badge>
                        <StatusBadge tone={market.is_active ? "success" : "neutral"} dot>
                          {market.is_active ? "Live storefront" : "Hidden storefront"}
                        </StatusBadge>
                        {market.operating_status ? (
                          <StatusBadge tone={isOpen ? "info" : "destructive"}>{isOpen ? "Open" : "Closed"}</StatusBadge>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <p className="line-clamp-2 text-sm text-muted-foreground">{market.featured_headline || market.address || "No address added yet."}</p>

                  <dl className="grid grid-cols-2 gap-3 rounded-lg border bg-muted/30 p-3 text-sm">
                    <div className="min-w-0">
                      <dt className="text-xs text-muted-foreground">Catalog</dt>
                      <dd className="font-medium tabular-nums">{market.active_items_count ?? 0} visible items</dd>
                    </div>
                    <div className="min-w-0">
                      <dt className="text-xs text-muted-foreground">Offer</dt>
                      <dd className="truncate font-medium">
                        {market.active_promo
                          ? market.active_promo.type === "percent"
                            ? `${toNumber(market.active_promo.value)}% off`
                            : `${formatMoney(market.active_promo.value)} off`
                          : "No live promo"}
                      </dd>
                      {market.active_promo ? <dd className="truncate text-xs text-muted-foreground">{market.active_promo.code}</dd> : null}
                    </div>
                  </dl>
                </div>

                <CardFooter className="grid grid-cols-2 gap-2 border-t bg-muted/20 px-4 py-3">
                  <Button asChild className="col-span-2" onClick={select}>
                    <Link to={`/markets/${market.id}/dashboard`}>
                      <LayoutDashboard />
                      Dashboard
                    </Link>
                  </Button>
                  <Button asChild variant="outline" onClick={select}>
                    <Link to={`/markets/${market.id}/items`}>
                      <Package />
                      Products
                    </Link>
                  </Button>
                  <Button asChild variant="outline" onClick={select}>
                    <Link to={`/markets/${market.id}/promo-codes`}>
                      <TicketPercent />
                      Promos
                    </Link>
                  </Button>
                  <Button asChild variant="outline" onClick={select}>
                    <Link to={`/markets/${market.id}`}>
                      <Settings />
                      Settings
                    </Link>
                  </Button>
                  <Button asChild variant="outline">
                    <Link to={`/m/${market.id}`} target="_blank" rel="noreferrer">
                      <ExternalLink />
                      Storefront
                    </Link>
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
