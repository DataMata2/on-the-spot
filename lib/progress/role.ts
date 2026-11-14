// The guest's role ("What do you do?") in localStorage, the source of truth (no accounts). Like the progress store,
// every storage access is wrapped: unavailable storage reads as "no role yet". The server only ever gets it as a
// request field (`role`, `roleText`) and validates it again (lib/drill1/roles.ts parseRole).

import { parseRole, type Role } from "@/lib/drill1/roles";

export const ROLE_KEY = "ots_role_v1";
/** Fired on window after a write, so open views re-read. */
export const ROLE_EVENT = "ots-role-changed";

/** The saved role, or null (none yet, storage unavailable or corrupt). */
export function loadRole(): Role | null {
  try {
    const raw = window.localStorage.getItem(ROLE_KEY);
    if (!raw) return null;
    const v: unknown = JSON.parse(raw);
    if (typeof v !== "object" || v === null) return null;
    const r = v as Record<string, unknown>;
    return parseRole(r.id, r.text);
  } catch {
    return null;
  }
}

/** Save a role. Returns false when it is invalid or storage is unavailable. */
export function saveRole(role: Role): boolean {
  const valid = parseRole(role.id, role.text);
  if (!valid) return false;
  try {
    window.localStorage.setItem(ROLE_KEY, JSON.stringify(valid));
    window.dispatchEvent(new Event(ROLE_EVENT));
    return true;
  } catch {
    return false;
  }
}

/** The request fields for a role: `{ role }`, plus `roleText` for "other"; {} when there is none. */
export function roleFields(role: Role | null): { role?: string; roleText?: string } {
  if (!role) return {};
  return role.id === "other" ? { role: role.id, roleText: role.text } : { role: role.id };
}
