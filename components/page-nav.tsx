import Link from "next/link";
import { ArrowLeft, ChartColumn, History, Settings, Trophy } from "lucide-react";

type PageId = "plan" | "history" | "stats" | "records" | "settings";

const pillClass =
  "inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary hover:text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:text-sm";

const destinations: { id: PageId; href: string; label: string; icon: typeof ChartColumn }[] = [
  { id: "stats", href: "/stats", label: "Stats", icon: ChartColumn },
  { id: "records", href: "/records", label: "Records", icon: Trophy },
  { id: "history", href: "/history", label: "History", icon: History },
  { id: "settings", href: "/settings", label: "Settings", icon: Settings },
];

// The shared page header nav: pills for the other destinations, plus a
// "Back to plan" link everywhere but the plan itself (where the page supplies
// its own brand row on the left). Pill labels hide below the sm breakpoint —
// four destinations don't fit beside the plan header's brand at 375 px — so
// every pill carries an aria-label.
export function PageNav({ current }: { current: PageId }) {
  const pills = destinations
    .filter((destination) => destination.id !== current)
    .map(({ id, href, label, icon: Icon }) => (
      <Link key={id} href={href} aria-label={label} className={pillClass}>
        <Icon className="size-4" aria-hidden="true" />
        <span className="hidden sm:inline">{label}</span>
      </Link>
    ));

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
