import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function SectionHeader({
  title,
  description,
  href,
  hrefLabel = "View all",
  actions,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  href?: string;
  hrefLabel?: string;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-3", className)}>
      <div className="min-w-0">
        <h2 className="text-lg font-semibold tracking-tight md:text-xl">{title}</h2>
        {description ? <p className="mt-0.5 text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {href || actions ? (
        <div className="flex items-center gap-1.5">
          {href ? (
            <Button asChild variant="ghost" size="sm">
              <Link to={href}>
                {hrefLabel}
                <ArrowRight />
              </Link>
            </Button>
          ) : null}
          {actions}
        </div>
      ) : null}
    </div>
  );
}

/** Section with a header and a horizontally scrolling, snap-aligned row of cards with prev/next buttons. */
export function ScrollRail({
  title,
  description,
  href,
  autoScrollMs,
  children,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  href?: string;
  /** Optional auto-advance interval; pauses while hovered/focused and when reduced motion is preferred. */
  autoScrollMs?: number;
  children: ReactNode;
  className?: string;
}) {
  const railRef = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);

  const scrollByPage = (direction: "left" | "right") => {
    const element = railRef.current;
    if (!element) return;
    const amount = Math.max(element.clientWidth * 0.8, 240);
    element.scrollBy({ left: direction === "left" ? -amount : amount, behavior: "smooth" });
  };

  useEffect(() => {
    const element = railRef.current;
    if (!autoScrollMs || !element || paused) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    const interval = setInterval(() => {
      const maxLeft = element.scrollWidth - element.clientWidth;
      if (maxLeft <= 0) return;
      const nextLeft = element.scrollLeft + Math.max(element.clientWidth * 0.8, 240);
      element.scrollTo({ left: nextLeft >= maxLeft + 4 ? 0 : Math.min(nextLeft, maxLeft), behavior: "smooth" });
    }, autoScrollMs);

    return () => clearInterval(interval);
  }, [autoScrollMs, paused]);

  return (
    <section className={cn("space-y-4", className)}>
      <SectionHeader
        title={title}
        description={description}
        href={href}
        actions={
          <div className="hidden items-center gap-1.5 sm:flex">
            <Button variant="outline" size="icon-sm" aria-label="Scroll left" onClick={() => scrollByPage("left")}>
              <ChevronLeft />
            </Button>
            <Button variant="outline" size="icon-sm" aria-label="Scroll right" onClick={() => scrollByPage("right")}>
              <ChevronRight />
            </Button>
          </div>
        }
      />
      <div
        ref={railRef}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onFocus={() => setPaused(true)}
        onBlur={() => setPaused(false)}
        onTouchStart={() => setPaused(true)}
        className="scrollbar-hide -mx-4 flex snap-x snap-mandatory scroll-px-4 gap-4 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:scroll-px-6 sm:px-6"
      >
        {children}
      </div>
    </section>
  );
}
