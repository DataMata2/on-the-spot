"use client";
import { useSyncExternalStore } from "react";

const noopSubscribe = () => () => {};

/** A browser-only value: `serverValue` during SSR and hydration, `read()` after. No effect + setState needed. */
export function useClientValue<T>(read: () => T, serverValue: T): T {
  return useSyncExternalStore(noopSubscribe, read, () => serverValue);
}
