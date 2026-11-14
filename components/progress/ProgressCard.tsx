"use client";
// The progress card (the return mechanic): today's drills, independent vs with help, a 7-day streak strip,
// tomorrow's drill, free drills left, the role the questions are for (with "change"), drill 2, and Pro. Results come from localStorage (lib/progress/store);
// the free count comes from the server (GET /api/drill1/usage).

import Link from "next/link";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { Blob, Button } from "@/components/kit";
import { Paywall } from "@/components/paywall";
import { localDay, TYPE_LABELS, TYPE_HINTS } from "@/lib/drill1/questions";
import { roleDisplayLabel } from "@/lib/drill1/roles";
import { loadRole, ROLE_EVENT, ROLE_KEY } from "@/lib/progress/role";
import { loadResults, PROGRESS_EVENT, STORAGE_KEY, summarize } from "@/lib/progress/store";

function subscribe(cb: () => void) {
  window.addEventListener(PROGRESS_EVENT, cb);
  window.addEventListener(ROLE_EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(PROGRESS_EVENT, cb);
    window.removeEventListener(ROLE_EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}
function readKey(key: string): string {
  try {
    return window.localStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}
const rawSnapshot = () => readKey(STORAGE_KEY);
const roleSnapshot = () => readKey(ROLE_KEY);
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
  const roleRaw = useSyncExternalStore(subscribe, roleSnapshot, () => "");
  const role = useMemo(() => (roleRaw ? loadRole() : null), [roleRaw]);
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
    return <div className="h-96 rounded-card bg-field-tint motion-safe:animate-pulse" aria-label="Loading your progress" />;
  }

  const pro = usage?.pro ?? false;
  const freeLeft = usage ? Math.max(0, usage.usage.freePerDay - usage.usage.usedToday) : null;
  const drill2Used = usage?.usage.drill2FreeUsed ?? summary.drill2Tried;

  return (
    <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_400px] lg:items-start lg:gap-x-16 lg:gap-y-6">
      <article className="flex flex-col gap-10 lg:row-span-3" aria-labelledby="progress-title">
        <header className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-4">
            <p className="type-label text-field-fg">Your progress</p>
            <Blob state={summary.today.total === 0 ? "idle" : "proud"} size={56} bob />
          </div>
          <h1 id="progress-title" className="type-display text-field-fg">
            {summary.today.total === 0 ? (
              <span className="block max-w-[11ch] text-[clamp(48px,14vw,96px)] leading-[0.98]">No drills yet today</span>
            ) : (
              <span className="flex flex-wrap items-end gap-x-4 gap-y-2">
                <span className="text-[clamp(110px,36vw,200px)] leading-[0.85] tabular-nums">{summary.today.total}</span>
                <span className="mb-[0.12em] text-[clamp(36px,10vw,56px)] leading-[1.02]">
                  {` drill${summary.today.total === 1 ? "" : "s"} today`}
                </span>
              </span>
            )}
          </h1>
        </header>

        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
          {[
            ["Independent", summary.today.independent, "today, no hint or model answer"],
            ["With help", summary.today.withHelp, "today, after a hint or model answer"],
            ["Answered first", summary.today.answerFirst, "today, first sentence answered"],
          ].map(([k, v, d], i) => (
            <div
              key={String(k)}
              data-field={i === 0 ? "ink" : i === 1 ? "paper" : "lemon"}
              className={
                "flex flex-col rounded-chip p-4 sm:p-5 " +
                (i === 0 ? "-rotate-2" : i === 1 ? "rotate-2" : "col-span-2 -rotate-1 shadow-sticker-sm sm:col-span-1")
              }
            >
              <dt className="order-2 mt-2 text-[0.9375rem] leading-tight font-semibold">{k}</dt>
              <dd className="type-display order-1 text-[48px] leading-none tabular-nums">{v}</dd>
              <dd className="order-3 mt-1 text-xs leading-4 text-field-muted">{d}</dd>
            </div>
          ))}
        </dl>

        <section aria-label="Last 7 days" className="flex flex-col gap-4">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <p className="flex items-baseline gap-2.5 text-field-fg">
              <span className="type-display text-[44px] leading-none tabular-nums">{summary.streak}</span>
              <span className="text-base font-semibold">day streak</span>
            </p>
            <h2 className="type-label text-field-fg">Last 7 days</h2>
          </div>
          <ol className="grid max-w-[440px] grid-cols-7 gap-1 sm:gap-2">
            {summary.week.map((d) => {
              const wd = WEEKDAY[new Date(`${d.day}T12:00:00`).getDay()];
              return (
                <li key={d.day} className="flex flex-col items-center gap-1.5">
                  <span
                    className={
                      "grid size-8 place-items-center rounded-full text-xs font-semibold tabular-nums min-[360px]:size-10 " +
                      (d.isToday
                        ? d.count > 0
                          ? "bg-lemon text-ink shadow-[0_0_0_3px_var(--color-ink)]"
                          : "shadow-[0_0_0_3px_var(--color-ink)]"
                        : d.count > 0
                          ? "bg-ink text-paper"
                          : "shadow-[inset_0_0_0_2px_rgb(16_14_23/0.55)]")
                    }
                    aria-label={`${d.day}: ${d.count} drill${d.count === 1 ? "" : "s"}`}
                  >
                    {d.count > 0 ? d.count : ""}
                  </span>
                  <span className={"font-mono text-[11px] text-field-fg " + (d.isToday ? "font-bold" : "")}>{d.isToday ? "Today" : wd}</span>
                </li>
              );
            })}
          </ol>
        </section>

        <section data-field="paper" className="rounded-card px-5 py-6 sm:p-7">
          <h2 className="type-label text-ink-2">Tomorrow&apos;s drill</h2>
          <p className="type-display mt-2 text-[24px] leading-[1.1] text-ink">Cold question: {TYPE_LABELS[summary.tomorrowType].toLowerCase()}</p>
          <p className="mt-2 text-base text-ink-2">{TYPE_HINTS[summary.tomorrowType]}</p>
          <p className="mt-4 flex flex-wrap items-center gap-x-3 text-[0.9375rem] text-ink">
            <span>
              <span className="font-semibold">Questions for:</span> {role ? roleDisplayLabel(role) : "not picked yet"}
            </span>
            <Link href="/drill?role=pick" className="inline-flex min-h-11 items-center font-semibold underline decoration-1 underline-offset-4 hover:no-underline">
              {role ? "change" : "pick your role"}
            </Link>
          </p>
        </section>

        <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-base font-semibold text-field-fg">
            {pro ? "Pro: unlimited drills." : freeLeft === null ? "Free: 3 drills a day." : `${freeLeft} of 3 free drills left today.`}
          </p>
          <Button href="/drill" size="md" className="max-sm:w-full">
            {summary.today.total === 0 ? "Start today's drill" : "Do another drill"}
          </Button>
        </div>
      </article>

      <Link
        href="/clarify"
        data-field="paper"
        className="group flex items-center justify-between gap-4 rounded-card p-5 shadow-sticker-sm transition-transform hover:-translate-y-0.5 focus-visible:outline-ink sm:p-6"
      >
        <div>
          <p className="type-label text-ink-2">Drill 2 · {pro ? "Pro" : drill2Used ? "Pro" : "1 free try"}</p>
          <p className="type-display mt-1.5 text-[24px] leading-[1.1] text-ink">Clarify the vague task</p>
          <p className="mt-1.5 text-[0.9375rem] text-ink-2">Your manager gives a fuzzy task. Ask the right questions out loud, then confirm it back.</p>
        </div>
        <span className="text-2xl transition-transform group-hover:translate-x-1" aria-hidden="true">→</span>
      </Link>

      <Link
        href="/rehearse"
        data-field="ink"
        className="group flex items-center justify-between gap-4 rounded-card p-5 shadow-sticker-sm transition-transform hover:-translate-y-0.5 focus-visible:outline-ink sm:p-6"
      >
        <div>
          <p className="type-label text-lemon">Pro</p>
          <p className="type-display mt-1.5 text-[24px] leading-[1.1]">Rehearse my real meeting</p>
          <p className="mt-1.5 text-[0.9375rem] text-field-muted">Paste your agenda, get the questions you&apos;re likely to face, and answer them out loud first.</p>
        </div>
        <span className="text-2xl text-lemon transition-transform group-hover:translate-x-1" aria-hidden="true">→</span>
      </Link>

      {!pro && (
        <div className="flex justify-center lg:justify-stretch">
          <Paywall reason="Keep the streak going: unlimited drills, drill 2 and meeting rehearsal." />
        </div>
      )}
    </div>
  );
}
