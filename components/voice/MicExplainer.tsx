"use client";
// Shown before the browser's microphone prompt, so the prompt isn't a surprise. The privacy line depends on
// which speech-to-text engine the server offers (GET /api/speech/config): with ElevenLabs the recorded audio
// goes through our server to ElevenLabs (lib/speech/handlers.ts keeps it in memory only, never on disk or in
// logs), and the browser's Web Speech runs alongside as the fallback (useHybridSpeechToText.ts); with the browser
// engine alone the browser's own speech service transcribes and we only get the text.

import { useSpeechEngines, type SpeechEngines } from "./speechConfig";

export const MIC_EXPLAINER_TEXT: Record<SpeechEngines["stt"], string> = {
  elevenlabs:
    "We'll ask for your microphone. Your audio is sent to our speech provider (ElevenLabs) to make a transcript (your browser's speech service may transcribe it too). We don't keep the recording.",
  browser: "We'll ask for your microphone. Speech is transcribed by your browser's speech service; we only receive the text.",
};

export function MicExplainer({ className = "" }: { className?: string }) {
  const { stt } = useSpeechEngines();
  return (
    <p className={"flex items-start gap-2 text-sm text-ink-2 " + className}>
      <svg className="mt-0.5 shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <rect x="9" y="2" width="6" height="12" rx="3" />
        <path d="M19 10v1a7 7 0 0 1-14 0v-1M12 18v4" />
      </svg>
      <span>{MIC_EXPLAINER_TEXT[stt]}</span>
    </p>
  );
}
