import { useMemo, useState } from "react";
import { ArrowRight, LockKeyhole, Store, UserRoundPlus } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { api } from "@/lib/api";
import { auth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type AuthMode = "login" | "register";

export default function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("admin@test.com");
  const [password, setPassword] = useState("123456");
  const [name, setName] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const nextPath = useMemo(() => searchParams.get("next") || "/orders", [searchParams]);

  function finishAuth(token: string, roles: string[]) {
    auth.setToken(token);
    navigate(nextPath || (roles.includes("admin") ? "/markets" : "/orders"), { replace: true });
  }

  async function onLogin(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await api.post("/api/login", { email, password });
      const roles = Array.isArray(res.data?.user?.roles) ? res.data.user.roles : [];
      finishAuth(res.data.token, roles);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? "Login failed");
    } finally {
      setLoading(false);
    }
  }

  async function onRegister(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await api.post("/api/register", {
        name,
        email,
        password,
        password_confirmation: passwordConfirmation,
      });
      const roles = Array.isArray(res.data?.user?.roles) ? res.data.user.roles : ["customer"];
      finishAuth(res.data.token, roles);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(251,191,36,0.30),_transparent_24%),radial-gradient(circle_at_bottom_right,_rgba(20,184,166,0.20),_transparent_28%),linear-gradient(160deg,_#0b1220_0%,_#172554_48%,_#fff8ed_48%,_#fff8ed_100%)] px-4 py-10">
      <div className="mx-auto grid min-h-[calc(100vh-5rem)] max-w-6xl items-center gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-[36px] border border-white/10 bg-slate-950/78 p-8 text-white shadow-[0_28px_80px_rgba(15,23,42,0.45)] backdrop-blur md:p-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200">
            <Store className="h-4 w-4 text-amber-300" />
            Smart Dispatch web console
          </div>
          <h1 className="font-display mt-6 max-w-xl text-4xl font-semibold tracking-tight md:text-6xl">
            Shop as a customer. Operate as staff. Control everything as admin.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-slate-300 md:text-lg">
            Customers can register and place orders. Staff and owners can manage markets. Admins
            can create users, assign roles, create markets, and set owners.
          </p>
          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            <div className="rounded-3xl border border-white/10 bg-white/6 p-5">
              <div className="text-sm uppercase tracking-[0.22em] text-slate-400">Customer</div>
              <div className="mt-2 text-xl font-semibold">Browse and order</div>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/6 p-5">
              <div className="text-sm uppercase tracking-[0.22em] text-slate-400">Owner</div>
              <div className="mt-2 text-xl font-semibold">Manage market operations</div>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/6 p-5">
              <div className="text-sm uppercase tracking-[0.22em] text-slate-400">Admin</div>
              <div className="mt-2 text-xl font-semibold">Users, roles, and markets</div>
            </div>
          </div>
        </section>

        <Card className="glass-panel border-white/40 bg-white/78 p-2">
          <CardHeader className="pb-3">
            <div className="mb-4 flex items-center gap-3">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 via-orange-500 to-rose-500 text-slate-950 shadow-lg">
                {mode === "login" ? <LockKeyhole className="h-5 w-5" /> : <UserRoundPlus className="h-5 w-5" />}
              </div>
              <div className="flex rounded-2xl bg-slate-100 p-1">
                <button
                  type="button"
                  onClick={() => setMode("login")}
                  className={`rounded-xl px-4 py-2 text-sm ${mode === "login" ? "bg-white shadow text-slate-950" : "text-slate-600"}`}
                >
                  Login
                </button>
                <button
                  type="button"
                  onClick={() => setMode("register")}
                  className={`rounded-xl px-4 py-2 text-sm ${mode === "register" ? "bg-white shadow text-slate-950" : "text-slate-600"}`}
                >
                  Register
                </button>
              </div>
            </div>
            <CardTitle className="font-display text-3xl tracking-tight text-slate-950">
              {mode === "login" ? "Sign in" : "Create customer account"}
            </CardTitle>
            <p className="text-sm text-slate-600">
              {mode === "login"
                ? "Use your existing account to continue."
                : "New public users register as customers and can place orders after sign-up."}
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={mode === "login" ? onLogin : onRegister} className="grid gap-5">
              {mode === "register" && (
                <div className="grid gap-2">
                  <Label>Name</Label>
                  <Input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    className="h-12 rounded-2xl border-white/60 bg-white/90"
                  />
                </div>
              )}

              <div className="grid gap-2">
                <Label>Email</Label>
                <Input
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  className="h-12 rounded-2xl border-white/60 bg-white/90"
                />
              </div>

              <div className="grid gap-2">
                <Label>Password</Label>
                <Input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Enter your password"
                  className="h-12 rounded-2xl border-white/60 bg-white/90"
                />
              </div>

              {mode === "register" && (
                <div className="grid gap-2">
                  <Label>Confirm password</Label>
                  <Input
                    type="password"
                    value={passwordConfirmation}
                    onChange={(event) => setPasswordConfirmation(event.target.value)}
                    className="h-12 rounded-2xl border-white/60 bg-white/90"
                  />
                </div>
              )}

              {error && <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

              <Button className="h-12 rounded-2xl text-base" disabled={loading}>
                {loading
                  ? mode === "login"
                    ? "Signing in..."
                    : "Creating account..."
                  : mode === "login"
                    ? "Continue to workspace"
                    : "Create account"}
                {!loading && <ArrowRight className="ml-2 h-4 w-4" />}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
