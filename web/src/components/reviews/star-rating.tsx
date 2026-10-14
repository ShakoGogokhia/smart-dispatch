import { Star } from "lucide-react";

import { cn } from "@/lib/utils";

const SIZES = {
  sm: { button: "size-8", icon: "size-5" },
  md: { button: "size-10", icon: "size-6" },
  lg: { button: "size-11", icon: "size-7" },
} as const;

/** Clickable 1-5 star picker with large touch targets. `value` 0 means "not rated yet". */
export function StarRating({
  value,
  onChange,
  size = "md",
  label = "Rating",
  disabled = false,
  className,
}: {
  value: number;
  onChange: (value: number) => void;
  size?: keyof typeof SIZES;
  label?: string;
  disabled?: boolean;
  className?: string;
}) {
  const sizes = SIZES[size];

  return (
    <div className={cn("-ml-1.5 flex items-center", className)} role="radiogroup" aria-label={label}>
      {[1, 2, 3, 4, 5].map((star) => {
        const active = star <= value;
        return (
          <button
            key={star}
            type="button"
            role="radio"
            aria-checked={star === value}
            aria-label={`Rate ${star} out of 5`}
            disabled={disabled}
            onClick={() => onChange(star)}
            className={cn(
              "flex items-center justify-center rounded-md transition-transform outline-none hover:scale-110 focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
              sizes.button,
            )}
          >
            <Star className={cn(sizes.icon, active ? "fill-warning text-warning" : "text-muted-foreground/40")} />
          </button>
        );
      })}
    </div>
  );
}

/** Read-only star row, e.g. for the "You rated this order" summary. */
export function StarDisplay({ value, className }: { value: number; className?: string }) {
  const rounded = Math.round(value);
  return (
    <span className={cn("inline-flex items-center gap-0.5", className)} role="img" aria-label={`${rounded} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Star key={star} className={cn("size-4", star <= rounded ? "fill-warning text-warning" : "text-muted-foreground/40")} />
      ))}
    </span>
  );
}
