"use client";
// Text-to-speech. Primary: ElevenLabs audio from POST /api/speech/tts (only texts the server vouches for: bank
// questions and opening lines as they are, runtime texts with the token the server sent next to them), played in one
// shared HTMLAudioElement that unlock() primes inside the user's tap (iOS). Fallback, silent and automatic: the
// browser's speechSynthesis, when the server says ElevenLabs is off, the request fails, or the audio isn't ready
// within 2.5 s. The text is always shown on screen too, so TTS failing is never fatal.

import { useCallback, useEffect, useRef, useState } from "react";
import { useSpeechEngines } from "./speechConfig";
import { useClientValue } from "./useClientValue";

export interface SpeakOptions {
  /** 1 = normal; SLOW_RATE for "Slower" (server audio plays at SLOW_AUDIO_RATE). */
  rate?: number;
  /** The server's TTS token for a runtime text (drill 2 replies, rehearse questions). Not needed for bank texts. */
  token?: string;
}

export interface TTS {
  supported: boolean;
  speaking: boolean;
  /** Speak `text`; resolves when done, cancelled or failed (never rejects). */
  speak(text: string, opts?: SpeakOptions): Promise<void>;
  cancel(): void;
  /** Call synchronously inside a click handler before any await: unlocks audio on iOS Safari. */
  unlock(): void;
}

export const SLOW_RATE = 0.8;
/** "Slower" for server audio: playbackRate (pitch preserved). */
export const SLOW_AUDIO_RATE = 0.85;
/** Server audio that isn't ready after this long is dropped for speechSynthesis. */
export const AUDIO_READY_TIMEOUT_MS = 2500;

const PREFERRED = [/google us english/i, /samantha/i, /aria/i, /jenny/i, /ava/i, /allison/i, /alex/i];

function pickVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  const us = voices.filter((v) => v.lang.replace("_", "-").toLowerCase() === "en-us");
  for (const re of PREFERRED) {
    const v = us.find((x) => re.test(x.name));
    if (v) return v;
  }
  return us.find((v) => v.localService) ?? us[0] ?? voices.find((v) => v.lang.toLowerCase().startsWith("en")) ?? null;
}

const hasSynth = () => typeof window !== "undefined" && "speechSynthesis" in window && typeof window.SpeechSynthesisUtterance === "function";
const hasAudio = () => typeof window !== "undefined" && typeof window.Audio === "function";

/** A 50 ms silent WAV, played inside a tap to unlock the shared audio element on iOS. */
let silentUrl: string | null = null;
function silentWav(): string {
  if (silentUrl) return silentUrl;
  const samples = 400; // 8 kHz, 8-bit mono
  const buf = new ArrayBuffer(44 + samples);
  const v = new DataView(buf);
  const str = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  str(0, "RIFF");
  v.setUint32(4, 36 + samples, true);
  str(8, "WAVE");
  str(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, 8000, true);
  v.setUint32(28, 8000, true);
  v.setUint16(32, 1, true);
  v.setUint16(34, 8, true);
  str(36, "data");
  v.setUint32(40, samples, true);
  for (let i = 0; i < samples; i++) v.setUint8(44 + i, 128);
  silentUrl = URL.createObjectURL(new Blob([buf], { type: "audio/wav" }));
  return silentUrl;
}

/** Object URLs of audio already fetched this page load (Replay / Slower don't fetch again). */
const audioUrls = new Map<string, string>();
const MAX_URLS = 30;

async function fetchAudio(text: string, token: string | undefined, signal: AbortSignal): Promise<string | null> {
  const hit = audioUrls.get(text);
  if (hit) return hit;
  try {
    const res = await fetch("/api/speech/tts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(token ? { text, token } : { text }),
      signal,
    });
    if (!res.ok || !(res.headers.get("content-type") ?? "").startsWith("audio/")) return null;
    const blob = await res.blob();
    if (blob.size === 0) return null;
    const url = URL.createObjectURL(blob);
    audioUrls.set(text, url);
    while (audioUrls.size > MAX_URLS) {
      const [oldText, oldUrl] = audioUrls.entries().next().value as [string, string];
      audioUrls.delete(oldText);
      URL.revokeObjectURL(oldUrl);
    }
    return url;
  } catch {
    return null;
  }
}

