import { Link } from "react-router-dom";

import { Brand } from "@/components/app/brand";

export function StorefrontFooter() {
  return (
    <footer className="border-t bg-muted/30">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="space-y-1.5">
          <Brand />
          <p className="text-sm text-muted-foreground">Order from local markets and follow your delivery live.</p>
        </div>
        <nav aria-label="Footer" className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
          <Link to="/" className="text-muted-foreground hover:text-foreground">Markets</Link>
          <Link to="/track" className="text-muted-foreground hover:text-foreground">Track order</Link>
          <Link to="/login" className="text-muted-foreground hover:text-foreground">Sign in</Link>
        </nav>
      </div>
    </footer>
  );
}
