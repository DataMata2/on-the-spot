import { describe, expect, it } from "vitest";
import { errorMessage, GENERIC_ERROR } from "../client-error";

describe("errorMessage", () => {
  it("never shows a 5xx error string", () => {
    expect(errorMessage(500, "boom")).toBe(GENERIC_ERROR);
    expect(errorMessage(503, "upstream ECONNRESET", "Feedback failed. Try again.")).toBe(GENERIC_ERROR);
  });
  it("shows a 4xx error string", () => {
    expect(errorMessage(402, "You've used today's free drills.")).toBe("You've used today's free drills.");
    expect(errorMessage(413, "That answer is too long.", "x")).toBe("That answer is too long.");
  });
  it("falls back when there is no usable string", () => {
    expect(errorMessage(400, undefined, "Try again.")).toBe("Try again.");
    expect(errorMessage(400, "  ", "Try again.")).toBe("Try again.");
    expect(errorMessage(200, "odd", "Try again.")).toBe("Try again.");
  });
});
