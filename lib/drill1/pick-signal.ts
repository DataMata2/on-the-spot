// /drill?role=pick (the progress card's "change" link) reopens the role picker (OTS-CURRENT-06).
//
// Next keeps a visited page mounted but hidden, so a client navigation to /drill?role=pick can land on a Drill1Flow
// that is already at feedback. The URL therefore has to be a live signal, not something read once on mount:
// a small component under its own <Suspense> reads useSearchParams() and writes it here, and the flow subscribes.
// Until that component has run (SSR, first client render), the snapshot falls back to window.location.

/** Whether these search params ask for the role picker. */
export function wantsPickFrom(search: string | URLSearchParams): boolean {
  const params = typeof search === "string" ? new URLSearchParams(search) : search;
  return params.get("role") === "pick";
}

export interface PickSignal {
  /** The latest value from the router (useSearchParams); undefined when no reader is mounted. */
  set(value: boolean | undefined): void;
  subscribe(cb: () => void): () => void;
  /** The router value if known, else the fallback (window.location on the client). */
  snapshot(fallback: () => boolean): boolean;
}

export function createPickSignal(): PickSignal {
  let value: boolean | undefined;
  const listeners = new Set<() => void>();
  return {
    set(v) {
      if (v === value) return;
      value = v;
      for (const cb of listeners) cb();
    },
    subscribe(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    snapshot(fallback) {
      return value ?? fallback();
    },
  };
}

/**
 * Whether the picker shows instead of the flow. `pickRequest` is set when the URL asks for the picker and cleared
 * by a pick; the picker then shows whatever phase the old run was in (a stale feedback screen included).
 */
export function shouldShowPicker(input: { queue: boolean; saved: boolean; wantsPick: boolean; pickedNow: boolean; phaseIsIntro: boolean }): boolean {
  if (input.queue) return false;
  if (input.wantsPick && !input.pickedNow) return true;
  return input.phaseIsIntro && !input.saved;
}

/**
 * The "adjust state while rendering" step: when role=pick appears (false → true), a role picked on an earlier visit
 * no longer counts, so the picker opens again. Returns the new pickedNow-cleared flag and the value to remember.
 */
export function onWantsPickChange(prev: boolean, next: boolean): { changed: boolean; clearPicked: boolean } {
  if (prev === next) return { changed: false, clearPicked: false };
  return { changed: true, clearPicked: next };
}
