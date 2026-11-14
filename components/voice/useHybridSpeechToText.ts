"use client";
// Speech-to-text with ElevenLabs as the primary engine and the browser's Web Speech API as the silent fallback.
//
// When the server says ElevenLabs is on (GET /api/speech/config) and the browser can record (MediaRecorder), one
// push-to-talk runs both: Web Speech exactly as before (live interim text where it exists) and a MediaRecorder
// capture of the same audio. On stop the audio goes to POST /api/speech/stt; its text wins. On ANY error or timeout
// the Web Speech text recorded in parallel is used; if that is empty too, it is the usual "heard nothing" state.
// Nothing tells the user which engine produced the words.
//
// Without ElevenLabs (no key, over budget, config not loaded at the first tap, no MediaRecorder) this hook IS the
// browser hook: every call is passed straight through. Where Web Speech is missing (Firefox, some iOS) but recording
// works and ElevenLabs is on, voice works through the server alone.

import { useCallback, useEffect, useRef, useState } from "react";
import type { EndReason, RecordingEnd } from "./autoStop";
import { useSpeechEngines } from "./speechConfig";
import { chooseTranscript, type ServerTranscript } from "./sttFallback";
import { useClientValue } from "./useClientValue";
import { DEFAULT_MAX_MS, useBrowserSpeechToText, type SpeechToText, type SttError } from "./useSpeechToText";

const MIME_TYPES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
/** Give up on the server transcript after this long and use the Web Speech text. */
const SERVER_TIMEOUT_MS = 15_000;

function canRecord(): boolean {
  return typeof window !== "undefined" && typeof window.MediaRecorder === "function" && typeof navigator.mediaDevices?.getUserMedia === "function";
}

function pickMime(): string | undefined {
  for (const t of MIME_TYPES) {
    try {
      if (MediaRecorder.isTypeSupported(t)) return t;
    } catch {
      /* ignore */
    }
  }
  return undefined;
}

function micError(err: unknown): SttError {
  const name = (err as { name?: string } | null)?.name;
  if (name === "NotAllowedError" || name === "SecurityError") return "mic_denied";
  if (name === "NotFoundError" || name === "OverconstrainedError" || name === "NotReadableError") return "no_mic";
  return "other";
}

async function transcribe(blob: Blob, durationMs: number): Promise<ServerTranscript> {
  try {
    const form = new FormData();
    form.append("audio", blob, /mp4/.test(blob.type) ? "answer.mp4" : /ogg/.test(blob.type) ? "answer.ogg" : "answer.webm");
    form.append("durationMs", String(Math.round(durationMs)));
    const res = await fetch("/api/speech/stt", { method: "POST", body: form, signal: AbortSignal.timeout(SERVER_TIMEOUT_MS) });
    if (!res.ok) return { ok: false };
    const body = (await res.json().catch(() => null)) as { text?: unknown } | null;
    return typeof body?.text === "string" ? { ok: true, text: body.text } : { ok: false };
  } catch {
    return { ok: false };
  }
}

/** One MediaRecorder capture. */
interface Capture {
  recorder: MediaRecorder | null;
  stream: MediaStream | null;
  chunks: Blob[];
  startedAt: number;
  /** Set once stop or reset began: a late getUserMedia result is released at once. */
  stopped: boolean;
  failed: SttError | null;
  ready: Promise<void>;
}

function release(c: Capture) {
  c.stream?.getTracks().forEach((t) => t.stop());
  c.stream = null;
}

/** Stop the capture and return its audio (null when it never recorded anything). */
async function finish(c: Capture): Promise<{ blob: Blob; durationMs: number } | null> {
  await c.ready;
  const mr = c.recorder;
  if (!mr || c.failed) {
    release(c);
    return null;
  }
  const durationMs = Date.now() - c.startedAt;
  if (mr.state !== "inactive") {
    await new Promise<void>((resolve) => {
      const t = setTimeout(resolve, 1000);
      mr.onstop = () => {
        clearTimeout(t);
        resolve();
      };
      try {
        mr.stop();
      } catch {
        clearTimeout(t);
        resolve();
      }
    });
  }
  release(c);
  const blob = new Blob(c.chunks, { type: mr.mimeType || c.chunks[0]?.type || "audio/webm" });
  return blob.size > 0 ? { blob, durationMs } : null;
}

