import { describe, expect, it } from "vitest";
import { clientIp } from "@/lib/ai-guard";

const h = (init: Record<string, string>) => new Headers(init);

describe("clientIp", () => {
  it("prefers cf-connecting-ip over everything else", () => {
    expect(clientIp(h({ "cf-connecting-ip": "1.1.1.1", "x-real-ip": "2.2.2.2", "x-forwarded-for": "3.3.3.3, 4.4.4.4" }))).toBe("1.1.1.1");
  });

  it("uses x-real-ip when there is no cf-connecting-ip", () => {
    expect(clientIp(h({ "x-real-ip": " 2.2.2.2 ", "x-forwarded-for": "3.3.3.3, 4.4.4.4" }))).toBe("2.2.2.2");
  });

  it("uses the LAST X-Forwarded-For hop, not the spoofable first one", () => {
    expect(clientIp(h({ "x-forwarded-for": "6.6.6.6, 10.0.0.1 , 5.5.5.5" }))).toBe("5.5.5.5");
    expect(clientIp(h({ "x-forwarded-for": "5.5.5.5, " }))).toBe("5.5.5.5");
  });

  it("falls back to unknown", () => {
    expect(clientIp(h({}))).toBe("unknown");
    expect(clientIp(h({ "cf-connecting-ip": " ", "x-forwarded-for": " , " }))).toBe("unknown");
  });
});
