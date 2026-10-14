/**
 * "Rate your order": after delivery the customer rates each item, the market and the courier in one go.
 * Backend: GET/POST /api/orders/{order}/review. Item + market ratings become storefront reviews.
 */
import { useState } from "react";
import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import type { AxiosError } from "axios";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { MediaImage } from "@/src/components/storefront/common";
import { Alert, AppText, Badge, Button, Card, Input, Row, Separator, Skeleton, radius } from "@/src/components/ui";
import { api } from "@/src/lib/api";
import { getErrorMessage } from "@/src/lib/errors";

import { StarRating } from "./star-rating";

type ExistingReview = { rating: number; comment?: string | null } | null;

export type OrderReviewPayload = {
  order_id: number;
  code: string;
  can_review: boolean;
  is_complete: boolean;
  items: { item_id: number; name: string; image_url?: string | null; review: ExistingReview }[];
  market: { id: number; name: string; slug?: string | null; review: ExistingReview } | null;
  driver: { id: number; name?: string | null; review: ExistingReview } | null;
};

type Draft = { rating: number; comment: string };
type FormState = { items: Record<number, Draft>; market: Draft; driver: Draft };

export function orderReviewQueryKey(orderId: number) {
  return ["order-review", orderId] as const;
}

function draftFrom(review: ExistingReview): Draft {
  return { rating: review?.rating ?? 0, comment: review?.comment ?? "" };
}

function formFrom(data: OrderReviewPayload): FormState {
  const items: Record<number, Draft> = {};
  for (const item of data.items) items[item.item_id] = draftFrom(item.review);
  return { items, market: draftFrom(data.market?.review ?? null), driver: draftFrom(data.driver?.review ?? null) };
}

function averageRating(data: OrderReviewPayload) {
  const ratings = [
    ...data.items.map((item) => item.review?.rating ?? 0),
    data.market?.review?.rating ?? 0,
    data.driver?.review?.rating ?? 0,
  ].filter((value) => value > 0);
  return ratings.length ? ratings.reduce((sum, value) => sum + value, 0) / ratings.length : 0;
}

/**
 * Self-loading review card for one order. Renders nothing when the current user can't rate it
 * (not their order / signed out → 401/403) or when it hasn't been delivered yet.
 */
export function OrderReview({ orderId, framed = true }: { orderId: number; framed?: boolean }) {
  const reviewQ = useQuery({
    queryKey: orderReviewQueryKey(orderId),
    queryFn: async () => (await api.get(`/api/orders/${orderId}/review`)).data as OrderReviewPayload,
    retry: false,
  });

  const status = (reviewQ.error as AxiosError | null)?.response?.status;
  if (status === 401 || status === 403 || status === 404) return null;

  const wrap = (content: ReactNode) => (framed ? <Card>{content}</Card> : <View style={styles.plain}>{content}</View>);

  if (reviewQ.isLoading) {
    return wrap(
      <View style={styles.gap8}>
        <Skeleton height={20} width="60%" />
        <Skeleton height={56} />
      </View>,
    );
  }

  if (reviewQ.isError || !reviewQ.data) {
    return wrap(<Alert tone="destructive" title="Could not load your review" description={getErrorMessage(reviewQ.error, "Please try again later.")} />);
  }

  if (!reviewQ.data.can_review) return null;

  return wrap(<OrderReviewBody key={reviewQ.data.order_id} data={reviewQ.data} />);
}

