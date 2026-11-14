import Link from "next/link";
import { Footer } from "@/components/site";
import { SiteHeader } from "@/components/site/SiteHeader";

const STEPS = [
  { title: "A question, cold", body: "A real meeting question appears and is read aloud. No warning, like at work." },
  { title: "5 seconds, then speak", body: "Think for five seconds. Answer out loud, up to 45 seconds. Or type it." },
  { title: "See what landed", body: "Did your first sentence answer it? Point, reason, next step. A stronger version in your own words." },
];

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <section className="mx-auto grid w-full max-w-5xl gap-10 px-4 pt-10 pb-14 sm:px-6 sm:pt-16 md:grid-cols-[1.15fr_1fr] md:items-center md:gap-14">
          <div className="flex flex-col gap-6">
            <h1 className="text-[2.25rem] leading-[1.08] font-bold tracking-[-0.025em] text-ink sm:text-[3.25rem]">
              Freeze when English is needed on the spot?
            </h1>
            <p className="max-w-xl text-lg text-ink-2">
              Train the exact moment: a surprise question in a meeting. 5 minutes a day. Feedback on what you said, never your accent.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link
                href="/drill"
                className="inline-flex h-13 items-center justify-center rounded-md bg-accent px-6 text-base font-semibold text-white transition-colors hover:bg-accent-hover active:bg-accent-press"
              >
                Try a cold question, no sign-up
              </Link>
              <span className="text-sm text-ink-3">Takes under 2 minutes.</span>
            </div>
          </div>

          {/* The moment, illustrated: a question and what the feedback looks like. */}
          <div aria-hidden="true" className="relative">
            <div className="rounded-lg border border-line bg-surface p-5 shadow-raised">
              <div className="flex items-center gap-3">
                <span className="grid size-9 place-items-center rounded-full bg-sunken text-sm font-bold text-ink-2">JM</span>
                <div className="text-sm">
                  <div className="font-semibold text-ink">Standup · 9:32</div>
                  <div className="text-ink-3">Your manager asks:</div>
                </div>
              </div>
              <p className="mt-4 text-xl leading-snug font-semibold text-ink">“Quick one: where are we on the onboarding redesign?”</p>
              <div className="mt-5 flex items-center gap-2 text-xs text-ink-3">
                <span className="h-1.5 w-8 rounded-full bg-accent" />
                <span className="h-1.5 w-8 rounded-full bg-accent" />
                <span className="h-1.5 w-8 rounded-full bg-accent" />
                <span className="h-1.5 w-8 rounded-full bg-line-strong" />
                <span className="h-1.5 w-8 rounded-full bg-line-strong" />
                <span className="ml-1">5 s to think</span>
              </div>
            </div>
            <div className="relative -mt-3 ml-6 rounded-lg border border-accent-mid/50 bg-accent-soft p-4 sm:ml-10">
              <div className="text-xs font-semibold tracking-wide text-accent-ink uppercase">Answer first: yes</div>
              <p className="mt-1 text-sm text-accent-ink">
                “<mark className="rounded-sm bg-surface px-0.5 text-accent-ink">We&apos;re on track for Friday</mark>. The API is done, QA starts Monday.”
              </p>
            </div>
          </div>
        </section>

        <section className="border-y border-line bg-surface/60">
          <div className="mx-auto w-full max-w-5xl px-4 py-12 sm:px-6">
            <h2 className="text-sm font-semibold tracking-wide text-ink-3 uppercase">How it works</h2>
            <ol className="mt-5 grid gap-5 sm:grid-cols-3">
              {STEPS.map((s, i) => (
                <li key={s.title} className="flex gap-4">
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-accent text-sm font-bold text-white">{i + 1}</span>
                  <div>
                    <h3 className="text-base font-semibold text-ink">{s.title}</h3>
                    <p className="mt-1 text-sm text-ink-2">{s.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="mx-auto flex w-full max-w-5xl flex-col items-start gap-4 px-4 py-12 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p className="text-base text-ink">
            <span className="font-semibold">Free: 3 drills a day</span> <span className="text-ink-3">·</span> Pro $12/mo
          </p>
          <Link href="/drill" className="text-base font-semibold text-accent hover:underline">
            Start the first drill →
          </Link>
        </section>
      </main>
      <Footer />
    </>
  );
}
