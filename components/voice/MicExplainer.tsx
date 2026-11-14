// Shown before the browser's microphone prompt, so the prompt isn't a surprise.

export const MIC_EXPLAINER_TEXT = "We'll ask for your microphone. Audio stays in your browser; only the text is sent.";

export function MicExplainer({ className = "" }: { className?: string }) {
  return (
    <p className={"flex items-start gap-2 text-sm text-ink-2 " + className}>
      <svg className="mt-0.5 shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <rect x="9" y="2" width="6" height="12" rx="3" />
        <path d="M19 10v1a7 7 0 0 1-14 0v-1M12 18v4" />
      </svg>
      <span>{MIC_EXPLAINER_TEXT}</span>
    </p>
  );
}
