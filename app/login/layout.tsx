import type { Metadata } from "next";

/**
 * Nothing here to rank for, and a sign-in page competing with the homepage in
 * search helps nobody. Out of the sitemap and explicitly noindex — robots.ts
 * does not disallow /login, because blocking it would also stop Google seeing
 * this directive.
 */
export const metadata: Metadata = {
  title: "Sign in | AIsathi",
  robots: { index: false, follow: true },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
