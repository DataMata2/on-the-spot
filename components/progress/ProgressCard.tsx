"use client";
// The progress card (the return mechanic): today's drills, independent vs with help, a 7-day streak strip,
// tomorrow's drill, free drills left, drill 2, and Pro. Results come from localStorage (lib/progress/store);
// the free count comes from the server (GET /api/drill1/usage).

import Link from "next/link";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { Paywall } from "@/components/paywall";
import { localDay, TYPE_LABELS, TYPE_HINTS } from "@/lib/drill1/questions";
import { loadResults, PROGRESS_EVENT, STORAGE_KEY, summarize } from "@/lib/progress/store";

function subscribe(cb: () => void) {
  window.addEventListener(PROGRESS_EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(PROGRESS_EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}
function rawSnapshot(): string {
  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}
// Today's date, client only (no Date during the server render).
const subscribeNoop = () => () => {};
const readToday = () => localDay(new Date());

const WEEKDAY = ["S", "M", "T", "W", "T", "F", "S"];

interface UsageBody {
  usage: { usedToday: number; freePerDay: number; drill2FreeUsed: boolean };
  pro: boolean;
}

export function ProgressCard() {
  const raw = useSyncExternalStore(subscribe, rawSnapshot, () => null);
  const today = useSyncExternalStore(subscribeNoop, readToday, () => null);
  const [usage, setUsage] = useState<UsageBody | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/drill1/usage", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((b: UsageBody | null) => {
        if (alive && b?.usage) setUsage(b);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  // `raw` is the snapshot that changes; loadResults() re-reads the same storage.
  const summary = useMemo(() => (raw === null || today === null ? null : summarize(loadResults(), today)), [raw, today]);

  if (!summary) {
    return <div className="h-96 animate-pulse rounded-lg bg-sunken" aria-label="Loading your progress" />;
  }

  const pro = usage?.pro ?? false;
  const freeLeft = usage ? Math.max(0, usage.usage.freePerDay - usage.usage.usedToday) : null;
  const drill2Used = usage?.usage.drill2FreeUsed ?? summary.drill2Tried;

  return (
    <div className="flex flex-col gap-6">
      <article className="flex flex-col gap-6 rounded-lg border border-line bg-surface p-5 shadow-raised sm:p-7" aria-labelledby="progress-title">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm font-semibold tracking-wide text-accent uppercase">Your progress</p>
            <h1 id="progress-title" className="text-2xl font-bold tracking-tight text-ink">
              {summary.today.total === 0 ? "No drills yet today" : `${summary.today.total} drill${summary.today.total === 1 ? "" : "s"} today`}
            </h1>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold tabular-nums text-ink">{summary.streak}</div>
            <div className="text-xs text-ink-3">day streak</div>
          </div>
        </header>

        <dl className="grid grid-cols-3 gap-3">
          {[
            ["Independent", summary.today.independent, "today, no hint or model answer"],
            ["With help", summary.today.withHelp, "today, after a hint or model answer"],
            ["Answered first", summary.today.answerFirst, "today, first sentence answered"],
          ].map(([k, v, d]) => (
            <div key={String(k)} className="rounded-md border border-line p-3">
              <dt className="text-xs font-semibold text-ink-2">{k}</dt>
              <dd className="text-2xl font-semibold tabular-nums text-ink">{v}</dd>
              <dd className="mt-0.5 text-[0.6875rem] leading-4 text-ink-3">{d}</dd>
            </div>
          ))}
        </dl>

        <section aria-label="Last 7 days">
          <h2 className="mb-2 text-xs font-semibold tracking-wide text-ink-3 uppercase">Last 7 days</h2>
          <ol className="grid grid-cols-7 gap-2">
            {summary.week.map((d) => {
              const wd = WEEKDAY[new Date(`${d.day}T12:00:00`).getDay()];
              return (
                <li key={d.day} className="flex flex-col items-center gap-1">
                  <span
                    className={
                      "grid size-9 place-items-center rounded-full text-xs font-semibold tabular-nums " +
                      (d.count > 0 ? "bg-accent text-white" : "border border-line-strong text-ink-3") +
                      (d.isToday ? " ring-2 ring-accent-mid ring-offset-2 ring-offset-surface" : "")
                    }
                    aria-label={`${d.day}: ${d.count} drill${d.count === 1 ? "" : "s"}`}
                  >
                    {d.count > 0 ? d.count : ""}
                  </span>
                  <span className={"text-xs " + (d.isToday ? "font-bold text-ink" : "text-ink-3")}>{d.isToday ? "Today" : wd}</span>
                </li>
              );
            })}
          </ol>
        </section>

        <section className="rounded-md bg-sunken p-4">
          <h2 className="text-xs font-semibold tracking-wide text-ink-3 uppercase">Tomorrow&apos;s drill</h2>
          <p className="mt-1 text-base font-semibold text-ink">Cold question: {TYPE_LABELS[summary.tomorrowType].toLowerCase()}</p>
          <p className="text-sm text-ink-2">{TYPE_HINTS[summary.tomorrowType]}</p>
        </section>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-ink-2">
            {pro ? "Pro: unlimited drills." : freeLeft === null ? "Free: 3 drills a day." : `${freeLeft} of 3 free drills left today.`}
          </p>
          <Link href="/drill" className="flex h-11 items-center justify-center rounded-md bg-accent px-5 font-semibold text-white hover:bg-accent-hover">
            {summary.today.total === 0 ? "Start today's drill" : "Do another drill"}
          </Link>
        </div>
      </article>

      <Link href="/clarify" className="group flex items-center justify-between gap-4 rounded-lg border border-line bg-surface p-5 hover:border-ink-3">
        <div>
          <p className="text-xs font-semibold tracking-wide text-accent uppercase">Drill 2 · {pro ? "Pro" : drill2Used ? "Pro" : "1 free try"}</p>
          <p className="text-lg font-semibold text-ink">Clarify the vague task</p>
          <p className="text-sm text-ink-2">Your manager gives a fuzzy task. Ask the right questions out loud, then confirm it back.</p>
        </div>
        <span className="text-xl text-accent transition-transform group-hover:translate-x-1" aria-hidden="true">→</span>
      </Link>

      {!pro && (
        <div className="flex justify-center">
          <Paywall reason="Keep the streak going: unlimited drills, drill 2 and a daily plan." />
        </div>
      )}
    </div>
  );
}
