import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Compass, LogIn, ShieldCheck, Store, Truck, UserRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { api } from "@/lib/api";
import { auth } from "@/lib/auth";
import { getDefaultAuthedPath, normalizeRoles } from "@/lib/session";
import { cn } from "@/lib/utils";

const SEEN_KEY = "sd-tour-seen";

type Step = {
  image: string;
  role: string;
  title: string;
  body: string;
  tryIt: string;
};

const STEPS: Step[] = [
  {
    image: "/tour/home.jpg",
    role: "Welcome",
    title: "Smart Dispatch in one minute",
    body: "A delivery platform with four connected roles: customers order from local markets, market owners prepare the orders, drivers deliver them, and admins dispatch everything in real time. The web app and the mobile app share the same Laravel API.",
    tryIt: "Browse the markets on the home page without signing in.",
  },
  {
    image: "/tour/cust-history.jpg",
    role: "Customer",
    title: "Order, pay and reorder",
    body: "Customers add items to the cart, check out with saved details, and get every order with its receipt, payment state and rating. Any past order can be reordered in one click.",
    tryIt: "Sign in as the customer and open Order history.",
  },
  {
    image: "/tour/track.jpg",
    role: "Customer",
    title: "Live order tracking",
    body: "Each order has a public tracking page with a step-by-step timeline, the assigned driver and a live map. It refreshes on its own every few seconds, no sign-in needed.",
    tryIt: "Open Track order and enter DEMO-00005.",
  },
  {
    image: "/tour/owner-dash.jpg",
    role: "Market owner",
    title: "Run the market",
    body: "Owners see revenue, top sellers, ratings and stock warnings at a glance, and manage products, promo codes and opening hours. Items that run out can be hidden from the storefront automatically.",
    tryIt: "Sign in as the market owner and open Dashboard.",
  },
  {
    image: "/tour/driver-hub.jpg",
    role: "Driver",
    title: "Accept and deliver",
    body: "Drivers go online to receive delivery offers with a countdown. They accept or decline, mark pickup, and finish with a signature or photo as proof of delivery. Earnings are tracked per shift.",
    tryIt: "Sign in as the driver and open Driver hub.",
  },
  {
    image: "/tour/dispatch.jpg",
    role: "Admin",
    title: "Dispatch with reasons",
    body: "The dispatch console suggests the best driver for every order and explains why: distance, free capacity, active orders and earlier declines. Unanswered offers time out and move on to the next driver.",
    tryIt: "Sign in as the admin and pick an order in Dispatch.",
  },
  {
    image: "/tour/livemap.jpg",
    role: "Admin",
    title: "Live map and operations",
    body: "Admins follow every driver on a live map with playback tracks and stale-location alerts, and also manage users, approvals, support tickets and audit logs.",
    tryIt: "Sign in as the admin and open Live map.",
  },
];

const ACCOUNTS = [
  { role: "Customer", email: "customer@test.com", icon: UserRound },
  { role: "Market owner", email: "owner@test.com", icon: Store },
  { role: "Driver", email: "driver@test.com", icon: Truck },
  { role: "Admin", email: "admin@test.com", icon: ShieldCheck },
];
const DEMO_PASSWORD = "123456";

function hasSeenTour() {
  try {
    return localStorage.getItem(SEEN_KEY) === "1";
  } catch {
    return true;
  }
}

function markTourSeen() {
  try {
    localStorage.setItem(SEEN_KEY, "1");
  } catch {
    // Storage can be blocked (private mode); the tour just shows again next time.
  }
}