function OrderReviewBody({ data }: { data: OrderReviewPayload }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState>(() => formFrom(data));
  const [mode, setMode] = useState<"form" | "summary">(data.is_complete ? "summary" : "form");
  const [justSubmitted, setJustSubmitted] = useState(false);

  const submitM = useMutation({
    mutationFn: async () => {
      const items = data.items
        .map((item) => ({ item_id: item.item_id, ...form.items[item.item_id] }))
        .filter((entry) => entry.rating > 0)
        .map((entry) => ({ item_id: entry.item_id, rating: entry.rating, comment: entry.comment.trim() || null }));
      const body: Record<string, unknown> = {};
      if (items.length) body.items = items;
      if (data.market && form.market.rating > 0) body.market = { rating: form.market.rating, comment: form.market.comment.trim() || null };
      if (data.driver && form.driver.rating > 0) body.driver = { rating: form.driver.rating, comment: form.driver.comment.trim() || null };
      return (await api.post(`/api/orders/${data.order_id}/review`, body)).data as OrderReviewPayload;
    },
    onSuccess: async (next) => {
      queryClient.setQueryData(orderReviewQueryKey(data.order_id), next);
      setForm(formFrom(next));
      setMode("summary");
      setJustSubmitted(true);
      await Promise.all(
        [["order-review", data.order_id], ["market-reviews"], ["public-market"], ["public-market-items"], ["item-reviews"], ["review-eligibility"], ["orders"], ["order-detail"]].map(
          (queryKey) => queryClient.invalidateQueries({ queryKey }),
        ),
      );
    },
  });

  const hasRating =
    Object.values(form.items).some((draft) => draft.rating > 0) || (!!data.market && form.market.rating > 0) || (!!data.driver && form.driver.rating > 0);

  const setItem = (itemId: number, patch: Partial<Draft>) =>
    setForm((current) => ({ ...current, items: { ...current.items, [itemId]: { ...current.items[itemId], ...patch } } }));
  const setMarket = (patch: Partial<Draft>) => setForm((current) => ({ ...current, market: { ...current.market, ...patch } }));
  const setDriver = (patch: Partial<Draft>) => setForm((current) => ({ ...current, driver: { ...current.driver, ...patch } }));

  if (mode === "summary") {
    return (
      <View style={styles.gap12}>
        {justSubmitted ? <Alert tone="success" title="Thanks! Your review was added." /> : null}
        <Row justify="space-between" gap={12} wrap>
          <View style={styles.flexShrink}>
            <AppText variant="caption">{data.code}</AppText>
            <Row gap={8} wrap>
              <AppText variant="label">You rated this order</AppText>
              <StarRating value={averageRating(data)} size={16} />
            </Row>
          </View>
          <Button
            size="sm"
            variant="outline"
            icon="create-outline"
            onPress={() => {
              setJustSubmitted(false);
              setMode("form");
            }}
          >
            Edit review
          </Button>
        </Row>
      </View>
    );
  }

  return (
    <View style={styles.gap16}>
      <View style={styles.gap4}>
        <Row justify="space-between" gap={8}>
          <AppText variant="heading" style={styles.flexShrink}>
            How was your order?
          </AppText>
          <Badge variant="outline">{data.code}</Badge>
        </Row>
        <AppText variant="small" tone="muted">
          Your ratings help other shoppers. They&apos;re added to the market&apos;s reviews.
        </AppText>
      </View>

      {data.items.length > 0 ? (
        <View style={styles.gap12}>
          <AppText variant="label" style={styles.semibold}>
            Items
          </AppText>
          {data.items.map((item) => {
            const draft = form.items[item.item_id] ?? { rating: 0, comment: "" };
            return (
              <View key={item.item_id} style={styles.gap8}>
                <Row gap={12} align="flex-start">
                  <MediaImage uri={item.image_url} style={styles.thumb} icon="cube-outline" iconSize={20} />
                  <View style={styles.flexShrink}>
                    <Row gap={6} wrap>
                      <AppText variant="label" numberOfLines={2} style={styles.flexShrink}>
                        {item.name}
                      </AppText>
                      {item.review ? <Badge tone="success" icon="checkmark">Rated</Badge> : null}
                    </Row>
                    <StarRating value={draft.rating} onChange={(rating) => setItem(item.item_id, { rating })} size={26} label={`Rate ${item.name}`} />
                  </View>
                </Row>
                {draft.rating > 0 ? (
                  <Input value={draft.comment} onChangeText={(comment) => setItem(item.item_id, { comment })} placeholder="Add a comment (optional)" multiline />
                ) : null}
              </View>
            );
          })}
        </View>
      ) : null}

      {data.market ? (
        <>
          <Separator />
          <ReviewSection
            title={`Rate ${data.market.name}`}
            rated={!!data.market.review}
            draft={form.market}
            onRating={(rating) => setMarket({ rating })}
            onComment={(comment) => setMarket({ comment })}
          />
        </>
      ) : null}

      {data.driver ? (
        <>
          <Separator />
          <ReviewSection
            title={`Rate your courier${data.driver.name ? ` ${data.driver.name}` : ""}`}
            rated={!!data.driver.review}
            draft={form.driver}
            onRating={(rating) => setDriver({ rating })}
            onComment={(comment) => setDriver({ comment })}
          />
        </>
      ) : null}

      {submitM.error ? <Alert tone="destructive" title={getErrorMessage(submitM.error, "Could not submit your review.")} /> : null}

      <Row gap={8}>
        {data.is_complete ? (
          <Button variant="outline" onPress={() => setMode("summary")} style={styles.flex}>
            Cancel
          </Button>
        ) : null}
        <Button icon="star-outline" onPress={() => submitM.mutate()} disabled={!hasRating} loading={submitM.isPending} style={styles.flex}>
          Submit review
        </Button>
      </Row>
    </View>
  );
}

function ReviewSection({
  title,
  rated,
  draft,
  onRating,
  onComment,
}: {
  title: string;
  rated: boolean;
  draft: Draft;
  onRating: (rating: number) => void;
  onComment: (comment: string) => void;
}) {
  return (
    <View style={styles.gap8}>
      <Row gap={6} wrap>
        <AppText variant="label" style={[styles.semibold, styles.flexShrink]}>
          {title}
        </AppText>
        {rated ? <Badge tone="success" icon="checkmark">Rated</Badge> : null}
      </Row>
      <StarRating value={draft.rating} onChange={onRating} label={title} />
      <Input value={draft.comment} onChangeText={onComment} placeholder="Add a comment (optional)" multiline />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  flexShrink: { flexShrink: 1, flexGrow: 1 },
  semibold: { fontWeight: "600" },
  plain: { gap: 12 },
  gap4: { gap: 4 },
  gap8: { gap: 8 },
  gap12: { gap: 12 },
  gap16: { gap: 16 },
  thumb: { width: 48, height: 48, borderRadius: radius.md },
});
