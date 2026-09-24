import type { Metadata } from "next";

/**
 * The playground is a client component, so it cannot export metadata itself.
 * Without this it inherited the homepage title — two pages in the sitemap
 * claiming to be the same document.
 */
export const metadata: Metadata = {
  title: "AI playground — chat with GPT, Claude and Gemini in NPR | AIsathi",
  description:
    "Chat with hundreds of AI models in one place. Free models to start, no card needed. Pay in Nepali Rupees with eSewa or Khalti.",
  alternates: { canonical: "/playground" },
};

export default function PlaygroundLayout({ children }: { children: React.ReactNode }) {
  return children;
}
