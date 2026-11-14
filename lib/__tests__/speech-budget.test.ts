import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { capFromEnv, SpeechBudget } from "../speech-budget";

const DAY1 = Date.parse("2026-11-14T10:00:00Z");
const DAY2 = Date.parse("2026-11-15T00:00:01Z");

const dirs: string[] = [];
const tmp = () => {
  const d = mkdtempSync(join(tmpdir(), "speech-budget-"));
  dirs.push(d);
  return d;
};
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

describe("SpeechBudget", () => {
  it("allows spending up to the cap, then the provider is exhausted", () => {
    const b = new SpeechBudget({ ttsCharsPerDay: 100, sttSecondsPerDay: 60, now: () => DAY1 });
    expect(b.take("tts", 60)).toBe(true);
    expect(b.take("tts", 50)).toBe(false); // would pass the cap: nothing counted
    expect(b.today().tts).toBe(60);
    expect(b.take("tts", 40)).toBe(true);
    expect(b.exhausted("tts")).toBe(true);
    expect(b.exhausted("stt")).toBe(false); // caps are per provider
  });

  it("refunds a failed call and never goes below zero", () => {
    const b = new SpeechBudget({ ttsCharsPerDay: 100, sttSecondsPerDay: 60, now: () => DAY1 });
    b.take("stt", 10);
    b.refund("stt", 10);
    b.refund("stt", 5);
    expect(b.today().stt).toBe(0);
  });

  it("rolls over at the UTC day boundary", () => {
    let t = DAY1;
    const b = new SpeechBudget({ ttsCharsPerDay: 100, sttSecondsPerDay: 60, now: () => t });
    b.take("tts", 100);
    expect(b.exhausted("tts")).toBe(true);
    t = DAY2;
    expect(b.exhausted("tts")).toBe(false);
    expect(b.today()).toEqual({ day: "2026-11-15", tts: 0, stt: 0 });
  });

  it("persists to the JSON file, so a restart the same day keeps the count", () => {
    const file = join(tmp(), "nested", "speech-budget.json");
    const a = new SpeechBudget({ ttsCharsPerDay: 100, sttSecondsPerDay: 60, file, now: () => DAY1 });
    a.take("tts", 42);
    a.take("stt", 7);
    expect(JSON.parse(readFileSync(file, "utf8"))).toEqual({ day: "2026-11-14", tts: 42, stt: 7, credits: 0 });
    const b = new SpeechBudget({ ttsCharsPerDay: 100, sttSecondsPerDay: 60, file, now: () => DAY1 });
    expect(b.today()).toEqual({ day: "2026-11-14", tts: 42, stt: 7 });
  });

  it("ignores a file from an earlier day", () => {
    const file = join(tmp(), "speech-budget.json");
    new SpeechBudget({ ttsCharsPerDay: 100, sttSecondsPerDay: 60, file, now: () => DAY1 }).take("tts", 99);
    const next = new SpeechBudget({ ttsCharsPerDay: 100, sttSecondsPerDay: 60, file, now: () => DAY2 });
    expect(next.today().tts).toBe(0);
  });

  it("keeps the all-time credits across days and restarts", () => {
    const file = join(tmp(), "speech-budget.json");
    const a = new SpeechBudget({ ttsCharsPerDay: 100, sttSecondsPerDay: 60, file, now: () => DAY1 });
    a.addCredits(27.5);
    a.addCredits(55);
    const b = new SpeechBudget({ ttsCharsPerDay: 100, sttSecondsPerDay: 60, file, now: () => DAY2 });
    expect(b.creditsUsed()).toBe(82.5);
    expect(b.today().tts).toBe(0);
  });

  it("keeps working when the file can't be written", () => {
    const notADir = join(tmp(), "file");
    writeFileSync(notADir, "x");
    const b = new SpeechBudget({ ttsCharsPerDay: 100, sttSecondsPerDay: 60, file: join(notADir, "speech-budget.json"), now: () => DAY1 });
    expect(b.take("tts", 10)).toBe(true);
    expect(b.today().tts).toBe(10);
  });
});

describe("capFromEnv", () => {
  it("reads non-negative numbers and falls back otherwise", () => {
    expect(capFromEnv("1200", 3000)).toBe(1200);
    expect(capFromEnv("0", 3000)).toBe(0);
    expect(capFromEnv("", 3000)).toBe(3000);
    expect(capFromEnv("abc", 3000)).toBe(3000);
    expect(capFromEnv("-5", 3000)).toBe(3000);
    expect(capFromEnv(undefined, 600)).toBe(600);
  });
});
