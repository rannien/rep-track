import { Analytics } from "@vercel/analytics/next";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} bg-background`}>
      <body className="font-sans antialiased">
        <SessionProvider>{children}</SessionProvider>
        {/* Dev-safe unconditionally: @vercel/analytics runs in debug mode
            outside production and sends nothing. */}
        <Analytics />
      </body>
    </html>
  );
}
