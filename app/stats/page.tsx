import { Suspense } from "react";
import Link from "next/link";
import { PageNav } from "@/components/page-nav";
import { SessionStats, SessionStatsSkeleton } from "@/components/session-stats";

export default function StatsPage() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-14">
      <header className="mb-6 flex flex-col gap-3 sm:mb-10">
        <PageNav current="stats" />
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
