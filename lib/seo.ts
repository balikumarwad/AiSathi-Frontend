/**
 * Structured data.
 *
 * The site had none — zero JSON-LD on any page — while already containing
 * everything the vocabulary wants: a company, a product, real prices and a
 * genuine FAQ section. Marking them up is the cheapest search work available,
 * because it describes what is already on the page rather than adding copy.
 *
 * One rule throughout: nothing here may claim something the page does not say.
 * Structured data that overstates is worse than none — it is the kind of thing
 * that earns a manual action, and every figure below is taken from the same
 * constants the page renders.
 */

export const SITE = "https://aisathi.io";

type Json = Record<string, unknown>;

export function organizationLd(): Json {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "AIsathi",
    legalName: "Olin Group Pvt. Ltd.",
    url: SITE,
    logo: `${SITE}/mark.svg`,
    description:
      "One login for hundreds of AI models, billed in Nepali Rupees. Top up with eSewa, Khalti or card.",
    address: {
      "@type": "PostalAddress",
      addressLocality: "Kathmandu",
      addressCountry: "NP",
    },
  };
}

export function websiteLd(): Json {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "AIsathi",
    url: SITE,
    inLanguage: ["en", "ne"],
  };
}

/** Built from the same FAQ array the page renders, so the two cannot diverge. */
export function faqLd(items: readonly (readonly [string, string])[]): Json {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map(([question, answer]) => ({
      "@type": "Question",
      name: question,
      acceptedAnswer: { "@type": "Answer", text: answer },
    })),
  };
}

/**
 * The credit packages, as offers. Priced in NPR because that is the whole
 * point of the product; a price in any other currency here would be a lie.
 */
export function offersLd(
  plans: readonly { name: string; npr: number; description: string }[],
): Json {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: "AIsathi credits",
    description:
      "Prepaid credits for hundreds of AI models through one OpenAI-compatible API, billed in Nepali Rupees.",
    brand: { "@type": "Brand", name: "AIsathi" },
    offers: plans.map((p) => ({
      "@type": "Offer",
      name: p.name,
      price: p.npr,
      priceCurrency: "NPR",
      description: p.description,
      url: `${SITE}/topup`,
      availability: "https://schema.org/InStock",
    })),
  };
}

/** Renders a block. JSON.stringify, never a template literal — a quote or a
 *  newline in any of the copy above would otherwise break out of the script. */
export function ldScript(data: Json) {
  return {
    type: "application/ld+json",
    dangerouslySetInnerHTML: { __html: JSON.stringify(data) },
  };
}
