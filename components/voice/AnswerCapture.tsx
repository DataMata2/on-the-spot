"use client";
// One answer, spoken or typed. Voice when the browser supports it and the mic is allowed; "Type instead" is
// always offered, and becomes the only option when speech recognition is missing (Firefox) or denied.
// A recording that ends on its own (the 45 s cap, the engine giving up, an error) is handed on as if the user
// had tapped stop, so the words are not lost when the next tap starts a new recording.

import { useEffect, useRef, useState } from "react";
import { autoStopAction, autoStopNotice, TIME_UP_NOTICE_MS } from "./autoStop";
import { PushToTalk } from "./PushToTalk";
import type { SpeechToText } from "./useSpeechToText";

export type AnswerMode = "voice" | "typed";

export interface CapturedAnswer {
  raw: string;
  mode: AnswerMode;
}

export interface AnswerCaptureProps {
  stt: SpeechToText;
  onCaptured(answer: CapturedAnswer): void;
  /** Start in typing mode (the user chose it earlier). */
  preferTyping?: boolean;
  onModeChange?(mode: AnswerMode): void;
  maxChars?: number;
  /** Shown above the controls, e.g. "We didn't catch enough. Try again." */
  notice?: string | null;
  placeholder?: string;
}

const ERROR_TEXT: Record<string, string> = {
  mic_denied: "Microphone access is blocked. Allow it in the address bar, or type your answer.",
  no_mic: "We couldn't find a microphone. Type your answer instead.",
  network: "Speech recognition needs a connection and failed. Try again or type your answer.",
  unsupported: "This browser can't turn speech into text (try Chrome or Safari). Type your answer instead.",
  other: "Speech recognition stopped unexpectedly. Try again or type your answer.",
};

export function AnswerCapture({ stt, onCaptured, preferTyping, onModeChange, maxChars = 1500, notice, placeholder = "Type your answer the way you'd say it…" }: AnswerCaptureProps) {
  const [typing, setTyping] = useState(Boolean(preferTyping));
  const [typed, setTyped] = useState("");
  const [heardNothing, setHeardNothing] = useState(false);
  // Endings that happened before this box mounted belong to an earlier capture.
  const [mountedAfter] = useState(() => stt.ended?.session ?? 0);
  // The session already handed to onCaptured (by handleStop or the auto-stop effect): never twice.
  const handledRef = useRef<number | null>(null);
  const [delivered, setDelivered] = useState<number | null>(null);
  const onCapturedRef = useRef(onCaptured);
  useEffect(() => {
    onCapturedRef.current = onCaptured;
  }, [onCaptured]);

  const autoAction = autoStopAction(stt.ended, { mountedAfter, handled: null });
  const autoNotice = autoAction !== "ignore" && !stt.listening ? autoStopNotice(stt.ended, stt.maxMs) : null;
  const capturePending = autoAction === "capture" && !stt.listening && delivered !== stt.ended?.session;

  useEffect(() => {
    const end = stt.ended;
    if (autoStopAction(end, { mountedAfter, handled: handledRef.current }) !== "capture" || !end) return;
    // Leave the time's-up notice on screen for a moment before moving on.
    const t = setTimeout(() => {
      if (handledRef.current === end.session) return;
      handledRef.current = end.session;
      setDelivered(end.session);
      onCapturedRef.current({ raw: end.text, mode: "voice" });
    }, end.reason === "max" ? TIME_UP_NOTICE_MS : 0);
    return () => clearTimeout(t);
  }, [stt.ended, mountedAfter]);

  const forcedTyping = !stt.supported || stt.error === "mic_denied" || stt.error === "no_mic";
  const showTyping = typing || forcedTyping;

  const switchMode = (toTyping: boolean) => {
    if (stt.ended) handledRef.current = stt.ended.session; // switching mode drops a pending auto-capture
    if (stt.listening) {
      handledRef.current = stt.session;
      void stt.stop();
    }
    setTyping(toTyping);
    onModeChange?.(toTyping ? "typed" : "voice");
  };

  const handleStop = async () => {
    const session = stt.session;
    const text = await stt.stop();
    if (handledRef.current === session) return;
    handledRef.current = session;
    if (!text.trim()) {
      setHeardNothing(true);
      return;
    }
    onCaptured({ raw: text, mode: "voice" });
  };

  const live = [stt.transcript, stt.interim].filter(Boolean).join(" ");
  const errorText = stt.error ? ERROR_TEXT[stt.error] : null;

  return (
    <div className="flex flex-col gap-4">
      {autoNotice && <p className="rounded-md bg-amber-soft px-3 py-2 text-sm text-amber" role="status">{autoNotice}</p>}
      {notice && <p className="rounded-md bg-amber-soft px-3 py-2 text-sm text-amber">{notice}</p>}
      {errorText && <p className="rounded-md bg-amber-soft px-3 py-2 text-sm text-amber" role="alert">{errorText}</p>}

      {showTyping ? (
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (typed.trim()) onCaptured({ raw: typed.trim(), mode: "typed" });
          }}
        >
          <label htmlFor="typed-answer" className="text-sm font-semibold text-ink">Your answer</label>
          <textarea
            id="typed-answer"
            autoFocus
            rows={5}
            maxLength={maxChars}
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder={placeholder}
            className="w-full resize-y rounded-md border border-line-strong bg-surface p-3 text-base text-ink focus:border-accent focus:outline-2 focus:outline-accent/30"
          />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs text-ink-3 tabular-nums">{typed.length}/{maxChars}</span>
            <div className="flex items-center gap-4">
              {!forcedTyping && (
                <button type="button" onClick={() => switchMode(false)} className="text-sm font-semibold text-accent hover:underline">
                  Use the mic
                </button>
              )}
              <button type="submit" disabled={!typed.trim()} className="h-11 rounded-md bg-accent px-5 font-semibold text-white hover:bg-accent-hover disabled:opacity-45">
                Done
              </button>
            </div>
          </div>
        </form>
      ) : (
        <div className="flex flex-col items-center gap-4">
          <PushToTalk
            listening={stt.listening}
            elapsedMs={stt.elapsedMs}
            maxMs={stt.maxMs}
            disabled={capturePending}
            onStart={() => {
              setHeardNothing(false);
              stt.start();
            }}
            onStop={() => void handleStop()}
          />
          <div className="min-h-16 w-full rounded-md border border-dashed border-line-strong bg-surface/60 p-3 text-base text-ink" aria-live="polite">
            {live ? (
              <>
                {stt.transcript} <span className="text-ink-3">{stt.interim}</span>
              </>
            ) : (
              <span className="text-ink-3">{stt.listening ? "Start talking. Your words appear here." : heardNothing || autoAction === "heard_nothing" ? "We didn't hear anything. Try again, or type instead." : "Your words will appear here."}</span>
            )}
          </div>
          <button type="button" onClick={() => switchMode(true)} className="text-sm font-semibold text-accent hover:underline">
            Type instead
          </button>
        </div>
      )}
    </div>
  );
}
