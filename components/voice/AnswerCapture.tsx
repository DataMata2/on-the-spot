"use client";
// One answer, spoken or typed. Voice when the browser (or the server, from a recording) can turn speech into text
// and the mic is allowed; "Type instead" is always offered, and becomes the only option when neither can (Firefox
// without ElevenLabs) or the mic is denied.
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
  /** Label of the typing box. "Your answer" by default; drill 2 uses "Your question" / "Your confirmation". */
  label?: string;
  /** The typed-mode submit button: "Submit answer" by default; drill 1 "Get feedback", drill 2 "Ask" / "Confirm". */
  submitLabel?: string;
  /** Text to start the typing box with (a typed answer sent back as too short stays in the box). */
  initialText?: string;
  /**
   * Called inside the record tap, right before recording starts. The drills pass tts.cancel, so a tap while the
   * manager or the question is still speaking (or its audio is still loading) stops the voice first: the recording
   * never starts over it.
   */
  onBeforeStart?(): void;
}

const ERROR_TEXT: Record<string, string> = {
  mic_denied: "Microphone access is blocked. Allow it in the address bar, or type your answer.",
  no_mic: "We couldn't find a microphone. Type your answer instead.",
  network: "Speech recognition needs a connection and failed. Try again or type your answer.",
  unsupported: "This browser can't turn speech into text (try Chrome or Safari). Type your answer instead.",
  other: "Speech recognition stopped unexpectedly. Try again or type your answer.",
};

export function AnswerCapture({ stt, onCaptured, preferTyping, onModeChange, maxChars = 1500, notice, placeholder = "Type your answer the way you'd say it…", label = "Your answer", submitLabel = "Submit answer", initialText = "", onBeforeStart }: AnswerCaptureProps) {
  const [typing, setTyping] = useState(Boolean(preferTyping));
  const [typed, setTyped] = useState(initialText);
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
  const capturePending = (autoAction === "capture" && !stt.listening && delivered !== stt.ended?.session) || stt.transcribing;

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
    if (stt.listening || stt.transcribing) {
      handledRef.current = stt.session;
      if (stt.listening) void stt.stop();
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
    <div className="flex flex-1 flex-col gap-4">
      {autoNotice && <p className="rounded-chip bg-amber-soft px-4 py-3 text-sm text-amber" role="status">{autoNotice}</p>}
      {notice && <p className="rounded-chip bg-amber-soft px-4 py-3 text-sm text-amber">{notice}</p>}
      {errorText && <p className="rounded-chip bg-amber-soft px-4 py-3 text-sm text-amber" role="alert">{errorText}</p>}

      {showTyping ? (
        <form
          data-field="paper"
          className="flex w-full flex-col gap-3 rounded-card px-5 py-5 shadow-[inset_0_0_0_2px_var(--color-ink)] sm:p-6 lg:mx-auto lg:max-w-[720px]"
          onSubmit={(e) => {
            e.preventDefault();
            if (typed.trim()) onCaptured({ raw: typed.trim(), mode: "typed" });
          }}
        >
          <label htmlFor="typed-answer" className="type-label text-ink-2">{label}</label>
          <textarea
            id="typed-answer"
            autoFocus
            rows={5}
            maxLength={maxChars}
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder={placeholder}
            className="w-full resize-y rounded-lg border-2 border-line-strong bg-paper p-3.5 text-[1.0625rem] leading-relaxed text-ink placeholder:text-ink-3 focus:border-ink"
          />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-[0.8125rem] text-ink-2 tabular-nums">{typed.length}/{maxChars}</span>
            <div className="flex items-center gap-2">
              {!forcedTyping && (
                <button type="button" onClick={() => switchMode(false)} className="inline-flex min-h-11 items-center px-2 text-[0.9375rem] font-semibold text-ink underline decoration-1 underline-offset-4">
                  Use the mic
                </button>
              )}
              <button type="submit" disabled={!typed.trim()} className="min-h-12 rounded-pill bg-ink px-6 font-semibold text-paper hover:opacity-90 disabled:opacity-45">
                {submitLabel}
              </button>
            </div>
          </div>
        </form>
      ) : (
        <div className="flex flex-1 flex-col items-center gap-4">
          <PushToTalk
            listening={stt.listening}
            elapsedMs={stt.elapsedMs}
            maxMs={stt.maxMs}
            disabled={capturePending}
            onStart={() => {
              setHeardNothing(false);
              onBeforeStart?.();
              stt.start();
            }}
            onStop={() => void handleStop()}
          />
          <div className="min-h-16 w-full max-w-[640px] rounded-chip border border-dashed border-field-line bg-field-tint px-4 py-3 text-base text-field-fg" aria-live="polite">
            {stt.transcribing ? (
              <span className="text-field-muted">
                {live ? `${live} ` : ""}
                <span role="status">Transcribing…</span>
              </span>
            ) : live ? (
              <>
                {stt.transcript} <span className="text-field-muted">{stt.interim}</span>
              </>
            ) : (
              <span className="text-field-muted">{stt.listening ? "Start talking. Your words appear here." : heardNothing || autoAction === "heard_nothing" ? "We didn't hear anything. Try again, or type instead." : "Your words will appear here."}</span>
            )}
          </div>
          <button type="button" onClick={() => switchMode(true)} className="-mt-2 inline-flex min-h-11 items-center px-3 text-[0.9375rem] font-semibold text-field-muted underline decoration-1 underline-offset-4 hover:text-field-fg">
            Type instead
          </button>
        </div>
      )}
    </div>
  );
}
