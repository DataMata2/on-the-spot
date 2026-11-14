import Link from "next/link";
import { Wordmark } from "./Wordmark";

export function Footer() {
  return (
    <footer className="mt-auto border-t border-line">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-8 text-sm text-ink-2 sm:flex-row sm:items-start sm:justify-between sm:px-6">
        <div className="flex flex-col gap-2">
          <Wordmark className="text-base" />
          <p className="max-w-md">
            Short spoken drills for the moments English at work goes quiet. We never score your accent: only whether
            your answer landed.
          </p>
        </div>
        <nav aria-label="Footer" className="flex flex-wrap gap-x-4 gap-y-2 max-sm:-my-3 max-sm:gap-y-0 sm:justify-end">
          <Link href="/drill" className="inline-flex items-center hover:text-ink max-sm:min-h-11">
            Practice
          </Link>
          <Link href="/clarify" className="inline-flex items-center hover:text-ink max-sm:min-h-11">
            Clarify
          </Link>
          <Link href="/rehearse" className="inline-flex items-center hover:text-ink max-sm:min-h-11">
            Rehearse
          </Link>
          <Link href="/progress" className="inline-flex items-center hover:text-ink max-sm:min-h-11">
            Progress
          </Link>
          <Link href="/pricing" className="inline-flex items-center hover:text-ink max-sm:min-h-11">
            Pricing
          </Link>
        </nav>
      </div>
    </footer>
  );
}
