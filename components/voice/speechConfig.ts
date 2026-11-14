"use client";
// Which speech engine the server offers (GET /api/speech/config), fetched once per page load. Anything but a
// clear "elevenlabs" means the browser's own speech: that is the default and the fallback.

import { useEffect, useState } from "react";

export interface SpeechEngines {
  stt: "elevenlabs" | "browser";
  tts: "elevenlabs" | "browser";
}

export const BROWSER_ONLY: SpeechEngines = { stt: "browser", tts: "browser" };

let pending: Promise<SpeechEngines> | null = null;

export function loadSpeechEngines(): Promise<SpeechEngines> {
  pending ??= fetch("/api/speech/config", { cache: "no-store" })
    .then((r) => (r.ok ? r.json() : BROWSER_ONLY))
    .then((b: Partial<SpeechEngines>) => ({ stt: b.stt === "elevenlabs" ? "elevenlabs" : "browser", tts: b.tts === "elevenlabs" ? "elevenlabs" : "browser" }) as SpeechEngines)
    .catch(() => BROWSER_ONLY);
  return pending;
}

/** The server's engines; BROWSER_ONLY until (and unless) the config says otherwise. */
export function useSpeechEngines(): SpeechEngines {
  const [engines, setEngines] = useState<SpeechEngines>(BROWSER_ONLY);
  useEffect(() => {
    let live = true;
    void loadSpeechEngines().then((e) => {
      if (live) setEngines(e);
    });
    return () => {
      live = false;
    };
  }, []);
  return engines;
}
