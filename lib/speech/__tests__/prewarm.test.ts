import { describe, expect, it, vi } from "vitest";
import { JURY_ORDER, QUESTIONS, getQuestion } from "@/lib/drill1/questions";
import { changeBeforeConfirm, createState, effectiveFact, fireChangeIfDue, offTopicReply, SUGGEST_CONFIRM_REPLY } from "@/lib/drill2/engine";
import { pickScenario, SCENARIOS } from "@/lib/drill2/scenarios";
import { prewarmHandler, ttsHandler } from "../handlers";
import { PREWARM_MAX_CHARS, prewarmTexts, verbatimTurnReply } from "../prewarm";
import { normalizeTtsText } from "../tts-allow";
import { makeDeps, mp3, ttsRequest } from "./helpers";

const texts = prewarmTexts();

describe("prewarm list", () => {
  it("stays within the 4,000-character refusal limit, with no duplicates or empty texts", () => {
    expect(PREWARM_MAX_CHARS).toBe(4000);
    expect(texts.reduce((n, t) => n + t.length, 0)).toBeLessThanOrEqual(PREWARM_MAX_CHARS);
    expect(new Set(texts).size).toBe(texts.length);
    for (const t of texts) expect(t).toBe(normalizeTtsText(t));
    expect(texts.every(Boolean)).toBe(true);
  });

  it("puts the jury first: the JURY_ORDER questions, then the first drill 2 scenario's opening line", () => {
    const jury = JURY_ORDER.map((id) => getQuestion(id)!.text);
    expect(texts.slice(0, jury.length)).toEqual(jury);
    expect(texts[jury.length]).toBe(pickScenario([]).managerLine);
  });

  it("includes the whole drill 1 question bank", () => {
    for (const q of QUESTIONS) expect(texts).toContain(q.text);
  });

  it("includes every drill 2 scenario's static lines", () => {
    for (const s of SCENARIOS) {
      expect(texts).toContain(s.managerLine);
      // After the change (or with none), every fact's reveal line is said alone for a one-topic question.
      const after = s.change ? fireChangeIfDue(s, createState(s), true).state : createState(s);
      for (const f of [...s.hiddenFacts, ...s.visibleFacts]) {
        const line = effectiveFact(s, after, f).fact.revealLine;
        const alone = s.topics.some((t) => f.topics.includes(t.key) && verbatimTurnReply(s, { ...after, turns: 5 }, { intent: "question", topics: [t.key] }) === line);
        if (alone) expect(texts).toContain(line);
      }
      for (const t of s.topics) if (t.line) expect(texts).toContain(t.line);
      if (s.change) {
        expect(texts).toContain(s.change.revealLine);
        expect(texts.some((x) => x.endsWith(s.change!.announceLine))).toBe(true);
        expect(texts).toContain(changeBeforeConfirm(s, createState(s))!.reply);
      }
    }
    for (let i = 0; i < 3; i++) expect(texts).toContain(offTopicReply(i));
    expect(texts).toContain(SUGGEST_CONFIRM_REPLY);
  });

  it("lists the exact reply the turn route builds: a one-fact answer is the reveal line, word for word", () => {
    const s = pickScenario([]);
    const fact = s.hiddenFacts[0];
    expect(verbatimTurnReply(s, createState(s), { intent: "question", topics: [fact.topics[0]] })).toBe(fact.revealLine);
  });

  it("a prewarmed drill 2 reply, sent later with its token, is a cache hit", async () => {
    const fetchImpl = vi.fn(async () => mp3());
    const { deps } = makeDeps({ fetchImpl, prewarmSecret: "s3cret", tts: 10_000, balance: 100_000 });
    const res = await prewarmHandler(deps)(new Request("http://localhost/api/speech/prewarm", { method: "POST", headers: { authorization: "Bearer s3cret" } }));
    expect(res.status).toBe(200);
    const calls = fetchImpl.mock.calls.length;
    expect(calls).toBe(texts.length);
    const reply = pickScenario([]).hiddenFacts[0].revealLine;
    const tts = await ttsHandler(deps)(ttsRequest({ text: ` ${reply}  `, token: deps.signer.sign(reply) }));
    expect(tts.status).toBe(200);
    expect(fetchImpl.mock.calls.length).toBe(calls);
  });

  it("?set=roles pre-generates the drill 1 role banks; an unknown set is refused", async () => {
    const fetchImpl = vi.fn(async () => mp3());
    const { deps } = makeDeps({ fetchImpl, prewarmSecret: "s3cret", tts: 10_000, balance: 100_000 });
    const req = (q: string) => new Request(`http://localhost/api/speech/prewarm${q}`, { method: "POST", headers: { authorization: "Bearer s3cret" } });
    const handler = prewarmHandler(deps);
    expect((await handler(req("?set=nope"))).status).toBe(400);
    const res = await handler(req("?set=roles"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { totalChars: number };
    const roles = prewarmTexts("roles");
    expect(body.totalChars).toBe(roles.reduce((n, t) => n + t.length, 0));
    expect(fetchImpl.mock.calls.length).toBe(roles.length);
  });
});
