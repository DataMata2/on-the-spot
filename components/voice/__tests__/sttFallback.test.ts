import { describe, expect, it } from "vitest";
import { chooseTranscript } from "../sttFallback";

describe("chooseTranscript", () => {
  it("uses the server text when it has words", () => {
    expect(chooseTranscript({ ok: true, text: " On track, shipping Friday. " }, "on track shipping friday")).toEqual({ text: "On track, shipping Friday.", source: "server" });
  });

  it("falls back to the Web Speech text on a server error or timeout", () => {
    expect(chooseTranscript({ ok: false }, "we are on track")).toEqual({ text: "we are on track", source: "browser" });
  });

  it("falls back to Web Speech when there was no server call or it heard nothing", () => {
    expect(chooseTranscript(null, "hello")).toEqual({ text: "hello", source: "browser" });
    expect(chooseTranscript({ ok: true, text: "  " }, "hello")).toEqual({ text: "hello", source: "browser" });
  });

  it("is 'heard nothing' when both are empty", () => {
    expect(chooseTranscript({ ok: false }, "   ")).toEqual({ text: "", source: "none" });
    expect(chooseTranscript({ ok: true, text: "" }, "")).toEqual({ text: "", source: "none" });
  });
});
