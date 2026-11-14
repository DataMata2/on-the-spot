import { describe, expect, it, vi } from "vitest";
import { configHandler, sttHandler } from "../handlers";
import { audioRequest, makeDeps } from "./helpers";

const ok = (text: string, secs = 4) => vi.fn(async () => Response.json({ text, audio_duration_secs: secs, language_code: "en" }));
const codeOf = async (res: Response) => ((await res.json()) as { code?: string }).code;

describe("POST /api/speech/stt", () => {
  it("returns the transcript and counts the seconds ElevenLabs reports", async () => {
    const fetchImpl = ok("We're on track for Friday.", 4.2);
    const { deps } = makeDeps({ fetchImpl });
    const res = await sttHandler(deps)(audioRequest(20_000, 4000));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ text: "We're on track for Friday." });
    expect(deps.budget.today().stt).toBe(4.2);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.elevenlabs.io/v1/speech-to-text");
    expect((init.headers as Record<string, string>)["xi-api-key"]).toBe("test-key");
    const form = init.body as FormData;
    expect(form.get("model_id")).toBe("scribe_v3");
    expect(form.get("language_code")).toBe("en");
  });

  it("no key → unavailable, and no API call", async () => {
    const fetchImpl = ok("x");
    const { deps } = makeDeps({ key: null, fetchImpl });
    const res = await sttHandler(deps)(audioRequest(20_000, 4000));
    expect(res.status).toBe(503);
    expect(await codeOf(res)).toBe("unavailable");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("an ElevenLabs error → failed, and the reserved seconds are given back", async () => {
    const fetchImpl = vi.fn(async () => new Response("{}", { status: 500 }));
    const { deps } = makeDeps({ fetchImpl });
    const res = await sttHandler(deps)(audioRequest(20_000, 4000));
    expect(res.status).toBe(502);
    expect(await codeOf(res)).toBe("failed");
    expect(deps.budget.today().stt).toBe(0);
  });

  it("a network error or timeout → failed", async () => {
    const fetchImpl = vi.fn(async () => {
      throw Object.assign(new Error("The operation timed out"), { name: "TimeoutError" });
    });
    const { deps } = makeDeps({ fetchImpl });
    expect(await codeOf(await sttHandler(deps)(audioRequest(20_000, 4000)))).toBe("failed");
  });

  it("over the daily cap → budget", async () => {
    const fetchImpl = ok("x");
    const { deps } = makeDeps({ fetchImpl, stt: 10 });
    deps.budget.take("stt", 8);
    const res = await sttHandler(deps)(audioRequest(20_000, 4000));
    expect(res.status).toBe(429);
    expect(await codeOf(res)).toBe("budget");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("too long (by duration or size) → too_long", async () => {
    const { deps } = makeDeps({ fetchImpl: ok("x") });
    expect(await codeOf(await sttHandler(deps)(audioRequest(20_000, 50_000)))).toBe("too_long");
    expect(await codeOf(await sttHandler(deps)(audioRequest(1.6 * 1024 * 1024, 10_000)))).toBe("too_long");
    // A client that under-reports: 1.4 MB can't be 2 s of speech, so the size estimate (> 47 s) wins.
    expect(await codeOf(await sttHandler(deps)(audioRequest(1.4 * 1024 * 1024, 2000)))).toBe("too_long");
  });

  it("rate limited → unavailable; not audio → failed", async () => {
    const limited = makeDeps({ fetchImpl: ok("x"), rateOk: false }).deps;
    expect(await codeOf(await sttHandler(limited)(audioRequest(20_000, 4000)))).toBe("unavailable");
    const { deps } = makeDeps({ fetchImpl: ok("x") });
    expect(await codeOf(await sttHandler(deps)(audioRequest(20_000, 4000, "text/plain")))).toBe("failed");
  });

  it("before the jury window, a balance under the reserve → unavailable", async () => {
    const fetchImpl = ok("x");
    const { deps } = makeDeps({ fetchImpl, balance: 2900, now: Date.parse("2026-11-14T20:00:00Z") });
    const res = await sttHandler(deps)(audioRequest(20_000, 4000));
    expect(await codeOf(res)).toBe("unavailable");
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe("GET /api/speech/config", () => {
  it("says browser without a key", async () => {
    const { deps } = makeDeps({ key: null });
    expect(await (await configHandler(deps)()).json()).toEqual({ stt: "browser", tts: "browser" });
  });

  it("says elevenlabs with a key and room in the budget", async () => {
    const { deps } = makeDeps();
    expect(await (await configHandler(deps)()).json()).toEqual({ stt: "elevenlabs", tts: "elevenlabs" });
  });

  it("turns a provider off once its daily cap is reached", async () => {
    const { deps } = makeDeps({ tts: 10 });
    deps.budget.take("tts", 10);
    expect(await (await configHandler(deps)()).json()).toEqual({ stt: "elevenlabs", tts: "browser" });
  });

  it("after the jury window opens, STT spends down to 200 credits while TTS stops at 1000", async () => {
    const { deps } = makeDeps({ balance: 600 });
    expect(await (await configHandler(deps)()).json()).toEqual({ stt: "elevenlabs", tts: "browser" });
  });
});
