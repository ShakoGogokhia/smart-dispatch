import type { ReactNode } from "react";
import { MotionConfig } from "motion/react";
import { ThemeProvider as NextThemesProvider, useTheme as useNextTheme } from "next-themes";

import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

export type Theme = "light" | "dark";

export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="system" enableSystem storageKey="theme" disableTransitionOnChange={false}>
      <MotionConfig reducedMotion="user" transition={{ type: "spring", stiffness: 380, damping: 32, mass: 0.8 }}>
        <TooltipProvider delayDuration={250}>
          {children}
          <Toaster richColors closeButton position="top-right" />
        </TooltipProvider>
      </MotionConfig>
    </NextThemesProvider>
  );
}

/** Resolved light/dark mode, for code (maps, charts) that needs the actual color scheme. */
export function useTheme() {
  const { resolvedTheme, setTheme } = useNextTheme();
  const theme: Theme = resolvedTheme === "dark" ? "dark" : "light";
  return { theme, setTheme, toggleTheme: () => setTheme(theme === "light" ? "dark" : "light") };
}
