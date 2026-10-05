import { Star } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

import { formatReviewDate, initials } from "./market-utils";

export function StarPicker({
  value,
  onChange,
  size = "md",
}: {
  value: number;
  onChange: (value: number) => void;
  size?: "sm" | "md" | "lg";
}) {
  const sizeClass = size === "sm" ? "size-4" : size === "lg" ? "size-7" : "size-5";

  return (
    <div className="flex items-center gap-1" role="radiogroup" aria-label="Rating">
      {[1, 2, 3, 4, 5].map((star) => {
        const active = star <= value;
        return (
          <button
            key={star}
            type="button"
            role="radio"
            aria-checked={star === value}
            onClick={() => onChange(star)}
            className="rounded-sm transition-transform outline-none hover:scale-110 focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={`Rate ${star} star${star > 1 ? "s" : ""}`}
          >
            <Star className={cn(sizeClass, active ? "fill-warning text-warning" : "text-muted-foreground/40")} />
          </button>
        );
      })}
    </div>
  );
}

export function Stars({ value, className }: { value?: number | null; className?: string }) {
  const rounded = value ? Math.round(value) : 0;
  return (
    <div className={cn("flex items-center gap-0.5", className)} aria-label={`${rounded} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={cn("size-3.5", star <= rounded ? "fill-warning text-warning" : "text-muted-foreground/40")}
        />
      ))}
    </div>
  );
}

/** Compact "★ 4.6 (128)" rating used on cards and in the hero. */
export function RatingInline({ value, count, className }: { value?: number | null; count?: number; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 text-sm tabular-nums", className)}>
      <Star className="size-3.5 fill-warning text-warning" />
      <span className="font-medium text-foreground">{value ? value.toFixed(1) : "New"}</span>
      {typeof count === "number" && count > 0 ? <span className="text-muted-foreground">({count})</span> : null}
    </span>
  );
}

export function ReviewListItem({
  name,
  rating,
  comment,
  createdAt,
}: {
  name?: string | null;
  rating: number;
  comment?: string | null;
  createdAt?: string | null;
}) {
  const date = formatReviewDate(createdAt);
  return (
    <div className="flex gap-3 py-4 first:pt-0 last:pb-0">
      <Avatar>
        <AvatarFallback className="bg-muted text-xs font-medium">{initials(name || "Anonymous")}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <div className="truncate text-sm font-medium">{name || "Anonymous"}</div>
          {date ? <div className="text-xs text-muted-foreground">{date}</div> : null}
        </div>
        <Stars value={Number(rating)} className="mt-1" />
        <p className={cn("mt-2 text-sm leading-relaxed", comment ? "text-foreground" : "text-muted-foreground")}>
          {comment || "No comment provided."}
        </p>
      </div>
    </div>
  );
}

export function ReviewForm({
  id,
  title,
  rating,
  onRatingChange,
  comment,
  onCommentChange,
  placeholder,
  error,
  isPending,
  submitLabel,
  onSubmit,
}: {
  id: string;
  title: string;
  rating: number;
  onRatingChange: (value: number) => void;
  comment: string;
  onCommentChange: (value: string) => void;
  placeholder: string;
  error?: string | null;
  isPending: boolean;
  submitLabel: string;
  onSubmit: () => void;
}) {
  return (
    <div className="grid gap-4 rounded-lg border bg-muted/30 p-4">
      <div className="grid gap-2">
        <Label>{title}</Label>
        <StarPicker value={rating} onChange={onRatingChange} size="lg" />
      </div>
      <div className="grid gap-2">
        <Label htmlFor={id}>Comment (optional)</Label>
        <Textarea
          id={id}
          value={comment}
          onChange={(e) => onCommentChange(e.target.value)}
          placeholder={placeholder}
          rows={3}
          className="bg-background"
        />
      </div>
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <Button onClick={onSubmit} disabled={isPending} className="w-full sm:w-auto sm:justify-self-end">
        {isPending ? "Posting review..." : submitLabel}
      </Button>
    </div>
  );
}
