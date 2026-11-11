import { describe, expect, it } from "vitest";
import { SPLASH_SCREENS, findSplashScreen, splashStartupImages } from "./splash";

function screenById(id: string) {
  const screen = SPLASH_SCREENS.find((candidate) => candidate.id === id);
  if (!screen) throw new Error(`missing splash screen ${id}`);
  return screen;
}

describe("SPLASH_SCREENS", () => {
  it("has unique ids", () => {
    const ids = SPLASH_SCREENS.map((screen) => screen.id);

    expect(new Set(ids).size).toBe(ids.length);
  });

  it("sizes an iPhone portrait image as CSS size times pixel ratio", () => {
    const screen = screenById("1179x2556-light");

    expect(screen).toMatchObject({
      width: 1179,
      height: 2556,
      pixelRatio: 3,
      scheme: "light",
    });
    expect(screen.media).toBe(
      "(device-width: 393px) and (device-height: 852px)" +
        " and (-webkit-device-pixel-ratio: 3)" +
        " and (orientation: portrait) and (prefers-color-scheme: light)",
    );
  });

  it("distinguishes devices that share CSS dims by pixel ratio", () => {
    const retina = screenById("828x1792-dark");
    const superRetina = screenById("1242x2688-dark");

    expect(retina.media).toContain("(-webkit-device-pixel-ratio: 2)");
    expect(superRetina.media).toContain("(-webkit-device-pixel-ratio: 3)");
    expect(retina.media).toContain("(device-width: 414px)");
    expect(superRetina.media).toContain("(device-width: 414px)");
  });

  it("swaps pixel dims for an iPad landscape image but keeps portrait device dims", () => {
    const screen = screenById("2732x2048-dark");

    expect(screen).toMatchObject({ width: 2732, height: 2048, scheme: "dark" });
    expect(screen.media).toBe(
      "(device-width: 1024px) and (device-height: 1366px)" +
        " and (-webkit-device-pixel-ratio: 2)" +
        " and (orientation: landscape) and (prefers-color-scheme: dark)",
    );
  });

  it("gives an iPad both orientations in both schemes", () => {
    const ipad = SPLASH_SCREENS.filter((screen) =>
      screen.media.includes("(device-width: 1024px) and (device-height: 1366px)"),
    );

    expect(
      ipad.map((screen) => [screen.id, screen.media.match(/orientation: (\w+)/)?.[1]]),
    ).toEqual([
      ["2048x2732-light", "portrait"],
      ["2048x2732-dark", "portrait"],
      ["2732x2048-light", "landscape"],
      ["2732x2048-dark", "landscape"],
    ]);
  });

  it("gives iPhones no landscape image", () => {
    const iphoneLandscape = SPLASH_SCREENS.filter(
      (screen) =>
        screen.media.includes("(device-width: 393px)") &&
        screen.media.includes("(orientation: landscape)"),
    );

    expect(iphoneLandscape).toEqual([]);
    expect(findSplashScreen("2556x1179-light")).toBeUndefined();
  });

  it("makes every landscape image wider than tall and every portrait one taller than wide", () => {
    for (const screen of SPLASH_SCREENS) {
      const landscape = screen.media.includes("(orientation: landscape)");

      expect(screen.width > screen.height, screen.id).toBe(landscape);
    }
  });

  it("offers every screen in exactly a light and a dark variant", () => {
    const schemesBySize = new Map<string, string[]>();
    for (const screen of SPLASH_SCREENS) {
      const size = `${screen.width}x${screen.height}`;
      schemesBySize.set(size, [...(schemesBySize.get(size) ?? []), screen.scheme]);
    }

    for (const [size, schemes] of schemesBySize) {
      expect(schemes.toSorted(), size).toEqual(["dark", "light"]);
    }
    for (const screen of SPLASH_SCREENS) {
      expect(screen.id).toBe(`${screen.width}x${screen.height}-${screen.scheme}`);
      expect(screen.media).toContain(`(prefers-color-scheme: ${screen.scheme})`);
    }
  });
});

describe("findSplashScreen", () => {
  it("returns the entry for a known id", () => {
    const screen = findSplashScreen("1179x2556-dark");

    expect(screen).toMatchObject({ id: "1179x2556-dark", scheme: "dark", width: 1179 });
  });

  it("returns undefined for unknown or hostile ids", () => {
    for (const id of ["../icon", "1x1-light", "", "1179x2556", "1179x2556-light/../x"]) {
      expect(findSplashScreen(id), id).toBeUndefined();
    }
  });
});

describe("splashStartupImages", () => {
  it("maps one url/media pair onto each splash screen", () => {
    const images = splashStartupImages();

    expect(images).toEqual(
      SPLASH_SCREENS.map((screen) => ({
        url: `/splash/${screen.id}`,
        media: screen.media,
      })),
    );
    expect(images).toContainEqual({
      url: "/splash/1179x2556-light",
      media: screenById("1179x2556-light").media,
    });
  });
});
