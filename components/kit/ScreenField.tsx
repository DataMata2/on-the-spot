import type { HTMLAttributes, ReactNode } from "react";
import { cx } from "./cx";

export type FieldName = "paper" | "tomato" | "night" | "cobalt" | "pink" | "lemon" | "ink";

export interface ScreenFieldProps extends Omit<HTMLAttributes<HTMLElement>, "className" | "children"> {
  /** The screen's colour. Sets the --field-* variables (data-field) for everything inside. */
  field: FieldName;
  /**
   * Night-field spotlight: true = warm cone from above (drill intro/question/think), "rec" = tomato glow from
   * below (recording). Static under reduced motion. Works on any field but is designed for night.
   */
  spotlight?: boolean | "rec";
  /**
   * This field colours the site header and <body> (default true). Exactly one field per page should claim the
   * header; pass false for any extra field sections further down the page.
   */
  claimsHeader?: boolean;
  /** Element to render. Default "section". */
  as?: "section" | "div";
  /**
   * Wrap children in the standard content column (max-w-[1200px], centred). Default true. Pass false to lay out
   * full-bleed children yourself (keep the 20px gutter: px-5).
   */
  contained?: boolean;
  /** Classes for the full-bleed field (padding, min-height, flex-1...). */
  className?: string;
  /** Classes for the inner content column (only when contained). */
  innerClassName?: string;
  /** Absolutely positioned decorations (circles, stripe band). Rendered behind the content, clipped to the field. */
  deco?: ReactNode;
  children?: ReactNode;
}

/**
 * A full-bleed screen section painted in one field colour. The header above it takes the same colour
 * automatically (see "Screen fields" in app/globals.css). Gutters: 20px phone, 32px sm, 48px lg.
 */
export function ScreenField({
  field,
  spotlight = false,
  claimsHeader = true,
  as: Tag = "section",
  contained = true,
  className,
  innerClassName,
  deco,
  children,
  ...rest
}: ScreenFieldProps) {
  return (
    <Tag
      data-field={field}
      data-header-field={claimsHeader ? field : undefined}
      className={cx(
        "relative isolate w-full overflow-hidden px-5 sm:px-8 lg:px-12",
        spotlight && "spotlight",
        spotlight === "rec" && "spotlight-rec",
        className,
      )}
      {...rest}
    >
      {deco && (
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
          {deco}
        </div>
      )}
      {contained ? <div className={cx("relative mx-auto w-full max-w-[1200px]", innerClassName)}>{children}</div> : children}
    </Tag>
  );
}
