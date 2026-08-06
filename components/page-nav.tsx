import Link from "next/link";
import { ArrowLeft, ChartColumn, History, Settings } from "lucide-react";

type PageId = "plan" | "history" | "stats" | "settings";

const pillClass =
  "inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary hover:text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:text-sm";

// The shared page header nav: pills for the other destinations, plus a
// "Back to plan" link everywhere but the plan itself (where the page supplies
// its own brand row on the left). The Settings pill is icon-only so the plan
// header's three pills still fit beside the brand at 375 px.
export function PageNav({ current }: { current: PageId }) {
  const pills = (
    <>
      {current !== "stats" ? (
        <Link href="/stats" className={pillClass}>
          <ChartColumn className="size-4" aria-hidden="true" />
          Stats
        </Link>
      ) : null}
      {current !== "history" ? (
        <Link href="/history" className={pillClass}>
          <History className="size-4" aria-hidden="true" />
          History
        </Link>
      ) : null}
      {current !== "settings" ? (
        <Link href="/settings" aria-label="Settings" className={pillClass}>
          <Settings className="size-4" aria-hidden="true" />
        </Link>
      ) : null}
    </>
  );

  if (current === "plan") {
    return (
      <nav className="flex items-center gap-2" aria-label="Pages">
        {pills}
      </nav>
    );
  }

  return (
    <nav className="flex items-center justify-between gap-2" aria-label="Pages">
      <Link
        href="/"
        className="inline-flex w-fit items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:text-sm"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Back to plan
      </Link>
      <div className="flex items-center gap-2">{pills}</div>
    </nav>
  );
}
