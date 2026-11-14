"use client";
// Text-to-speech with the browser's speechSynthesis. Prefers an en-US voice; copes with voices that load late
// and with engines that never fire `end` (a safety timeout resolves the promise). The text is always shown on
// screen too, so TTS failing is never fatal.

import { useCallback, useEffect, useRef, useState } from "react";
import { useClientValue } from "./useClientValue";

export interface SpeakOptions {
  /** 1 = normal; "slower" uses 0.8. */
  rate?: number;
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

export function useTTS(): TTS {
  const supported = useClientValue(hasSynth, false);
  const [speaking, setSpeaking] = useState(false);
  const voiceRef = useRef<SpeechSynthesisVoice | null>(null);
  const doneRef = useRef<(() => void) | null>(null);

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

  const cancel = useCallback(() => {
    if (!hasSynth()) return;
    window.speechSynthesis.cancel();
    doneRef.current?.();
  }, []);

  const unlock = useCallback(() => {
    if (!hasSynth()) return;
    try {
      const u = new SpeechSynthesisUtterance(" ");
      u.volume = 0;
      window.speechSynthesis.speak(u);
    } catch {
      /* ignore */
    }
  }, []);

  const speak = useCallback(async (text: string, opts: SpeakOptions = {}) => {
    if (!hasSynth() || !text.trim()) return;
    const synth = window.speechSynthesis;
    synth.cancel();
    doneRef.current?.();
    if (!voiceRef.current) {
      // Voices can arrive late (Chrome loads them async): wait briefly once.
      await new Promise<void>((resolve) => {
        const t = setTimeout(resolve, 700);
        synth.addEventListener?.("voiceschanged", () => { clearTimeout(t); resolve(); }, { once: true });
      });
      voiceRef.current = pickVoice(synth.getVoices());
    }
    const rate = opts.rate ?? 1;
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

  return { supported, speaking, speak, cancel, unlock };
}
