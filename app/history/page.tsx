import Link from "next/link";
import { SessionHistory } from "@/components/session-history";
import { ArrowLeft } from "lucide-react";

export default function HistoryPage() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-14">
      <header className="mb-6 flex flex-col gap-3 sm:mb-10">
        <Link
          href="/"
          className="inline-flex w-fit items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:text-sm"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back to plan
        </Link>
        <h1 className="text-2xl font-bold tracking-tight text-foreground text-balance sm:text-4xl">
          Session History
        </h1>
        <p className="max-w-xl text-pretty text-sm leading-relaxed text-muted-foreground sm:text-base">
          Every training day you&apos;ve logged, most recent first. Expand a session to see the sets
          you hit for each exercise.
        </p>
      </header>

      <SessionHistory />
    </main>
  );
}
