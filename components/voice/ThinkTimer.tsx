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
    // Grid: column 1 is left free for a companion (Drill1Flow puts the thinking blob there), then the label, the
    // dots and the count; the skip button sits at the bottom of whatever height the parent gives the timer.
    <div className="grid w-full flex-1 grid-cols-[2.75rem_auto_minmax(0,1fr)_auto] grid-rows-[auto_minmax(1.5rem,1fr)_auto] items-center gap-x-3" role="timer" aria-live="polite">
      <div className="type-label col-start-2 row-start-1 text-field-mark">Think</div>
      <div className="type-display col-start-4 row-start-1 text-[2.5rem] leading-none text-field-mark tabular-nums">{left}</div>
      <div className="col-start-3 row-start-1 flex gap-1.5" aria-hidden="true">
        {Array.from({ length: seconds }, (_, i) => (
          <span key={i} className={"h-2 flex-1 rounded-full transition-colors " + (i < seconds - left ? "bg-field-mark" : "bg-field-tint")} />
        ))}
      </div>
      <button type="button" onClick={skip} className="col-span-4 row-start-3 mt-2 min-h-14 w-full justify-self-center rounded-pill bg-field-cta px-7 text-base font-semibold text-field-cta-fg hover:opacity-90 sm:w-auto sm:min-w-72">
        {skipLabel}
      </button>
    </div>
  );
}
