import { describe, expect, it } from "vitest";
import { bestOpening } from "../summary";

describe("bestOpening (5c)", () => {
  it("prefers the stronger version's first sentence, labelled", () => {
    expect(bestOpening({ graded: "um so we are fine I think. More.", strongerVersion: "We're on track for Thursday. The fix is in review." })).toEqual({
      text: "We're on track for Thursday.",
      stronger: true,
    });
  });
  it("falls back to the user's own first sentence", () => {
    expect(bestOpening({ graded: "We're on track. QA starts Monday.", strongerVersion: null })).toEqual({ text: "We're on track.", stronger: false });
  });
  it("marks an opening cut at the word cap", () => {
    const long = "we are on track and the api is done and the tests pass and qa starts on monday and the release is friday and then we ship";
    const out = bestOpening({ graded: long, strongerVersion: null })!;
    expect(out.text.endsWith("…")).toBe(true);
    expect(out.stronger).toBe(false);
  });
  it("is null with nothing to show", () => {
    expect(bestOpening({ graded: "", strongerVersion: null })).toBeNull();
  });
});
