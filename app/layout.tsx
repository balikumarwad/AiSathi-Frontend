import type { Metadata } from "next";
import Script from "next/script";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Geist_Mono, Inter, Mukta } from "next/font/google";
import "./globals.css";

// Microsoft Clarity project id (public analytics tag — ships to the browser).
const CLARITY_ID = "xijrot3a41";

// AIsathi design system typography. Three families, not four:
//
//   Inter  - all Latin UI text. Headings get their weight from Inter 700 with
//            tight tracking rather than from a separate display face.
//   Mukta  - all Devanagari. Drawn by Ek Type to pair with Latin at matching
//            weights, so mixed lines like "रू499" sit on one baseline.
//   Geist  - code, API keys, token counts, prices.
//
// Removed: Bebas Neue (condensed poster face, reads as event flyer) and
// Give You Glory (handwriting, on pages that take payment details).
//
// Why Mukta matters: every face here was previously loaded subsets:["latin"],
// so NONE contained a Devanagari glyph. Every "रू" price, the hero "रुपैयाँ"
// and the whole Nepali interface fell back to whatever the visitor's OS
// happened to supply - different on Windows, Android and iOS, missing on some.
// Mukta is listed after Inter in the body stack, so the browser reaches it
// per-glyph for Devanagari while Latin stays in Inter.
const body = Inter({
  variable: "--font-body",
  subsets: ["latin"],
});

const nepali = Mukta({
  variable: "--font-np",
  subsets: ["devanagari", "latin"],
  weight: ["400", "500", "600", "700"],
});

const mono = Geist_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://aisathi.io"),
  title: "AIsathi — Any AI model. Pay in NPR.",
  description:
    "Chat with and build on hundreds of AI models — GPT, Claude, Gemini. Top up with eSewa, Khalti or card. Free models to start. Built for Nepal.",
  openGraph: {
    title: "AIsathi — Any AI model. Pay in NPR.",
    description:
      "Hundreds of AI models behind one login. Pay in rupees with eSewa, Khalti, or card — free models to start.",
    url: "https://aisathi.io",
    siteName: "AIsathi",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "AIsathi — any AI model, pay in rupees" }],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "AIsathi — Any AI model. Pay in NPR.",
    description: "Hundreds of AI models behind one login. Pay in rupees — free models to start.",
    images: ["/og.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${body.variable} ${nepali.variable} ${mono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        {/* Microsoft Clarity — session recordings + heatmaps (audit item). */}
        <Script id="ms-clarity" strategy="afterInteractive">
          {`(function(c,l,a,r,i,t,y){
              c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
              t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
              y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
            })(window, document, "clarity", "script", "${CLARITY_ID}");`}
        </Script>
        {/* Vercel Pro: first-party visitor analytics + real-user Core Web Vitals. */}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
