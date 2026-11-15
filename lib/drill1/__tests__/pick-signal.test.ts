import { describe, expect, it, vi } from "vitest";
import { createPickSignal, onWantsPickChange, shouldShowPicker, wantsPickFrom } from "../pick-signal";

// OTS-CURRENT-06: Progress → "change" (/drill?role=pick) must open the picker even on a mounted, stale Drill1Flow.

describe("wantsPickFrom", () => {
  it("reads role=pick from a search string or params", () => {
    expect(wantsPickFrom("?role=pick")).toBe(true);
    expect(wantsPickFrom(new URLSearchParams("role=pick&x=1"))).toBe(true);
    expect(wantsPickFrom("")).toBe(false);
    expect(wantsPickFrom("?role=other")).toBe(false);
  });
});

describe("createPickSignal", () => {
  it("falls back to the URL until the router value is known, then follows the router", () => {
    const s = createPickSignal();
    expect(s.snapshot(() => true)).toBe(true); // first render, straight from window.location
    s.set(false);
    expect(s.snapshot(() => true)).toBe(false);
    s.set(undefined); // reader unmounted (page hidden): back to the URL
    expect(s.snapshot(() => false)).toBe(false);
  });

  it("notifies subscribers on change only, and stops after unsubscribe", () => {
    const s = createPickSignal();
    const cb = vi.fn();
    const off = s.subscribe(cb);
    s.set(true);
    s.set(true);
    expect(cb).toHaveBeenCalledTimes(1);
    s.set(false);
    expect(cb).toHaveBeenCalledTimes(2);
    off();
    s.set(true);
    expect(cb).toHaveBeenCalledTimes(2);
  });
});

describe("shouldShowPicker", () => {
  const base = { queue: false, saved: true, wantsPick: false, pickedNow: false, phaseIsIntro: false };
  it("Feedback → Progress → change shows the picker without a reload (stale feedback phase)", () => {
    expect(shouldShowPicker({ ...base, wantsPick: true })).toBe(true);
  });
  it("plain Back to the old feedback (no role=pick) keeps the feedback", () => {
    expect(shouldShowPicker(base)).toBe(false);
  });
  it("after the pick, the flow continues to the intro", () => {
    expect(shouldShowPicker({ ...base, wantsPick: true, pickedNow: true, phaseIsIntro: true })).toBe(false);
  });
  it("first visit with no saved role shows the picker; never in queue mode", () => {
    expect(shouldShowPicker({ ...base, saved: false, phaseIsIntro: true })).toBe(true);
    expect(shouldShowPicker({ ...base, queue: true, saved: false, wantsPick: true, phaseIsIntro: true })).toBe(false);
  });
});

describe("onWantsPickChange", () => {
  it("a second 'change' after a new drill clears the earlier pick so the picker opens again", () => {
    // visit 1: role=pick appears, user picks, URL cleaned (true → false), then change again (false → true)
    expect(onWantsPickChange(false, true)).toEqual({ changed: true, clearPicked: true });
    expect(onWantsPickChange(true, false)).toEqual({ changed: true, clearPicked: false });
    expect(onWantsPickChange(false, true).clearPicked).toBe(true);
    expect(onWantsPickChange(true, true)).toEqual({ changed: false, clearPicked: false });
  });
});
