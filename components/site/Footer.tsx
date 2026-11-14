import Link from "next/link";
import { Wordmark } from "./Wordmark";

export function Footer() {
  return (
    <footer data-field="ink" className="mt-auto">
      <div className="mx-auto flex w-full max-w-[1296px] flex-col gap-5 px-5 py-8 text-sm text-field-muted sm:flex-row sm:items-start sm:justify-between sm:px-8 sm:py-10 lg:px-12">
        <div className="flex flex-col gap-2.5">
          <Wordmark className="text-field-fg lg:text-[1.3125rem]" />
          <p className="max-w-md">
            Short spoken drills for the moments English at work goes quiet. We never score your accent: only whether
            your answer landed.
          </p>
        </div>
        <nav aria-label="Footer" className="flex flex-wrap gap-x-4 gap-y-2 max-sm:-my-3 max-sm:gap-y-0 sm:justify-end">
          <Link href="/drill" className="inline-flex min-w-11 items-center justify-center underline-offset-4 hover:text-field-fg hover:underline max-sm:min-h-11">
            Practice
          </Link>
          <Link href="/clarify" className="inline-flex min-w-11 items-center justify-center underline-offset-4 hover:text-field-fg hover:underline max-sm:min-h-11">
            Clarify
          </Link>
          <Link href="/rehearse" className="inline-flex min-w-11 items-center justify-center underline-offset-4 hover:text-field-fg hover:underline max-sm:min-h-11">
            Rehearse
          </Link>
          <Link href="/progress" className="inline-flex min-w-11 items-center justify-center underline-offset-4 hover:text-field-fg hover:underline max-sm:min-h-11">
            Progress
          </Link>
          <Link href="/pricing" className="inline-flex min-w-11 items-center justify-center underline-offset-4 hover:text-field-fg hover:underline max-sm:min-h-11">
            Pricing
          </Link>
        </nav>
      </div>
    </footer>
  );
}
