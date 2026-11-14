import { describe, expect, it } from "vitest";
import { chooseTranscript, hasWords } from "../sttFallback";

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

  // TM-OTS-07: a word-less server result must not replace a real browser transcript.
  it("a punctuation-only or tag-only server result loses to the browser text", () => {
    for (const text of ["...", "-", "…", " . , ", "[inaudible]", "(music)", "[noise] ...", "*silence*"]) {
      expect(chooseTranscript({ ok: true, text }, "We are on track.")).toEqual({ text: "We are on track.", source: "browser" });
    }
  });

  it("a word-less server result with no browser text is 'heard nothing'", () => {
    expect(chooseTranscript({ ok: true, text: "..." }, "  ")).toEqual({ text: "", source: "none" });
    expect(chooseTranscript({ ok: true, text: "[inaudible]" }, "")).toEqual({ text: "", source: "none" });
  });

  it("a short real server word still wins", () => {
    expect(chooseTranscript({ ok: true, text: "Yes." }, "yes")).toEqual({ text: "Yes.", source: "server" });
    expect(chooseTranscript({ ok: true, text: "[laughs] Yes, done." }, "yes done")).toEqual({ text: "[laughs] Yes, done.", source: "server" });
    expect(chooseTranscript({ ok: true, text: "42" }, "")).toEqual({ text: "42", source: "server" });
  });

  it("hasWords", () => {
    expect(hasWords("...")).toBe(false);
    expect(hasWords("[inaudible]")).toBe(false);
    expect(hasWords("On track")).toBe(true);
    expect(hasWords("Ça va")).toBe(true);
  });
});
