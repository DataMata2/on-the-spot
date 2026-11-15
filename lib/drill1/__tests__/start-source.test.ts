import { describe, expect, it, vi } from "vitest";
import { juryQuestion, pickQuestion, type QuestionType } from "../questions";
import { RoleQuestionCache, type RoleGenCreate } from "../role-gen";
import { pickForRole, ROLE_BANKS, startSource } from "../roles";

// OTS-CURRENT-05: a failed "Other" generation falls back to the general bank and says so (source), with a retry.

const general = (type: QuestionType | null, excludeIds: readonly string[]) => (type ? null : juryQuestion(excludeIds)) ?? pickQuestion(type, excludeIds);

const good = {
  questions: [
    { type: "status", context: "Site meeting. The project lead asks:", text: "Where are we on the bridge inspection?" },
    { type: "decision", context: "Planning meeting. Your manager asks:", text: "Steel or concrete for the new deck, which do you recommend?" },
    { type: "estimate", context: "Budget review. The client asks:", text: "How long will the repairs take?" },
    { type: "blocker", context: "Standup. Your manager asks:", text: "Is anything holding up the permits?" },
    { type: "status", context: "City council meeting. A council member asks:", text: "Is the bridge safe to use right now?" },
  ],
};
const reply = (json: unknown) => ({ stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify(json) }] });

function deps(create: RoleGenCreate, budget = true, now = 1_000) {
  return { create: vi.fn(create), model: "test-model", takeBudget: vi.fn(() => budget), now: () => now };
}

describe("startSource", () => {
  it("AI timeout → the general question is marked general_fallback", async () => {
    const pool = await new RoleQuestionCache().get("g", "Handyman fixing homes", deps(async () => { throw new Error("timeout"); }));
    expect(pool).toBeNull();
    const q = pickForRole("other", null, [], { pool: pool ?? undefined, general });
    expect(startSource("other", q, pool)).toBe("general_fallback");
  });

  it("a successful Other is 'generated', never a false warning", async () => {
    const pool = await new RoleQuestionCache().get("g", "Civil engineer", deps(async () => reply(good)));
    const q = pickForRole("other", null, [], { pool: pool ?? undefined, general });
    expect(startSource("other", q, pool)).toBe("generated");
  });

  it("an exhausted generated pool is plain 'general', not a fallback", async () => {
    const pool = (await new RoleQuestionCache().get("g", "Civil engineer", deps(async () => reply(good))))!;
    const q = pickForRole("other", null, pool.map((p) => p.id), { pool, general });
    expect(startSource("other", q, pool)).toBe("general");
  });

  it("bank roles are 'role' (or 'general' once the bank is used up); the general role is 'general'", () => {
    const bank = ROLE_BANKS["software-engineer"];
    expect(startSource("software-engineer", bank[0], undefined)).toBe("role");
    expect(startSource("software-engineer", general(null, []), undefined)).toBe("general");
    expect(startSource("general", general(null, []), undefined)).toBe("general");
  });
});

describe("RoleQuestionCache retry", () => {
  it("a user retry skips the remembered failure and serves the role once the AI is back", async () => {
    const cache = new RoleQuestionCache();
    let up = false;
    const d = deps(async () => {
      if (!up) throw new Error("timeout");
      return reply(good);
    });
    expect(await cache.get("g1", "Pilot", d)).toBeNull();
    expect(await cache.get("g1", "Pilot", d)).toBeNull(); // plain start: cached failure, no new AI call
    expect(d.create).toHaveBeenCalledTimes(1);
    up = true;
    const pool = await cache.get("g1", "Pilot", d, undefined, { retry: true });
    expect(pool).toHaveLength(5);
    expect(d.create).toHaveBeenCalledTimes(2);
    // and the success is cached: a later retry makes no call
    expect(await cache.get("g1", "Pilot", d, undefined, { retry: true })).toBe(pool);
    expect(d.create).toHaveBeenCalledTimes(2);
  });

  it("a retry still takes the AI budget: over it, no AI call", async () => {
    const cache = new RoleQuestionCache();
    const d = deps(async () => reply(good), false);
    expect(await cache.get("g1", "Pilot", d, undefined, { retry: true })).toBeNull();
    expect(d.create).not.toHaveBeenCalled();
    expect(d.takeBudget).toHaveBeenCalledTimes(1);
  });

  it("a failed retry is remembered again: plain starts after it don't call the AI", async () => {
    const cache = new RoleQuestionCache();
    const d = deps(async () => { throw new Error("down"); });
    await cache.get("g1", "Pilot", d);
    await cache.get("g1", "Pilot", d, undefined, { retry: true });
    await cache.get("g1", "Pilot", d);
    expect(d.create).toHaveBeenCalledTimes(2);
  });
});
