import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";

import { Spinner } from "@/components/ui/spinner";
import { auth } from "@/lib/auth";
import { useMe } from "@/lib/useMe";

export default function RequireAuth({ children }: { children: ReactNode }) {
  const location = useLocation();
  const token = auth.getToken();
  const meQ = useMe();

  if (!token) {
    const next = encodeURIComponent(`${location.pathname}${location.search}`);
    return <Navigate to={`/login?next=${next}`} replace />;
  }

  if (meQ.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6">
        <div className="flex items-center gap-3 rounded-xl border bg-card px-5 py-4 text-sm text-muted-foreground shadow-sm">
          <Spinner />
          Checking access...
        </div>
      </div>
    );
  }

  if (meQ.isError) {
    auth.clear();
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
