/**
 * The model catalogue — server-rendered.
 *
 * This is the page with the most to gain from search: 450-odd model names,
 * each with a rupee price, is exactly the long tail people type ("claude
 * sonnet price nepal", "gpt api npr"). It used to be a client component that
 * fetched on mount, so the HTML a crawler received was 21 KB with no model in
 * it — not one name, not one price — and it inherited the homepage <title>.
 *
 * Now the list is fetched on the server and handed to the table as its initial
 * state, so the markup contains the models and the page still filters and
 * searches instantly on the client.
 *
 * ISR rather than per-request: the catalogue changes a few times a week, and
 * making every visitor wait on an upstream call to see a price list would be a
 * poor trade.
 */

import type { Metadata } from "next";

import Nav from "@/components/Nav";
import { publicCatalogue, type PublicModel } from "@/lib/catalog-server";

import ModelsTable from "./ModelsTable";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "AI model prices in NPR — GPT, Claude, Gemini, Llama | AIsathi",
  description:
    "Every AI model AIsathi serves, priced in Nepali Rupees per million tokens. GPT, Claude, Gemini, Llama, DeepSeek and more — FX and margin already included. Free models to start.",
  alternates: { canonical: "/models" },
  openGraph: {
    title: "AI model prices in NPR — GPT, Claude, Gemini, Llama",
    description:
      "Every model we serve, priced in rupees per million tokens. No FX surprises.",
    url: "/models",
  },
};

export default async function ModelsPage() {
  // A missing upstream key at build time must not fail the build or blank the
  // page: the table falls back to fetching on the client.
  let initial: PublicModel[] = [];
  try {
    initial = await publicCatalogue();
  } catch {
    initial = [];
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--surface-page)", color: "var(--text-strong)" }}>
      <Nav />
      <ModelsTable initial={initial} />
      <footer
        className="p-6 text-center text-xs"
        style={{ color: "var(--text-faint)", borderTop: "1px solid var(--border-hairline)" }}
      >
        AIsathi · <span lang="ne">तपाईंको AI साथी</span> · aisathi.io
      </footer>
    </div>
  );
}
