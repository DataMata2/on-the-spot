import Link from "next/link";
import { MobileMenu } from "./MobileMenu";
import { Wordmark } from "./Wordmark";

const LINKS = [
  { href: "/drill", label: "Practice" },
  { href: "/clarify", label: "Clarify" },
  { href: "/rehearse", label: "Rehearse" },
  { href: "/progress", label: "Progress" },
  { href: "/pricing", label: "Pricing" },
] as const;

export interface HeaderProps {
  /** Show the "Pro" badge. Read it on the server (isProRequest) and pass it in, or use <SiteHeader />. */
  pro?: boolean;
}

/**
 * Site header: wordmark, Practice / Clarify / Rehearse / Progress / Pricing, and a Pro badge for Pro guests.
 * Below `sm` the links move into a menu button (MobileMenu). No hooks here; usable anywhere.
 * Colours come from the page's screen field (bg-field / text-field-fg): the page's <ScreenField> marks itself
 * data-header-field and globals.css copies that field's variables onto this header via header:has(+ main ...),
 * so a page must render the header immediately before its <main>. Paper when no field claims it.
 */
export function Header({ pro = false }: HeaderProps) {
  return (
    <header className="relative z-20 bg-field text-field-fg">
      <div className="mx-auto flex h-16 w-full max-w-[1296px] items-center justify-between gap-3 px-5 sm:px-8 lg:h-20 lg:px-12">
        <div className="flex min-w-0 items-center gap-2.5">
          <Link href="/" aria-label="On the Spot home" className="-mx-1 rounded-md px-1 py-1 max-sm:inline-flex max-sm:min-h-11 max-sm:items-center">
            <Wordmark className="max-[359px]:text-[1.1875rem]" />
          </Link>
          {pro && (
            <span className="type-label shrink-0 rounded-pill bg-field-mark px-2.5 py-1 text-[0.6875rem] leading-4 text-field-face">
              Pro
            </span>
          )}
        </div>
        <nav aria-label="Main" className="-mr-3 flex items-center max-sm:hidden lg:gap-1">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-pill px-3 py-2 text-[0.9375rem] font-medium text-field-fg underline-offset-4 transition-colors hover:bg-field-tint hover:underline"
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <MobileMenu links={LINKS} />
      </div>
    </header>
  );
}
