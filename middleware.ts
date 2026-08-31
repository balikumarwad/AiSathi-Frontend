import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Force the canonical domain. The app is reachable at both aisathi.io and the
 * raw *.vercel.app deployment domains; serving the same content on two hosts
 * splits SEO and lets Google index the Vercel URL instead of aisathi.io. This
 * permanently redirects any *.vercel.app request to aisathi.io so Google only
 * ever sees — and only ever shows — the real domain.
 *
 * Production only. Preview deployments live on *.vercel.app by design, so
 * redirecting them sent every pull-request preview to production instead —
 * which made previews impossible to review. Worse, the redirect is a 308, so
 * a browser that followed it once kept doing so from cache. VERCEL_ENV is
 * "production" | "preview" | "development" and is set by Vercel at build time.
 */
export function middleware(req: NextRequest) {
  const host = req.headers.get("host") ?? "";
  if (process.env.VERCEL_ENV === "production" && host.endsWith(".vercel.app")) {
    const url = new URL(req.url);
    url.protocol = "https:";
    url.host = "aisathi.io";
    url.port = "";
    return NextResponse.redirect(url, 308);
  }
  return NextResponse.next();
}

export const config = {
  // Run on everything except Next's static assets and the icons.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|og.png).*)"],
};
