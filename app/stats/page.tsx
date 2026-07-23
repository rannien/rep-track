import { Suspense } from "react";
import Link from "next/link";
import { SessionStats, SessionStatsSkeleton } from "@/components/session-stats";
import { ArrowLeft, History } from "lucide-react";

export default function StatsPage() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-14">
      <header className="mb-6 flex flex-col gap-3 sm:mb-10">
        <nav className="flex items-center justify-between gap-2" aria-label="Pages">
          <Link
            href="/"
            className="inline-flex w-fit items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:text-sm"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back to plan
          </Link>
          <Link
            href="/history"
            className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary hover:text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:text-sm"
          >
            <History className="size-4" aria-hidden="true" />
            History
          </Link>
        </nav>
        <h1 className="text-2xl font-bold tracking-tight text-foreground text-balance sm:text-4xl">
          Statistics
        </h1>
        <p className="max-w-xl text-pretty text-sm leading-relaxed text-muted-foreground sm:text-base">
          How your training stacks up across sessions and exercises — total volume and reps over
          time. Every number here is also listed set by set in the{" "}
          <Link href="/history" className="font-medium text-primary hover:underline">
            session history
          </Link>
          .
        </p>
      </header>

      {/* useSearchParams (metric/exercise view state) suspends during the
          static prerender, so the stats tree needs its own boundary. */}
      <Suspense fallback={<SessionStatsSkeleton />}>
        <SessionStats />
      </Suspense>
    </main>
  );
}
