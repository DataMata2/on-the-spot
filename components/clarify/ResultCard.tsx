"use client";
// The drill 2 result: every fact as correct / missing / contradicted / guessed, with the user's own quote.

import type { FactGrade, Grade } from "@/lib/drill2/types";

const STATUS: Record<string, { label: string; cls: string; icon: string }> = {
  correct: { label: "Confirmed", cls: "bg-accent-soft text-accent-ink", icon: "✓" },
  guessed: { label: "Guessed", cls: "bg-amber-soft text-amber", icon: "?" },
  missing: { label: "Missing", cls: "bg-amber-soft text-amber", icon: "–" },
  contradicted: { label: "Contradicted", cls: "bg-red-soft text-red", icon: "✕" },
};

function FactRow({ f }: { f: FactGrade }) {
  const s = STATUS[f.guessed ? "guessed" : f.status];
  return (
    <li className="flex flex-col gap-1.5 border-t border-line py-3 first:border-t-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold tracking-wide text-ink-3 uppercase">
            {f.label}
            {!f.hidden && <span className="ml-1 font-normal normal-case">(in the original ask)</span>}
          </p>
          <p className="text-base font-semibold text-ink">{f.expected}</p>
        </div>
        <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${s.cls}`}>
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
      <div className="rounded-lg border border-line bg-surface p-5 shadow-raised sm:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${grade.mode === "independent" ? "bg-accent-soft text-accent-ink" : "bg-sunken text-ink-2"}`}
          >
            {grade.mode === "independent" ? "Independent" : "With help"}
          </span>
          {input !== "voice" && <span className="rounded-full bg-sunken px-2.5 py-0.5 text-xs text-ink-2">{input === "typed" ? "Typed" : "Transcript fixed by hand"}</span>}
        </div>
        <h2 id="result-title" className="mt-3 text-xl font-semibold text-ink">
          {headline}
        </h2>
        <dl className="mt-4 grid grid-cols-3 gap-3 text-center">
          <div className="rounded-md bg-paper p-3">
            <dt className="text-xs text-ink-3">Questions</dt>
            <dd className="text-lg font-semibold text-ink tabular-nums">{grade.questionsAsked}</dd>
          </div>
          <div className="rounded-md bg-paper p-3">
            <dt className="text-xs text-ink-3">Found</dt>
            <dd className="text-lg font-semibold text-ink tabular-nums">
              {grade.factsRevealed}/{grade.hiddenTotal}
            </dd>
          </div>
          <div className="rounded-md bg-paper p-3">
            <dt className="text-xs text-ink-3">Confirmed</dt>
            <dd className="text-lg font-semibold text-ink tabular-nums">
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
      </div>

      <div className="rounded-lg border border-accent-mid/50 bg-accent-soft p-5 sm:p-6">
        <p className="text-xs font-semibold tracking-wide text-accent-ink uppercase">One phrase to keep</p>
        <p className="mt-2 text-lg font-semibold text-ink">{grade.lesson.construction}</p>
        <p className="mt-1 text-base text-ink-2">{grade.lesson.example}</p>
        <p className="mt-3 text-sm text-ink-2">Use it before you start work: one check now saves a redo later.</p>
      </div>

      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={onNext}
          disabled={busy}
          className="h-12 w-full rounded-md bg-accent px-6 font-semibold text-white hover:bg-accent-hover disabled:opacity-45 sm:w-auto sm:self-start"
        >
          {nextLabel}
        </button>
        <p className="text-sm text-ink-3">A different task, the same skill. Try it without hints to make it count as independent.</p>
      </div>
    </section>
  );
}
