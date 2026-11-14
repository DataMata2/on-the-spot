"use client";
// The drill 1 feedback card: answer-first verdict with the quoted evidence highlighted in the transcript, the
// point → reason → next-step checklist with quotes, words / sentences / fillers, the stronger version
// (collapsed: opening it marks the next answer "with help"), and one tip.
//
// Layout: the verdict sits on the screen's field (cobalt in the drill), the rest on a paper card. On desktop the
// article is a subgrid of Drill1Flow's two-column feedback grid: verdict left, card right.

import { Blob, PaperCard } from "@/components/kit";
import type { Drill1Feedback, Quoted, Verdict } from "@/lib/drill1/feedback";
import { modeCopy, type InputMode } from "@/lib/drill1/mode-copy";

/** `label` is the accessible verdict; `word` is the same verdict shown huge (no new words). */
const VERDICT_UI: Record<Verdict, { label: string; word: string }> = {
  yes: { label: "Answer first: yes", word: "Yes." },
  partly: { label: "Answer first: partly", word: "Partly." },
  no: { label: "Answer first: not yet", word: "Not yet." },
};

/** The transcript with `quote` highlighted (it is a verified exact substring, or null). */
function Highlighted({ text, quote }: { text: string; quote: string | null }) {
  const at = quote ? text.indexOf(quote) : -1;
  if (!quote || at < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, at)}
      <mark className="rounded-[4px] bg-lemon px-[3px] text-ink [box-decoration-break:clone] [-webkit-box-decoration-break:clone]">{quote}</mark>
      {text.slice(at + quote.length)}
    </>
  );
}

function CheckRow({ label, item, hint }: { label: string; item: Quoted; hint: string }) {
  return (
    <li className="grid grid-cols-[28px_minmax(0,1fr)] gap-3">
      <span
        aria-hidden="true"
        className={"grid size-7 place-items-center rounded-full text-sm font-bold " + (item.present ? "bg-cobalt text-paper" : "text-ink-3 shadow-[inset_0_0_0_2px_var(--color-line-strong)]")}
      >
        {item.present ? "✓" : ""}
      </span>
      <div className="min-w-0 pt-0.5">
        <div className="font-semibold text-ink">
          {label} <span className="sr-only">{item.present ? "present" : "missing"}</span>
        </div>
        <div className="text-ink-2">{item.present ? (item.quote ? <q className="italic">{item.quote}</q> : "Present.") : hint}</div>
      </div>
    </li>
  );
}

export interface FeedbackCardProps {
  feedback: Drill1Feedback;
  strongerOpen: boolean;
  onOpenStronger(): void;
  /** How THIS answer was given: the copy says "said" only for a spoken one. */
  mode: InputMode;
}

