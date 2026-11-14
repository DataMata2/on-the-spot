import Link from "next/link";
import { Blob, ScreenField } from "@/components/kit";
import { buttonClasses } from "@/components/kit/Button";
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
      <main className="flex flex-1 flex-col">
        <ScreenField
          field="tomato"
          className="pb-24 lg:pb-32"
          deco={
            <>
              <div className="absolute -right-32 -bottom-36 size-[300px] rounded-full bg-lemon lg:-right-44 lg:-bottom-72 lg:size-[520px]" />
              <div className="stripe-band absolute inset-x-0 bottom-0 h-[22px] text-ink lg:h-7" />
            </>
          }
        >
          {/* The giant wordmark: decorative, the real name is in the header. */}
          <div
            aria-hidden="true"
            className="type-display mt-5 text-[clamp(64px,26vw,128px)] leading-[0.95] text-ink sm:mt-8 lg:mt-10 lg:text-[clamp(128px,14.5vw,212px)]"
          >
            <span className="block whitespace-nowrap lg:inline">On the </span>
            <span className="block whitespace-nowrap lg:inline">
              Spot
              <Blob state="happy" size="0.46em" bob face="var(--color-paper)" className="relative top-[0.02em] ml-[0.06em]" />
            </span>
          </div>

          <div className="mt-6 flex flex-col gap-12 lg:mt-12 lg:flex-row lg:items-start lg:justify-between lg:gap-16">
            <div className="flex max-w-[560px] flex-col">
              <h1 className="type-heading max-w-[15ch] text-[30px] leading-[1.08] text-ink sm:max-w-none sm:text-[44px] lg:text-[52px]">
                Freeze when English is needed on the spot?
              </h1>
              <p className="mt-4 max-w-[34ch] text-base text-ink sm:max-w-[40ch] sm:text-lg">
                Train the exact moment: a surprise question in a meeting. 5 minutes a day. Feedback on what you said, never your accent.
              </p>
              <div className="mt-6 flex flex-col gap-3 sm:mt-8 sm:flex-row sm:items-center sm:gap-5">
                <Link
                  href="/drill"
                  className={buttonClasses({
                    size: "lg",
                    fullWidth: true,
                    className: "px-4 text-[clamp(15px,4.4vw,17px)] sm:w-auto sm:px-7 sm:text-[1.0625rem]",
                  })}
                >
                  Try a cold question, no sign-up
                </Link>
                <span className="text-sm text-field-muted">Takes under 2 minutes.</span>
              </div>
            </div>

            {/* The moment, illustrated: a question and what the feedback looks like. */}
            <div aria-hidden="true" className="relative mr-2 mb-28 w-full max-w-[440px] self-center sm:mb-20 lg:mt-2 lg:mr-10 lg:self-start">
              <div className="relative rotate-2 rounded-card bg-paper p-5 text-ink shadow-sticker-lg sm:p-6">
                <Blob state="thinking" size={56} body="var(--color-ink)" face="var(--color-paper)" className="absolute -top-7 right-5 motion-safe:animate-bob" />
                <div className="flex items-center gap-3">
                  <span className="grid size-10 place-items-center rounded-full bg-pink text-sm font-bold text-ink">JM</span>
                  <div className="text-sm text-ink-2">
                    <div className="font-semibold text-ink">Standup · 9:32</div>
                    <div>Your manager asks:</div>
                  </div>
                </div>
                <p className="mt-4 font-display text-[22px] leading-[1.15] font-bold tracking-[-0.02em] sm:text-[28px]">
                  “Quick one: where are we on the onboarding redesign?”
                </p>
                <div className="mt-4 flex items-center gap-1.5 font-mono text-xs text-ink-2">
                  <span className="h-1.5 w-7 rounded-full bg-ink sm:w-8" />
                  <span className="h-1.5 w-7 rounded-full bg-ink sm:w-8" />
                  <span className="h-1.5 w-7 rounded-full bg-ink sm:w-8" />
                  <span className="h-1.5 w-7 rounded-full bg-sunken sm:w-8" />
                  <span className="h-1.5 w-7 rounded-full bg-sunken sm:w-8" />
                  <span className="ml-1.5">5 s to think</span>
                </div>
              </div>
              <div className="absolute -bottom-[104px] -left-1 w-[86%] sm:-bottom-20 -rotate-[5deg] rounded-[22px] bg-cobalt px-[18px] py-4 text-paper shadow-sticker sm:-left-14 sm:w-[330px]">
                <div className="type-label text-[11px] text-lemon">Answer first: yes</div>
                <p className="mt-1.5 text-[15px] leading-snug">
                  “<mark className="rounded-sm bg-lemon px-0.5 text-ink">We&apos;re on track for Friday</mark>. The API is done, QA starts Monday.”
                </p>
              </div>
            </div>
          </div>
        </ScreenField>

        <ScreenField field="paper" claimsHeader={false} className="py-14 sm:py-20">
          <h2 className="type-label text-ink-2">How it works</h2>
          <ol className="mt-6 grid gap-10 sm:grid-cols-3 sm:gap-8">
            {STEPS.map((s, i) => (
              <li key={s.title} className="flex flex-col border-t-2 border-ink pt-4">
                <span aria-hidden="true" className="type-display text-[88px] leading-none text-ink lg:text-[112px]">
                  {i + 1}
                </span>
                <h3 className="type-heading mt-3 text-[26px] leading-tight text-ink">{s.title}</h3>
                <p className="mt-2 max-w-[36ch] text-base text-ink-2">{s.body}</p>
              </li>
            ))}
          </ol>
        </ScreenField>

        <ScreenField
          field="lemon"
          claimsHeader={false}
          className="py-12 sm:py-16"
          innerClassName="flex flex-col items-start gap-5 sm:flex-row sm:items-center sm:justify-between"
        >
          <p className="type-heading text-[26px] leading-tight text-ink sm:text-[34px]">
            <span>Free: 3 drills a day</span> <span className="text-ink-2">·</span> Pro $12/mo
          </p>
          <Link href="/drill" className={buttonClasses({ size: "lg", className: "max-sm:w-full" })}>
            Start the first drill →
          </Link>
        </ScreenField>
      </main>
      <Footer />
    </>
  );
}
