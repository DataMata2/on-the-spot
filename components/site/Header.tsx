import Link from "next/link";
import { Wordmark } from "./Wordmark";

const LINKS = [
  { href: "/drill", label: "Practice" },
  // Hidden on narrow phones so the nav fits; /progress links to it too.
  { href: "/rehearse", label: "Rehearse", narrow: "max-sm:hidden" },
  { href: "/progress", label: "Progress" },
  { href: "/pricing", label: "Pricing" },
] as const;

export interface HeaderProps {
  /** Show the "Pro" badge. Read it on the server (isProRequest) and pass it in, or use <SiteHeader />. */
  pro?: boolean;
}

/** Site header: wordmark, Practice / Progress / Pricing, and a Pro badge for Pro guests. No hooks; usable anywhere. */
export function Header({ pro = false }: HeaderProps) {
  return (
    <header className="border-b border-line/70 bg-paper/90 backdrop-blur-sm">
      <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between gap-3 px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-2">
          <Link href="/" aria-label="On the Spot home" className="-mx-1 rounded-sm px-1 py-1">
            <Wordmark markClassName="max-[400px]:hidden" />
          </Link>
          {pro && (
            <span className="rounded-full bg-accent px-2 py-0.5 text-[0.6875rem] leading-4 font-bold tracking-wide text-white uppercase">
              Pro
            </span>
          )}
        </div>
        <nav aria-label="Main" className="-mr-2 flex items-center">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`rounded-md px-2 py-1.5 text-sm font-medium text-ink-2 transition-colors hover:bg-sunken hover:text-ink sm:px-3 ${"narrow" in l ? l.narrow : ""}`}
            >
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
