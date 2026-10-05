import { useEffect, useMemo, useState } from "react";
import { Check, CircleSlash, Layers3, Megaphone, Package, Sparkles, WandSparkles } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { api } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { useMe } from "@/lib/useMe";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";
import { LoadingState } from "@/components/app/loading-state";
import { OrderStatusBadge, StatusBadge, humanizeStatus } from "@/components/app/status-badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type PromotionPlanKey = "week" | "month" | "year";
type PromotionTargetType = "market" | "item";
type PromotionTone = "amber" | "cyan" | "emerald" | "rose" | "slate";
type PromotionShape = "pill" | "soft" | "outline";

type MarketRecord = {
  id: number;
  name: string;
  code: string;
  address?: string | null;
  featured_badge?: string | null;
  featured_headline?: string | null;
  featured_copy?: string | null;
  logo_url?: string | null;
  banner_url?: string | null;
};

type MarketItem = {
  id: number;
  name: string;
  sku: string;
  category?: string | null;
  image_url?: string | null;
  price: number | string;
  is_promoted?: boolean;
};

type PromotionPurchase = {
  id: number;
  target_type: PromotionTargetType;
  plan_key: PromotionPlanKey;
  price_label: string;
  badge?: string | null;
  headline?: string | null;
  copy?: string | null;
  duration_days: number;
  starts_at?: string | null;
  ends_at?: string | null;
  status: string;
  market?: {
    id: number;
    name: string;
    code: string;
  } | null;
  item?: {
    id: number;
    name: string;
    sku?: string | null;
  } | null;
};

type TemplateKey = "vip_market" | "staff_pick" | "fast_delivery";

const promotionPlans: Array<{
  key: PromotionPlanKey;
  label: string;
  durationText: string;
  priceLabel: string;
  text: string;
}> = [
  {
    key: "week",
    label: "7 days",
    durationText: "Weekly push",
    priceLabel: "$120 / 7 days",
    text: "Short-term storefront boost for launches, events, and campaign weeks.",
  },
  {
    key: "month",
    label: "30 days",
    durationText: "Monthly run",
    priceLabel: "$360 / 30 days",
    text: "Sustained placement for stores that want a stronger public presence all month.",
  },
  {
    key: "year",
    label: "365 days",
    durationText: "Annual visibility",
    priceLabel: "$2400 / 365 days",
    text: "Long-term featured placement for flagship storefronts and always-on promotion.",
  },
];

const defaultPreviewByPlan: Record<PromotionPlanKey, { badge: string; headline: string; copy: string }> = {
  week: {
    badge: "Boost Week",
    headline: "Weekly spotlight across the marketplace",
    copy: "Feature this storefront for a short premium campaign and stronger landing-page discovery.",
  },
  month: {
    badge: "Featured Market",
    headline: "Monthly featured storefront visibility",
    copy: "Promote this market with a premium badge, headline, and stronger public placement for the month.",
  },
  year: {
    badge: "Flagship Market",
    headline: "Year-round premium storefront placement",
    copy: "Keep this market in a premium promoted state for long-term visibility and stronger branding.",
  },
};

const marketTemplates: Array<{
  key: TemplateKey;
  label: string;
  badge: string;
  headline: string;
  copy: string;
  tone: PromotionTone;
  shape: PromotionShape;
}> = [
  {
    key: "vip_market",
    label: "VIP Market",
    badge: "VIP Market",
    headline: "Premium storefront now featured",
    copy: "This storefront is running a premium featured placement across the marketplace.",
    tone: "amber",
    shape: "pill",
  },
  {
    key: "staff_pick",
    label: "Staff Pick",
    badge: "Staff Pick",
    headline: "Picked for quality and consistency",
    copy: "Highlighted by the team for strong service, presentation, and customer experience.",
    tone: "rose",
    shape: "soft",
  },
  {
    key: "fast_delivery",
    label: "Fast Delivery",
    badge: "Fast Delivery",
    headline: "Featured for quick fulfillment",
    copy: "Promoted for reliable ordering, faster turnaround, and smooth delivery flow.",
    tone: "cyan",
    shape: "pill",
  },
];

