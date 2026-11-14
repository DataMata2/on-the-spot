// Shared voice building blocks (drill 1 and drill 2).
export { useTTS, SLOW_RATE, SLOW_AUDIO_RATE, type TTS, type SpeakOptions } from "./useTTS";
export { useSpeechToText } from "./useHybridSpeechToText";
export { useBrowserSpeechToText, DEFAULT_MAX_MS, type SpeechToText, type SttError } from "./useSpeechToText";
export { PushToTalk, type PushToTalkProps } from "./PushToTalk";
export { ThinkTimer, type ThinkTimerProps } from "./ThinkTimer";
export { TranscriptEditor, type TranscriptEditorProps } from "./TranscriptEditor";
export { MicExplainer, MIC_EXPLAINER_TEXT } from "./MicExplainer";
export { AnswerCapture, type AnswerCaptureProps, type AnswerMode, type CapturedAnswer } from "./AnswerCapture";
export { useClientValue } from "./useClientValue";
