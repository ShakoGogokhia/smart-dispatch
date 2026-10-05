import type { LucideIcon } from "lucide-react";
import { motion } from "motion/react";
import type { ReactNode } from "react";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: ReactNode;
  value: ReactNode;
  icon?: LucideIcon;
  hint?: ReactNode;
  tone?: "default" | "primary" | "success" | "warning" | "destructive" | "info";
  className?: string;
  onClick?: () => void;
  active?: boolean;
}

const TONES = {
  default: "bg-muted text-muted-foreground",
  primary: "bg-primary/10 text-primary",
  success: "bg-success/15 text-success",
  warning: "bg-warning/20 text-warning-foreground dark:text-warning",
  destructive: "bg-destructive/10 text-destructive",
  info: "bg-info/15 text-info",
};

export function StatCard({ label, value, icon: Icon, hint, tone = "default", className, onClick, active }: StatCardProps) {
  return (
    <motion.div whileHover={onClick ? { y: -2 } : undefined} transition={{ duration: 0.15 }}>
      <Card
        role={onClick ? "button" : undefined}
        tabIndex={onClick ? 0 : undefined}
        onClick={onClick}
        onKeyDown={onClick ? (e) => (e.key === "Enter" || e.key === " ") && onClick() : undefined}
        className={cn(
          "gap-0 px-4 py-3 shadow-xs",
          onClick && "cursor-pointer transition-shadow hover:shadow-md",
          active && "ring-2 ring-primary",
          className,
        )}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate text-xs font-medium text-muted-foreground">{label}</div>
            <div className="mt-0.5 text-2xl font-semibold tabular-nums tracking-tight">{value}</div>
            {hint ? <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div> : null}
          </div>
          {Icon ? (
            <div className={cn("flex size-10 shrink-0 items-center justify-center rounded-lg", TONES[tone])}>
              <Icon className="size-5" />
            </div>
          ) : null}
        </div>
      </Card>
    </motion.div>
  );
}

export function StatGrid({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4", className)}>{children}</div>;
}
