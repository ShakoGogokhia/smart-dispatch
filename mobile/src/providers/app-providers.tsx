import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { PropsWithChildren } from "react";
import { useColorScheme } from "react-native";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";

import { api, setApiLanguage, setApiToken } from "@/src/lib/api";
import { buildColors, DEFAULT_PALETTE, isPaletteId, type PaletteId, type ResolvedTheme, type ThemeColors, type ThemeMode } from "@/src/theme/tokens";
import {
  clearStoredToken,
  getStoredLanguage,
  getStoredPalette,
  getStoredTheme,
  getStoredToken,
  setStoredLanguage,
  setStoredPalette,
  setStoredTheme,
  setStoredToken,
} from "@/src/lib/storage";

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
  /** Resolved light/dark scheme actually shown. */
  theme: ResolvedTheme;
  /** User choice: light, dark or follow the system. */
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => Promise<void>;
  palette: PaletteId;
  setPalette: (palette: PaletteId) => Promise<void>;
  colors: ThemeColors;
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
  const systemScheme = useColorScheme();
  const [language, setLanguageState] = useState<Language>("en");
  const [themeMode, setThemeModeState] = useState<ThemeMode>("system");
  const [palette, setPaletteState] = useState<PaletteId>(DEFAULT_PALETTE);

  useEffect(() => {
    let active = true;

    async function load() {
      const [storedLanguage, storedTheme, storedPalette] = await Promise.all([
        getStoredLanguage(),
        getStoredTheme(),
        getStoredPalette(),
      ]);

      if (!active) {
        return;
      }

      const nextLanguage = storedLanguage === "ka" ? "ka" : "en";
      const nextMode: ThemeMode = storedTheme === "dark" || storedTheme === "light" ? storedTheme : "system";

      setLanguageState(nextLanguage);
      setThemeModeState(nextMode);
      if (isPaletteId(storedPalette)) {
        setPaletteState(storedPalette);
      }
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

  const theme: ResolvedTheme = themeMode === "system" ? (systemScheme === "dark" ? "dark" : "light") : themeMode;
  const colors = useMemo(() => buildColors(palette, theme), [palette, theme]);

  const setThemeMode = useCallback(async (mode: ThemeMode) => {
    setThemeModeState(mode);
    await setStoredTheme(mode);
  }, []);

  const setPalette = useCallback(async (next: PaletteId) => {
    setPaletteState(next);
    await setStoredPalette(next);
  }, []);

  const toggleTheme = useCallback(async () => {
    await setThemeMode(theme === "light" ? "dark" : "light");
  }, [setThemeMode, theme]);

  const value = useMemo<PreferencesContextValue>(
    () => ({
      language,
      setLanguage,
      theme,
      themeMode,
      setThemeMode,
      palette,
      setPalette,
      colors,
      toggleTheme,
    }),
    [colors, language, palette, setLanguage, setPalette, setThemeMode, theme, themeMode, toggleTheme],
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

/** Theme tokens (same as the web app) for the active palette and light/dark mode. */
export function useThemeColors() {
  return usePreferences().colors;
}
