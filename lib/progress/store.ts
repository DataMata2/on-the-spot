// Progress = drill results in the browser's localStorage (no accounts tonight). Every storage access is wrapped
// in try/catch: private windows, blocked storage and SSR all read as "no results". The summary logic is pure
// and unit-tested in __tests__/store.test.ts.

import { dailyType, dayNumber, localDay, type QuestionType } from "@/lib/drill1/questions";

export const STORAGE_KEY = "ots_progress_v1";
const MAX_RESULTS = 500;
/** Fired on window after a write, so open views re-read. */
export const PROGRESS_EVENT = "ots-progress-changed";

export type HelpMark = "independent" | "with_help";

export interface DrillResult {
  id: string;
  /** ISO timestamp. */
  at: string;
  /** The user's local calendar day, "YYYY-MM-DD". */
  day: string;
  drill: "drill1" | "drill2";
  questionId: string;
  questionType?: QuestionType;
  /** See docs: "independent" = no hint opened and no stronger version seen for the previous answer in the chain. */
  help: HelpMark;
  /** Drill 1 answer-first verdict (drill 2 may leave it null). */
  verdict: "yes" | "partly" | "no" | null;
  words: number;
  /** The transcript was fixed by hand before grading. */
  edited?: boolean;
  mode?: "voice" | "typed";
}

function isResult(v: unknown): v is DrillResult {
  if (typeof v !== "object" || v === null) return false;
  const r = v as Record<string, unknown>;
  return typeof r.id === "string" && typeof r.day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(r.day) && (r.drill === "drill1" || r.drill === "drill2") && (r.help === "independent" || r.help === "with_help");
}

/** All stored results, oldest first; [] when storage is unavailable or corrupt. */
export function loadResults(): DrillResult[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isResult) : [];
  } catch {
    return [];
  }
}

/** Append a result (id/at/day filled in). Returns false when storage is unavailable. */
export function addResult(input: Omit<DrillResult, "id" | "at" | "day"> & { at?: Date }): boolean {
  const at = input.at ?? new Date();
  const { at: _at, ...rest } = input;
  void _at;
  const result: DrillResult = { ...rest, id: `${at.getTime()}-${Math.random().toString(36).slice(2, 8)}`, at: at.toISOString(), day: localDay(at) };
  try {
    const all = [...loadResults(), result].slice(-MAX_RESULTS);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    window.dispatchEvent(new Event(PROGRESS_EVENT));
    return true;
  } catch {
    return false;
  }
}

export function clearResults(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new Event(PROGRESS_EVENT));
  } catch {
    /* storage unavailable */
  }
}

/** "YYYY-MM-DD" n days after `day` (negative = before). */
export function addDays(day: string, n: number): string {
  const d = new Date((dayNumber(day) + n) * 86_400_000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

/**
 * Current streak in days: consecutive days with at least one drill, ending today, or ending yesterday when
 * nothing is done yet today (the streak is still alive until the day is over).
 */
export function currentStreak(days: readonly string[], today: string): number {
  const set = new Set(days);
  let cursor = set.has(today) ? today : addDays(today, -1);
  let n = 0;
  while (set.has(cursor)) {
    n += 1;
    cursor = addDays(cursor, -1);
  }
  return n;
}

export interface StreakDay {
  day: string;
  count: number;
  isToday: boolean;
}

/** The last 7 days ending today, oldest first, with drill counts. */
export function weekStrip(results: readonly DrillResult[], today: string): StreakDay[] {
  const counts = new Map<string, number>();
  for (const r of results) counts.set(r.day, (counts.get(r.day) ?? 0) + 1);
  return Array.from({ length: 7 }, (_, i) => {
    const day = addDays(today, i - 6);
    return { day, count: counts.get(day) ?? 0, isToday: day === today };
  });
}

export interface ProgressSummary {
  today: { total: number; independent: number; withHelp: number; answerFirst: number };
  allTime: { total: number; independent: number; withHelp: number };
  streak: number;
  week: StreakDay[];
  tomorrowType: QuestionType;
  drill2Tried: boolean;
}

export function summarize(results: readonly DrillResult[], today: string): ProgressSummary {
  const todays = results.filter((r) => r.day === today);
  const count = (rs: readonly DrillResult[], help: HelpMark) => rs.filter((r) => r.help === help).length;
  return {
    today: { total: todays.length, independent: count(todays, "independent"), withHelp: count(todays, "with_help"), answerFirst: todays.filter((r) => r.verdict === "yes").length },
    allTime: { total: results.length, independent: count(results, "independent"), withHelp: count(results, "with_help") },
    streak: currentStreak(results.map((r) => r.day), today),
    week: weekStrip(results, today),
    tomorrowType: dailyType(addDays(today, 1)),
    drill2Tried: results.some((r) => r.drill === "drill2"),
  };
}
