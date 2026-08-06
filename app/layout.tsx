import { Analytics } from "@vercel/analytics/next";
import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { RestTimerProvider } from "@/components/rest-timer-provider";
import { ServiceWorkerRegistrar } from "@/components/service-worker";
import { SessionProvider } from "@/components/session-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { UnitProvider } from "@/components/unit-provider";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Rep Track",
  description:
    "Track your training days — log every set with weight and reps, and see what you lifted last time.",
  generator: "v0.app",
  icons: {
    // The icon carries its own solid indigo tile, so one set works for both
    // light and dark browser chrome.
    icon: [
      { url: "/icon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    apple: "/apple-icon.png",
  },
  appleWebApp: {
    // iOS home-screen launch: chrome-less, matching the standalone manifest.
    capable: true,
    title: "Rep Track",
    statusBarStyle: "default",
  },
};

// The brand tint for the mobile status bar / installed title bar, per OS
// appearance. It tracks the OS rather than the in-app class — a user forcing
// the theme opposite their OS gets a slightly mismatched tint, accepted for
// staying out of Next's head management. The dark value ≈ the dark
// --background (oklch(0.145 0 0)).
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#4b50d5" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // suppressHydrationWarning (one level deep) because the init script adds
    // the "dark" class before hydration, so <html>'s attributes legitimately
    // differ from the server HTML.
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} bg-background`}
      suppressHydrationWarning
    >
      <body className="font-sans antialiased">
        {/* First in <body>: parser-blocking, so the stored theme applies
            before first paint — no light flash on a dark preference. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <ThemeProvider>
          {/* UnitProvider wraps SessionProvider: the undo toast it renders
              formats weights, so it needs the unit context. */}
          <UnitProvider>
            <SessionProvider>
              <RestTimerProvider>{children}</RestTimerProvider>
            </SessionProvider>
          </UnitProvider>
        </ThemeProvider>
        <ServiceWorkerRegistrar />
        {/* Dev-safe unconditionally: @vercel/analytics runs in debug mode
            outside production and sends nothing. */}
        <Analytics />
      </body>
    </html>
  );
}
