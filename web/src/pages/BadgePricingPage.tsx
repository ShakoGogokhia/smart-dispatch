import { useState } from "react";
import { Send, Sparkles, Star, Users } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMe } from "@/lib/useMe";

type MyMarket = {
  id: number;
  name: string;
  code: string;
};

type BadgeRequest = {
  id: number;
  badge: string;
  duration_days: number;
  status: string;
  notes?: string | null;
  created_at?: string;
  market?: {
    id: number;
    name: string;
    code: string;
  } | null;
};

const badgePlans = [
  { badge: "VIP Market", price: "$120 / 7 days", text: "Top-line placement with premium visual weight.", icon: Star },
  { badge: "New Market", price: "$60 / 7 days", text: "Launch support for a recently opened storefront.", icon: Sparkles },
  { badge: "Staff Pick", price: "$90 / 7 days", text: "Editorial-style recommendation visible on the public page.", icon: Users },
];

export default function BadgePricingPage() {
  const qc = useQueryClient();
  const meQ = useMe();
  const roles = meQ.data?.roles ?? [];
  const [marketId, setMarketId] = useState("");
  const [badge, setBadge] = useState("VIP Market");
  const [durationDays, setDurationDays] = useState("7");
  const [notes, setNotes] = useState("");

  const marketsQ = useQuery({
    queryKey: ["my-markets-badge-pricing"],
    queryFn: async () => (await api.get("/api/my/markets")).data as MyMarket[],
  });

  const requestsQ = useQuery({
    queryKey: ["my-badge-requests", roles.includes("admin")],
    queryFn: async () => (await api.get(roles.includes("admin") ? "/api/badge-requests" : "/api/my/badge-requests")).data as BadgeRequest[],
    enabled: !!meQ.data,
  });

  const requestM = useMutation({
    mutationFn: async () => {
      return (
        await api.post(`/api/markets/${marketId}/badge-requests`, {
          badge,
          duration_days: Number(durationDays) || 7,
          notes: notes.trim() || null,
        })
      ).data as BadgeRequest;
    },
    onSuccess: async () => {
      setNotes("");
      await qc.invalidateQueries({ queryKey: ["my-badge-requests"] });
      await qc.invalidateQueries({ queryKey: ["my-badge-requests", true] });
    },
  });

  return (
    <div className="grid gap-6">
      <section className="intro-panel">
        <h1 className="intro-title">Badge pricing</h1>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {badgePlans.map((plan) => {
          const Icon = plan.icon;
          return (
            <Card key={plan.badge}>
              <CardContent className="grid gap-4 p-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-[18px] bg-cyan-50 text-cyan-700 dark:bg-cyan-300/10 dark:text-cyan-100">
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <div className="theme-ink text-xl font-semibold">{plan.badge}</div>
                  <div className="theme-warm mt-2 text-sm font-semibold">{plan.price}</div>
                </div>
                <div className="theme-copy text-sm leading-7">{plan.text}</div>
              </CardContent>
            </Card>
          );
        })}
      </section>

      <section className="dashboard-card">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="field-group">
            <Label>Market</Label>
            <Select value={marketId} onValueChange={setMarketId}>
              <SelectTrigger>
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
            <Label>Badge</Label>
            <Select value={badge} onValueChange={setBadge}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {badgePlans.map((plan) => (
                  <SelectItem key={plan.badge} value={plan.badge}>
                    {plan.badge}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="field-group">
            <Label>Duration (days)</Label>
            <Input value={durationDays} onChange={(event) => setDurationDays(event.target.value)} />
          </div>

          <div className="field-group">
            <Label>Notes</Label>
            <Input value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Why this market should be featured" />
          </div>
        </div>

        <div className="mt-5">
          <Button onClick={() => requestM.mutate()} disabled={!marketId || requestM.isPending}>
            <Send className="h-4 w-4" />
            {requestM.isPending ? "Sending..." : "Send badge request"}
          </Button>
        </div>
      </section>

      <section className="dashboard-card">
        <div className="section-kicker">Requests</div>
        <div className="mt-4 grid gap-3">
          {(requestsQ.data ?? []).map((request) => (
            <div key={request.id} className="subpanel flex flex-col gap-3 px-4 py-4 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="theme-ink font-semibold">{request.market?.name ?? "Market"} - {request.badge}</div>
                <div className="theme-copy text-sm">{request.duration_days} days - {request.notes || "No note"}</div>
              </div>
              <div className="status-chip">{request.status}</div>
            </div>
          ))}
          {!(requestsQ.data ?? []).length && <div className="theme-copy text-sm">No badge requests yet.</div>}
        </div>
      </section>
    </div>
  );
}
