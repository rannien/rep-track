import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import {
  SPLASH_BACKGROUND,
  SPLASH_ICON_SIZE_PT,
  SPLASH_SCREENS,
  findSplashScreen,
} from "@/lib/splash";

export const dynamicParams = false;

export function generateStaticParams() {
  return SPLASH_SCREENS.map((screen) => ({ screen: screen.id }));
}

export async function GET(_request: Request, { params }: { params: Promise<{ screen: string }> }) {
  const { screen: id } = await params;
  const screen = findSplashScreen(id);
  if (!screen) return new Response(null, { status: 404 });

  const icon = await readFile(join(process.cwd(), "public", "icon.svg"));
  const iconSize = SPLASH_ICON_SIZE_PT * screen.pixelRatio;

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: SPLASH_BACKGROUND[screen.scheme],
      }}
    >
      {/* oxlint-disable-next-line next/no-img-element -- Satori renders a plain <img>, not next/image */}
      <img
        src={`data:image/svg+xml;base64,${icon.toString("base64")}`}
        width={iconSize}
        height={iconSize}
        alt=""
      />
    </div>,
    { width: screen.width, height: screen.height },
  );
}
