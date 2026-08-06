import { PageNav } from "@/components/page-nav";
import { PrBoard } from "@/components/pr-board";

export default function RecordsPage() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-14">
      <header className="mb-6 flex flex-col gap-3 sm:mb-10">
        <PageNav current="records" />
        <h1 className="text-2xl font-bold tracking-tight text-foreground text-balance sm:text-4xl">
          Personal Records
        </h1>
        <p className="max-w-xl text-pretty text-sm leading-relaxed text-muted-foreground sm:text-base">
          The heaviest set you&apos;ve actually lifted for each exercise, across your whole history
          — an equal weight only takes the record with more reps.
        </p>
      </header>

      <PrBoard />
    </main>
  );
}
