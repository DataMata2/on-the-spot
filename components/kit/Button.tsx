import Link from "next/link";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";
import { cx } from "./cx";

/**
 * primary   — the field's CTA pill: ink pill on light fields (paper/tomato/pink/lemon), paper pill on dark
 *             fields (night/cobalt/ink). Follows the nearest [data-field] automatically.
 * secondary — outline pill (2px inset ring in the field's text colour), transparent fill.
 * ghost     — text-only pill, faint field tint on hover / a soft chip on dark fields.
 * ink / paper / lemon — fixed-colour pills when the field's default is wrong for the spot
 *             (e.g. `lemon` for the big "Try again" on the cobalt feedback field).
 */
export type ButtonVariant = "primary" | "secondary" | "ghost" | "ink" | "paper" | "lemon";
export type ButtonSize = "sm" | "md" | "lg";

interface CommonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Stretch to the container width (handy for stacked mobile CTAs). */
  fullWidth?: boolean;
  className?: string;
  children: ReactNode;
}

/** With `href`, renders a Next.js link styled as a button. */
export type ButtonLinkProps = CommonProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href" | "className" | "children"> & { href: string };

/** Without `href`, renders a <button> (type="button" unless set). */
export type ButtonButtonProps = CommonProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children"> & { href?: undefined };

export type ButtonProps = ButtonLinkProps | ButtonButtonProps;

const base =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-pill font-semibold select-none " +
  "transition-[background-color,box-shadow,color,transform,filter] duration-150 ease-out-soft " +
  "active:translate-y-px disabled:pointer-events-none disabled:opacity-45 aria-disabled:pointer-events-none aria-disabled:opacity-45";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-field-cta text-field-cta-fg hover:opacity-90",
  secondary: "bg-transparent text-field-fg shadow-[inset_0_0_0_2px_var(--field-line)] hover:bg-field-tint",
  ghost: "bg-transparent text-field-fg hover:bg-field-tint",
  ink: "bg-ink text-paper hover:opacity-90",
  paper: "bg-paper text-ink hover:brightness-95",
  lemon: "bg-lemon text-ink hover:brightness-105",
};

const sizes: Record<ButtonSize, string> = {
  sm: "min-h-9 px-4 text-sm max-sm:min-h-11",
  md: "min-h-11 px-5 text-[0.9375rem]",
  lg: "min-h-14 px-7 text-base sm:text-[1.0625rem]",
};

/** The button look for elements Button can't render, e.g. a plain <a download> to a route handler. */
export function buttonClasses({
  variant = "primary",
  size = "md",
  fullWidth = false,
  className,
}: Pick<CommonProps, "variant" | "size" | "fullWidth" | "className"> = {}): string {
  return cx(base, variants[variant], sizes[size], fullWidth && "w-full", className);
}

/** Field-aware pill button (see ButtonVariant) in three sizes; a link when `href` is given. */
export function Button(props: ButtonProps) {
  const { variant = "primary", size = "md", fullWidth = false, className, children } = props;
  const classes = buttonClasses({ variant, size, fullWidth, className });

  if (props.href !== undefined) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { variant: _v, size: _s, fullWidth: _f, className: _c, children: _ch, href, ...rest } = props;
    return (
      <Link href={href} className={classes} {...rest}>
        {children}
      </Link>
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { variant: _v, size: _s, fullWidth: _f, className: _c, children: _ch, href: _h, type = "button", ...rest } = props;
  return (
    <button type={type} className={classes} {...rest}>
      {children}
    </button>
  );
}
