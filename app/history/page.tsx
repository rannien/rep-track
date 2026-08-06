import { DataControls } from "@/components/data-controls";
import { PageNav } from "@/components/page-nav";
import { SessionHistory } from "@/components/session-history";

export default function HistoryPage() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-14">
      <header className="mb-6 flex flex-col gap-3 sm:mb-10">
        <PageNav current="history" />
        <h1 className="text-2xl font-bold tracking-tight text-foreground text-balance sm:text-4xl">
          Session History
        </h1>
        <p className="max-w-xl text-pretty text-sm leading-relaxed text-muted-foreground sm:text-base">
          Every training day you&apos;ve logged, most recent first. Expand a session to see the sets
          you hit for each exercise.
        </p>
      </header>

      <div className="mb-6 sm:mb-8">
        <DataControls />
      </div>

      <SessionHistory />
    </main>
  );
}
