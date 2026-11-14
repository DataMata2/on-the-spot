"use client";
// The talk button. Tap to start, tap again to stop (the default, reliable on touch). On desktop you can also
// press and hold: releasing after a long press stops. Space / Enter toggle from the keyboard.

import { useRef, type KeyboardEvent, type PointerEvent } from "react";

export interface PushToTalkProps {
  listening: boolean;
  onStart(): void;
  onStop(): void;
  elapsedMs: number;
  maxMs: number;
  disabled?: boolean;
  /** Label when idle. */
  idleLabel?: string;
}

/** A press longer than this counts as hold-to-talk: releasing it stops. */
const HOLD_MS = 600;

export function PushToTalk({ listening, onStart, onStop, elapsedMs, maxMs, disabled, idleLabel = "Tap to answer" }: PushToTalkProps) {
  const downAt = useRef<number | null>(null);
  const startedByThisPress = useRef(false);

  const onPointerDown = (e: PointerEvent<HTMLButtonElement>) => {
    if (disabled || e.button !== 0) return;
    e.preventDefault();
    downAt.current = Date.now();
    if (listening) {
      startedByThisPress.current = false;
      onStop();
    } else {
      startedByThisPress.current = true;
      onStart();
    }
  };

  const onPointerUp = () => {
    const at = downAt.current;
    downAt.current = null;
    if (at !== null && startedByThisPress.current && Date.now() - at >= HOLD_MS) onStop();
    startedByThisPress.current = false;
  };

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (disabled || e.repeat || (e.key !== " " && e.key !== "Enter")) return;
    e.preventDefault();
    if (listening) onStop();
    else onStart();
  };

  const remaining = Math.max(0, Math.ceil((maxMs - elapsedMs) / 1000));
  const fraction = listening ? Math.min(1, elapsedMs / maxMs) : 0;
  const R = 54;
  const C = 2 * Math.PI * R;

  return (
    <div className="flex flex-col items-center gap-3">
      <button
        type="button"
        disabled={disabled}
        aria-pressed={listening}
        aria-label={listening ? "Stop answering" : idleLabel}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={onKeyDown}
        onContextMenu={(e) => e.preventDefault()}
        style={{ touchAction: "none", WebkitTouchCallout: "none" }}
        className={
          "relative grid size-32 place-items-center rounded-full select-none outline-offset-4 transition-transform duration-150 " +
          "focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-45 " +
          (listening ? "scale-105 bg-red text-white" : "bg-accent text-white hover:bg-accent-hover active:scale-95")
        }
      >
        <svg className="absolute inset-0 -rotate-90" viewBox="0 0 120 120" aria-hidden="true">
          <circle cx="60" cy="60" r={R} fill="none" stroke="currentColor" strokeOpacity="0.25" strokeWidth="4" />
          {listening && (
            <circle cx="60" cy="60" r={R} fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - fraction)} />
          )}
        </svg>
        {listening ? (
          <span className="flex flex-col items-center leading-none">
            <span className="size-5 rounded-sm bg-white" aria-hidden="true" />
            <span className="mt-2 text-sm font-semibold tabular-nums">{remaining}s</span>
          </span>
        ) : (
          <MicIcon />
        )}
        {listening && <span className="absolute inset-0 animate-ping rounded-full bg-red/30" aria-hidden="true" />}
      </button>
      <p className="text-sm text-ink-2" aria-live="polite">
        {listening ? "Listening… tap to stop" : idleLabel}
        {!listening && <span className="hidden text-ink-3 sm:inline"> · or press and hold</span>}
      </p>
    </div>
  );
}

function MicIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M19 10v1a7 7 0 0 1-14 0v-1M12 18v4M8 22h8" />
    </svg>
  );
}
