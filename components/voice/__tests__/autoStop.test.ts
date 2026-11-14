import { describe, expect, it } from "vitest";
import { autoStopAction, autoStopNotice, type RecordingEnd } from "../autoStop";

const end = (over: Partial<RecordingEnd> = {}): RecordingEnd => ({ session: 2, reason: "max", text: "hello there", ...over });
const fresh = { mountedAfter: 0, handled: null };

describe("autoStopAction", () => {
  it("captures a non-empty transcript when recording ends on its own", () => {
    expect(autoStopAction(end(), fresh)).toBe("capture");
    expect(autoStopAction(end({ reason: "auto" }), fresh)).toBe("capture");
    expect(autoStopAction(end({ reason: "error" }), fresh)).toBe("capture");
  });

  it("shows heard-nothing when it ends on its own with no text", () => {
    expect(autoStopAction(end({ text: "  " }), fresh)).toBe("heard_nothing");
  });

  it("ignores a user stop (handleStop owns it)", () => {
    expect(autoStopAction(end({ reason: "user" }), fresh)).toBe("ignore");
  });

  it("captures only once per session", () => {
    expect(autoStopAction(end(), { mountedAfter: 0, handled: 2 })).toBe("ignore");
  });

  it("ignores endings from before this capture box mounted", () => {
    expect(autoStopAction(end({ session: 2 }), { mountedAfter: 2, handled: null })).toBe("ignore");
    expect(autoStopAction(null, fresh)).toBe("ignore");
  });
});

describe("autoStopNotice", () => {
  it("says time's up only for the max-duration stop", () => {
    expect(autoStopNotice(end(), 45_000)).toBe("Time's up: we stopped at 45 seconds.");
    expect(autoStopNotice(end({ reason: "auto" }), 45_000)).toBeNull();
    expect(autoStopNotice(null, 45_000)).toBeNull();
  });
});
