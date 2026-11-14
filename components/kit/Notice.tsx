import type { HTMLAttributes, ReactNode } from "react";
import { cx } from "./cx";

export type NoticeTone = "tip" | "info" | "warning" | "error" | "dashed";

export interface NoticeProps extends Omit<HTMLAttributes<HTMLDivElement>, "className" | "children" | "title"> {
  /**
   * tip: sunken box with a 4px cobalt left rule (the mock's "Tip for next time").
   * info: sunken box. warning: amber-soft. error: red-soft with red rule. dashed: 2px dashed ink border (test-card note).
   */
  tone?: NoticeTone;
  /** Optional small mono label above the body (e.g. "Tip for next time"). */
  label?: ReactNode;
  className?: string;
  children: ReactNode;
}

const TONES: Record<NoticeTone, string> = {
  tip: "rounded-r-lg border-l-4 border-cobalt bg-sunken text-ink",
  info: "rounded-lg bg-sunken text-ink",
  warning: "rounded-lg border-l-4 border-amber-mid bg-amber-soft text-ink",
  error: "rounded-lg border-l-4 border-red bg-red-soft text-red",
  dashed: "rounded-lg border-2 border-dashed border-current",
};

/**
 * An inline note box. Adds no role: pass role="alert" / role="status" / aria-live yourself when the
 * original markup had them, so behaviour and QA selectors stay unchanged.
 */
export function Notice({ tone = "info", label, className, children, ...rest }: NoticeProps) {
  return (
    <div className={cx("px-4 py-3.5 text-[0.9375rem] leading-normal sm:px-5", TONES[tone], className)} {...rest}>
      {label && (
        <span className={cx("type-label mb-1 block text-[0.6875rem]", tone === "dashed" ? "text-field-muted" : "text-ink-2")}>
          {label}
        </span>
      )}
      {children}
    </div>
  );
}
