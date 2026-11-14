import type { HTMLAttributes, ReactNode } from "react";
import { cx } from "./cx";

export type PaperCardTone = "paper" | "sunken" | "ink" | "lemon" | "cobalt";

export interface PaperCardProps extends Omit<HTMLAttributes<HTMLElement>, "className" | "children"> {
  /** Card colour. paper (default) and sunken read as light fields inside; ink and cobalt as dark ones. */
  tone?: PaperCardTone;
  /** Hard ink offset shadow ("sticker"): true = 8px, "sm" = 4px, "lg" = 12px. Default none. */
  sticker?: boolean | "sm" | "lg";
  /** Tilt in degrees (e.g. -2, 3). Desktop-preview / sticker cards only; keep reading surfaces straight. */
  tilt?: number;
  /** Inner padding: "md" (default, 24/20px phone, 32px sm+), "sm" (16-20px), "none". */
  padding?: "none" | "sm" | "md";
  /** Element to render. Default "div". Use "article" / "section" to keep existing landmarks + aria-* props. */
  as?: "div" | "section" | "article" | "aside" | "li";
  className?: string;
  children?: ReactNode;
}

/* tone -> data-field, so Buttons, Blob and field-aware text inside the card restyle themselves. */
const FIELD: Record<PaperCardTone, string> = {
  paper: "paper",
  sunken: "paper",
  ink: "ink",
  lemon: "lemon",
  cobalt: "cobalt",
};

const PADDING = { none: "", sm: "p-4 sm:p-5", md: "px-5 py-6 sm:p-8" } as const;
const SHADOW = { sm: "shadow-sticker-sm", md: "shadow-sticker", lg: "shadow-sticker-lg" } as const;

/** The 28px-radius card that sits on a colour field (feedback card, plan card, chat card...). */
export function PaperCard({
  tone = "paper",
  sticker = false,
  tilt,
  padding = "md",
  as: Tag = "div",
  className,
  children,
  style,
  ...rest
}: PaperCardProps) {
  return (
    <Tag
      data-field={FIELD[tone]}
      className={cx(
        "rounded-card",
        tone === "sunken" && "bg-sunken",
        PADDING[padding],
        sticker && SHADOW[sticker === true ? "md" : sticker],
        className,
      )}
      style={tilt ? { ...style, transform: `rotate(${tilt}deg)` } : style}
      {...rest}
    >
      {children}
    </Tag>
  );
}
