import type { Metadata } from "next";

/**
 * A payment screen behind a login. robots.ts already disallows /topup; this
 * makes the intent explicit in the page itself, so a link from elsewhere
 * cannot pull it into the index.
 */
export const metadata: Metadata = {
  title: "Top up credits | AIsathi",
  robots: { index: false, follow: false },
};

export default function TopupLayout({ children }: { children: React.ReactNode }) {
  return children;
}
