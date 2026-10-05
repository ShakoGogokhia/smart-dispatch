import { Check, Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { PALETTES, swatchColor, usePalette } from "@/lib/palette";
import { cn } from "@/lib/utils";

const MODES = [
  { id: "light", label: "Light", icon: Sun },
  { id: "dark", label: "Dark", icon: Moon },
  { id: "system", label: "System", icon: Monitor },
] as const;

function useIsDark() {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted && resolvedTheme === "dark";
}

/** Mode (light / dark / system) + color palette picker. */
export function ThemePanel() {
  const { theme, setTheme } = useTheme();
  const { palette, setPalette } = usePalette();
  const isDark = useIsDark();

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground">Mode</p>
        <div className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1">
          {MODES.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTheme(id)}
              aria-pressed={theme === id}
              className={cn(
                "relative flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
                theme === id ? "text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {theme === id && (
                <motion.span layoutId="theme-mode-indicator" className="absolute inset-0 rounded-md bg-background shadow-sm" />
              )}
              <Icon className="relative size-3.5" />
              <span className="relative">{label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground">Color</p>
        <div className="grid grid-cols-4 gap-2">
          {PALETTES.map((p) => {
            const active = palette === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setPalette(p.id)}
                aria-pressed={active}
                aria-label={p.label}
                title={p.label}
                className={cn(
                  "group flex flex-col items-center gap-1 rounded-lg border p-2 transition-colors hover:bg-accent",
                  active ? "border-primary bg-accent" : "border-transparent",
                )}
              >
                <span
                  className="flex size-7 items-center justify-center rounded-full shadow-sm ring-1 ring-border transition-transform group-hover:scale-110"
                  style={{
                    background:
                      p.id === "midnight"
                        ? `linear-gradient(135deg, oklch(0.13 0.01 ${p.h}) 50%, ${swatchColor(p, true)} 50%)`
                        : swatchColor(p, isDark),
                  }}
                >
                  {active && <Check className={cn("size-3.5", p.id === "zinc" && isDark ? "text-black" : "text-white")} />}
                </span>
                <span className="w-full truncate text-center text-[10px] leading-tight text-muted-foreground">{p.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function ThemeToggle({
  compact = false,
  trigger,
  className,
}: {
  compact?: boolean;
  trigger?: ReactNode;
  className?: string;
}) {
  const isDark = useIsDark();

  const icon = (
    <AnimatePresence mode="wait" initial={false}>
      <motion.span
        key={isDark ? "dark" : "light"}
        initial={{ rotate: -90, opacity: 0, scale: 0.6 }}
        animate={{ rotate: 0, opacity: 1, scale: 1 }}
        exit={{ rotate: 90, opacity: 0, scale: 0.6 }}
        transition={{ duration: 0.18 }}
        className="flex"
      >
        {isDark ? <Moon className="size-[18px]" /> : <Sun className="size-[18px]" />}
      </motion.span>
    </AnimatePresence>
  );

  const button = trigger ?? (
    <Button variant="ghost" size="icon" aria-label="Change theme" className={className}>
      {icon}
    </Button>
  );

  return (
    <Popover>
      {compact && !trigger ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>{button}</PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent>Theme &amp; colors</TooltipContent>
        </Tooltip>
      ) : (
        <PopoverTrigger asChild>{button}</PopoverTrigger>
      )}
      <PopoverContent align="end" className="w-80">
        <ThemePanel />
      </PopoverContent>
    </Popover>
  );
}

export default ThemeToggle;
