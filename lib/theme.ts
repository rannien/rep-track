// Theme domain logic, extracted from components/theme-provider.tsx so the
// stored-preference validation and resolution are testable without the React
// layer — same convention as lib/rest-timer.ts.

export const THEME_KEY = "rep-track-theme";

export type ThemePreference = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

// Least surprising default; an invalid or missing stored value degrades here.
export const DEFAULT_THEME: ThemePreference = "system";

// localStorage is a trust boundary (see lib/sessions.ts): only the three
// exact strings are accepted; anything else yields null and the caller keeps
// the default.
export function parseStoredTheme(raw: string | null): ThemePreference | null {
  return raw === "light" || raw === "dark" || raw === "system" ? raw : null;
}

// Resolve a preference against the OS appearance — pure, so it needs no
// matchMedia to test.
export function resolveTheme(preference: ThemePreference, systemDark: boolean): ResolvedTheme {
  if (preference === "system") return systemDark ? "dark" : "light";
  return preference;
}

// Runs as an inline <script> at the top of <body>, parser-blocking, so a
// stored "dark" never flashes the light theme before hydration. Must stay
// semantically identical to
// resolveTheme(parseStoredTheme(raw) ?? DEFAULT_THEME, systemDark) — any
// stored garbage means "system" in both places. classList.toggle rather than
// overwriting className, because <html> also carries the font classes. The
// try/catch keeps a blocked localStorage (private mode) from breaking paint;
// ThemeProvider re-derives the same answer after mount.
export const THEME_INIT_SCRIPT = `(function () {
  try {
    var stored = localStorage.getItem(${JSON.stringify(THEME_KEY)});
    var dark =
      stored === "dark" ||
      (stored !== "light" && matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.classList.toggle("dark", dark);
  } catch (error) {}
})();`;
