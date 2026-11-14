"use client";
// A short countdown before answering ("5 seconds to think"), skippable.

import { useEffect, useRef, useState } from "react";

export interface ThinkTimerProps {
  seconds?: number;
  onDone(): void;
  skipLabel?: string;
}

export function ThinkTimer({ seconds = 5, onDone, skipLabel = "I'm ready" }: ThinkTimerProps) {
  const [left, setLeft] = useState(seconds);
  const doneRef = useRef(onDone);
  const firedRef = useRef(false);
  useEffect(() => {
    doneRef.current = onDone;
  }, [onDone]);

  useEffect(() => {
    const started = Date.now();
    const id = setInterval(() => {
      const remaining = Math.max(0, seconds - Math.floor((Date.now() - started) / 1000));
      setLeft(remaining);
      if (remaining === 0 && !firedRef.current) {
        firedRef.current = true;
        clearInterval(id);
        doneRef.current();
      }
    }, 200);
    return () => clearInterval(id);
  }, [seconds]);

  const skip = () => {
    if (firedRef.current) return;
    firedRef.current = true;
    doneRef.current();
  };

  return (
    <div className="flex flex-col items-center gap-3" role="timer" aria-live="polite">
      <div className="text-sm font-medium tracking-wide text-ink-2 uppercase">Think</div>
      <div className="text-4xl font-semibold tabular-nums text-ink">{left}</div>
      <div className="flex gap-1.5" aria-hidden="true">
        {Array.from({ length: seconds }, (_, i) => (
          <span key={i} className={"h-1.5 w-8 rounded-full transition-colors " + (i < seconds - left ? "bg-accent" : "bg-line-strong")} />
        ))}
      </div>
      <button type="button" onClick={skip} className="mt-1 h-10 rounded-md max-sm:h-11 border border-accent px-4 text-sm font-semibold text-accent hover:bg-accent-soft">
        {skipLabel}
      </button>
    </div>
  );
}
