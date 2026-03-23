import { useMemo, useState } from "react";
import { ArrowRight, LockKeyhole, ShieldCheck, Store, Truck, UserRoundPlus } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import type { AxiosError } from "axios";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import { auth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { getDefaultAuthedPath, normalizeRoles } from "@/lib/session";

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
    { icon: Store, title: "Storefront ready", text: "Public browsing, saved cart state, and structured checkout." },
    { icon: Truck, title: "Dispatch aware", text: "Orders, routing, and live location data in the same workspace." },
    { icon: ShieldCheck, title: "Role driven", text: "Customers, staff, drivers, and admins land in the right flow." },
  ];

  return (
    <div className="app-shell">
      <div className="mx-auto grid max-w-7xl gap-5 lg:grid-cols-[1.15fr_0.85fr]">
        <section className="ink-panel page-enter overflow-hidden p-6 md:p-10">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="command-chip">Smart Dispatch</div>
            <div className="flex gap-2">
              <Button
                variant={language === "ka" ? "secondary" : "ghost"}
                className="h-10 rounded-[16px] border-white/20 text-white hover:bg-white/10"
                onClick={() => setLanguage("ka")}
              >
                {t("lang.ka")}
              </Button>
              <Button
                variant={language === "en" ? "secondary" : "ghost"}
                className="h-10 rounded-[16px] border-white/20 text-white hover:bg-white/10"
                onClick={() => setLanguage("en")}
              >
                {t("lang.en")}
              </Button>
            </div>
          </div>

          <div className="mt-8 max-w-3xl">
            <div className="section-kicker text-slate-300">Commerce + delivery operating system</div>
            <h1 className="font-display mt-3 text-5xl font-semibold tracking-[-0.06em] text-white md:text-7xl">
              A calmer, tougher workspace for orders that actually move.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-8 text-slate-300 md:text-lg">
              This version drops the glossy marketing look and shifts into a more editorial, control-room style:
              strong hierarchy, clear blocks, and fast scanability for public shoppers and ops teams.
            </p>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {highlights.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.title} className="rounded-[24px] border border-white/15 bg-white/6 p-5">
                  <Icon className="h-6 w-6 text-[#ffd67d]" />
                  <div className="mt-4 font-display text-2xl font-semibold text-white">{item.title}</div>
                  <div className="mt-2 text-sm leading-7 text-slate-300">{item.text}</div>
                </div>
              );
            })}
          </div>
        </section>

        <Card className="page-enter page-enter-delay-2 bg-[#fffaf0]">
          <CardHeader className="pb-0">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="section-kicker">Access</div>
                <CardTitle className="font-display mt-2 text-4xl font-semibold tracking-[-0.05em]">
                  {mode === "login" ? t("auth.signIn") : t("auth.createAccount")}
                </CardTitle>
              </div>
              <div className="rounded-[18px] border-2 border-slate-950 bg-[#efe6d6] p-1">
                <button
                  type="button"
                  className={[
                    "rounded-[12px] px-4 py-2 text-sm font-semibold",
                    mode === "login" ? "bg-white text-slate-950" : "text-slate-600",
                  ].join(" ")}
                  onClick={() => setMode("login")}
                >
                  {t("auth.login")}
                </button>
                <button
                  type="button"
                  className={[
                    "rounded-[12px] px-4 py-2 text-sm font-semibold",
                    mode === "register" ? "bg-white text-slate-950" : "text-slate-600",
                  ].join(" ")}
                  onClick={() => setMode("register")}
                >
                  {t("auth.register")}
                </button>
              </div>
            </div>
          </CardHeader>

          <CardContent className="grid gap-6">
            <div className="rounded-[22px] border-2 border-slate-950 bg-[#efe6d6] p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-[16px] border-2 border-slate-950 bg-white">
                  {mode === "login" ? <LockKeyhole className="h-5 w-5" /> : <UserRoundPlus className="h-5 w-5" />}
                </div>
                <div className="text-sm leading-6 text-slate-700">
                  {mode === "login" ? t("auth.loginText") : t("auth.registerText")}
                </div>
              </div>
            </div>

            <form onSubmit={mode === "login" ? onLogin : onRegister} className="grid gap-4">
              {mode === "register" && (
                <div className="grid gap-2">
                  <Label>{t("auth.name")}</Label>
                  <Input value={name} onChange={(event) => setName(event.target.value)} className="h-12" />
                </div>
              )}

              <div className="grid gap-2">
                <Label>{t("auth.email")}</Label>
                <Input
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  className="h-12"
                />
              </div>

              <div className="grid gap-2">
                <Label>{t("auth.password")}</Label>
                <Input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Enter your password"
                  className="h-12"
                />
              </div>

              {mode === "register" && (
                <div className="grid gap-2">
                  <Label>{t("auth.confirmPassword")}</Label>
                  <Input
                    type="password"
                    value={passwordConfirmation}
                    onChange={(event) => setPasswordConfirmation(event.target.value)}
                    className="h-12"
                  />
                </div>
              )}

              {error && <div className="rounded-[18px] border-2 border-red-700 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

              <Button className="h-12 text-base" disabled={loading}>
                {loading
                  ? mode === "login"
                    ? t("auth.signingIn")
                    : t("auth.creatingAccount")
                  : mode === "login"
                    ? t("auth.continue")
                    : t("auth.create")}
                {!loading && <ArrowRight className="h-4 w-4" />}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
