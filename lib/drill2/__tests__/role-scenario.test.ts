import { describe, expect, it } from "vitest";
import { BANK_ROLES } from "@/lib/drill1/roles";
import { ROLE_FIRST_SCENARIO, pickScenarioForRole } from "../role-scenario";
import { getScenario, pickScenario, SCENARIOS } from "../scenarios";

describe("drill 2 first scenario by role", () => {
  it("maps every bank role to an existing scenario", () => {
    for (const r of BANK_ROLES) expect(getScenario(ROLE_FIRST_SCENARIO[r]!)).toBeDefined();
    expect(new Set(Object.values(ROLE_FIRST_SCENARIO))).toEqual(new Set(SCENARIOS.map((s) => s.id)));
  });

  it("serves the role's scenario first", () => {
    expect(pickScenarioForRole("marketing-sales", []).id).toBe("customer-update");
    expect(pickScenarioForRole("product-manager", []).id).toBe("kickoff-change");
    expect(pickScenarioForRole("data-analytics", []).id).toBe("numbers-thursday");
  });

  it("keeps the usual order without a role, for general and other, and after the first scenario", () => {
    for (const role of [null, "general", "other"] as const) expect(pickScenarioForRole(role, []).id).toBe(pickScenario([]).id);
    expect(pickScenarioForRole("product-manager", ["kickoff-change"]).id).toBe(pickScenario(["kickoff-change"]).id);
  });
});
