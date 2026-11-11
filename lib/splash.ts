export type ColorScheme = "light" | "dark";
type Orientation = "portrait" | "landscape";

type Device = {
  width: number;
  height: number;
  pixelRatio: number;
  rotates: boolean;
};

export type SplashScreen = {
  id: string;
  width: number;
  height: number;
  pixelRatio: number;
  scheme: ColorScheme;
  media: string;
};

// Hand-synced counterpart: --background in app/globals.css.
export const SPLASH_BACKGROUND: Record<ColorScheme, string> = {
  light: "#fafaf9",
  dark: "#0a0a0a",
};

export const SPLASH_ICON_SIZE_PT = 120;

// Portrait CSS-pixel sizes. iPhone home screens don't rotate, so only iPads get landscape.
const DEVICES: Device[] = [
  { width: 440, height: 956, pixelRatio: 3, rotates: false },
  { width: 430, height: 932, pixelRatio: 3, rotates: false },
  { width: 428, height: 926, pixelRatio: 3, rotates: false },
  { width: 420, height: 912, pixelRatio: 3, rotates: false },
  { width: 414, height: 896, pixelRatio: 3, rotates: false },
  { width: 414, height: 896, pixelRatio: 2, rotates: false },
  { width: 414, height: 736, pixelRatio: 3, rotates: false },
  { width: 402, height: 874, pixelRatio: 3, rotates: false },
  { width: 393, height: 852, pixelRatio: 3, rotates: false },
  { width: 390, height: 844, pixelRatio: 3, rotates: false },
  { width: 375, height: 812, pixelRatio: 3, rotates: false },
  { width: 375, height: 667, pixelRatio: 2, rotates: false },
  { width: 320, height: 568, pixelRatio: 2, rotates: false },
  { width: 1032, height: 1376, pixelRatio: 2, rotates: true },
  { width: 1024, height: 1366, pixelRatio: 2, rotates: true },
  { width: 834, height: 1210, pixelRatio: 2, rotates: true },
  { width: 834, height: 1194, pixelRatio: 2, rotates: true },
  { width: 834, height: 1112, pixelRatio: 2, rotates: true },
  { width: 820, height: 1180, pixelRatio: 2, rotates: true },
  { width: 810, height: 1080, pixelRatio: 2, rotates: true },
  { width: 768, height: 1024, pixelRatio: 2, rotates: true },
  { width: 744, height: 1133, pixelRatio: 2, rotates: true },
];

const SCHEMES: ColorScheme[] = ["light", "dark"];

function screensFor(device: Device): SplashScreen[] {
  const orientations: Orientation[] = device.rotates ? ["portrait", "landscape"] : ["portrait"];
  return orientations.flatMap((orientation) => {
    const portrait = orientation === "portrait";
    const width = (portrait ? device.width : device.height) * device.pixelRatio;
    const height = (portrait ? device.height : device.width) * device.pixelRatio;
    const deviceMedia =
      `(device-width: ${device.width}px) and (device-height: ${device.height}px)` +
      ` and (-webkit-device-pixel-ratio: ${device.pixelRatio})` +
      ` and (orientation: ${orientation})`;
    return SCHEMES.map((scheme) => ({
      id: `${width}x${height}-${scheme}`,
      width,
      height,
      pixelRatio: device.pixelRatio,
      scheme,
      media: `${deviceMedia} and (prefers-color-scheme: ${scheme})`,
    }));
  });
}

export const SPLASH_SCREENS: SplashScreen[] = DEVICES.flatMap(screensFor);

export function findSplashScreen(id: string): SplashScreen | undefined {
  return SPLASH_SCREENS.find((screen) => screen.id === id);
}

export function splashStartupImages(): { url: string; media: string }[] {
  return SPLASH_SCREENS.map((screen) => ({
    url: `/splash/${screen.id}`,
    media: screen.media,
  }));
}
