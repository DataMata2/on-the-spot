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

// TM-OTS-06: the credit check and the hold are one synchronous step, so parallel calls can't all pass it.
describe("credit reserve under parallel calls", () => {
  const BEFORE_WINDOW = Date.parse("2026-11-14T20:00:00Z"); // the 3,000-credit jury reserve applies

  function gated() {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const fetchImpl = vi.fn(async () => {
      await gate;
      return Response.json({ text: "We are on track.", audio_duration_secs: 10 });
    });
    return { fetchImpl, release };
  }

  it("two parallel 10 s clips at 3,100 credits: one goes through, the balance stays at or above the reserve", async () => {
    const { fetchImpl, release } = gated();
    const { deps } = makeDeps({ fetchImpl, balance: 3100, now: BEFORE_WINDOW });
    const handle = sttHandler(deps);
    const both = Promise.all([handle(audioRequest(20_000, 10_000)), handle(audioRequest(20_000, 10_000))]);
    await new Promise((r) => setTimeout(r, 30));
    release();
    const statuses = (await both).map((r) => r.status).sort();
    expect(statuses).toEqual([200, 503]);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect((await deps.credits.remaining())!).toBeGreaterThanOrEqual(deps.config.reserveCredits);
  });

  it("N parallel clips near the floor: only as many as fit go through", async () => {
    const { fetchImpl, release } = gated();
    // 10 s = 55 credits; 300 credits above the reserve fit 5 clips.
    const { deps } = makeDeps({ fetchImpl, balance: 3300, now: BEFORE_WINDOW });
    const handle = sttHandler(deps);
    const all = Promise.all(Array.from({ length: 8 }, () => handle(audioRequest(20_000, 10_000))));
    await new Promise((r) => setTimeout(r, 30));
    release();
    const res = await all;
    expect(res.filter((r) => r.status === 200)).toHaveLength(5);
    expect(res.filter((r) => r.status === 503)).toHaveLength(3);
    expect(fetchImpl).toHaveBeenCalledTimes(5);
    expect((await deps.credits.remaining())!).toBeGreaterThanOrEqual(3000);
    expect(deps.budget.today().stt).toBe(50);
  });

  it("a failed call gives its hold back, so the next call fits again", async () => {
    let fail = true;
    const fetchImpl = vi.fn(async () => (fail ? new Response("{}", { status: 500 }) : Response.json({ text: "ok", audio_duration_secs: 10 })));
    const { deps } = makeDeps({ fetchImpl, balance: 3100, now: BEFORE_WINDOW });
    const handle = sttHandler(deps);
    expect((await handle(audioRequest(20_000, 10_000))).status).toBe(502);
    expect(deps.credits.available()).toBe(3100);
    fail = false;
    expect((await handle(audioRequest(20_000, 10_000))).status).toBe(200);
    expect(deps.credits.available()).toBe(3045);
    expect((await handle(audioRequest(20_000, 10_000))).status).toBe(503);
  });

  it("settles to the actual seconds: a shorter clip than estimated frees the difference", async () => {
    const fetchImpl = vi.fn(async () => Response.json({ text: "ok", audio_duration_secs: 4 }));
    const { deps } = makeDeps({ fetchImpl, balance: 3100, now: BEFORE_WINDOW });
    expect((await sttHandler(deps)(audioRequest(20_000, 10_000))).status).toBe(200);
    expect(deps.credits.available()).toBeCloseTo(3100 - 22);
    expect(deps.budget.today().stt).toBe(4);
  });

  it("over the daily cap the credit hold is released too", async () => {
    const { deps } = makeDeps({ fetchImpl: vi.fn(), balance: 3100, now: BEFORE_WINDOW, stt: 5 });
    const res = await sttHandler(deps)(audioRequest(20_000, 10_000));
    expect(res.status).toBe(429);
    expect(deps.credits.available()).toBe(3100);
  });
});
