import { Suspense } from "react";
import { isProRequest } from "@/lib/pro";
import { Header } from "./Header";

async function HeaderWithPro() {
  return <Header pro={await isProRequest()} />;
}

/**
 * Server component: the Header with the Pro badge read from the verified cookie. The cookie read sits in
 * its own Suspense boundary, so pages that use it still prerender (Cache Components).
 */
export function SiteHeader() {
  return (
    <Suspense fallback={<Header />}>
      <HeaderWithPro />
    </Suspense>
  );
}
