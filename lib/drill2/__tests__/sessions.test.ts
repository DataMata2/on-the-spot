import { describe, expect, it } from "vitest";
import { NUMBERS_FOR_THURSDAY } from "../scenarios";
import { SessionStore } from "../sessions";

describe("SessionStore", () => {
  it("a duplicate request id returns the cached result and runs the work once", async () => {
    const store = new SessionStore();
    const s = store.create("guest-a", NUMBERS_FOR_THURSDAY);
    let calls = 0;
    const work = async () => ++calls;
    const [a, b] = await Promise.all([store.once(s, "r1", work), store.once(s, "r1", work)]);
    const c = await store.once(s, "r1", work);
    expect([a, b, c]).toEqual([1, 1, 1]);
    expect(calls).toBe(1);
    expect(await store.once(s, "r2", work)).toBe(2);
  });
  it("a failed run can be retried with the same id", async () => {
    const store = new SessionStore();
    const s = store.create("g", NUMBERS_FOR_THURSDAY);
    await expect(store.once(s, "r", async () => { throw new Error("boom"); })).rejects.toThrow("boom");
    await Promise.resolve();
    expect(await store.once(s, "r", async () => "ok")).toBe("ok");
  });
  it("sessions belong to one guest and expire after the TTL", () => {
    let t = 0;
    const store = new SessionStore(1000, () => t);
    const s = store.create("guest-a", NUMBERS_FOR_THURSDAY);
    expect(store.get(s.id, "guest-b")).toBeNull();
    expect(store.get(s.id, "guest-a")?.id).toBe(s.id);
    t = 2001;
    expect(store.get(s.id, "guest-a")).toBeNull();
  });
  it("remembers which scenarios a guest has done", () => {
    const store = new SessionStore();
    store.create("g", NUMBERS_FOR_THURSDAY);
    expect(store.done("g")).toEqual([NUMBERS_FOR_THURSDAY.id]);
    expect(store.done("other")).toEqual([]);
  });
});
