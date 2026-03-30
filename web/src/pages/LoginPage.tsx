import { useEffect, useMemo, useState } from "react";
import type { AxiosError } from "axios";
import { ArrowRight, LockKeyhole, UserRoundPlus } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import { auth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
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

  useEffect(() => {
    const requestedMode = searchParams.get("mode");
    setMode(requestedMode === "register" ? "register" : "login");
  }, [searchParams]);

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
      setError(getErrorMessage(nextError, t("auth.loginFailed")));
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
        language,
        password,
        password_confirmation: passwordConfirmation,
      });
      finishAuth(res.data.token, res.data?.user?.roles ?? ["customer"]);
    } catch (nextError: unknown) {
      setError(getErrorMessage(nextError, t("auth.registerFailed")));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[minmax(0,1fr)_460px]">
      <section className="public-hero page-enter">
        <div className="command-chip">{mode === "login" ? "Login" : "Register"}</div>
        <h1 className="mt-4 font-display text-4xl font-semibold tracking-[-0.06em] text-slate-950 dark:text-white md:text-6xl">
          {mode === "login" ? "Simple sign in." : "Create your account."}
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-600 dark:text-slate-300">
          Customers can register here, and staff can use the same page to sign in and open the workspace from the header.
        </p>

        <div className="mt-6 flex flex-wrap gap-2">
          <Button variant={language === "en" ? "default" : "secondary"} className="h-11 rounded-[16px]" onClick={() => setLanguage("en")}>
            English
          </Button>
          <Button variant={language === "ka" ? "default" : "secondary"} className="h-11 rounded-[16px]" onClick={() => setLanguage("ka")}>
            Georgian
          </Button>
        </div>
      </section>

      <Card className="page-enter page-enter-delay-1">
        <CardHeader className="pb-2">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="section-kicker">Account</div>
              <CardTitle className="font-display mt-2 text-3xl font-semibold tracking-[-0.05em] text-slate-950 dark:text-white">
                {mode === "login" ? t("auth.signIn") : t("auth.createAccount")}
              </CardTitle>
            </div>

            <div className="rounded-[16px] border border-border bg-secondary p-1">
              <button
                type="button"
                className={[
                  "rounded-[12px] px-4 py-2 text-sm font-semibold transition",
                  mode === "login"
                    ? "bg-white text-slate-950 dark:bg-white/10 dark:text-white"
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
                    ? "bg-white text-slate-950 dark:bg-white/10 dark:text-white"
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
            <div className="flex items-center gap-3 p-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-[16px] border border-border bg-secondary">
                {mode === "login" ? <LockKeyhole className="h-5 w-5" /> : <UserRoundPlus className="h-5 w-5" />}
              </div>
              <div className="text-sm leading-6 text-slate-600 dark:text-slate-300">
                {mode === "login" ? "Use your existing account." : "New accounts are created as customer accounts."}
              </div>
            </div>
          </div>

          <form onSubmit={mode === "login" ? onLogin : onRegister} className="grid gap-4">
            {mode === "register" && (
              <div className="field-group">
                <Label className="field-label" htmlFor="name">
                  {t("auth.name")}
                </Label>
                <Input id="name" value={name} onChange={(event) => setName(event.target.value)} className="input-shell" />
              </div>
            )}

            <div className="field-group">
              <Label className="field-label" htmlFor="email">
                {t("auth.email")}
              </Label>
              <Input
                id="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                className="input-shell"
              />
            </div>

            <div className="field-group">
              <Label className="field-label" htmlFor="password">
                {t("auth.password")}
              </Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter your password"
                className="input-shell"
              />
            </div>

            {mode === "register" && (
              <div className="field-group">
                <Label className="field-label" htmlFor="password-confirmation">
                  {t("auth.confirmPassword")}
                </Label>
                <Input
                  id="password-confirmation"
                  type="password"
                  value={passwordConfirmation}
                  onChange={(event) => setPasswordConfirmation(event.target.value)}
                  className="input-shell"
                />
              </div>
            )}

            {error && <div className="rounded-[18px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

            <Button className="h-12 text-base" disabled={loading}>
              {loading
                ? mode === "login"
                  ? t("auth.signingIn")
                  : t("auth.creatingAccount")
                : mode === "login"
                  ? "Login"
                  : "Register"}
              {!loading && <ArrowRight className="h-4 w-4" />}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
