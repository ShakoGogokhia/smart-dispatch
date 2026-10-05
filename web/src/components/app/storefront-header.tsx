import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";

import PublicAccountMenu from "@/components/PublicAccountMenu";
import ThemeToggle from "@/components/ThemeToggle";
import { Brand } from "@/components/app/brand";
import { cn } from "@/lib/utils";

const LINKS = [
  { label: "Markets", to: "/", end: true },
  { label: "Popular", to: "/discover/popular" },
  { label: "Deals", to: "/discover/discounted" },
  { label: "Track order", to: "/track" },
];

/**
 * Sticky top bar shared by every customer-facing page (home, discovery, market, checkout, tracking).
 * `center` is an optional slot (e.g. a search box); `actions` renders before the theme/account buttons (e.g. cart).
 */
export function StorefrontHeader({
  center,
  actions,
  showLinks = true,
  className,
}: {
  center?: ReactNode;
  actions?: ReactNode;
  showLinks?: boolean;
  className?: string;
}) {
  return (
    <header className={cn("sticky top-0 z-50 border-b bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/70", className)}>
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6">
        <Brand />

        {showLinks ? (
          <nav className="hidden items-center gap-1 lg:flex" aria-label="Storefront">
            {LINKS.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.end}
                className={({ isActive }) =>
                  cn(
                    "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                    isActive ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                  )
                }
              >
                {link.label}
              </NavLink>
            ))}
          </nav>
        ) : null}

        <div className="min-w-0 flex-1">{center}</div>

        <div className="flex shrink-0 items-center gap-1.5">
          {actions}
          <ThemeToggle compact />
          <PublicAccountMenu />
        </div>
      </div>
    </header>
  );
}
