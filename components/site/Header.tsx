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
 */
export function Header({ pro = false }: HeaderProps) {
  return (
    <header className="border-b border-line/70 bg-paper/90 backdrop-blur-sm">
      <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between gap-3 px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-2">
          <Link href="/" aria-label="On the Spot home" className="-mx-1 rounded-sm px-1 py-1 max-sm:inline-flex max-sm:min-h-11 max-sm:items-center">
            <Wordmark className="whitespace-nowrap max-[374px]:text-[0.9375rem]" markClassName="max-[400px]:hidden" />
          </Link>
          {pro && (
            <span className="shrink-0 rounded-full bg-accent px-2 py-0.5 text-[0.6875rem] leading-4 font-bold tracking-wide text-white uppercase">
              Pro
            </span>
          )}
        </div>
        <nav aria-label="Main" className="-mr-2 flex items-center max-sm:hidden">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-md px-2 py-1.5 text-sm font-medium text-ink-2 transition-colors hover:bg-sunken hover:text-ink sm:px-3"
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
