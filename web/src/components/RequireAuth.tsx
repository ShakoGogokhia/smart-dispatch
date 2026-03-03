import { Navigate } from "react-router-dom";
import { auth } from "@/lib/auth";
import { useMe } from "@/lib/useMe";

export default function RequireAuth({ children }: { children: JSX.Element }) {
  const token = auth.getToken();
  const meQ = useMe();

  if (!token) return <Navigate to="/login" replace />;

  if (meQ.isLoading) return <div className="p-6">Loading...</div>;

  if (meQ.isError) {
    auth.clear();
    return <Navigate to="/login" replace />;
  }

  return children;
}