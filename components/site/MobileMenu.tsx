"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

export interface MobileMenuLink {
  href: string;
  label: string;
}

/**
 * The narrow-screen menu (below `sm`). A <details>/<summary>, so it opens and its links work before
 * hydration; once hydrated it also closes on navigation, Escape and a tap outside.
 */
export function MobileMenu({ links }: { links: readonly MobileMenuLink[] }) {
  const ref = useRef<HTMLDetailsElement>(null);
  const pathname = usePathname();

  // Close after a navigation.
  useEffect(() => {
    if (ref.current) ref.current.open = false;
  }, [pathname]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const summary = el.querySelector("summary");
    const close = (focusSummary: boolean) => {
      if (!el.open) return;
      el.open = false;
      if (focusSummary) summary?.focus();
    };
    // Mirror the open state on the summary (browsers also expose it natively, which covers pre-hydration).
    const sync = () => summary?.setAttribute("aria-expanded", String(el.open));
    sync();
    el.addEventListener("toggle", sync);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close(el.contains(document.activeElement));
    };
    const onPointer = (e: PointerEvent) => {
      if (!el.contains(e.target as Node)) close(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      el.removeEventListener("toggle", sync);
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, []);

  return (
    <details ref={ref} className="group relative sm:hidden">
      <summary
        aria-label="Menu"
        className="-mr-2 flex size-11 cursor-pointer list-none items-center justify-center rounded-pill text-field-fg hover:bg-field-tint group-open:bg-field-tint [&::-webkit-details-marker]:hidden"
      >
        <svg viewBox="0 0 20 20" aria-hidden className="size-5 group-open:hidden">
          <path d="M3 5.5h14M3 10h14M3 14.5h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <svg viewBox="0 0 20 20" aria-hidden className="hidden size-5 group-open:block">
          <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </summary>
      <nav
        aria-label="Main"
        className="absolute top-full right-0 z-50 mt-2 flex w-56 flex-col overflow-hidden rounded-chip border-2 border-ink bg-paper py-1.5 text-ink shadow-sticker-sm [--field-ring:var(--color-cobalt)]"
      >
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            aria-current={pathname === l.href ? "page" : undefined}
            onClick={() => {
              if (ref.current) ref.current.open = false;
            }}
            className="flex min-h-11 items-center px-5 text-base font-semibold text-ink underline-offset-4 hover:bg-sunken aria-[current=page]:underline aria-[current=page]:decoration-2"
          >
            {l.label}
          </Link>
        ))}
      </nav>
    </details>
  );
}