export function FeedbackCard({ feedback: f, strongerOpen, onOpenStronger, mode }: FeedbackCardProps) {
  const v = VERDICT_UI[f.answerFirst.verdict];
  const copy = modeCopy(mode);
  const fillerList = Object.entries(f.checks.fillers.byFiller).map(([w, n]) => `${w} ×${n}`).join(", ");
  return (
    <article
      className="flex flex-col gap-8 lg:col-span-2 lg:col-start-1 lg:row-span-2 lg:row-start-1 lg:grid lg:grid-cols-subgrid lg:grid-rows-subgrid"
      aria-label="Feedback"
    >
      <header className="flex flex-col lg:col-start-1 lg:row-start-1">
        <p>
          <span className="sr-only">{v.label}</span>
          <span aria-hidden="true" className="type-label block text-[0.8125rem] text-field-muted">
            Answer first
          </span>
          <span aria-hidden="true" className="type-display mt-1 block text-[clamp(4.5rem,24vw,10.5rem)] leading-[0.92] text-field-mark">
            {v.word}
          </span>
        </p>
        <p className="mt-5 max-w-[34ch] text-lg leading-snug text-field-fg lg:text-[1.375rem]">{f.answerFirst.note}</p>
        {f.english !== false && (
          <details className="group mt-4 text-sm text-field-muted">
            <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-2 font-semibold text-field-fg underline decoration-1 underline-offset-4 [&::-webkit-details-marker]:hidden">
              How we checked
              <svg className="size-4 transition-transform group-open:rotate-180" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M6 9l6 6 6-6" />
              </svg>
            </summary>
            <div className="flex flex-col gap-1 pt-1 pb-1">
              <span>AI judgment: {f.answerFirst.ai ?? "unavailable"}</span>
              <span>
                Word check: {f.answerFirst.wordCheck.passed ? <>found “{f.answerFirst.wordCheck.word}” in your first sentence</> : "no status or decision word in your first sentence"}
              </span>
            </div>
          </details>
        )}
      </header>

      <PaperCard className="flex flex-col gap-8 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-start">
        <section className="flex flex-col gap-2">
          <h3 className="type-label text-ink-2">{copy.yourAnswer}{f.edited ? " (with your fix)" : ""}</h3>
          <blockquote className="rounded-lg bg-sunken p-4 text-[1.0625rem] leading-[1.65] text-ink">
            <Highlighted text={f.graded} quote={f.answerFirst.evidenceQuote} />
          </blockquote>
          {f.answerFirst.evidenceQuote && <p className="text-[0.8125rem] text-ink-2">Highlighted: the words that answered the question.</p>}
        </section>

        {f.structure && (
          <section className="flex flex-col gap-3">
            <h3 className="type-label text-ink-2">Structure</h3>
            <ul className="flex flex-col gap-4">
              <CheckRow label="Point" item={f.structure.point} hint={copy.missingPoint} />
              <CheckRow label="Reason" item={f.structure.reason} hint="Missing: one reason, the “because”." />
              <CheckRow label="Next step" item={f.structure.nextStep} hint="Missing: what happens next, or what you need." />
            </ul>
          </section>
        )}

        {f.strongerVersion && (
          <section className="flex flex-col gap-2">
            {strongerOpen ? (
              <>
                <h3 className="type-label text-ink-2">A stronger version, in your words</h3>
                <p className="rounded-lg bg-cobalt p-4 text-[1.0625rem] leading-relaxed text-paper">{f.strongerVersion}</p>
                <p className="text-[0.8125rem] text-ink-2">{copy.bracketsNote}</p>
              </>
            ) : (
              <button type="button" onClick={onOpenStronger} className="group flex w-full flex-col items-center gap-2 rounded-card text-center">
                <span className="flex min-h-14 w-full items-center justify-center rounded-pill bg-ink px-5 font-semibold text-paper transition-opacity group-hover:opacity-90">
                  Show a stronger version →
                </span>
                <span className="block text-[0.8125rem] font-normal text-ink-2">Your next answer then counts as “with help”.</span>
              </button>
            )}
          </section>
        )}

        <div className="flex flex-col gap-2">
          <dl className="flex flex-wrap gap-x-8 gap-y-4">
            {[
              ["Words", String(f.checks.words)],
              [f.checks.punctuated ? "Sentences" : "Sentences (est.)", String(f.checks.sentences)],
              ["Fillers", String(f.checks.fillers.total)],
            ].map(([k, val]) => (
              <div key={k} className="flex flex-col-reverse">
                <dt className="text-sm text-ink-2">{k}</dt>
                <dd className="type-display text-[2.5rem] leading-none text-ink tabular-nums">{val}</dd>
              </div>
            ))}
          </dl>
          {fillerList && <p className="text-[0.8125rem] text-ink-2">Fillers: {fillerList}</p>}
        </div>

        <section className="rounded-r-lg border-l-4 border-cobalt bg-sunken py-4 pr-4 pl-5">
          <h3 className="type-label mb-1 text-[0.6875rem] text-ink-2">Tip for next time</h3>
          <p className="text-base text-ink">{f.tip}</p>
        </section>

        <div className="flex flex-col gap-2">
          {!f.aiAvailable && <p className="text-[0.8125rem] text-ink-2">The AI coach is unavailable right now, so this shows the quick checks only.</p>}
          <p className="flex items-center gap-2.5 text-sm text-ink-2">
            <Blob size={20} />
            {copy.gradeNote}
          </p>
        </div>
      </PaperCard>
    </article>
  );
}
