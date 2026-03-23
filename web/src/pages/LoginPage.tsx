import { useMemo, useState } from "react";
import {
  ArrowRight,
  LockKeyhole,
  ShieldCheck,
  Sparkles,
  Store,
  Truck,
  UserRoundPlus,
} from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import type { AxiosError } from "axios";

import { api } from "@/lib/api";
import { auth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { getDefaultAuthedPath, normalizeRoles } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function getErrorMessage(error: unknown, fallback: string) {
  const axiosError = error as AxiosError<{ message?: string }>;
  return axiosError.response?.data?.message ?? fallback;
}

type AuthMode = "login" | "register";

export default function LoginPage() {
  const { language, setLanguage, t } = useI18n();
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
    } catch (error: unknown) {
      setError(getErrorMessage(error, "Login failed"));
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
    } catch (error: unknown) {
      setError(getErrorMessage(error, "Registration failed"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden px-4 py-6 md:px-6 md:py-8">
      <div className="aurora-orb left-[7%] top-[9%] h-44 w-44 bg-orange-400/24" />
      <div className="aurora-orb right-[9%] top-[18%] h-56 w-56 bg-teal-400/16 [animation-delay:1.2s]" />
      <div className="aurora-orb bottom-[12%] left-[42%] h-40 w-40 bg-amber-200/16 [animation-delay:2.1s]" />

      <div className="relative mx-auto grid min-h-[calc(100vh-3rem)] max-w-7xl items-center gap-8 lg:grid-cols-[1.08fr_0.92fr]">
        <section className="hero-surface animated-enter p-7 md:p-10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(255,255,255,0.12),_transparent_28%),linear-gradient(135deg,_rgba(255,176,86,0.16),_transparent_40%)]" />

          <div className="relative">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-100">
              <Store className="h-4 w-4 text-amber-300" />
              {t("app.name")}
            </div>

            <h1 className="font-display mt-6 max-w-3xl text-4xl font-bold tracking-[-0.05em] md:text-6xl xl:text-7xl">
              {t("auth.heroTitle")}
            </h1>

            <p className="mt-5 max-w-2xl text-base leading-7 text-slate-300 md:text-lg">
              {t("auth.heroText")}
            </p>

            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              {[
                { label: t("auth.customer"), title: t("auth.customerDesc"), icon: Sparkles },
                { label: t("auth.owner"), title: t("auth.ownerDesc"), icon: Truck },
                { label: t("auth.admin"), title: t("auth.adminDesc"), icon: ShieldCheck },
              ].map((entry) => {
                const Icon = entry.icon;
                return (
                  <div key={entry.label} className="rounded-[28px] border border-white/10 bg-white/6 p-5">
                    <Icon className="h-5 w-5 text-white" />
                    <div className="mt-4 text-sm uppercase tracking-[0.22em] text-slate-400">{entry.label}</div>
                    <div className="mt-2 text-lg font-semibold leading-7 text-white">{entry.title}</div>
                  </div>
                );
              })}
            </div>

            <div className="mt-8 flex gap-2">
              <Button
                variant={language === "ka" ? "default" : "secondary"}
                className="rounded-2xl"
                onClick={() => setLanguage("ka")}
              >
                {t("lang.ka")}
              </Button>
              <Button
                variant={language === "en" ? "default" : "secondary"}
                className="rounded-2xl"
                onClick={() => setLanguage("en")}
              >
                {t("lang.en")}
              </Button>
            </div>
          </div>
        </section>

        <Card className="glass-panel animated-enter animated-enter-delay-2 border-white/40 bg-white/80 p-2">
          <CardHeader className="pb-3">
            <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="inline-flex h-14 w-14 items-center justify-center rounded-[22px] bg-gradient-to-br from-amber-400 via-orange-500 to-rose-500 text-slate-950 shadow-[0_18px_42px_rgba(249,115,22,0.28)]">
                  {mode === "login" ? <LockKeyhole className="h-5 w-5" /> : <UserRoundPlus className="h-5 w-5" />}
                </div>
                <div>
                  <div className="text-xs uppercase tracking-[0.24em] text-slate-500">Secure access</div>
                  <div className="font-display text-2xl font-bold tracking-[-0.04em] text-slate-950">
                    {mode === "login" ? t("auth.signIn") : t("auth.createAccount")}
                  </div>
                </div>
              </div>

              <div className="flex rounded-2xl bg-slate-100 p-1">
                <button
                  type="button"
                  onClick={() => setMode("login")}
                  className={`rounded-xl px-4 py-2 text-sm ${mode === "login" ? "bg-white text-slate-950 shadow" : "text-slate-600"}`}
                >
                  {t("auth.login")}
                </button>
                <button
                  type="button"
                  onClick={() => setMode("register")}
                  className={`rounded-xl px-4 py-2 text-sm ${mode === "register" ? "bg-white text-slate-950 shadow" : "text-slate-600"}`}
                >
                  {t("auth.register")}
                </button>
              </div>
            </div>

            <CardTitle className="font-display text-3xl font-bold tracking-[-0.04em] text-slate-950">
              {mode === "login" ? t("auth.signIn") : t("auth.createAccount")}
            </CardTitle>
            <p className="max-w-xl text-sm leading-7 text-slate-600">
              {mode === "login" ? t("auth.loginText") : t("auth.registerText")}
            </p>
          </CardHeader>

          <CardContent>
            <form onSubmit={mode === "login" ? onLogin : onRegister} className="grid gap-5">
              {mode === "register" && (
                <div className="grid gap-2">
                  <Label>{t("auth.name")}</Label>
                  <Input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    className="h-12 rounded-2xl border-white/60 bg-white/90"
                  />
                </div>
              )}

              <div className="grid gap-2">
                <Label>{t("auth.email")}</Label>
                <Input
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  className="h-12 rounded-2xl border-white/60 bg-white/90"
                />
              </div>

              <div className="grid gap-2">
                <Label>{t("auth.password")}</Label>
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
                  <Label>{t("auth.confirmPassword")}</Label>
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
                    ? t("auth.signingIn")
                    : t("auth.creatingAccount")
                  : mode === "login"
                    ? t("auth.continue")
                    : t("auth.create")}
                {!loading && <ArrowRight className="ml-2 h-4 w-4" />}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
