import Link from "next/link";
import { PageNav } from "@/components/page-nav";
import { RestTimerSettings } from "@/components/rest-timer-settings";
import { ThemeSettings } from "@/components/theme-settings";
import { UnitSettings } from "@/components/unit-settings";

export default function SettingsPage() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-14">
      <header className="mb-6 flex flex-col gap-3 sm:mb-10">
        <PageNav current="settings" />
        <h1 className="text-2xl font-bold tracking-tight text-foreground text-balance sm:text-4xl">
          Settings
        </h1>
        <p className="max-w-xl text-pretty text-sm leading-relaxed text-muted-foreground sm:text-base">
          Preferences for this device. Everything here is stored locally in your browser.
        </p>
      </header>

      <div className="flex flex-col gap-4 sm:gap-6">
        <ThemeSettings />
        <UnitSettings />
        <RestTimerSettings />
        <p className="text-xs text-muted-foreground sm:text-sm">
          Backup &amp; restore lives on the{" "}
          <Link href="/history" className="font-medium text-primary hover:underline">
            History
          </Link>{" "}
          page, next to your logged sessions.
        </p>
      </div>
    </main>
  );
}
