import { useId, useState } from "react";
import type { ReactNode } from "react";
import { AlertCircle, CheckCircle2, Package, Store, Truck } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AxiosError } from "axios";
import { toast } from "sonner";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

import { StarDisplay, StarRating } from "./star-rating";

type ExistingReview = { rating: number; comment: string | null } | null;

export type OrderReviewPayload = {
  order_id: number;
  code: string;
  can_review: boolean;
  is_complete: boolean;
  items: Array<{ item_id: number; name: string; image_url: string | null; review: ExistingReview }>;
  market: { id: number; name: string; slug: string | null; review: ExistingReview } | null;
  driver: { id: number; name: string | null; review: ExistingReview } | null;
};

type Draft = { rating: number; comment: string };

const HELPER_TEXT = "Your ratings help other shoppers. They're added to the market's reviews.";

function apiErrorMessage(error: unknown) {
  const axiosError = error as AxiosError<{ message?: string }> | null;
  return axiosError?.response?.data?.message ?? (error as Error | null)?.message ?? "Something went wrong.";
}

function apiErrorStatus(error: unknown) {
  return (error as AxiosError | null)?.response?.status;
}

function toDraft(review: ExistingReview): Draft {
  return { rating: review?.rating ?? 0, comment: review?.comment ?? "" };
}

function allRatings(data: OrderReviewPayload) {
  return [...data.items.map((item) => item.review), data.market?.review ?? null, data.driver?.review ?? null]
    .filter((review): review is NonNullable<ExistingReview> => review !== null)
    .map((review) => review.rating);
}

function orderReviewQueryKey(orderId: number) {
  return ["order-review", orderId] as const;
}

/**
 * "Rate your order": one card to rate every item, the market and the courier of a delivered order.
 * Pre-filled from existing ratings, so it doubles as "Edit your review".
 *
 * - `variant="card"` renders its own Card with header; `"plain"` renders just the body (e.g. inside a Dialog).
 * - `hideWhenUnavailable` hides the card entirely when the API refuses (401/403), e.g. on the public tracking page.
 */
export function OrderReview({
  orderId,
  variant = "card",
  hideWhenUnavailable = false,
  className,
}: {
  orderId: number;
  variant?: "card" | "plain";
  hideWhenUnavailable?: boolean;
  className?: string;
}) {
  const reviewQ = useQuery({
    queryKey: orderReviewQueryKey(orderId),
    queryFn: async () => (await api.get(`/api/orders/${orderId}/review`)).data as OrderReviewPayload,
    retry: false,
  });

  if (reviewQ.isLoading) {
    const skeleton = (
      <div className="grid gap-3" aria-busy="true">
        <span className="sr-only">Loading your review...</span>
        <Skeleton className="h-14 rounded-lg" />
        <Skeleton className="h-14 rounded-lg" />
      </div>
    );
    return variant === "card" ? (
      <Card className={className}>
        <CardContent>{skeleton}</CardContent>
      </Card>
    ) : (
      skeleton
    );
  }

  if (reviewQ.isError) {
    const status = apiErrorStatus(reviewQ.error);
    if (hideWhenUnavailable && (status === 401 || status === 403 || status === 404)) return null;
    return (
      <Alert variant="destructive" className={className}>
        <AlertCircle />
        <AlertDescription>{apiErrorMessage(reviewQ.error)}</AlertDescription>
      </Alert>
    );
  }

  const data = reviewQ.data;
  if (!data || !data.can_review) return null;

  return <OrderReviewBody data={data} variant={variant} className={className} />;
}

