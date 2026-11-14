// Drill 2 "match the role where cheap": which existing scenario a guest meets first, by the drill 1 role. A small
// mapping outside the engine; the engine, the normaliser and the scenarios themselves are unchanged. After the
// first scenario, the usual order (pickScenario) takes over. No role, "general" and "other" keep the usual order.
import type { RoleId } from "@/lib/drill1/roles";
import { getScenario, pickScenario } from "./scenarios";
import type { Scenario } from "./types";

/** First scenario per role: S1 numbers-thursday (a short report), S2 customer-update (a client message), S3 kickoff-change (setting up a meeting). */
export const ROLE_FIRST_SCENARIO: Partial<Record<RoleId, string>> = {
  "software-engineer": "numbers-thursday",
  "data-analytics": "numbers-thursday",
  "finance-ops": "numbers-thursday",
  "marketing-sales": "customer-update",
  healthcare: "customer-update",
  "product-manager": "kickoff-change",
  designer: "kickoff-change",
};

/** The scenario POST /api/drill2/start serves: the role's first one for a guest who has done none, else pickScenario. */
export function pickScenarioForRole(role: RoleId | null, done: string[]): Scenario {
  if (done.length === 0 && role) {
    const id = ROLE_FIRST_SCENARIO[role];
    const s = id ? getScenario(id) : null;
    if (s) return s;
  }
  return pickScenario(done);
}
