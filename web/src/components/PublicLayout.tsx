import { useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { ChevronRight, LayoutDashboard, LogIn, UserRound, UserRoundPlus, Zap } from "lucide-react";

import ProfileSettingsDialog from "@/components/ProfileSettingsDialog";
import ThemeToggle from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { auth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { getDefaultAuthedPath } from "@/lib/session";
import { useMe } from "@/lib/useMe";

function HeaderActions() {
  const navigate = useNavigate();
  const location = useLocation();
  const [profileOpen, setProfileOpen] = useState(false);
  const { language, setLanguage, t } = useI18n();
  const token = auth.getToken();
  const meQ = useMe({ enabled: !!token });
  const authedPath = getDefaultAuthedPath(meQ.data?.roles);
  const nextValue = `${location.pathname}${location.search}`;

  const languageSwitcher = (
    <div className="flex items-center gap-1 rounded-full border border-white/10 bg-white/6 p-1">
      <Button
        type="button"
        variant={language === "en" ? "default" : "ghost"}
        className="h-9 rounded-full px-3 text-xs"
        onClick={() => setLanguage("en")}
      >
        EN
      </Button>
      <Button
        type="button"
        variant={language === "ka" ? "default" : "ghost"}
        className="h-9 rounded-full px-3 text-xs"
        onClick={() => setLanguage("ka")}
      >
        KA
      </Button>
    </div>
  );

  function handleLogout() {
    navigate("/", { replace: true });
  }

  if (token && meQ.isLoading) {
    return (
      <div className="flex flex-wrap items-center justify-end gap-2">
        {languageSwitcher}
        <div className="status-chip min-h-11 rounded-[16px] px-4">Loading...</div>
        <ThemeToggle />
      </div>
    );
  }

  if (!meQ.data) {
    return (
      <div className="flex flex-wrap items-center justify-end gap-2">
        {languageSwitcher}
        <ThemeToggle />
        <Button asChild variant="secondary" className="h-11 rounded-[16px]">
          <Link to={`/login?next=${encodeURIComponent(nextValue)}`}>
            <LogIn className="h-4 w-4" />
            {t("auth.login")}
          </Link>
        </Button>
        <Button asChild className="h-11 rounded-[16px]">
          <Link to={`/login?mode=register&next=${encodeURIComponent(nextValue)}`}>
            <UserRoundPlus className="h-4 w-4" />
            {t("auth.register")}
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-end gap-2">
        {languageSwitcher}
        <div className="status-chip min-h-11 rounded-[16px] px-4">
          <UserRound className="h-4 w-4" />
          {meQ.data.name}
        </div>
        <Button asChild variant="secondary" className="h-11 rounded-[16px]">
          <Link to={authedPath}>
            <LayoutDashboard className="h-4 w-4" />
            {t("public.openWorkspace")}
          </Link>
        </Button>
        <Button variant="secondary" className="h-11 rounded-[16px]" onClick={() => setProfileOpen(true)}>
          {language === "ka" ? "პროფილის პარამეტრები" : "Profile settings"}
        </Button>
        <ThemeToggle />
      </div>

      <ProfileSettingsDialog
        open={profileOpen}
        onOpenChange={setProfileOpen}
        name={meQ.data.name}
        email={meQ.data.email}
        language={meQ.data.language}
        onLogout={handleLogout}
      />
    </>
  );
}

export default function PublicLayout() {
  const { language, t } = useI18n();

  return (
    <div className="app-shell storefront-shell public-marketplace-shell">
      <div className="relative z-10 mx-auto max-w-7xl space-y-6">
        <header className="public-header page-enter">
          <Link to="/" className="public-logo">
            <span className="public-logo__mark">
              <Zap className="h-4 w-4" />
            </span>
            <div>
              <div className="font-display text-xl font-semibold tracking-[-0.04em] text-slate-950 dark:text-white">Smart Dispatch</div>
              <div className="text-sm text-slate-500 dark:text-slate-400">
                {language === "ka" ? "მარკეტები და დისპეტჩი" : "Markets and dispatch"}
              </div>
            </div>
          </Link>

          <HeaderActions />
        </header>

        <Outlet />

        <footer className="public-footer page-enter page-enter-delay-1">
          <div>
            <div className="font-display text-xl font-semibold text-slate-950 dark:text-white">Smart Dispatch</div>
            <p className="mt-2 max-w-xl text-sm text-slate-600 dark:text-slate-400">
              {language === "ka"
                ? "სწრაფად დაათვალიერე მარკეტები, გახსენი მაღაზია და საჭიროებისას გადადი სამუშაო სივრცეში."
                : "Browse markets fast, open a store, and move to staff tools when you need them."}
            </p>
          </div>

          <div className="flex flex-wrap gap-3 text-sm">
            <Link to="/" className="status-chip rounded-[16px] px-4 py-2">
              {t("public.openMarkets")}
            </Link>
            <Link to="/login?mode=register" className="status-chip rounded-[16px] px-4 py-2">
              {language === "ka" ? "ანგარიშის შექმნა" : "Create account"}
            </Link>
            <Link to="/login" className="status-chip rounded-[16px] px-4 py-2">
              {t("auth.login")}
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </footer>
      </div>
    </div>
  );
}