function discard(c: Capture) {
  c.stopped = true;
  void c.ready.then(() => {
    try {
      if (c.recorder && c.recorder.state !== "inactive") c.recorder.stop();
    } catch {
      /* ignore */
    }
    release(c);
  });
}

type Mode = "undecided" | "web" | "hybrid";

export function useSpeechToText({ maxMs = DEFAULT_MAX_MS, lang = "en-US" }: { maxMs?: number; lang?: string } = {}): SpeechToText {
  const engines = useSpeechEngines();
  const recordable = useClientValue(canRecord, false);
  const serverStt = engines.stt === "elevenlabs" && recordable;

  // Web Speech endings reach the hybrid through this ref (set below, once the handlers exist).
  const webEndRef = useRef<(end: RecordingEnd) => void>(() => {});
  const onWebEnd = useCallback((end: RecordingEnd) => webEndRef.current(end), []);
  const web = useBrowserSpeechToText({ maxMs, lang, onEnd: onWebEnd });
  const { start: webStart, stop: webStop, reset: webReset, supported: webSupported } = web;

  // The engine is chosen at the first start() and kept for this hook's lifetime, so sessions never mix.
  const [mode, setMode] = useState<Mode>("undecided");
  const modeRef = useRef<Mode>("undecided");
  const [listening, setListening] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [session, setSession] = useState(0);
  const [ended, setEnded] = useState<RecordingEnd | null>(null);
  const [error, setError] = useState<SttError | null>(null);
  const [recFailed, setRecFailed] = useState(false);
  const [finalText, setFinalText] = useState("");

  const sessionRef = useRef(0);
  const activeRef = useRef(false); // a hybrid recording is running (not yet stopping)
  const captureRef = useRef<Capture | null>(null);
  const webEndedRef = useRef<RecordingEnd | null>(null); // Web Speech ended on its own during this recording
  const startedAtRef = useRef(0);
  const finalTextRef = useRef("");
  const pendingRef = useRef<Promise<string> | null>(null); // the stop in progress
  const epochRef = useRef(0); // bumped by reset/unmount: a transcription that comes back later is dropped
  const maxTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimers = () => {
    if (maxTimerRef.current) clearTimeout(maxTimerRef.current);
    if (tickRef.current) clearInterval(tickRef.current);
    maxTimerRef.current = null;
    tickRef.current = null;
  };

  const stopWith = useCallback(
    (reason: EndReason): Promise<string> => {
      if (!activeRef.current) return pendingRef.current ?? Promise.resolve(finalTextRef.current);
      activeRef.current = false;
      clearTimers();
      const capture = captureRef.current;
      captureRef.current = null;
      if (capture) capture.stopped = true;
      const epoch = epochRef.current;
      const sess = sessionRef.current;
      setListening(false);
      const p = (async () => {
        const webText = webSupported ? webStop() : Promise.resolve("");
        const audio = capture ? await finish(capture) : null;
        let server: ServerTranscript | null = null;
        if (audio && epoch === epochRef.current) {
          setTranscribing(true);
          server = await transcribe(audio.blob, audio.durationMs);
        }
        const browserText = await webText;
        if (epoch !== epochRef.current) return "";
        const chosen = chooseTranscript(server, browserText);
        finalTextRef.current = chosen.text;
        pendingRef.current = null;
        setFinalText(chosen.text);
        setTranscribing(false);
        setEnded({ session: sess, reason, text: chosen.text });
        return chosen.text;
      })();
      pendingRef.current = p;
      return p;
    },
    [webSupported, webStop],
  );

  // A Web Speech ending matters only when the recorder isn't running: then it ends the hybrid recording too.
  useEffect(() => {
    webEndRef.current = (end) => {
      if (modeRef.current !== "hybrid" || !activeRef.current) return;
      webEndedRef.current = end;
      const c = captureRef.current;
      if (!c || c.failed) void stopWith(end.reason === "user" ? "auto" : end.reason);
    };
  }, [stopWith]);

  const start = useCallback(() => {
    if (modeRef.current === "undecided") {
      modeRef.current = serverStt ? "hybrid" : "web";
      setMode(modeRef.current);
    }
    if (modeRef.current === "web") {
      webStart();
      return;
    }
    if (activeRef.current || pendingRef.current) return;
    sessionRef.current += 1;
    setSession(sessionRef.current);
    setEnded(null);
    setError(null);
    setRecFailed(false);
    setFinalText("");
    finalTextRef.current = "";
    setElapsedMs(0);
    webEndedRef.current = null;
    activeRef.current = true;
    startedAtRef.current = Date.now();
    if (webSupported) webStart();

    const c: Capture = { recorder: null, stream: null, chunks: [], startedAt: Date.now(), stopped: false, failed: null, ready: Promise.resolve() };
    captureRef.current = c;
    c.ready = (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
        c.stream = stream;
        if (c.stopped) return; // finish()/discard() release it
        const mime = pickMime();
        const mr = new MediaRecorder(stream, { ...(mime ? { mimeType: mime } : {}), audioBitsPerSecond: 32_000 });
        mr.ondataavailable = (e) => {
          if (e.data.size > 0) c.chunks.push(e.data);
        };
        c.recorder = mr;
        mr.start(1000);
        c.startedAt = Date.now();
      } catch (err) {
        c.failed = micError(err);
      }
    })().then(() => {
      if (!c.failed || captureRef.current !== c || !activeRef.current) return;
      // No recording: carry on with Web Speech alone, or end now when there is nothing else listening.
      setRecFailed(true);
      if (!webSupported) {
        setError(c.failed);
        void stopWith("error");
      } else if (webEndedRef.current) {
        void stopWith(webEndedRef.current.reason === "user" ? "auto" : webEndedRef.current.reason);
      }
    });

    setListening(true);
    tickRef.current = setInterval(() => setElapsedMs(Date.now() - startedAtRef.current), 200);
    maxTimerRef.current = setTimeout(() => void stopWith("max"), maxMs);
  }, [serverStt, webStart, webSupported, stopWith, maxMs]);

  const stop = useCallback((): Promise<string> => (modeRef.current === "hybrid" ? stopWith("user") : webStop()), [stopWith, webStop]);

  const reset = useCallback(() => {
    if (modeRef.current !== "hybrid") {
      webReset();
      return;
    }
    epochRef.current += 1;
    activeRef.current = false;
    clearTimers();
    const c = captureRef.current;
    captureRef.current = null;
    if (c) discard(c);
    pendingRef.current = null;
    finalTextRef.current = "";
    webReset();
    setListening(false);
    setTranscribing(false);
    setEnded(null);
    setError(null);
    setRecFailed(false);
    setFinalText("");
    setElapsedMs(0);
  }, [webReset]);

  useEffect(
    () => () => {
      epochRef.current += 1;
      activeRef.current = false;
      clearTimers();
      const c = captureRef.current;
      captureRef.current = null;
      if (c) discard(c);
    },
    [],
  );

  if (mode !== "hybrid") {
    return { ...web, supported: mode === "undecided" ? webSupported || serverStt : webSupported, start, stop, reset };
  }
  return {
    supported: true,
    listening,
    transcribing,
    transcript: listening || transcribing ? web.transcript : finalText,
    interim: listening ? web.interim : "",
    // While the recorder works, Web Speech's own errors are hidden: the server transcript doesn't need it.
    error: error ?? (recFailed ? web.error : null),
    elapsedMs,
    maxMs,
    session,
    ended,
    start,
    stop,
    reset,
  };
}
