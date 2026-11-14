import type { ReactNode } from "react";
import { cx } from "./cx";

export type StickerShape = "scallop" | "circle" | "rounded";
export type StickerTone = "tomato" | "lemon" | "pink" | "cobalt" | "ink" | "paper";

export interface StickerProps {
  /** scallop: the price-sticker burst; circle; rounded: 20px-radius tag. */
  shape?: StickerShape;
  tone?: StickerTone;
  /** Rotation in degrees. Default -10 for scallop, 0 otherwise. */
  rotate?: number;
  /** Width/height (px number or CSS length) for scallop/circle; ignored for rounded (sizes to content). */
  size?: number | string;
  /** Hard ink drop shadow. Default true. */
  shadow?: boolean;
  className?: string;
  /** Centred content, e.g. <b className="type-display text-5xl">$79</b>. */
  children?: ReactNode;
}

const SCALLOP =
  "M100 4l13 15 19-8 6 20 20 0-3 20 18 9-10 17 13 15-17 11 4 20-20 3-3 20-19-5-11 17-15-13-15 13-11-17-19 5-3-20-20-3 4-20-17-11 13-15-10-17 18-9-3-20 20 0 6-20 19 8z";

/* Text colour per tone: ink on light tones (white on tomato fails contrast), paper on dark ones. */
const TONE: Record<StickerTone, { fill: string; text: string }> = {
  tomato: { fill: "var(--color-tomato)", text: "text-ink" },
  lemon: { fill: "var(--color-lemon)", text: "text-ink" },
  pink: { fill: "var(--color-pink)", text: "text-ink" },
  paper: { fill: "var(--color-paper)", text: "text-ink" },
  cobalt: { fill: "var(--color-cobalt)", text: "text-paper" },
  ink: { fill: "var(--color-ink)", text: "text-paper" },
};

/** A sticker object with a hard ink shadow: scalloped price burst, round badge or rounded tag. */
export function Sticker({ shape = "scallop", tone = "tomato", rotate, size = 184, shadow = true, className, children }: StickerProps) {
  const deg = rotate ?? (shape === "scallop" ? -10 : 0);
  const dim = typeof size === "number" ? `${size}px` : size;
  const t = TONE[tone];

  if (shape === "rounded") {
    return (
      <span
        className={cx("inline-flex items-center rounded-chip px-4 py-3", shadow && "shadow-sticker-sm", t.text, className)}
        style={{ backgroundColor: t.fill, transform: deg ? `rotate(${deg}deg)` : undefined }}
      >
        {children}
      </span>
    );
  }

  return (
    <span
      className={cx("relative inline-grid shrink-0 place-items-center text-center", shadow && "drop-shadow-sticker", t.text, className)}
      style={{ width: dim, height: dim, transform: deg ? `rotate(${deg}deg)` : undefined }}
    >
      <svg viewBox="0 0 200 200" aria-hidden="true" focusable="false" className="absolute inset-0 size-full">
        {shape === "scallop" ? <path d={SCALLOP} fill={t.fill} /> : <circle cx="100" cy="100" r="98" fill={t.fill} />}
      </svg>
      <span className="relative flex flex-col items-center justify-center">{children}</span>
    </span>
  );
}
