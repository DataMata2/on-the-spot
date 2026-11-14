import { Blob } from "@/components/kit/Blob";
import { cx } from "@/components/kit/cx";

/**
 * The product's mark: the "spot" blob with two dot eyes. Colours follow the nearest screen field
 * (ink blob on light fields, lemon on dark ones; the eyes are the field colour).
 */
export function Mark({ className }: { className?: string }) {
  return <Blob state="idle" size="1.1em" className={cx("-translate-y-px", className)} />;
}

/** "On the Spot" in the display face with the blob mark. Never wraps. */
export function Wordmark({ className, markClassName }: { className?: string; markClassName?: string }) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-[0.35em] font-display text-[1.3125rem] leading-none font-extrabold tracking-[-0.03em] whitespace-nowrap text-current [font-variation-settings:'opsz'_24,'wdth'_88] lg:text-[1.5rem]",
        className,
      )}
    >
      <Mark className={markClassName} />
      On the Spot
    </span>
  );
}
