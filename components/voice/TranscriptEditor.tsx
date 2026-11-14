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
      <label htmlFor="transcript" className="type-label text-field-muted">
        {label}
      </label>
      <textarea
        id="transcript"
        value={value}
        maxLength={maxLength}
        onChange={(e) => onChange(e.target.value)}
        rows={5}
        className="w-full resize-y rounded-chip border-2 border-field-line bg-paper p-4 text-[1.0625rem] leading-relaxed text-ink"
      />
      <div className="flex flex-wrap items-center justify-between gap-2 text-[0.8125rem] text-field-muted">
        <span>Fix it if we misheard you. A fix is saved separately; we grade the words, not your accent.</span>
        {edited && (
          <button type="button" className="inline-flex min-h-11 items-center px-1 font-semibold text-field-fg underline decoration-1 underline-offset-4" onClick={() => onChange(raw)}>
            Restore what we heard
          </button>
        )}
      </div>
    </div>
  );
}
