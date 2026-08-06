import { describe, expect, it } from "vitest";
import { THEME_INIT_SCRIPT, parseStoredTheme, resolveTheme } from "./theme";

describe("parseStoredTheme", () => {
  it("accepts exactly the three known preferences", () => {
    expect(parseStoredTheme("light")).toBe("light");
    expect(parseStoredTheme("dark")).toBe("dark");
    expect(parseStoredTheme("system")).toBe("system");
  });

  it("rejects everything else", () => {
    for (const raw of [null, "", "auto", "DARK", " dark", "0"]) {
      expect(parseStoredTheme(raw)).toBeNull();
    }
  });
});

describe("resolveTheme", () => {
  it("forces an explicit preference regardless of the OS", () => {
    expect(resolveTheme("light", false)).toBe("light");
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
    expect(resolveTheme("dark", true)).toBe("dark");
  });

  it("follows the OS when the preference is system", () => {
    expect(resolveTheme("system", false)).toBe("light");
    expect(resolveTheme("system", true)).toBe("dark");
  });
});

// The FOUC-critical path: execute the inline script string for real against
// stubbed globals and assert it toggles the class exactly like
// resolveTheme(parseStoredTheme(raw) ?? "system", systemDark) would.
function runScript(stored: string | null, systemDark: boolean) {
  const toggles: [string, boolean][] = [];
  new Function("localStorage", "matchMedia", "document", THEME_INIT_SCRIPT)(
    { getItem: () => stored },
    () => ({ matches: systemDark }),
    {
      documentElement: {
        classList: { toggle: (name: string, force: boolean) => toggles.push([name, force]) },
      },
    },
  );
  return toggles;
}

describe("THEME_INIT_SCRIPT", () => {
  it("applies a stored explicit preference regardless of the OS", () => {
    expect(runScript("dark", false)).toEqual([["dark", true]]);
    expect(runScript("light", true)).toEqual([["dark", false]]);
  });

  it("follows the OS when the key is missing or holds garbage", () => {
    expect(runScript(null, true)).toEqual([["dark", true]]);
    expect(runScript(null, false)).toEqual([["dark", false]]);
    expect(runScript("garbage", true)).toEqual([["dark", true]]);
  });

  it("swallows a throwing localStorage instead of breaking paint", () => {
    expect(() =>
      new Function("localStorage", "matchMedia", "document", THEME_INIT_SCRIPT)(
        {
          getItem: () => {
            throw new Error("blocked");
          },
        },
        () => ({ matches: true }),
        { documentElement: { classList: { toggle: () => {} } } },
      ),
    ).not.toThrow();
  });
});
