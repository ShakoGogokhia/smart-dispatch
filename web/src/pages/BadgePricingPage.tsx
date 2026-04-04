import { useEffect, useMemo, useState } from "react";
import { Layers3, Megaphone, Package, Sparkles, WandSparkles } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/lib/api";
import { useMe } from "@/lib/useMe";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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

function getBadgePreviewClass(tone: PromotionTone, shape: PromotionShape) {
  const toneMap: Record<PromotionTone, string> = {
    amber: "bg-amber-300 text-black border border-amber-200",
    cyan: "bg-cyan-500 text-white border border-cyan-400",
    emerald: "bg-emerald-500 text-white border border-emerald-400",
    rose: "bg-rose-500 text-white border border-rose-400",
    slate: "bg-slate-900 text-white border border-slate-800",
  };

  const shapeMap: Record<PromotionShape, string> = {
    pill: "rounded-full",
    soft: "rounded-2xl",
    outline: "rounded-full bg-transparent text-current",
  };

  const outlineToneMap: Record<PromotionTone, string> = {
    amber: "border border-amber-300 bg-amber-50 text-amber-800",
    cyan: "border border-cyan-400 bg-cyan-50 text-cyan-700",
    emerald: "border border-emerald-400 bg-emerald-50 text-emerald-700",
    rose: "border border-rose-400 bg-rose-50 text-rose-700",
    slate: "border border-slate-400 bg-slate-50 text-slate-700",
  };

  return `${shapeMap[shape]} px-3 py-1 text-xs font-semibold ${shape === "outline" ? outlineToneMap[tone] : toneMap[tone]}`;
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
      ? selectedPlan.priceLabel.replace("$120", "$220").replace("$360", "$640").replace("$2400", "$4200")
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
      <Card className="rounded-[30px]">
        <CardContent className="p-8 text-sm text-slate-600 dark:text-slate-300">
          Only market owners or admins can purchase storefront promotion.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-6">
      <section className="intro-panel">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="section-kicker text-white/70">Promotion Studio</div>
            <h1 className="intro-title">Storefront promotion</h1>
            <p className="intro-copy">
              Market owners can purchase promotion directly here. Market promotion applies immediately and turns the storefront into a promoted market automatically.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="status-chip">{marketsQ.data?.length ?? 0} markets</span>
            <span className="status-chip">{promotionPlans.length} plans</span>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {promotionPlans.map((plan) => (
          <Card key={plan.key}>
            <CardContent className="grid gap-4 p-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-[18px] bg-cyan-50 text-cyan-700 dark:bg-cyan-300/10 dark:text-cyan-100">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <div className="theme-ink text-xl font-semibold">{plan.durationText}</div>
                <div className="theme-warm mt-2 text-sm font-semibold">{plan.priceLabel}</div>
              </div>
              <div className="theme-copy text-sm leading-7">{plan.text}</div>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="grid gap-5 lg:grid-cols-[360px_minmax(0,1fr)]">
        <Card>
          <CardContent className="grid gap-5 p-6">
            <div>
              <div className="section-kicker">Preview</div>
              <div className="theme-ink mt-2 text-2xl font-semibold">What customers will see</div>
            </div>

            <div className="overflow-hidden rounded-[28px] border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
              <div className="relative h-44 bg-zinc-100 dark:bg-zinc-800">
                {resolveMediaUrl(selectedMarket?.banner_url ?? selectedMarket?.logo_url) ? (
                  <img
                    src={resolveMediaUrl(selectedMarket?.banner_url ?? selectedMarket?.logo_url) ?? undefined}
                    alt={selectedMarket?.name ?? "Preview"}
                    className="h-full w-full object-cover"
                  />
                ) : null}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                <div className="absolute left-4 top-4">
                  <span className={getBadgePreviewClass(tone, shape)}>
                    {targetType === "market" ? badge || "Promoted Market" : "Promoted Item"}
                  </span>
                </div>
              </div>

              <div className="grid gap-3 p-5">
                <div className="flex items-start gap-3">
                  {resolveMediaUrl(selectedMarket?.logo_url) ? (
                    <img
                      src={resolveMediaUrl(selectedMarket?.logo_url) ?? undefined}
                      alt={selectedMarket?.name ?? "Market logo"}
                      className="h-16 w-16 rounded-[1.4rem] border border-zinc-200 object-cover dark:border-zinc-800"
                    />
                  ) : (
                    <div className="flex h-16 w-16 items-center justify-center rounded-[1.4rem] border border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-800">
                      {targetType === "market" ? <Megaphone className="h-6 w-6 text-zinc-400" /> : <Package className="h-6 w-6 text-zinc-400" />}
                    </div>
                  )}

                  <div className="min-w-0">
                    <div className="theme-ink text-xl font-semibold">
                      {targetType === "market"
                        ? selectedMarket?.name || "Selected market"
                        : selectedItem?.name || "Selected item"}
                    </div>
                    <div className="theme-muted mt-1 text-sm">
                      {targetType === "market"
                        ? headline || "Featured storefront headline"
                        : `${selectedMarket?.name || "Selected market"} item promotion`}
                    </div>
                  </div>
                </div>

                <div className="rounded-[22px] border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950">
                  <div className="theme-copy text-sm leading-7">
                    {targetType === "market"
                      ? copy || "Promotion copy will appear here."
                      : "This item will be marked as promoted and stay highlighted inside the storefront."}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <span className="status-chip status-neutral">{selectedPlan.durationText}</span>
                  <span className="status-chip status-good">{effectivePriceLabel}</span>
                  <span className="status-chip status-neutral">
                    {targetType === "market" ? "Storefront promotion" : "Item promotion"}
                  </span>
                  {targetType === "market" && isCustomSponsor ? (
                    <span className="status-chip status-warn">Custom sponsor</span>
                  ) : null}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="grid gap-5 p-6">
            <div>
              <div className="section-kicker">Purchase</div>
              <div className="theme-ink mt-2 text-2xl font-semibold">Choose promotion settings</div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="field-group">
                <Label className="field-label">Market</Label>
                <Select value={marketId} onValueChange={setMarketId}>
                  <SelectTrigger className="input-shell w-full">
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

              <div className="field-group">
                <Label className="field-label">Promotion target</Label>
                <Select value={targetType} onValueChange={(value) => setTargetType(value as PromotionTargetType)}>
                  <SelectTrigger className="input-shell w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="market">Market storefront</SelectItem>
                    <SelectItem value="item">Single item</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="field-group">
                <Label className="field-label">Plan</Label>
                <Select value={planKey} onValueChange={(value) => setPlanKey(value as PromotionPlanKey)}>
                  <SelectTrigger className="input-shell w-full">
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
                <div className="field-group">
                  <Label className="field-label">Item</Label>
                  <Select value={itemId} onValueChange={setItemId} disabled={!marketId}>
                    <SelectTrigger className="input-shell w-full">
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

              {targetType === "market" ? (
                <>
                  <div className="paper-panel-muted p-5 md:col-span-2">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="section-kicker">Safety</div>
                        <div className="theme-copy mt-2 text-sm leading-7">
                          Standard storefront promotion uses safe pre-made copy only. Custom sponsor unlocks custom text, color, and badge shape for a higher cost.
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant={isCustomSponsor ? "default" : "secondary"}
                        onClick={() => setIsCustomSponsor((current) => !current)}
                      >
                        <WandSparkles className="mr-2 h-4 w-4" />
                        {isCustomSponsor ? "Using custom sponsor" : "Switch to custom sponsor"}
                      </Button>
                    </div>
                  </div>

                  {!isCustomSponsor ? (
                    <div className="field-group md:col-span-2">
                      <Label className="field-label">Safe promotion template</Label>
                      <Select value={templateKey} onValueChange={(value) => setTemplateKey(value as TemplateKey)}>
                        <SelectTrigger className="input-shell w-full">
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

                  <div className="field-group">
                    <Label className="field-label">Badge</Label>
                    <Input value={badge} onChange={(event) => setBadge(event.target.value)} className="input-shell" disabled={!isCustomSponsor} />
                  </div>

                  <div className="field-group">
                    <Label className="field-label">Headline</Label>
                    <Input value={headline} onChange={(event) => setHeadline(event.target.value)} className="input-shell" disabled={!isCustomSponsor} />
                  </div>

                  <div className="field-group md:col-span-2">
                    <Label className="field-label">Preview copy</Label>
                    <Input value={copy} onChange={(event) => setCopy(event.target.value)} className="input-shell" disabled={!isCustomSponsor} />
                  </div>

                  <div className="field-group">
                    <Label className="field-label">Badge color</Label>
                    <Select value={tone} onValueChange={(value) => setTone(value as PromotionTone)} disabled={!isCustomSponsor}>
                      <SelectTrigger className="input-shell w-full">
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

                  <div className="field-group">
                    <Label className="field-label">Badge shape</Label>
                    <Select value={shape} onValueChange={(value) => setShape(value as PromotionShape)} disabled={!isCustomSponsor}>
                      <SelectTrigger className="input-shell w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pill">Pill</SelectItem>
                        <SelectItem value="soft">Soft</SelectItem>
                        <SelectItem value="outline">Outline</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </>
              ) : (
                <div className="paper-panel-muted p-5 md:col-span-2">
                  <div className="section-kicker">Item promotion</div>
                  <div className="theme-copy mt-2 text-sm leading-7">
                    Purchasing item promotion marks the selected item as promoted immediately and keeps it highlighted for the selected duration.
                  </div>
                </div>
              )}
            </div>

            {purchaseError ? <div className="text-sm text-red-700 dark:text-red-300">{purchaseError}</div> : null}

            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={() => purchaseM.mutate()} disabled={!canPurchase || purchaseM.isPending}>
                {purchaseM.isPending ? "Processing..." : `Purchase ${targetType === "market" ? "market" : "item"} promotion`}
              </Button>
              <div className="theme-muted text-sm">
                This action activates promotion immediately and updates the public storefront state automatically.
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="dashboard-card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="section-kicker">History</div>
            <div className="theme-ink mt-2 text-2xl font-semibold">Promotion purchases</div>
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
            <Layers3 className="h-4 w-4" />
            {marketId ? "Filtered by selected market" : "Select a market to view purchases"}
          </div>
        </div>

        <div className="mt-5 grid gap-3">
          {(purchasesQ.data ?? []).map((purchase) => (
            <div key={purchase.id} className="subpanel flex flex-col gap-3 px-4 py-4 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="theme-ink font-semibold">
                  {purchase.target_type === "market"
                    ? `${purchase.market?.name ?? "Market"} storefront promotion`
                    : `${purchase.item?.name ?? "Item"} item promotion`}
                </div>
                <div className="theme-copy text-sm">
                  {purchase.duration_days} days • {purchase.price_label} • {purchase.badge || purchase.plan_key}
                </div>
                <div className="theme-muted mt-1 text-xs">
                  Ends at: {purchase.ends_at || "-"}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="status-chip status-neutral">{purchase.target_type}</span>
                <span className="status-chip status-good">{purchase.status}</span>
              </div>
            </div>
          ))}

          {!marketId ? (
            <div className="theme-copy text-sm">Select a market to see promotion history.</div>
          ) : null}

          {marketId && purchasesQ.isLoading ? (
            <div className="theme-copy text-sm">Loading promotion history...</div>
          ) : null}

          {marketId && !purchasesQ.isLoading && !(purchasesQ.data ?? []).length ? (
            <div className="theme-copy text-sm">No promotion purchases yet for this market.</div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
