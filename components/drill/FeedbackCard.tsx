"use client";
// The drill 1 feedback card: answer-first verdict with the quoted evidence highlighted in the transcript, the
// point → reason → next-step checklist with quotes, words / sentences / fillers, the stronger version
// (collapsed: opening it marks the next answer "with help"), and one tip.

import type { Drill1Feedback, Quoted, Verdict } from "@/lib/drill1/feedback";

const VERDICT_UI: Record<Verdict, { label: string; className: string; dot: string }> = {
  yes: { label: "Answer first: yes", className: "bg-accent-soft text-accent-ink", dot: "bg-accent" },
  partly: { label: "Answer first: partly", className: "bg-amber-soft text-amber", dot: "bg-amber-mid" },
  no: { label: "Answer first: not yet", className: "bg-red-soft text-red", dot: "bg-red" },
};

/** The transcript with `quote` highlighted (it is a verified exact substring, or null). */
function Highlighted({ text, quote }: { text: string; quote: string | null }) {
  const at = quote ? text.indexOf(quote) : -1;
  if (!quote || at < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, at)}
      <mark className="rounded-sm bg-accent-soft px-0.5 text-accent-ink ring-1 ring-accent-mid/60">{quote}</mark>
      {text.slice(at + quote.length)}
    </>
  );
}

function CheckRow({ label, item, hint }: { label: string; item: Quoted; hint: string }) {
  return (
    <li className="flex gap-3">
      <span
        aria-hidden="true"
        className={"mt-0.5 grid size-5 shrink-0 place-items-center rounded-full text-xs font-bold " + (item.present ? "bg-accent text-white" : "border border-line-strong text-ink-3")}
      >
        {item.present ? "✓" : ""}
      </span>
      <div className="min-w-0">
        <div className="text-sm font-semibold text-ink">
          {label} <span className="sr-only">{item.present ? "present" : "missing"}</span>
        </div>
        <div className="text-sm text-ink-2">{item.present ? (item.quote ? <q className="italic">{item.quote}</q> : "Present.") : hint}</div>
      </div>
    </li>
  );
}

export interface FeedbackCardProps {
  feedback: Drill1Feedback;
  strongerOpen: boolean;
  onOpenStronger(): void;
}

export function FeedbackCard({ feedback: f, strongerOpen, onOpenStronger }: FeedbackCardProps) {
  const v = VERDICT_UI[f.answerFirst.verdict];
  const fillerList = Object.entries(f.checks.fillers.byFiller).map(([w, n]) => `${w} ×${n}`).join(", ");
  return (
    <article className="flex flex-col gap-6 rounded-lg border border-line bg-surface p-5 shadow-raised sm:p-7" aria-label="Feedback">
      <header className="flex flex-col gap-3">
        <span className={"inline-flex w-fit items-center gap-2 rounded-full px-3 py-1 text-sm font-semibold " + v.className}>
          <span className={"size-2 rounded-full " + v.dot} aria-hidden="true" />
          {v.label}
        </span>
        <p className="text-lg text-ink">{f.answerFirst.note}</p>
        {f.english !== false && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-3">
          <span>AI judgment: {f.answerFirst.ai ?? "unavailable"}</span>
          <span>
            Word check: {f.answerFirst.wordCheck.passed ? <>found “{f.answerFirst.wordCheck.word}” in your first sentence</> : "no status or decision word in your first sentence"}
          </span>
        </div>
        )}
      </header>

      <section className="flex flex-col gap-2">
        <h3 className="text-xs font-semibold tracking-wide text-ink-3 uppercase">What you said{f.edited ? " (with your fix)" : ""}</h3>
        <blockquote className="rounded-md bg-sunken p-4 text-base leading-relaxed text-ink">
          <Highlighted text={f.graded} quote={f.answerFirst.evidenceQuote} />
        </blockquote>
        {f.answerFirst.evidenceQuote && <p className="text-xs text-ink-3">Highlighted: the words that answered the question.</p>}
      </section>

      {f.structure && (
        <section className="flex flex-col gap-3">
          <h3 className="text-xs font-semibold tracking-wide text-ink-3 uppercase">Structure</h3>
          <ul className="flex flex-col gap-3">
            <CheckRow label="Point" item={f.structure.point} hint="Missing: say the answer itself." />
            <CheckRow label="Reason" item={f.structure.reason} hint="Missing: one reason, the “because”." />
            <CheckRow label="Next step" item={f.structure.nextStep} hint="Missing: what happens next, or what you need." />
          </ul>
        </section>
      )}

      <dl className="grid grid-cols-3 gap-3 text-center">
        {[
          ["Words", String(f.checks.words)],
          [f.checks.punctuated ? "Sentences" : "Sentences (est.)", String(f.checks.sentences)],
          ["Fillers", String(f.checks.fillers.total)],
        ].map(([k, val]) => (
          <div key={k} className="rounded-md border border-line p-3">
            <dt className="text-xs text-ink-3">{k}</dt>
            <dd className="text-xl font-semibold tabular-nums text-ink">{val}</dd>
          </div>
        ))}
      </dl>
      {fillerList && <p className="-mt-3 text-xs text-ink-3">Fillers: {fillerList}</p>}

      {f.strongerVersion && (
        <section className="flex flex-col gap-2">
          {strongerOpen ? (
            <>
              <h3 className="text-xs font-semibold tracking-wide text-ink-3 uppercase">A stronger version, in your words</h3>
              <p className="rounded-md border border-accent-mid/50 bg-accent-soft p-4 text-base leading-relaxed text-accent-ink">{f.strongerVersion}</p>
              <p className="text-xs text-ink-3">Brackets like [your ETA] mark facts you didn&apos;t say. We never make them up.</p>
            </>
          ) : (
            <button type="button" onClick={onOpenStronger} className="w-fit text-sm font-semibold text-accent hover:underline">
              Show a stronger version →
              <span className="block text-xs font-normal text-ink-3">Your next answer then counts as “with help”.</span>
            </button>
          )}
        </section>
      )}

      <section className="rounded-md border-l-4 border-accent bg-paper px-4 py-3">
        <h3 className="text-xs font-semibold tracking-wide text-ink-3 uppercase">Tip for next time</h3>
        <p className="text-base text-ink">{f.tip}</p>
      </section>

      {!f.aiAvailable && <p className="text-xs text-ink-3">The AI coach is unavailable right now, so this shows the quick checks only.</p>}
      <p className="text-xs text-ink-3">We grade what you said, never your accent.</p>
    </article>
  );
}
