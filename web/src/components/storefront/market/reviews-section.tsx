import { forwardRef } from "react";
import { MessageSquare, Star } from "lucide-react";

import { EmptyState } from "@/components/app/empty-state";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";

import { ReviewForm, ReviewListItem, Stars } from "./market-ratings";
import type { MarketReviewRecord } from "./market-utils";

type Props = {
  marketName?: string;
  summary: { average: number; count: number };
  reviews?: MarketReviewRecord[];
  isLoading: boolean;
  isError: boolean;
  isLoggedIn: boolean;
  rating: number;
  onRatingChange: (value: number) => void;
  comment: string;
  onCommentChange: (value: string) => void;
  error: string | null;
  isPending: boolean;
  onSubmit: () => void;
};

export const MarketReviewsSection = forwardRef<HTMLElement, Props>(function MarketReviewsSection(
  {
    marketName,
    summary,
    reviews,
    isLoading,
    isError,
    isLoggedIn,
    rating,
    onRatingChange,
    comment,
    onCommentChange,
    error,
    isPending,
    onSubmit,
  },
  ref,
) {
  const list = reviews ?? [];
  const distribution = [5, 4, 3, 2, 1].map((star) => ({
    star,
    count: list.filter((review) => Math.round(Number(review.rating || 0)) === star).length,
  }));

  return (
    <section ref={ref} id="reviews" className="scroll-mt-32">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Market reviews</CardTitle>
          <CardDescription>What customers say about {marketName || "this market"}.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-[240px_minmax(0,1fr)]">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="text-4xl font-semibold tabular-nums">{summary.average ? summary.average.toFixed(1) : "0.0"}</div>
              <div>
                <Stars value={summary.average} />
                <div className="mt-1 text-xs text-muted-foreground tabular-nums">
                  {summary.count} review{summary.count === 1 ? "" : "s"}
                </div>
              </div>
            </div>
            {list.length > 0 ? (
              <div className="space-y-1.5">
                {distribution.map((row) => (
                  <div key={row.star} className="flex items-center gap-2 text-xs">
                    <span className="flex w-6 items-center gap-0.5 tabular-nums">
                      {row.star}
                      <Star className="size-3 fill-warning text-warning" />
                    </span>
                    <Progress value={(row.count / list.length) * 100} className="h-1.5 flex-1" />
                    <span className="w-6 text-right text-muted-foreground tabular-nums">{row.count}</span>
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          <div className="min-w-0 space-y-4">
            {isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            ) : isError ? (
              <EmptyState compact icon={MessageSquare} title="Market reviews are not available yet." />
            ) : list.length > 0 ? (
              <div className="max-h-[28rem] divide-y overflow-y-auto pr-1">
                {list.map((review) => (
                  <ReviewListItem
                    key={review.id}
                    name={review.user?.name}
                    rating={Number(review.rating)}
                    comment={review.comment}
                    createdAt={review.created_at}
                  />
                ))}
              </div>
            ) : (
              <EmptyState compact icon={MessageSquare} title="No market reviews yet" description="Be the first to review this market." />
            )}

            {isLoggedIn ? (
              <ReviewForm
                id="market-review-comment"
                title="Your market rating"
                rating={rating}
                onRatingChange={onRatingChange}
                comment={comment}
                onCommentChange={onCommentChange}
                placeholder="How was your experience with this market?"
                error={error}
                isPending={isPending}
                submitLabel={`Post ${rating}-star market review`}
                onSubmit={onSubmit}
              />
            ) : (
              <p className="text-xs text-muted-foreground">Sign in to leave a review.</p>
            )}
          </div>
        </CardContent>
      </Card>
    </section>
  );
});
