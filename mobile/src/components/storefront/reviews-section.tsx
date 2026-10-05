import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { AppText, Card, EmptyState, Progress, Row, Separator, Skeleton, useColors } from "@/src/components/ui";

import { ReviewForm, ReviewListItem, Stars } from "./common";
import type { MarketReviewRecord } from "./utils";

export function MarketReviewsSection({
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
}: {
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
}) {
  const c = useColors();
  const list = reviews ?? [];
  const distribution = [5, 4, 3, 2, 1].map((star) => ({
    star,
    count: list.filter((review) => Math.round(Number(review.rating || 0)) === star).length,
  }));

  return (
    <Card title="Market reviews" description={`What customers say about ${marketName || "this market"}.`}>
      <Row gap={12}>
        <Text style={[styles.average, { color: c.foreground }]}>{summary.average ? summary.average.toFixed(1) : "0.0"}</Text>
        <View>
          <Stars value={summary.average} />
          <AppText variant="caption" style={styles.mt4}>
            {summary.count} review{summary.count === 1 ? "" : "s"}
          </AppText>
        </View>
      </Row>

      {list.length > 0 ? (
        <View style={styles.gap6}>
          {distribution.map((row) => (
            <Row key={row.star} gap={8}>
              <Row gap={2} style={styles.starLabel}>
                <AppText variant="caption" tone="default" style={styles.tabular}>
                  {row.star}
                </AppText>
                <Ionicons name="star" size={11} color={c.warning} />
              </Row>
              <View style={styles.flex}>
                <Progress value={(row.count / list.length) * 100} />
              </View>
              <AppText variant="caption" style={[styles.count, styles.tabular]}>
                {row.count}
              </AppText>
            </Row>
          ))}
        </View>
      ) : null}

      <Separator />

      {isLoading ? (
        <View style={styles.gap8}>
          <Skeleton height={56} />
          <Skeleton height={56} />
        </View>
      ) : isError ? (
        <EmptyState compact icon="chatbubble-outline" title="Market reviews are not available yet." />
      ) : list.length > 0 ? (
        <View>
          {list.map((review, index) => (
            <View key={review.id}>
              {index > 0 ? <Separator style={styles.sep} /> : null}
              <ReviewListItem name={review.user?.name} rating={Number(review.rating)} comment={review.comment} createdAt={review.created_at} />
            </View>
          ))}
        </View>
      ) : (
        <EmptyState compact icon="chatbubble-outline" title="No market reviews yet" description="Be the first to review this market." />
      )}

      {isLoggedIn ? (
        <ReviewForm
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
        <AppText variant="caption">Sign in to leave a review.</AppText>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  mt4: { marginTop: 4 },
  gap6: { gap: 6 },
  gap8: { gap: 8 },
  tabular: { fontVariant: ["tabular-nums"] },
  average: { fontSize: 36, fontWeight: "600", fontVariant: ["tabular-nums"], letterSpacing: -0.5 },
  starLabel: { width: 26 },
  count: { width: 24, textAlign: "right" },
  sep: { marginVertical: 12 },
});
