"use client";
// The drill 2 result: every fact as correct / missing / contradicted / guessed, with the user's own quote.

import { PaperCard } from "@/components/kit";
import { buttonClasses } from "@/components/kit/Button";
import type { FactGrade, Grade } from "@/lib/drill2/types";

const STATUS: Record<string, { label: string; cls: string; icon: string }> = {
  correct: { label: "Confirmed", cls: "bg-mint text-ink", icon: "✓" },
  guessed: { label: "Guessed", cls: "bg-lemon text-ink", icon: "?" },
  missing: { label: "Missing", cls: "bg-paper text-ink shadow-[inset_0_0_0_1.5px_var(--color-ink)]", icon: "–" },
  contradicted: { label: "Contradicted", cls: "bg-tomato text-ink", icon: "✕" },
};

function FactRow({ f }: { f: FactGrade }) {
  const s = STATUS[f.guessed ? "guessed" : f.status];
  return (
    <li className="flex flex-col gap-1.5 border-t border-line py-4 first:border-t-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="type-label text-[11px] text-ink-2">
            {f.label}
            {!f.hidden && <span className="ml-1 font-sans font-normal tracking-normal normal-case">(in the original ask)</span>}
          </p>
          <p className="mt-0.5 text-base font-semibold text-ink">{f.expected}</p>
        </div>
        <span className={`inline-flex shrink-0 items-center gap-1 rounded-pill px-3 py-1 text-xs font-semibold ${s.cls}`}>
          <span aria-hidden>{s.icon}</span>
          {s.label}
        </span>
      </div>
      {f.quote && f.quote.length < 160 && (
        <p className="text-sm text-ink-2">
          You said: <q className="text-ink">{f.quote}</q>
        </p>
      )}
      {f.status !== "correct" || f.guessed ? <p className="text-sm text-ink-2">{f.note}</p> : null}
    </li>
  );
}

export function ResultCard({
  grade,
  input,
  onNext,
  nextLabel = "Try a new task",
  busy,
}: {
  grade: Grade;
  input: "voice" | "typed" | "edited";
  onNext(): void;
  nextLabel?: string;
  busy?: boolean;
}) {
  const relevantQuestions = grade.questionsAsked - grade.offTopicQuestions;
  const headline = grade.allCorrect
    ? "You clarified the whole task."
    : grade.factsConfirmed === 0
      ? "The task is still vague. Let's see what was missing."
      : `${grade.factsConfirmed} of ${grade.factsTotal} details confirmed.`;
  return (
    <section className="flex flex-col gap-5" aria-labelledby="result-title">
      <PaperCard sticker>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`rounded-pill px-3 py-1 text-xs font-semibold ${grade.mode === "independent" ? "bg-cobalt text-paper" : "bg-sunken text-ink"}`}
          >
            {grade.mode === "independent" ? "Independent" : "With help"}
          </span>
          {input !== "voice" && <span className="rounded-pill bg-sunken px-3 py-1 text-xs text-ink">{input === "typed" ? "Typed" : "Transcript fixed by hand"}</span>}
        </div>
        <h2 id="result-title" className="type-display mt-4 text-[clamp(28px,7.5vw,40px)] leading-[1.04] text-ink">
          {headline}
        </h2>
        <dl className="mt-6 grid grid-cols-3 gap-2 border-y border-line py-4 sm:gap-4">
          <div className="flex min-w-0 flex-col">
            <dt className="order-2 mt-1 text-[13px] font-semibold text-ink-2">Questions</dt>
            <dd className="type-display order-1 text-[36px] leading-none text-ink tabular-nums sm:text-[40px]">{grade.questionsAsked}</dd>
          </div>
          <div className="flex min-w-0 flex-col">
            <dt className="order-2 mt-1 text-[13px] font-semibold text-ink-2">Found</dt>
            <dd className="type-display order-1 text-[36px] leading-none text-ink tabular-nums sm:text-[40px]">
              {grade.factsRevealed}/{grade.hiddenTotal}
            </dd>
          </div>
          <div className="flex min-w-0 flex-col">
            <dt className="order-2 mt-1 text-[13px] font-semibold text-ink-2">Confirmed</dt>
            <dd className="type-display order-1 text-[36px] leading-none text-ink tabular-nums sm:text-[40px]">
              {grade.factsConfirmed}/{grade.factsTotal}
            </dd>
          </div>
        </dl>
        {grade.offTopicQuestions > 0 && (
          <p className="mt-3 text-sm text-ink-2">
            {relevantQuestions} of your {grade.questionsAsked} questions were about the task.
          </p>
        )}
        <ul className="mt-4">
          {grade.facts.map((f) => (
            <FactRow key={f.key} f={f} />
          ))}
        </ul>
      </PaperCard>

      <PaperCard tone="lemon" sticker="sm">
        <p className="type-label text-ink">One phrase to keep</p>
        <p className="type-heading mt-3 text-[26px] leading-[1.12] text-ink">{grade.lesson.construction}</p>
        <p className="mt-2 text-base text-ink-2">{grade.lesson.example}</p>
        <p className="mt-4 text-sm text-ink-2">Use it before you start work: one check now saves a redo later.</p>
      </PaperCard>

      <div className="flex flex-col gap-3">
        <button
          type="button"
          onClick={onNext}
          disabled={busy}
          className={buttonClasses({ size: "lg", fullWidth: true, className: "sm:w-auto sm:self-start" })}
        >
          {nextLabel}
        </button>
        <p className="text-sm text-field-muted">A different task, the same skill. Try it without hints to make it count as independent.</p>
      </div>
    </section>
  );
}
