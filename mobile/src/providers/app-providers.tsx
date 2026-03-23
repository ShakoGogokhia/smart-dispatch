import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { PropsWithChildren } from "react";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";

import { api, setApiLanguage, setApiToken } from "@/src/lib/api";
import {
  clearStoredToken,
  getStoredLanguage,
  getStoredTheme,
  getStoredToken,
  setStoredLanguage,
  setStoredTheme,
  setStoredToken,
} from "@/src/lib/storage";

type ThemeMode = "light" | "dark";
type Language = "en" | "ka";

type PendingRoute = {
  name: string;
  params?: Record<string, unknown>;
} | null;

type AuthContextValue = {
  token: string | null;
  ready: boolean;
  pendingRoute: PendingRoute;
  setPendingRoute: (route: PendingRoute) => void;
  signIn: (token: string) => Promise<void>;
  signOut: () => Promise<void>;
};

type PreferencesContextValue = {
  language: Language;
  setLanguage: (language: Language) => Promise<void>;
  theme: ThemeMode;
  toggleTheme: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);
const PreferencesContext = createContext<PreferencesContextValue | null>(null);

const queryClient = new QueryClient();

function AuthProvider({ children }: PropsWithChildren) {
  const client = useQueryClient();
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [pendingRoute, setPendingRoute] = useState<PendingRoute>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      let nextToken: string | null = null;

      try {
        nextToken = await getStoredToken();
      } finally {
        if (!active) {
          return;
        }

        setToken(nextToken);
        setApiToken(nextToken);
        setReady(true);
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, []);

  const signIn = useCallback(async (nextToken: string) => {
    await setStoredToken(nextToken);
    setApiToken(nextToken);
    setToken(nextToken);
    await client.invalidateQueries({ queryKey: ["me"] });
  }, [client]);

  const signOut = useCallback(async () => {
    try {
      await api.post("/api/logout");
    } catch {
      // Keep local logout resilient even when backend logout fails.
    }

    await clearStoredToken();
    setApiToken(null);
    setToken(null);
    setPendingRoute(null);
    client.clear();
  }, [client]);

  const value = useMemo<AuthContextValue>(
    () => ({
      token,
      ready,
      pendingRoute,
      setPendingRoute,
      signIn,
      signOut,
    }),
    [pendingRoute, ready, signIn, signOut, token],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function PreferencesProvider({ children }: PropsWithChildren) {
  const [language, setLanguageState] = useState<Language>("en");
  const [theme, setTheme] = useState<ThemeMode>("light");

  useEffect(() => {
    let active = true;

    async function load() {
      const [storedLanguage, storedTheme] = await Promise.all([getStoredLanguage(), getStoredTheme()]);

      if (!active) {
        return;
      }

      const nextLanguage = storedLanguage === "ka" ? "ka" : "en";
      const nextTheme = storedTheme === "dark" ? "dark" : "light";

      setLanguageState(nextLanguage);
      setTheme(nextTheme);
      setApiLanguage(nextLanguage);
    }

    void load();

    return () => {
      active = false;
    };
  }, []);

  const setLanguage = useCallback(async (language: Language) => {
    setLanguageState(language);
    setApiLanguage(language);
    await setStoredLanguage(language);

    void api.post("/api/me/language", { language }).catch(() => {
      // Keep preference local when sync is unavailable.
    });
  }, []);

  const toggleTheme = useCallback(async () => {
    const nextTheme: ThemeMode = theme === "light" ? "dark" : "light";
    setTheme(nextTheme);
    await setStoredTheme(nextTheme);
  }, [theme]);

  const value = useMemo<PreferencesContextValue>(
    () => ({
      language,
      setLanguage,
      theme,
      toggleTheme,
    }),
    [language, setLanguage, theme, toggleTheme],
  );

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <QueryClientProvider client={queryClient}>
      <PreferencesProvider>
        <AuthProvider>{children}</AuthProvider>
      </PreferencesProvider>
    </QueryClientProvider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AppProviders");
  }
  return context;
}

export function usePreferences() {
  const context = useContext(PreferencesContext);
  if (!context) {
    throw new Error("usePreferences must be used inside AppProviders");
  }
  return context;
}
