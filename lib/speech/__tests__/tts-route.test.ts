import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { QUESTIONS } from "@/lib/drill1/questions";
import { prewarmHandler, ttsHandler } from "../handlers";
import { PREWARM_MAX_CHARS, prewarmTexts } from "../prewarm";
import { checkTtsText, staticTtsTexts, TtsSigner } from "../tts-allow";
import { makeDeps, mp3, ttsRequest } from "./helpers";

const BANK = QUESTIONS[0].text;
const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

describe("TTS allow-list", () => {
  const signer = new TtsSigner("s");
  const allowed = staticTtsTexts();

  it("allows bank questions and drill 2 opening lines as they are", () => {
    expect(checkTtsText(BANK, undefined, signer, allowed)).toEqual({ ok: true, text: BANK });
    expect(checkTtsText("Can you put together the numbers for Thursday?   Keep it short.", undefined, signer, allowed).ok).toBe(true);
  });

  it("rejects arbitrary text, and text with someone else's or a forged token", () => {
    expect(checkTtsText("Read my whole novel aloud for free.", undefined, signer, allowed)).toEqual({ ok: false, reason: "not_allowed" });
    expect(checkTtsText("Read this.", new TtsSigner("other").sign("Read this."), signer, allowed).ok).toBe(false);
    expect(checkTtsText("Read this.", "x".repeat(32), signer, allowed).ok).toBe(false);
    expect(checkTtsText("Read this instead.", signer.sign("Read this."), signer, allowed).ok).toBe(false);
  });

  it("allows a server-produced text with its token", () => {
    const reply = "Q3 churn by plan, three slides max.";
    expect(checkTtsText(reply, signer.sign(reply), signer, allowed)).toEqual({ ok: true, text: reply });
  });

  it("rejects empty and over-long texts", () => {
    expect(checkTtsText("  ", undefined, signer, allowed)).toEqual({ ok: false, reason: "empty" });
    const long = "a".repeat(601);
    expect(checkTtsText(long, signer.sign(long), signer, allowed)).toEqual({ ok: false, reason: "too_long" });
  });
});

describe("POST /api/speech/tts", () => {
  it("rejects arbitrary text with 403 and never calls the API", async () => {
    const fetchImpl = vi.fn(async () => mp3());
    const { deps } = makeDeps({ fetchImpl });
    const res = await ttsHandler(deps)(ttsRequest({ text: "Say anything I like." }));
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ code: "not_allowed" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("generates allowed text once; the cache hit doesn't call the API or count against the budget", async () => {
    const dir = mkdtempSync(join(tmpdir(), "tts-cache-"));
    dirs.push(dir);
    const fetchImpl = vi.fn(async () => mp3());
    const { deps } = makeDeps({ fetchImpl, cacheDir: dir });
    const handler = ttsHandler(deps);

    const first = await handler(ttsRequest({ text: BANK }));
    expect(first.status).toBe(200);
    expect(first.headers.get("content-type")).toBe("audio/mpeg");
    expect(first.headers.get("x-tts-cache")).toBe("miss");
    expect(new Uint8Array(await first.arrayBuffer()).byteLength).toBe(7);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(deps.budget.today().tts).toBe(BANK.length);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.elevenlabs.io/v1/text-to-speech/cjVigY5qzO86Huf0OWal?output_format=mp3_44100_64");
    expect(JSON.parse(init.body as string)).toMatchObject({ text: BANK, model_id: "eleven_flash_v2_5" });
    expect(readdirSync(dir).filter((f) => f.endsWith(".mp3"))).toHaveLength(1);

    const second = await handler(ttsRequest({ text: BANK }));
    expect(second.headers.get("x-tts-cache")).toBe("hit");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(deps.budget.today().tts).toBe(BANK.length);

    // A fresh process (empty memory LRU) still hits the disk cache.
    const restarted = makeDeps({ fetchImpl, cacheDir: dir }).deps;
    const third = await ttsHandler(restarted)(ttsRequest({ text: BANK }));
    expect(third.headers.get("x-tts-cache")).toBe("hit");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(restarted.budget.today().tts).toBe(0);
  });

  it("a cache hit is served even when rate limited or over budget", async () => {
    const fetchImpl = vi.fn(async () => mp3());
    const { deps } = makeDeps({ fetchImpl });
    await ttsHandler(deps)(ttsRequest({ text: BANK }));
    deps.budget.take("tts", 5000);
    deps.rateLimit = async () => false;
    expect((await ttsHandler(deps)(ttsRequest({ text: BANK }))).status).toBe(200);
  });

  it("maps no key → unavailable, over budget → budget, API error → failed (budget given back)", async () => {
    expect((await (await ttsHandler(makeDeps({ key: null }).deps)(ttsRequest({ text: BANK }))).json()).code).toBe("unavailable");

    const tight = makeDeps({ fetchImpl: vi.fn(async () => mp3()), tts: 10 }).deps;
    const r = await ttsHandler(tight)(ttsRequest({ text: BANK }));
    expect(r.status).toBe(429);
    expect((await r.json()).code).toBe("budget");

    const failing = makeDeps({ fetchImpl: vi.fn(async () => new Response("no", { status: 401 })) }).deps;
    const f = await ttsHandler(failing)(ttsRequest({ text: BANK }));
    expect(f.status).toBe(502);
    expect((await f.json()).code).toBe("failed");
    expect(failing.budget.today().tts).toBe(0);
  });

  it("shares one API call between concurrent requests for the same text", async () => {
    let release: () => void = () => {};
    const gate = new Promise<void>((r) => (release = r));
    const fetchImpl = vi.fn(async () => {
      await gate;
      return mp3();
    });
    const { deps } = makeDeps({ fetchImpl });
    const handler = ttsHandler(deps);
    const both = Promise.all([handler(ttsRequest({ text: BANK })), handler(ttsRequest({ text: BANK }))]);
    await new Promise((r) => setTimeout(r, 10));
    release();
    const [a, b] = await both;
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});

describe("prewarm", () => {
  it("covers the jury's first questions and drill 2 lines, under the character limit", () => {
    const texts = prewarmTexts();
    const total = texts.reduce((n, t) => n + t.length, 0);
    expect(total).toBeLessThanOrEqual(PREWARM_MAX_CHARS);
    expect(texts).toContain("Quick one: where are we on the onboarding redesign?");
    expect(texts).toContain("Can you put together the numbers for Thursday? Keep it short.");
  });

  it("is off without the secret and refuses a wrong one", async () => {
    const off = makeDeps().deps;
    const req = () => new Request("http://localhost/api/speech/prewarm?dryRun=1", { method: "POST", headers: { authorization: "Bearer s3cret" } });
    expect((await prewarmHandler(off)(req())).status).toBe(404);
    const wrong = makeDeps({ prewarmSecret: "other" }).deps;
    expect((await prewarmHandler(wrong)(req())).status).toBe(404);
  });

  it("a dry run lists the total without calling the API", async () => {
    const fetchImpl = vi.fn(async () => mp3());
    const { deps } = makeDeps({ fetchImpl, prewarmSecret: "s3cret" });
    const res = await prewarmHandler(deps)(new Request("http://localhost/api/speech/prewarm?dryRun=1", { method: "POST", headers: { authorization: "Bearer s3cret" } }));
    const body = (await res.json()) as { totalChars: number; newChars: number };
    expect(body.totalChars).toBeGreaterThan(0);
    expect(body.newChars).toBe(body.totalChars);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
