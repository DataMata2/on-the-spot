"use client";
// Shows what speech recognition heard, editable. The raw transcript is kept separately by the caller; this
// only edits the second copy.

export interface TranscriptEditorProps {
  raw: string;
  value: string;
  onChange(value: string): void;
  maxLength?: number;
  label?: string;
}

export function TranscriptEditor({ raw, value, onChange, maxLength = 1500, label = "What we heard" }: TranscriptEditorProps) {
  const edited = value.trim() !== raw.trim();
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor="transcript" className="text-sm font-semibold text-ink">
        {label}
      </label>
      <textarea
        id="transcript"
        value={value}
        maxLength={maxLength}
        onChange={(e) => onChange(e.target.value)}
        rows={5}
        className="w-full resize-y rounded-md border border-line-strong bg-surface p-3 text-base text-ink focus:border-accent focus:outline-2 focus:outline-accent/30"
      />
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-ink-3">
        <span>Fix it if we misheard you. A fix is saved separately; we grade the words, not your accent.</span>
        {edited && (
          <button type="button" className="font-semibold text-accent hover:underline" onClick={() => onChange(raw)}>
            Restore what we heard
          </button>
        )}
      </div>
    </div>
  );
}
