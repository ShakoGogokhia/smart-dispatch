import { useMemo, useState } from "react";
import { AlertCircle, ArrowRight, Check, ShieldCheck, Store, Truck, UserRound } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import type { AxiosError } from "axios";

import { Brand } from "@/components/app/brand";
import ThemeToggle from "@/components/ThemeToggle";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
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
        phone: phone.trim() || null,
        address: address.trim() || null,
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
    { icon: UserRound, title: "Customers", text: "Browse markets, place orders and track deliveries live." },
    { icon: Store, title: "Market owners", text: "Manage your market, catalog, promo codes and incoming orders." },
    { icon: Truck, title: "Drivers & admins", text: "Pick up deliveries, oversee users, roles and operations." },
  ];

  return (
    <div className="grid min-h-screen bg-background lg:grid-cols-2">
      {/* Brand panel */}
      <aside className="hidden flex-col justify-between bg-primary p-10 text-primary-foreground lg:flex">
        <div className="flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary-foreground/15">
            <Truck className="size-4" />
          </span>
          <span className="text-[15px] font-semibold tracking-tight">Smart Dispatch</span>
        </div>

        <div className="max-w-md space-y-8">
          <div className="space-y-3">
            <h1 className="text-3xl font-semibold tracking-tight">Order, deliver and manage, all in one place.</h1>
            <p className="text-primary-foreground/80">
              Customers place orders, owners run their markets, drivers deliver and admins keep everything moving, from one app.
            </p>
          </div>
          <ul className="space-y-5">
            {highlights.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.title} className="flex items-start gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-foreground/15">
                    <Icon className="size-4" />
                  </span>
                  <div>
                    <div className="font-medium">{item.title}</div>
                    <div className="text-sm text-primary-foreground/75">{item.text}</div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="flex items-center gap-2 text-sm text-primary-foreground/75">
          <ShieldCheck className="size-4" />
          Secure sign-in for every role
        </div>
      </aside>

      {/* Form */}
      <div className="flex flex-col">
        <div className="flex items-center justify-between gap-3 p-4 sm:p-6">
          <div className="lg:hidden">
            <Brand />
          </div>
          <div className="ml-auto">
            <ThemeToggle compact />
          </div>
        </div>

        <div className="flex flex-1 items-center justify-center px-4 pb-10 sm:px-6">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle className="text-xl">{mode === "login" ? "Welcome back" : "Create your account"}</CardTitle>
              <CardDescription>
                {mode === "login"
                  ? "Sign in with your email and password to continue."
                  : "New accounts are created as customer accounts by default."}
              </CardDescription>
            </CardHeader>

            <CardContent className="grid gap-6">
              <Tabs value={mode} onValueChange={(value) => setMode(value as AuthMode)}>
                <TabsList className="w-full">
                  <TabsTrigger value="login">Sign in</TabsTrigger>
                  <TabsTrigger value="register">Register</TabsTrigger>
                </TabsList>
              </Tabs>

              <form onSubmit={mode === "login" ? onLogin : onRegister} className="grid gap-4">
                {mode === "register" && (
                  <div className="grid gap-2">
                    <Label htmlFor="auth-name">Full name</Label>
                    <Input id="auth-name" value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" placeholder="Your name" />
                  </div>
                )}

                <div className="grid gap-2">
                  <Label htmlFor="auth-email">Email</Label>
                  <Input
                    id="auth-email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@example.com"
                    autoComplete="email"
                  />
                </div>

                {mode === "register" && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="grid gap-2">
                      <Label htmlFor="auth-phone">Phone</Label>
                      <Input id="auth-phone" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="Optional" autoComplete="tel" />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="auth-address">Address</Label>
                      <Input id="auth-address" value={address} onChange={(event) => setAddress(event.target.value)} placeholder="Optional" autoComplete="street-address" />
                    </div>
                    <p className="-mt-2 text-xs text-muted-foreground sm:col-span-2">Saved to speed up checkout. You can change them later.</p>
                  </div>
                )}

                <div className="grid gap-2">
                  <Label htmlFor="auth-password">Password</Label>
                  <Input
                    id="auth-password"
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Enter your password"
                    autoComplete={mode === "login" ? "current-password" : "new-password"}
                  />
                </div>

                {mode === "register" && (
                  <div className="grid gap-2">
                    <Label htmlFor="auth-password-confirm">Confirm password</Label>
                    <Input
                      id="auth-password-confirm"
                      type="password"
                      value={passwordConfirmation}
                      onChange={(event) => setPasswordConfirmation(event.target.value)}
                      autoComplete="new-password"
                    />
                  </div>
                )}

                {error && (
                  <Alert variant="destructive">
                    <AlertCircle />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <Button className="w-full" disabled={loading}>
                  {loading ? <Spinner /> : null}
                  {loading
                    ? mode === "login"
                      ? "Signing in..."
                      : "Creating account..."
                    : mode === "login"
                      ? "Continue"
                      : "Create account"}
                  {!loading && <ArrowRight />}
                </Button>
              </form>

              <p className="text-center text-sm text-muted-foreground">
                {mode === "login" ? "New to Smart Dispatch? " : "Already have an account? "}
                <button
                  type="button"
                  className="font-medium text-primary underline-offset-4 hover:underline"
                  onClick={() => setMode(mode === "login" ? "register" : "login")}
                >
                  {mode === "login" ? "Create an account" : "Sign in"}
                </button>
              </p>

              <ul className="grid gap-1.5 text-xs text-muted-foreground lg:hidden">
                {highlights.map((item) => (
                  <li key={item.title} className="flex items-start gap-2">
                    <Check className="mt-0.5 size-3.5 shrink-0 text-primary" />
                    <span>
                      <span className="font-medium text-foreground">{item.title}:</span> {item.text}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
