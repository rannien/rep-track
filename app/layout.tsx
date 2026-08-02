import { Analytics } from "@vercel/analytics/next";
import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { RestTimerProvider } from "@/components/rest-timer-provider";
import { ServiceWorkerRegistrar } from "@/components/service-worker";
import { SessionProvider } from "@/components/session-provider";
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

// The indigo brand tile also tints the mobile status bar / installed title bar.
export const viewport: Viewport = {
  themeColor: "#4b50d5",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} bg-background`}>
      <body className="font-sans antialiased">
        <SessionProvider>
          <RestTimerProvider>{children}</RestTimerProvider>
        </SessionProvider>
        <ServiceWorkerRegistrar />
        {/* Dev-safe unconditionally: @vercel/analytics runs in debug mode
            outside production and sends nothing. */}
        <Analytics />
      </body>
    </html>
  );
}
