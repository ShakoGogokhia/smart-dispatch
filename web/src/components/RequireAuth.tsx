import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";

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
      <div className="flex min-h-screen items-center justify-center px-6">
        <div className="glass-panel w-full max-w-md p-8 text-center">
          <div className="text-sm font-medium text-muted-foreground">Checking access...</div>
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
