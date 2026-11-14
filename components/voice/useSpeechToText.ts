"use client";
// Speech-to-text behind a small interface, so a server-side engine can replace the browser one later.
// Browser engine: webkitSpeechRecognition (Chrome, Edge, Safari), en-US, interim results. Chrome ends a
// session on its own after silence; while the user is still "talking" (active) we restart it and keep what was
// already recognized. A hard maximum duration stops it regardless. Audio never leaves the browser's engine
// from our side; only the text is sent to our server.

import { useCallback, useEffect, useRef, useState } from "react";
import { useClientValue } from "./useClientValue";

export type SttError = "unsupported" | "mic_denied" | "no_mic" | "network" | "other";

export interface SpeechToText {
  /** The browser can do speech recognition at all. */
  supported: boolean;
  listening: boolean;
  /** Final recognized text so far (across auto-restarts). */
  transcript: string;
  /** Not-yet-final text being recognized right now. */
  interim: string;
  error: SttError | null;
  /** Milliseconds since start() while listening. */
  elapsedMs: number;
  maxMs: number;
  start(): void;
  /** Stop and resolve with the full transcript (pending interim text included). */
  stop(): Promise<string>;
  /** Clear transcript and error. */
  reset(): void;
}

export const DEFAULT_MAX_MS = 45_000;

// Minimal typings for the Web Speech API (not in lib.dom for every TS version).
interface RecognitionAlternative { transcript: string }
interface RecognitionResult { isFinal: boolean; length: number; [i: number]: RecognitionAlternative }
interface RecognitionEvent { resultIndex: number; results: { length: number; [i: number]: RecognitionResult } }
interface RecognitionErrorEvent { error: string }
interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: RecognitionEvent) => void) | null;
  onerror: ((e: RecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type RecognitionCtor = new () => Recognition;

function getCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const join = (a: string, b: string) => [a.trim(), b.trim()].filter(Boolean).join(" ");

export function useSpeechToText({ maxMs = DEFAULT_MAX_MS, lang = "en-US" }: { maxMs?: number; lang?: string } = {}): SpeechToText {
  const supported = useClientValue(() => getCtor() !== null, false);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<SttError | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);

  const recRef = useRef<Recognition | null>(null);
  const activeRef = useRef(false);
  const committedRef = useRef(""); // finals from ended sessions
  const sessionFinalRef = useRef(""); // finals of the running session
  const interimRef = useRef("");
  const startedAtRef = useRef(0);
  const restartsRef = useRef<number[]>([]);
  const maxTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const waitersRef = useRef<((t: string) => void)[]>([]);
  const launchRef = useRef<() => boolean>(() => false); // for the restart inside onend

  const clearTimers = () => {
    if (maxTimerRef.current) clearTimeout(maxTimerRef.current);
    if (tickRef.current) clearInterval(tickRef.current);
    maxTimerRef.current = null;
    tickRef.current = null;
  };

  const finalize = useCallback(() => {
    clearTimers();
    activeRef.current = false;
    recRef.current = null;
    // A pending interim at the very end is usually right; keep it rather than lose the last words.
    const full = join(join(committedRef.current, sessionFinalRef.current), interimRef.current);
    committedRef.current = full;
    sessionFinalRef.current = "";
    interimRef.current = "";
    setTranscript(full);
    setInterim("");
    setListening(false);
    const waiters = waitersRef.current;
    waitersRef.current = [];
    waiters.forEach((w) => w(full));
  }, []);

  const launch = useCallback(() => {
    const Ctor = getCtor();
    if (!Ctor) return false;
    const rec = new Ctor();
    rec.lang = lang;
    // Android Chrome duplicates results in continuous mode; use single-shot sessions + auto-restart there.
    rec.continuous = !/android/i.test(navigator.userAgent);
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    rec.onresult = (e) => {
      if (recRef.current !== rec) return;
      let fin = "";
      let inter = "";
      for (let i = 0; i < e.results.length; i++) {
        const r = e.results[i];
        const text = r[0]?.transcript ?? "";
        if (r.isFinal) fin = join(fin, text);
        else inter = join(inter, text);
      }
      sessionFinalRef.current = fin;
      interimRef.current = inter;
      setTranscript(join(committedRef.current, fin));
      setInterim(inter);
    };
    rec.onerror = (e) => {
      if (recRef.current !== rec) return;
      const code = e.error;
      if (code === "no-speech" || code === "aborted") return; // onend follows; restart handles it
      activeRef.current = false;
      setError(code === "not-allowed" || code === "service-not-allowed" ? "mic_denied" : code === "audio-capture" ? "no_mic" : code === "network" ? "network" : "other");
    };
    rec.onend = () => {
      if (recRef.current !== rec) return;
      committedRef.current = join(committedRef.current, sessionFinalRef.current);
      sessionFinalRef.current = "";
      const now = Date.now();
      restartsRef.current = restartsRef.current.filter((t) => now - t < 2000);
      const stormy = restartsRef.current.length >= 5;
      if (activeRef.current && !stormy && now - startedAtRef.current < maxMs) {
        // Chrome's silent end: keep listening.
        interimRef.current = "";
        restartsRef.current.push(now);
        if (!launchRef.current()) finalize();
        return;
      }
      finalize();
    };
    recRef.current = rec;
    try {
      rec.start();
      return true;
    } catch {
      recRef.current = null;
      return false;
    }
  }, [lang, maxMs, finalize]);

  useEffect(() => {
    launchRef.current = launch;
  }, [launch]);

  const stop = useCallback((): Promise<string> => {
    activeRef.current = false;
    const rec = recRef.current;
    if (!rec) return Promise.resolve(committedRef.current);
    return new Promise<string>((resolve) => {
      waitersRef.current.push(resolve);
      try {
        rec.stop();
      } catch {
        finalize();
      }
      // Some engines never fire onend after stop().
      setTimeout(() => {
        if (recRef.current === rec) {
          try {
            rec.abort();
          } catch {
            /* ignore */
          }
          finalize();
        }
      }, 1500);
    });
  }, [finalize]);

  const start = useCallback(() => {
    if (!getCtor()) {
      setError("unsupported");
      return;
    }
    if (recRef.current) return;
    committedRef.current = "";
    sessionFinalRef.current = "";
    interimRef.current = "";
    restartsRef.current = [];
    setTranscript("");
    setInterim("");
    setError(null);
    setElapsedMs(0);
    activeRef.current = true;
    startedAtRef.current = Date.now();
    if (!launch()) {
      activeRef.current = false;
      setError("other");
      return;
    }
    setListening(true);
    tickRef.current = setInterval(() => setElapsedMs(Date.now() - startedAtRef.current), 200);
    maxTimerRef.current = setTimeout(() => void stop(), maxMs);
  }, [launch, maxMs, stop]);

  const reset = useCallback(() => {
    committedRef.current = "";
    setTranscript("");
    setInterim("");
    setError(null);
    setElapsedMs(0);
  }, []);

  useEffect(
    () => () => {
      activeRef.current = false;
      clearTimers();
      const rec = recRef.current;
      recRef.current = null;
      try {
        rec?.abort();
      } catch {
        /* ignore */
      }
    },
    [],
  );

  return { supported, listening, transcript, interim, error, elapsedMs, maxMs, start, stop, reset };
}