// The stored tone names are kept for the API; the preview maps them onto theme tokens.
function getBadgePreviewClass(tone: PromotionTone, shape: PromotionShape) {
  const toneMap: Record<PromotionTone, string> = {
    amber: "border border-warning bg-warning text-warning-foreground",
    cyan: "border border-info bg-info text-primary-foreground",
    emerald: "border border-success bg-success text-primary-foreground",
    rose: "border border-destructive bg-destructive text-primary-foreground",
    slate: "border border-foreground bg-foreground text-background",
  };

  const shapeMap: Record<PromotionShape, string> = {
    pill: "rounded-full",
    soft: "rounded-lg",
    outline: "rounded-full",
  };

  const outlineToneMap: Record<PromotionTone, string> = {
    amber: "border border-warning bg-background text-warning",
    cyan: "border border-info bg-background text-info",
    emerald: "border border-success bg-background text-success",
    rose: "border border-destructive bg-background text-destructive",
    slate: "border border-foreground bg-background text-foreground",
  };

  return `${shapeMap[shape]} px-3 py-1 text-xs font-semibold shadow-sm ${shape === "outline" ? outlineToneMap[tone] : toneMap[tone]}`;
}

function customPrice(priceLabel: string) {
  return priceLabel.replace("$120", "$220").replace("$360", "$640").replace("$2400", "$4200");
}

function resolveMediaUrl(url?: string | null) {
  if (!url) {
    return null;
  }

  try {
    const apiOrigin = new URL(api.defaults.baseURL ?? window.location.origin).origin;
    const parsed = new URL(url, apiOrigin);

    if (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1") {
      return `${apiOrigin}${parsed.pathname}${parsed.search}${parsed.hash}`;
    }

    return parsed.toString();
  } catch {
    return url;
  }
}

