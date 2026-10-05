import { Inbox } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface EmptyStateProps {
  title?: ReactNode;
  description?: ReactNode;
  icon?: LucideIcon;
  action?: ReactNode;
  compact?: boolean;
  className?: string;
}

export function EmptyState({ title = "Nothing here yet", description, icon: Icon = Inbox, action, compact = false, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        compact ? "gap-1.5 py-6" : "gap-3 rounded-xl border border-dashed py-14",
        className,
      )}
    >
      <div className={cn("flex items-center justify-center rounded-full bg-muted text-muted-foreground", compact ? "size-9" : "size-12")}>
        <Icon className={compact ? "size-4" : "size-5"} />
      </div>
      <div className={cn("font-medium", compact ? "text-sm" : "text-base")}>{title}</div>
      {description ? <p className="max-w-sm text-sm text-muted-foreground">{description}</p> : null}
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}
