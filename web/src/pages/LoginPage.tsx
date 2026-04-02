import { useMemo, useState } from "react";
import { ArrowRight, LockKeyhole, ShieldCheck, Store, Truck, UserRoundPlus } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import type { AxiosError } from "axios";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import ThemeToggle from "@/components/ThemeToggle";
import { api } from "@/lib/api";
import { auth } from "@/lib/auth";
import { getDefaultAuthedPath, normalizeRoles } from "@/lib/session";

function getErrorMessage(error: unknown, fallback: string) {
  if (!error || typeof error !== "object") {
    return fallback;
  }

  const axiosError = error as AxiosError<{ message?: string }>;
  return axiosError.response?.data?.message ?? fallback;
}

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

  const nextPath = useMemo(() => searchParams.get("next"), [searchParams]);

  function finishAuth(token: string, rolesInput: unknown) {
    auth.setToken(token);
    const roles = normalizeRoles(rolesInput);
    const fallbackPath = getDefaultAuthedPath(roles);
    navigate(nextPath ?? fallbackPath, { replace: true });
  }

  async function onLogin(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await api.post("/api/login", { email, password });
      finishAuth(res.data.token, res.data?.user?.roles);
    } catch (nextError: unknown) {
      setError(getErrorMessage(nextError, "Login failed"));
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
      finishAuth(res.data.token, res.data?.user?.roles ?? ["customer"]);
    } catch (nextError: unknown) {
      setError(getErrorMessage(nextError, "Registration failed"));
    } finally {
      setLoading(false);
    }
  }

  const highlights = [
    { icon: Store, title: "Customer", text: "Browse markets and place orders." },
    { icon: Truck, title: "Owner", text: "Manage your market and catalog." },
    { icon: ShieldCheck, title: "Admin", text: "Manage users, roles, and markets." },
  ];

  return (
    <div className="app-shell">
      <div className="mx-auto grid max-w-7xl gap-5 lg:grid-cols-[minmax(0,1.12fr)_420px]">
        <section className="hero-panel page-enter overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="command-chip">Smart Dispatch</div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <ThemeToggle />
            </div>
          </div>

          <div className="mt-8 grid gap-8 xl:grid-cols-[minmax(0,1fr)_320px]">
            <div>
              <div className="section-kicker">Commerce, routes, and live operations</div>
              <h1 className="font-display mt-4 max-w-4xl text-5xl font-semibold tracking-[-0.06em] text-white md:text-7xl">
                Order like a customer, work like staff, manage like an admin.
              </h1>
              <p className="mt-5 max-w-3xl text-base leading-8 text-white/78 md:text-lg">
                Customers place orders, owners manage their market, and admins oversee users, roles, and operations from one app.
              </p>

              <div className="mt-8 flex flex-wrap gap-2">
                <span className="data-pill">Unified orders</span>
                <span className="data-pill">Clear handoffs</span>
                <span className="data-pill">Mobile-friendly</span>
              </div>
            </div>

            <div className="hero-mesh flex h-full flex-col justify-center">
              <div className="section-kicker text-white/70">Why it stays simple</div>
              <div className="mt-4 grid gap-3">
                {highlights.map((item) => {
                  const Icon = item.icon;
                  return (
                    <div key={item.title} className="rounded-[20px] border border-white/10 bg-white/6 p-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-[14px] border border-white/12 bg-white/10 text-amber-200">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="mt-4 font-display text-xl font-semibold tracking-[-0.04em] text-white">
                        {item.title}
                      </div>
                      <div className="mt-2 text-sm leading-7 text-slate-300">{item.text}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        <Card className="page-enter page-enter-delay-2">
          <CardHeader className="pb-0">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="section-kicker">Access</div>
                <CardTitle className="font-display mt-2 text-4xl font-semibold tracking-[-0.05em] text-slate-950 dark:text-white">
                  {mode === "login" ? "Sign in" : "Create account"}
                </CardTitle>
              </div>
              <div className="rounded-[16px] border border-border bg-secondary p-1">
                <button
                  type="button"
                  className={[
                    "rounded-[12px] px-4 py-2 text-sm font-semibold transition",
                    mode === "login"
                      ? "bg-background/95 text-foreground shadow-sm"
                      : "text-slate-500 hover:text-slate-950 dark:text-slate-400 dark:hover:text-white",
                  ].join(" ")}
                  onClick={() => setMode("login")}
                >
                  Login
                </button>
                <button
                  type="button"
                  className={[
                    "rounded-[12px] px-4 py-2 text-sm font-semibold transition",
                    mode === "register"
                      ? "bg-background/95 text-foreground shadow-sm"
                      : "text-slate-500 hover:text-slate-950 dark:text-slate-400 dark:hover:text-white",
                  ].join(" ")}
                  onClick={() => setMode("register")}
                >
                  Register
                </button>
              </div>
            </div>
          </CardHeader>

          <CardContent className="grid gap-6">
            <div className="frost-panel">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-[16px] border border-border bg-secondary">
                  {mode === "login" ? <LockKeyhole className="h-5 w-5" /> : <UserRoundPlus className="h-5 w-5" />}
                </div>
                <div className="text-sm leading-6 text-slate-600 dark:text-slate-300">
                  {mode === "login"
                    ? "Use your existing account to continue."
                    : "New accounts are created as customer accounts by default."}
                </div>
              </div>
            </div>

            <form onSubmit={mode === "login" ? onLogin : onRegister} className="grid gap-4">
              {mode === "register" && (
                <div className="field-group">
                  <Label className="field-label">Name</Label>
                  <Input value={name} onChange={(event) => setName(event.target.value)} className="input-shell" />
                </div>
              )}

              <div className="field-group">
                <Label className="field-label">Email</Label>
                <Input
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  className="input-shell"
                />
              </div>

              <div className="field-group">
                <Label className="field-label">Password</Label>
                <Input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Enter your password"
                  className="input-shell"
                />
              </div>

              {mode === "register" && (
                <div className="field-group">
                  <Label className="field-label">Confirm password</Label>
                  <Input
                    type="password"
                    value={passwordConfirmation}
                    onChange={(event) => setPasswordConfirmation(event.target.value)}
                    className="input-shell"
                  />
                </div>
              )}

              {error && <div className="status-bad rounded-[18px] border px-4 py-3 text-sm">{error}</div>}

              <Button className="h-12 text-base" disabled={loading}>
                {loading
                  ? mode === "login"
                    ? "Signing in..."
                    : "Creating account..."
                  : mode === "login"
                    ? "Continue"
                    : "Create account"}
                {!loading && <ArrowRight className="h-4 w-4" />}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