export default function BadgePricingPage() {
  const qc = useQueryClient();
  const meQ = useMe();
  const roles = meQ.data?.roles ?? [];
  const canManagePromotion = roles.includes("owner") || roles.includes("admin");

  const [marketId, setMarketId] = useState("");
  const [targetType, setTargetType] = useState<PromotionTargetType>("market");
  const [itemId, setItemId] = useState("");
  const [planKey, setPlanKey] = useState<PromotionPlanKey>("week");
  const [templateKey, setTemplateKey] = useState<TemplateKey>("vip_market");
  const [isCustomSponsor, setIsCustomSponsor] = useState(false);
  const [badge, setBadge] = useState(defaultPreviewByPlan.week.badge);
  const [headline, setHeadline] = useState(defaultPreviewByPlan.week.headline);
  const [copy, setCopy] = useState(defaultPreviewByPlan.week.copy);
  const [tone, setTone] = useState<PromotionTone>("amber");
  const [shape, setShape] = useState<PromotionShape>("pill");

  const marketsQ = useQuery({
    queryKey: ["promotion-my-markets"],
    queryFn: async () => (await api.get("/api/my/markets")).data as MarketRecord[],
    enabled: canManagePromotion,
  });

  const itemsQ = useQuery({
    queryKey: ["promotion-market-items", marketId],
    queryFn: async () => (await api.get(`/api/markets/${marketId}/items`)).data as MarketItem[],
    enabled: canManagePromotion && targetType === "item" && !!marketId,
  });

  const purchasesQ = useQuery({
    queryKey: ["promotion-purchases", marketId],
    queryFn: async () => (await api.get(`/api/markets/${marketId}/promotion-purchases`)).data as PromotionPurchase[],
    enabled: canManagePromotion && !!marketId,
  });

  useEffect(() => {
    if (!isCustomSponsor) {
      const selectedTemplate = marketTemplates.find((entry) => entry.key === templateKey) ?? marketTemplates[0];
      setBadge(selectedTemplate.badge);
      setHeadline(selectedTemplate.headline);
      setCopy(selectedTemplate.copy);
      setTone(selectedTemplate.tone);
      setShape(selectedTemplate.shape);
      return;
    }

    const defaults = defaultPreviewByPlan[planKey];
    setBadge((current) => current || defaults.badge);
    setHeadline((current) => current || defaults.headline);
    setCopy((current) => current || defaults.copy);
  }, [isCustomSponsor, planKey, templateKey]);

  useEffect(() => {
    setItemId("");
  }, [marketId, targetType]);

  const purchaseM = useMutation({
    mutationFn: async () => {
      return (
        await api.post(`/api/markets/${marketId}/promotion-purchases`, {
          target_type: targetType,
          item_id: targetType === "item" ? Number(itemId) : null,
          plan_key: planKey,
          template_key: targetType === "market" && !isCustomSponsor ? templateKey : null,
          is_custom_sponsor: targetType === "market" ? isCustomSponsor : false,
          badge: targetType === "market" && isCustomSponsor ? badge.trim() || null : null,
          headline: targetType === "market" && isCustomSponsor ? headline.trim() || null : null,
          copy: targetType === "market" && isCustomSponsor ? copy.trim() || null : null,
          theme: targetType === "market" ? { tone, shape } : null,
        })
      ).data as PromotionPurchase;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["promotion-purchases", marketId] });
      await qc.invalidateQueries({ queryKey: ["promotion-my-markets"] });
      await qc.invalidateQueries({ queryKey: ["my-markets"] });
      await qc.invalidateQueries({ queryKey: ["markets"] });
      await qc.invalidateQueries({ queryKey: ["public-markets"] });
      await qc.invalidateQueries({ queryKey: ["public-market", marketId] });
      if (targetType === "item") {
        await qc.invalidateQueries({ queryKey: ["promotion-market-items", marketId] });
      }
      toast.success("Promotion purchased and activated");
    },
  });

  const selectedMarket = useMemo(
    () => (marketsQ.data ?? []).find((market) => String(market.id) === marketId) ?? null,
    [marketId, marketsQ.data],
  );

  const selectedItem = useMemo(
    () => (itemsQ.data ?? []).find((item) => String(item.id) === itemId) ?? null,
    [itemId, itemsQ.data],
  );

  const selectedPlan = promotionPlans.find((plan) => plan.key === planKey) ?? promotionPlans[0];
  const effectivePriceLabel =
    targetType === "market" && isCustomSponsor
      ? customPrice(selectedPlan.priceLabel)
      : selectedPlan.priceLabel;
  const purchaseError =
    (purchaseM.error as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message ??
    (purchaseM.error as { message?: string })?.message ??
    null;

  const canPurchase =
    !!marketId &&
    (targetType === "market" || !!itemId) &&
    (targetType === "item" || badge.trim().length > 0);

  if (!canManagePromotion) {
    return (
      <div className="space-y-6">
        <PageHeader title="Storefront promotion" />
        <EmptyState
          icon={CircleSlash}
          title="Owners and admins only"
          description="Only market owners or admins can purchase storefront promotion."
        />
      </div>
    );
  }

  const purchases = purchasesQ.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Storefront promotion"
        description="Market owners can purchase promotion directly here. Market promotion applies immediately and turns the storefront into a promoted market automatically."
        actions={
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary" className="tabular-nums">
              {marketsQ.data?.length ?? 0} markets
            </Badge>
            <Badge variant="secondary" className="tabular-nums">
              {promotionPlans.length} plans
            </Badge>
          </div>
        }
      />

      <section className="grid gap-4 md:grid-cols-3">
        {promotionPlans.map((plan) => {
          const selected = plan.key === planKey;
          return (
            <Card key={plan.key} className={cn("transition-shadow", selected && "ring-2 ring-primary")}>
              <CardHeader>
                <CardTitle className="text-base">{plan.durationText}</CardTitle>
                <CardDescription>{plan.label}</CardDescription>
                {selected ? (
                  <CardAction>
                    <Badge>Selected</Badge>
                  </CardAction>
                ) : null}
              </CardHeader>
              <CardContent className="grid gap-4">
                <div>
                  <div className="text-2xl font-semibold tabular-nums tracking-tight">{plan.priceLabel.split(" / ")[0]}</div>
                  <div className="text-xs text-muted-foreground">
                    per {plan.label} · custom sponsor {customPrice(plan.priceLabel).split(" / ")[0]}
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">{plan.text}</p>
                <ul className="grid gap-2 text-sm">
                  {[`${plan.label} of featured placement`, "Promoted badge on the storefront or item", "Activates immediately after purchase"].map((feature) => (
                    <li key={feature} className="flex items-start gap-2">
                      <Check className="mt-0.5 size-4 shrink-0 text-success" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter className="mt-auto">
                <Button variant={selected ? "default" : "outline"} className="w-full" onClick={() => setPlanKey(plan.key)}>
                  {selected ? "Selected plan" : "Choose plan"}
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </section>

      <section className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="text-base">What customers will see</CardTitle>
            <CardDescription>Live preview of the promoted card.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-hidden rounded-lg border bg-card">
              <div className="relative h-40 bg-muted">
                {resolveMediaUrl(selectedMarket?.banner_url ?? selectedMarket?.logo_url) ? (
                  <img
                    src={resolveMediaUrl(selectedMarket?.banner_url ?? selectedMarket?.logo_url) ?? undefined}
                    alt={selectedMarket?.name ?? "Preview"}
                    className="h-full w-full object-cover"
                  />
                ) : null}
                <div className="absolute left-3 top-3">
                  <span className={getBadgePreviewClass(tone, shape)}>
                    {targetType === "market" ? badge || "Promoted Market" : "Promoted Item"}
                  </span>
                </div>
              </div>

              <div className="grid gap-3 p-4">
                <div className="flex items-start gap-3">
                  {resolveMediaUrl(selectedMarket?.logo_url) ? (
                    <img
                      src={resolveMediaUrl(selectedMarket?.logo_url) ?? undefined}
                      alt={selectedMarket?.name ?? "Market logo"}
                      className="size-12 shrink-0 rounded-lg border object-cover"
                    />
                  ) : (
                    <div className="flex size-12 shrink-0 items-center justify-center rounded-lg border bg-muted text-muted-foreground">
                      {targetType === "market" ? <Megaphone className="size-5" /> : <Package className="size-5" />}
                    </div>
                  )}

                  <div className="min-w-0">
                    <div className="truncate font-semibold">
                      {targetType === "market" ? selectedMarket?.name || "Selected market" : selectedItem?.name || "Selected item"}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {targetType === "market"
                        ? headline || "Featured storefront headline"
                        : `${selectedMarket?.name || "Selected market"} item promotion`}
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">
                  {targetType === "market"
                    ? copy || "Promotion copy will appear here."
                    : "This item will be marked as promoted and stay highlighted inside the storefront."}
                </div>

                <div className="flex flex-wrap gap-2">
                  <StatusBadge>{selectedPlan.durationText}</StatusBadge>
                  <StatusBadge tone="success">{effectivePriceLabel}</StatusBadge>
                  <StatusBadge>{targetType === "market" ? "Storefront promotion" : "Item promotion"}</StatusBadge>
                  {targetType === "market" && isCustomSponsor ? <StatusBadge tone="warning">Custom sponsor</StatusBadge> : null}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Choose promotion settings</CardTitle>
            <CardDescription>Pick the market, what to promote and for how long.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="promo-market">Market</Label>
                <Select value={marketId} onValueChange={setMarketId}>
                  <SelectTrigger id="promo-market" className="w-full">
                    <SelectValue placeholder="Select your market" />
                  </SelectTrigger>
                  <SelectContent>
                    {(marketsQ.data ?? []).map((market) => (
                      <SelectItem key={market.id} value={String(market.id)}>
                        {market.name} ({market.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="promo-target">Promotion target</Label>
                <Select value={targetType} onValueChange={(value) => setTargetType(value as PromotionTargetType)}>
                  <SelectTrigger id="promo-target" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="market">Market storefront</SelectItem>
                    <SelectItem value="item">Single item</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="promo-plan">Plan</Label>
                <Select value={planKey} onValueChange={(value) => setPlanKey(value as PromotionPlanKey)}>
                  <SelectTrigger id="promo-plan" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {promotionPlans.map((plan) => (
                      <SelectItem key={plan.key} value={plan.key}>
                        {plan.durationText} ({plan.priceLabel})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {targetType === "item" ? (
                <div className="grid gap-2">
                  <Label htmlFor="promo-item">Item</Label>
                  <Select value={itemId} onValueChange={setItemId} disabled={!marketId}>
                    <SelectTrigger id="promo-item" className="w-full">
                      <SelectValue placeholder={marketId ? "Select an item" : "Choose a market first"} />
                    </SelectTrigger>
                    <SelectContent>
                      {(itemsQ.data ?? []).map((item) => (
                        <SelectItem key={item.id} value={String(item.id)}>
                          {item.name} ({item.sku})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
            </div>

            {targetType === "market" ? (
              <>
                <div className="flex flex-col gap-3 rounded-lg border bg-muted/30 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="text-sm font-medium">{isCustomSponsor ? "Custom sponsor" : "Safe template"}</div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Standard storefront promotion uses safe pre-made copy only. Custom sponsor unlocks custom text, color, and badge shape for a higher cost.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant={isCustomSponsor ? "default" : "outline"}
                    className="shrink-0"
                    onClick={() => setIsCustomSponsor((current) => !current)}
                  >
                    <WandSparkles />
                    {isCustomSponsor ? "Using custom sponsor" : "Switch to custom sponsor"}
                  </Button>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  {!isCustomSponsor ? (
                    <div className="grid gap-2 sm:col-span-2">
                      <Label htmlFor="promo-template">Safe promotion template</Label>
                      <Select value={templateKey} onValueChange={(value) => setTemplateKey(value as TemplateKey)}>
                        <SelectTrigger id="promo-template" className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {marketTemplates.map((template) => (
                            <SelectItem key={template.key} value={template.key}>
                              {template.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : null}

                  <div className="grid gap-2">
                    <Label htmlFor="promo-badge">Badge</Label>
                    <Input id="promo-badge" value={badge} onChange={(event) => setBadge(event.target.value)} disabled={!isCustomSponsor} />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="promo-headline">Headline</Label>
                    <Input id="promo-headline" value={headline} onChange={(event) => setHeadline(event.target.value)} disabled={!isCustomSponsor} />
                  </div>

                  <div className="grid gap-2 sm:col-span-2">
                    <Label htmlFor="promo-copy">Preview copy</Label>
                    <Input id="promo-copy" value={copy} onChange={(event) => setCopy(event.target.value)} disabled={!isCustomSponsor} />
                    {!isCustomSponsor ? <p className="text-xs text-muted-foreground">Switch to custom sponsor to edit the text.</p> : null}
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="promo-tone">Badge color</Label>
                    <Select value={tone} onValueChange={(value) => setTone(value as PromotionTone)} disabled={!isCustomSponsor}>
                      <SelectTrigger id="promo-tone" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="amber">Amber</SelectItem>
                        <SelectItem value="cyan">Cyan</SelectItem>
                        <SelectItem value="emerald">Emerald</SelectItem>
                        <SelectItem value="rose">Rose</SelectItem>
                        <SelectItem value="slate">Slate</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="promo-shape">Badge shape</Label>
                    <Select value={shape} onValueChange={(value) => setShape(value as PromotionShape)} disabled={!isCustomSponsor}>
                      <SelectTrigger id="promo-shape" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pill">Pill</SelectItem>
                        <SelectItem value="soft">Soft</SelectItem>
                        <SelectItem value="outline">Outline</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </>
            ) : (
              <Alert>
                <Package />
                <AlertTitle>Item promotion</AlertTitle>
                <AlertDescription>
                  Purchasing item promotion marks the selected item as promoted immediately and keeps it highlighted for the selected duration.
                </AlertDescription>
              </Alert>
            )}

            {purchaseError ? (
              <Alert variant="destructive">
                <AlertDescription>{purchaseError}</AlertDescription>
              </Alert>
            ) : null}
          </CardContent>
          <CardFooter className="flex-col items-stretch gap-3 border-t sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground">
              Total <span className="font-medium text-foreground tabular-nums">{effectivePriceLabel}</span>. This action activates promotion
              immediately and updates the public storefront state automatically.
            </p>
            <Button className="shrink-0" onClick={() => purchaseM.mutate()} disabled={!canPurchase || purchaseM.isPending}>
              {purchaseM.isPending ? "Processing..." : `Purchase ${targetType === "market" ? "market" : "item"} promotion`}
            </Button>
          </CardFooter>
        </Card>
      </section>

      <Card className="gap-0 overflow-hidden py-0">
        <CardHeader className="border-b py-4">
          <CardTitle className="text-base">Promotion purchases</CardTitle>
          <CardDescription className="flex items-center gap-1.5">
            <Layers3 className="size-3.5" />
            {marketId ? "Filtered by selected market" : "Select a market to view purchases"}
          </CardDescription>
        </CardHeader>

        {!marketId ? (
          <EmptyState compact icon={Layers3} title="No market selected" description="Select a market to see promotion history." />
        ) : purchasesQ.isLoading ? (
          <LoadingState rows={2} className="p-4" />
        ) : !purchases.length ? (
          <EmptyState
            compact
            icon={Sparkles}
            title="No purchases yet"
            description="No promotion purchases yet for this market. Choose a plan above to get started."
          />
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6">Promotion</TableHead>
                    <TableHead>Target</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Ends</TableHead>
                    <TableHead className="pr-6">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {purchases.map((purchase) => (
                    <TableRow key={purchase.id}>
                      <TableCell className="pl-6">
                        <div className="font-medium">{purchaseTitle(purchase)}</div>
                        <div className="text-xs text-muted-foreground">{purchase.badge || purchase.plan_key}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{humanizeStatus(purchase.target_type)}</Badge>
                      </TableCell>
                      <TableCell className="tabular-nums">
                        <div>{purchase.duration_days} days</div>
                        <div className="text-xs text-muted-foreground">{purchase.price_label}</div>
                      </TableCell>
                      <TableCell className="text-sm">{purchase.ends_at ? formatDateTime(purchase.ends_at) : "-"}</TableCell>
                      <TableCell className="pr-6">
                        <OrderStatusBadge status={purchase.status} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="divide-y md:hidden">
              {purchases.map((purchase) => (
                <div key={purchase.id} className="grid gap-2 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 font-medium">{purchaseTitle(purchase)}</div>
                    <OrderStatusBadge status={purchase.status} />
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {purchase.duration_days} days · {purchase.price_label} · {purchase.badge || purchase.plan_key}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="outline">{humanizeStatus(purchase.target_type)}</Badge>
                    Ends: {purchase.ends_at ? formatDateTime(purchase.ends_at) : "-"}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </Card>
    </div>
  );
}

function purchaseTitle(purchase: PromotionPurchase) {
  return purchase.target_type === "market"
    ? `${purchase.market?.name ?? "Market"} storefront promotion`
    : `${purchase.item?.name ?? "Item"} item promotion`;
}
