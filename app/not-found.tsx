import type { Metadata } from "next";
import Link from "next/link";
import { Blob, ScreenField } from "@/components/kit";
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
      <main className="flex flex-1 flex-col">
        <ScreenField
          field="tomato"
          className="flex-1 pt-6 pb-24 sm:pt-12 lg:pb-32"
          deco={
            <>
              <div className="absolute -right-32 -bottom-36 size-[300px] rounded-full bg-lemon lg:-right-44 lg:-bottom-72 lg:size-[520px]" />
              <div className="stripe-band absolute inset-x-0 bottom-0 h-[22px] text-ink lg:h-7" />
            </>
          }
        >
          <div className="flex max-w-2xl flex-col items-start">
            <p className="type-display flex items-end text-[clamp(112px,40vw,240px)] leading-[0.9] text-ink">
              404
              <Blob state="thinking" size="0.36em" face="var(--color-paper)" className="mb-[0.06em] ml-[0.08em]" />
            </p>
            <h1 className="type-display mt-6 text-[clamp(34px,10vw,64px)] leading-[0.98] text-ink">This page doesn&apos;t exist</h1>
            <p className="mt-3 text-lg text-ink">The link may be old or mistyped.</p>
            <div className="mt-8 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
              <Link href="/drill" className={buttonClasses({ size: "lg" })}>
                Practice
              </Link>
              <Link href="/" className={buttonClasses({ variant: "secondary", size: "lg" })}>
                Home
              </Link>
            </div>
          </div>
        </ScreenField>
      </main>
      <Footer />
    </>
  );
}
