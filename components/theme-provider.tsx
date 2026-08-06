"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  DEFAULT_THEME,
  THEME_KEY,
  type ResolvedTheme,
  type ThemePreference,
  parseStoredTheme,
  resolveTheme,
} from "@/lib/theme";

type ThemeContextValue = {
  /** False during SSR and the first client render; gate preference-derived UI on it. */
  hydrated: boolean;
  preference: ThemePreference;
  /** What is actually applied to <html> — the preference resolved against the OS. */
  resolvedTheme: ResolvedTheme;
  setPreference: (preference: ThemePreference) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within <ThemeProvider>");
  return ctx;
}

const SYSTEM_DARK_QUERY = "(prefers-color-scheme: dark)";

// Owns the theme preference after hydration. The pre-paint work is done by
// THEME_INIT_SCRIPT in the layout; this provider re-derives the same answer
// on mount (idempotent class toggle) and then keeps it live: OS appearance
// changes, other tabs, and the settings page all flow through here.
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [hydrated, setHydrated] = useState(false);
  const [preference, setPreferenceState] = useState<ThemePreference>(DEFAULT_THEME);
  const [systemDark, setSystemDark] = useState(false);

  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem(THEME_KEY);
    } catch {
      // Storage inaccessible (blocked/private mode): stay on the default —
      // the theme still works, the choice just won't persist.
    }
    setPreferenceState(parseStoredTheme(stored) ?? DEFAULT_THEME);
    const media = window.matchMedia(SYSTEM_DARK_QUERY);
    setSystemDark(media.matches);
    setHydrated(true);

    // Live OS appearance changes; only visible while the preference is
    // "system" (resolveTheme ignores systemDark otherwise).
    function onMediaChange(e: MediaQueryListEvent) {
      setSystemDark(e.matches);
    }
    media.addEventListener("change", onMediaChange);

    // Another tab changed (or cleared) the stored preference — adopt it. No
    // echo guard needed: writes only happen in setPreference, a user action.
    function onStorage(e: StorageEvent) {
      if (e.key !== null && e.key !== THEME_KEY) return; // null key = storage.clear()
      setPreferenceState(parseStoredTheme(e.key === null ? null : e.newValue) ?? DEFAULT_THEME);
    }
    window.addEventListener("storage", onStorage);
    return () => {
      media.removeEventListener("change", onMediaChange);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const resolvedTheme = resolveTheme(preference, systemDark);

  // Gated on hydrated so the initial defaults can never undo what the init
  // script applied before paint.
  useEffect(() => {
    if (!hydrated) return;
    document.documentElement.classList.toggle("dark", resolvedTheme === "dark");
  }, [hydrated, resolvedTheme]);

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    try {
      window.localStorage.setItem(THEME_KEY, next);
    } catch {
      // Non-fatal: the theme still applies for this visit.
    }
  }, []);

  const value = useMemo(
    () => ({ hydrated, preference, resolvedTheme, setPreference }),
    [hydrated, preference, resolvedTheme, setPreference],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
