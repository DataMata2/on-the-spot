import type { Metadata } from "next";
import Link from "next/link";
import { buttonClasses } from "@/components/kit/Button";
import { Footer } from "@/components/site";
import { SiteHeader } from "@/components/site/SiteHeader";

export const metadata: Metadata = {
  title: "Page not found — On the Spot",
};

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center gap-4 px-4 py-16 text-center sm:px-6">
        <p className="text-sm font-semibold text-accent">404</p>
        <h1 className="text-2xl font-bold tracking-[-0.02em] text-ink sm:text-3xl">This page doesn&apos;t exist</h1>
        <p className="text-base text-ink-2">The link may be old or mistyped.</p>
        <div className="mt-2 flex flex-wrap justify-center gap-3">
          <Link href="/drill" className={buttonClasses({})}>
            Practice
          </Link>
          <Link href="/" className={buttonClasses({ variant: "secondary" })}>
            Home
          </Link>
        </div>
      </main>
      <Footer />
    </>
  );
}