function OrderReviewBody({
  data,
  variant,
  className,
}: {
  data: OrderReviewPayload;
  variant: "card" | "plain";
  className?: string;
}) {
  const [editing, setEditing] = useState(!data.is_complete);
  const ratings = allRatings(data);
  const hasAnyRating = ratings.length > 0;
  const showForm = editing || !hasAnyRating;

  const content = showForm ? (
    <OrderReviewForm
      data={data}
      onDone={() => setEditing(false)}
      onCancel={hasAnyRating ? () => setEditing(false) : undefined}
    />
  ) : (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
      <CheckCircle2 className="size-4 shrink-0 text-success" />
      <span>You rated this order</span>
      <StarDisplay value={ratings.reduce((sum, value) => sum + value, 0) / ratings.length} />
      <span aria-hidden className="text-muted-foreground">
        ·
      </span>
      <Button variant="link" size="sm" className="h-auto p-0" onClick={() => setEditing(true)}>
        Edit review
      </Button>
    </div>
  );

  if (variant === "plain") return <div className={className}>{content}</div>;

  return (
    <Card className={cn("gap-4", className)}>
      <CardHeader>
        <CardTitle className="text-base">How was your order?</CardTitle>
        <CardDescription>
          <span className="font-mono">{data.code}</span>
          {showForm ? <span className="mt-1 block">{HELPER_TEXT}</span> : null}
        </CardDescription>
        {data.is_complete ? (
          <CardAction>
            <Badge variant="secondary">
              <CheckCircle2 />
              Rated
            </Badge>
          </CardAction>
        ) : null}
      </CardHeader>
      <CardContent>{content}</CardContent>
    </Card>
  );
}

function OrderReviewForm({
  data,
  onDone,
  onCancel,
}: {
  data: OrderReviewPayload;
  onDone: () => void;
  onCancel?: () => void;
}) {
  const queryClient = useQueryClient();
  const [items, setItems] = useState<Record<number, Draft>>(() =>
    Object.fromEntries(data.items.map((item) => [item.item_id, toDraft(item.review)])),
  );
  const [market, setMarket] = useState<Draft>(() => toDraft(data.market?.review ?? null));
  const [driver, setDriver] = useState<Draft>(() => toDraft(data.driver?.review ?? null));

  const ratedItems = data.items.filter((item) => (items[item.item_id]?.rating ?? 0) > 0);
  const canSubmit = ratedItems.length > 0 || (data.market && market.rating > 0) || (data.driver && driver.rating > 0);

  const submitM = useMutation({
    mutationFn: async () => {
      const body: Record<string, unknown> = {};
      if (ratedItems.length > 0) {
        body.items = ratedItems.map((item) => ({
          item_id: item.item_id,
          rating: items[item.item_id].rating,
          comment: items[item.item_id].comment.trim() || null,
        }));
      }
      if (data.market && market.rating > 0) {
        body.market = { rating: market.rating, comment: market.comment.trim() || null };
      }
      if (data.driver && driver.rating > 0) {
        body.driver = { rating: driver.rating, comment: driver.comment.trim() || null };
      }
      return (await api.post(`/api/orders/${data.order_id}/review`, body)).data as OrderReviewPayload;
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(orderReviewQueryKey(data.order_id), updated);
      toast.success("Thanks! Your review was added.");
      onDone();
      void Promise.all(
        [
          orderReviewQueryKey(data.order_id),
          ["market-reviews"],
          ["item-reviews"],
          ["review-eligibility"],
          ["public-market"],
          ["public-market-items"],
          ["orders"],
          ["order-detail"],
          ["customer-history"],
        ].map((queryKey) => queryClient.invalidateQueries({ queryKey })),
      );
    },
  });

  return (
    <div className="grid gap-5">
      {data.items.length > 0 ? (
        <ReviewSection title={data.items.length === 1 ? "Item" : "Items"}>
          <div className="grid gap-3">
            {data.items.map((item) => (
              <RatingRow
                key={item.item_id}
                media={
                  item.image_url ? (
                    <img src={item.image_url} alt="" className="size-12 rounded-md border object-cover" loading="lazy" />
                  ) : (
                    <span className="flex size-12 items-center justify-center rounded-md border bg-muted text-muted-foreground">
                      <Package className="size-5" />
                    </span>
                  )
                }
                title={item.name}
                rated={item.review !== null}
                draft={items[item.item_id] ?? { rating: 0, comment: "" }}
                onChange={(draft) => setItems((current) => ({ ...current, [item.item_id]: draft }))}
                disabled={submitM.isPending}
              />
            ))}
          </div>
        </ReviewSection>
      ) : null}

      {data.market ? (
        <>
          {data.items.length > 0 ? <Separator /> : null}
          <ReviewSection title="Market">
            <RatingRow
              media={
                <span className="flex size-12 items-center justify-center rounded-md border bg-muted text-muted-foreground">
                  <Store className="size-5" />
                </span>
              }
              title={`Rate ${data.market.name}`}
              rated={data.market.review !== null}
              draft={market}
              onChange={setMarket}
              disabled={submitM.isPending}
            />
          </ReviewSection>
        </>
      ) : null}

      {data.driver ? (
        <>
          <Separator />
          <ReviewSection title="Courier">
            <RatingRow
              media={
                <span className="flex size-12 items-center justify-center rounded-md border bg-muted text-muted-foreground">
                  <Truck className="size-5" />
                </span>
              }
              title={`Rate your courier ${data.driver.name ?? ""}`.trim()}
              rated={data.driver.review !== null}
              draft={driver}
              onChange={setDriver}
              disabled={submitM.isPending}
            />
          </ReviewSection>
        </>
      ) : null}

      {submitM.isError ? (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertDescription>{apiErrorMessage(submitM.error)}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-wrap justify-end gap-2">
        {onCancel ? (
          <Button variant="ghost" onClick={onCancel} disabled={submitM.isPending}>
            Cancel
          </Button>
        ) : null}
        <Button onClick={() => submitM.mutate()} disabled={!canSubmit || submitM.isPending}>
          {submitM.isPending ? <Spinner /> : null}
          {submitM.isPending ? "Submitting..." : "Submit review"}
        </Button>
      </div>
    </div>
  );
}

function ReviewSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="grid gap-3">
      <h4 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{title}</h4>
      {children}
    </section>
  );
}

