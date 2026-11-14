import type { CSSProperties } from "react";
import { cx } from "./cx";

export type BlobState = "idle" | "thinking" | "listening" | "proud" | "happy";

export interface BlobProps {
  /**
   * idle: two dot eyes (the logo mark). thinking: eyes looking up, flat mouth, thought dots.
   * listening: closed happy eyes, small open mouth. proud: arched eyes, big smile, sparkle. happy: big eyes + smile.
   */
  state?: BlobState;
  /** Width/height in px (number) or any CSS length. Default 48. */
  size?: number | string;
  /** Gentle bob animation (off under prefers-reduced-motion). */
  bob?: boolean;
  /** Body colour; default the field's mark colour (ink on light fields, lemon on dark). Any CSS colour. */
  body?: string;
  /** Face (eyes/mouth) colour; default the field's background colour. Any CSS colour. */
  face?: string;
  className?: string;
}

const BODY_BIG = "M50 6c23 0 42 17 42 42 0 26-19 46-43 46C25 94 7 75 8 50 9 24 27 6 50 6z";
const BODY_SMALL = "M50 10c21 0 38 15 38 38 0 24-17 42-39 42C27 90 11 73 12 50 13 27 29 10 50 10z";

/** The "spot" companion: a decorative ink/lemon blob with a face per state. Always aria-hidden. */
export function Blob({ state = "idle", size = 48, bob = false, body, face, className }: BlobProps) {
  const dim = typeof size === "number" ? `${size}px` : size;
  const style = {
    width: dim,
    height: dim,
    "--blob-body": body ?? "var(--field-mark)",
    "--blob-face": face ?? "var(--field-face)",
  } as CSSProperties;
  const fillBody = { fill: "var(--blob-body)" };
  const fillFace = { fill: "var(--blob-face)" };
  const strokeFace = { stroke: "var(--blob-face)" };

  return (
    <span aria-hidden="true" className={cx("inline-block shrink-0", bob && "motion-safe:animate-bob", className)} style={style}>
      <svg viewBox="0 0 100 100" className="block size-full overflow-visible" focusable="false">
        {state === "idle" && (
          <>
            <path d={BODY_BIG} style={fillBody} />
            <circle cx="40" cy="46" r="7" style={fillFace} />
            <circle cx="62" cy="46" r="7" style={fillFace} />
          </>
        )}
        {state === "happy" && (
          <>
            <path d={BODY_BIG} style={fillBody} />
            <circle cx="38" cy="46" r="10" style={fillFace} />
            <circle cx="64" cy="46" r="10" style={fillFace} />
            <circle cx="41" cy="48" r="4.5" style={fillBody} />
            <circle cx="67" cy="48" r="4.5" style={fillBody} />
            <path d="M42 68q9 7 18 0" strokeWidth="5" fill="none" strokeLinecap="round" style={strokeFace} />
          </>
        )}
        {state === "thinking" && (
          <>
            <path d={BODY_SMALL} style={fillBody} />
            <circle cx="39" cy="46" r="9" style={fillFace} />
            <circle cx="62" cy="46" r="9" style={fillFace} />
            <circle cx="42" cy="42" r="3.5" style={fillBody} />
            <circle cx="65" cy="42" r="3.5" style={fillBody} />
            <path d="M45 68h12" strokeWidth="5" strokeLinecap="round" style={strokeFace} />
            <circle cx="92" cy="18" r="5" opacity=".8" style={fillBody} />
            <circle cx="102" cy="4" r="3.5" opacity=".55" style={fillBody} />
          </>
        )}
        {state === "listening" && (
          <>
            <path d={BODY_SMALL} style={fillBody} />
            <path d="M31 48q8 6 16 0M55 48q8 6 16 0" strokeWidth="5" fill="none" strokeLinecap="round" style={strokeFace} />
            <circle cx="51" cy="68" r="5" style={fillFace} />
          </>
        )}
        {state === "proud" && (
          <>
            <path d={BODY_SMALL} style={fillBody} />
            <path d="M30 50q8-9 16 0M54 50q8-9 16 0" strokeWidth="5" fill="none" strokeLinecap="round" style={strokeFace} />
            <path d="M38 64q12 12 24 0" strokeWidth="5" fill="none" strokeLinecap="round" style={strokeFace} />
            <path d="M90 6l3 8 8 3-8 3-3 8-3-8-8-3 8-3z" style={fillBody} />
          </>
        )}
      </svg>
    </span>
  );
}
