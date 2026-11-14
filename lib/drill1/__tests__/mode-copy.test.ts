import { describe, expect, it } from "vitest";
import { answeredLine, MODE_COPY, modeCopy } from "../mode-copy";

describe("mode copy (5a)", () => {
  it("only spoken answers say 'out loud'", () => {
    expect(answeredLine(5, 5, ["voice", "voice", "voice", "voice", "voice"])).toBe("You answered 5 of 5 questions out loud.");
    expect(answeredLine(5, 5, ["voice", "typed", "voice", "voice", "voice"])).toBe("You answered 5 of 5 questions.");
    expect(answeredLine(2, 5, ["typed", "typed"])).toBe("You answered 2 of 5 questions.");
    expect(answeredLine(0, 5, [])).toBe("You answered 0 of 5 questions.");
    expect(answeredLine(1, 1, ["voice"])).toBe("You answered 1 of 1 question out loud.");
  });

  it("typed feedback copy never assumes speech", () => {
    for (const line of Object.values(MODE_COPY.typed)) expect(line).not.toMatch(/\b(said|say|out loud|spoke|spoken|accent)\b/i);
    expect(modeCopy("typed").yourAnswer).toBe("What you wrote");
    expect(modeCopy("voice").yourAnswer).toBe("What you said");
    expect(modeCopy(undefined)).toBe(MODE_COPY.typed);
  });
});