function RatingRow({
  media,
  title,
  rated,
  draft,
  onChange,
  disabled,
}: {
  media: ReactNode;
  title: string;
  rated: boolean;
  draft: Draft;
  onChange: (draft: Draft) => void;
  disabled: boolean;
}) {
  const commentId = useId();

  return (
    <div className="grid gap-2">
      <div className="flex items-start gap-3">
        <div className="shrink-0">{media}</div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium break-words">{title}</span>
            {rated ? (
              <Badge variant="secondary">
                <CheckCircle2 />
                Rated
              </Badge>
            ) : null}
          </div>
          <StarRating
            value={draft.rating}
            onChange={(rating) => onChange({ ...draft, rating })}
            label={title}
            size="sm"
            disabled={disabled}
            className="mt-0.5"
          />
        </div>
      </div>
      {draft.rating > 0 ? (
        <div className="grid gap-1.5 sm:pl-15">
          <Label htmlFor={commentId} className="sr-only">
            Comment for {title}
          </Label>
          <Textarea
            id={commentId}
            value={draft.comment}
            onChange={(event) => onChange({ ...draft, comment: event.target.value })}
            placeholder="Add a comment (optional)"
            rows={2}
            maxLength={1000}
            disabled={disabled}
          />
        </div>
      ) : null}
    </div>
  );
}

/** "Rate order" dialog used from order lists. Pass `order` to open it, `null` to close. */
export function OrderReviewDialog({
  order,
  onClose,
}: {
  order: { id: number; code: string } | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={order != null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>How was your order?</DialogTitle>
          <DialogDescription>
            {order ? <span className="font-mono">{order.code}</span> : null}
            <span className="mt-1 block">{HELPER_TEXT}</span>
          </DialogDescription>
        </DialogHeader>
        {order ? <OrderReview orderId={order.id} variant="plain" /> : null}
      </DialogContent>
    </Dialog>
  );
}
