import { cx } from "@/components/kit/cx";

/** A speech bubble with a filled dot: "you, speaking, now". The product's mark. */
export function Mark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" aria-hidden className={cx("size-5", className)}>
      <path
        d="M4 2.5h12A2.5 2.5 0 0 1 18.5 5v7a2.5 2.5 0 0 1-2.5 2.5H9.2l-3.6 3a.6.6 0 0 1-1-.46V14.5H4A2.5 2.5 0 0 1 1.5 12V5A2.5 2.5 0 0 1 4 2.5Z"
        className="fill-accent"
      />
      <circle cx="10" cy="8.5" r="2.4" className="fill-white" />
    </svg>
  );
}

export function Wordmark({ className, markClassName }: { className?: string; markClassName?: string }) {
  return (
    <span className={cx("inline-flex items-center gap-2 text-[1.0625rem] font-bold tracking-[-0.01em] text-ink", className)}>
      <Mark className={markClassName} />
      On the Spot
    </span>
  );
}