export default function WelcomeTour() {
  const [open, setOpen] = useState(() => !hasSeenTour());
  const [index, setIndex] = useState(0);
  const [signingIn, setSigningIn] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const total = STEPS.length + 1;
  const isAccounts = index === STEPS.length;
  const step = STEPS[index];

  const go = useCallback((next: number) => setIndex(Math.min(Math.max(next, 0), total - 1)), [total]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight") go(index + 1);
      if (event.key === "ArrowLeft") go(index - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, index, go]);

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      markTourSeen();
      setError(null);
    }
  }

  function reopen() {
    setIndex(0);
    setOpen(true);
  }

  async function signInAs(email: string) {
    setSigningIn(email);
    setError(null);
    try {
      const res = await api.post("/api/login", { email, password: DEMO_PASSWORD });
      auth.setToken(res.data.token);
      markTourSeen();
      // Full reload so every cached query starts fresh for the new role.
      window.location.assign(getDefaultAuthedPath(normalizeRoles(res.data.user?.roles)));
    } catch {
      setError("The demo server is waking up (free hosting sleeps when idle). Try again in about 30 seconds.");
      setSigningIn(null);
    }
  }

  return (
    <>
      {!open && (
        <Button
          variant="outline"
          size="sm"
          onClick={reopen}
          // Desktop only: on small screens the app and storefront already pin bars to the bottom.
          className="fixed right-4 bottom-4 z-40 hidden rounded-full shadow-md lg:inline-flex"
        >
          <Compass />
          Product tour
        </Button>
      )}

      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-3xl">
          <div className="flex h-12 items-center gap-2 border-b px-6 pr-12 text-sm text-muted-foreground">
            <Compass className="size-4" />
            <span>Product tour</span>
            <span className="ml-auto tabular-nums">
              {index + 1} / {total}
            </span>
          </div>

          {isAccounts ? (
            <div className="grid gap-4 p-6">
              <div className="grid gap-1.5">
                <span className="text-xs font-medium tracking-wide text-primary uppercase">Try it yourself</span>
                <DialogTitle className="text-xl">Sign in with a demo account</DialogTitle>
                <DialogDescription>
                  Every account uses the password <span className="font-mono font-medium text-foreground">{DEMO_PASSWORD}</span>.
                  The demo database resets itself, so feel free to click around and change things.
                </DialogDescription>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {ACCOUNTS.map(({ role, email, icon: Icon }) => (
                  <button
                    key={email}
                    type="button"
                    disabled={signingIn !== null}
                    onClick={() => signInAs(email)}
                    className="flex items-center gap-3 rounded-lg border bg-card p-4 text-left transition-colors hover:border-primary hover:bg-accent disabled:opacity-60"
                  >
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                      <Icon className="size-5" />
                    </span>
                    <span className="grid min-w-0 flex-1">
                      <span className="font-medium">{role}</span>
                      <span className="truncate font-mono text-xs text-muted-foreground">{email}</span>
                    </span>
                    {signingIn === email ? <Spinner /> : <LogIn className="size-4 text-muted-foreground" />}
                  </button>
                ))}
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>
          ) : (
            <>
              <div className="aspect-[16/9] w-full overflow-hidden border-b bg-muted">
                <img
                  src={step.image}
                  alt={`${step.title} screenshot`}
                  className="h-full w-full object-cover object-top"
                />
              </div>
              <div className="grid gap-2 p-6">
                <span className="text-xs font-medium tracking-wide text-primary uppercase">{step.role}</span>
                <DialogTitle className="text-xl">{step.title}</DialogTitle>
                <DialogDescription className="text-sm leading-relaxed">{step.body}</DialogDescription>
                <p className="text-sm">
                  <span className="font-medium">Try it: </span>
                  <span className="text-muted-foreground">{step.tryIt}</span>
                </p>
              </div>
            </>
          )}

          <div className="flex items-center justify-between gap-3 border-t px-6 py-4">
            <div className="flex items-center gap-1.5" aria-label={`Step ${index + 1} of ${total}`}>
              {Array.from({ length: total }, (_, i) => (
                <button
                  key={i}
                  type="button"
                  aria-label={`Go to step ${i + 1}`}
                  onClick={() => go(i)}
                  className={cn(
                    "h-1.5 rounded-full transition-all",
                    i === index ? "w-6 bg-primary" : "w-1.5 bg-muted-foreground/30 hover:bg-muted-foreground/60",
                  )}
                />
              ))}
            </div>

            <div className="flex items-center gap-2">
              {index === 0 ? (
                <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
                  Skip
                </Button>
              ) : (
                <Button variant="ghost" size="sm" onClick={() => go(index - 1)}>
                  <ArrowLeft />
                  Back
                </Button>
              )}
              {isAccounts ? (
                <Button size="sm" onClick={() => onOpenChange(false)}>
                  Explore on my own
                </Button>
              ) : (
                <Button size="sm" onClick={() => go(index + 1)}>
                  Next
                  <ArrowRight />
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
