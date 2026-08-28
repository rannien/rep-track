import { CompareView } from "@/components/compare-view";
import { PageNav } from "@/components/page-nav";

export default function ComparePage() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-14">
      <header className="mb-6 flex flex-col gap-3 sm:mb-10">
        <PageNav current="compare" />
        <h1 className="text-2xl font-bold tracking-tight text-foreground text-balance sm:text-4xl">
          Compare
        </h1>
        <p className="max-w-xl text-pretty text-sm leading-relaxed text-muted-foreground sm:text-base">
          See how you stack up against a training partner. Import a backup they exported from their
          Rep Track (History → Export backup) — it stays on this device and is never merged into
          your history.
        </p>
      </header>

      <CompareView />
    </main>
  );
}