export function useTTS(): TTS {
  const engines = useSpeechEngines();
  const serverTts = engines.tts === "elevenlabs";
  const synthOk = useClientValue(hasSynth, false);
  const audioOk = useClientValue(hasAudio, false);
  const supported = synthOk || (serverTts && audioOk);
  const [speaking, setSpeaking] = useState(false);
  const voiceRef = useRef<SpeechSynthesisVoice | null>(null);
  const doneRef = useRef<(() => void) | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const serverRef = useRef(serverTts);
  const speakIdRef = useRef(0);
  const fetchAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    serverRef.current = serverTts;
  }, [serverTts]);

  useEffect(() => {
    if (!hasSynth()) return;
    const synth = window.speechSynthesis;
    const update = () => {
      voiceRef.current = pickVoice(synth.getVoices());
    };
    update();
    synth.addEventListener?.("voiceschanged", update);
    return () => {
      synth.removeEventListener?.("voiceschanged", update);
      synth.cancel();
    };
  }, []);

  useEffect(
    () => () => {
      fetchAbortRef.current?.abort();
      audioRef.current?.pause();
    },
    [],
  );

  const audioEl = () => {
    if (!hasAudio()) return null;
    if (!audioRef.current) {
      const a = new Audio();
      a.preload = "auto";
      audioRef.current = a;
    }
    return audioRef.current;
  };

  /** Stop whatever is playing or loading and resolve its speak(). */
  const halt = useCallback(() => {
    speakIdRef.current += 1;
    fetchAbortRef.current?.abort();
    fetchAbortRef.current = null;
    if (hasSynth()) window.speechSynthesis.cancel();
    audioRef.current?.pause();
    doneRef.current?.();
  }, []);

  const cancel = useCallback(() => halt(), [halt]);

  const unlock = useCallback(() => {
    if (hasSynth()) {
      try {
        const u = new SpeechSynthesisUtterance(" ");
        u.volume = 0;
        window.speechSynthesis.speak(u);
      } catch {
        /* ignore */
      }
    }
    if (!serverRef.current) return;
    // Play silence in this element now, inside the tap, so iOS lets it play the real audio after an await.
    const a = audioEl();
    if (!a) return;
    try {
      a.src = silentWav();
      a.playbackRate = 1;
      void a.play().catch(() => {});
    } catch {
      /* ignore */
    }
  }, []);

  /** Plays `url`; resolves true when it played to the end (or was cancelled), false when it couldn't start. */
  const playAudio = useCallback((url: string, rate: number, id: number): Promise<boolean> => {
    const el = audioEl();
    if (!el) return Promise.resolve(false);
    const a: HTMLAudioElement = el;
    return new Promise<boolean>((resolve) => {
      let finished = false;
      let safety: ReturnType<typeof setTimeout> | undefined;
      function finish(played: boolean) {
        if (finished) return;
        finished = true;
        clearTimeout(safety);
        a.onended = null;
        a.onerror = null;
        a.onloadedmetadata = null;
        if (doneRef.current === done) doneRef.current = null;
        setSpeaking(false);
        resolve(played);
      }
      const done = () => finish(true);
      doneRef.current = done;
      a.onended = done;
      a.onerror = () => finish(false);
      a.onloadedmetadata = () => {
        clearTimeout(safety);
        const secs = Number.isFinite(a.duration) ? a.duration : 30;
        safety = setTimeout(done, (secs / rate) * 1000 + 3000);
      };
      safety = setTimeout(done, 60_000);
      try {
        a.src = url;
        a.playbackRate = rate;
        a.defaultPlaybackRate = rate;
        setSpeaking(true);
        a.play().catch(() => {
          // Blocked (no unlock) or undecodable: let speechSynthesis say it instead.
          if (id === speakIdRef.current) finish(false);
        });
      } catch {
        finish(false);
      }
    });
  }, []);

  const speakSynth = useCallback(async (text: string, rate: number) => {
    if (!hasSynth()) return;
    const synth = window.speechSynthesis;
    synth.cancel();
    if (!voiceRef.current) {
      // Voices can arrive late (Chrome loads them async): wait briefly once.
      await new Promise<void>((resolve) => {
        const t = setTimeout(resolve, 700);
        synth.addEventListener?.("voiceschanged", () => { clearTimeout(t); resolve(); }, { once: true });
      });
      voiceRef.current = pickVoice(synth.getVoices());
    }
    await new Promise<void>((resolve) => {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = "en-US";
      if (voiceRef.current) u.voice = voiceRef.current;
      u.rate = rate;
      const words = text.split(/\s+/).length;
      const safety = setTimeout(() => finish(), ((words / 2.3) / rate) * 1000 + 4000);
      let finished = false;
      function finish() {
        if (finished) return;
        finished = true;
        clearTimeout(safety);
        if (doneRef.current === finish) doneRef.current = null;
        setSpeaking(false);
        resolve();
      }
      doneRef.current = finish;
      u.onend = finish;
      u.onerror = finish;
      setSpeaking(true);
      try {
        synth.speak(u);
        // Chrome sometimes starts paused after a cancel().
        if (synth.paused) synth.resume();
      } catch {
        finish();
      }
    });
  }, []);

  const speak = useCallback(
    async (text: string, opts: SpeakOptions = {}) => {
      if (!text.trim()) return;
      halt();
      const id = speakIdRef.current;
      const rate = opts.rate ?? 1;
      if (serverRef.current && hasAudio()) {
        const ctrl = new AbortController();
        fetchAbortRef.current = ctrl;
        // A cancel() aborts the fetch too; a slow one gives up after AUDIO_READY_TIMEOUT_MS.
        const timer = setTimeout(() => ctrl.abort(), AUDIO_READY_TIMEOUT_MS);
        const url = await fetchAudio(text.replace(/\s+/g, " ").trim(), opts.token, ctrl.signal);
        clearTimeout(timer);
        if (fetchAbortRef.current === ctrl) fetchAbortRef.current = null;
        if (id !== speakIdRef.current) return; // cancelled or replaced meanwhile
        if (url && (await playAudio(url, rate < 1 ? SLOW_AUDIO_RATE : 1, id))) return;
        if (id !== speakIdRef.current) return;
      }
      await speakSynth(text, rate);
    },
    [halt, playAudio, speakSynth],
  );

  return { supported, speaking, speak, cancel, unlock };
}
