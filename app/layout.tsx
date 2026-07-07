import type { Metadata } from "next";
import Script from "next/script";
import { Bebas_Neue, Geist_Mono, Give_You_Glory, Inter } from "next/font/google";
import "./globals.css";

// Microsoft Clarity project id (public analytics tag — ships to the browser).
const CLARITY_ID = "xijrot3a41";

// AIsathi design system typography: Bebas Neue for display (tall condensed
// headlines), Inter for body, Give You Glory for the handwritten script
// accents, Geist Mono for code. Self-hosted at build time via next/font.
const display = Bebas_Neue({
  variable: "--font-display",
  subsets: ["latin"],
  weight: "400",
});

const body = Inter({
  variable: "--font-body",
  subsets: ["latin"],
});

const script = Give_You_Glory({
  variable: "--font-script",
  subsets: ["latin"],
  weight: "400",
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
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "AIsathi — the rhino galloping past the rising sun" }],
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
      className={`${display.variable} ${body.variable} ${script.variable} ${mono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-[family-name:var(--font-body)]">
        {children}
        {/* Microsoft Clarity — session recordings + heatmaps (audit item). */}
        <Script id="ms-clarity" strategy="afterInteractive">
          {`(function(c,l,a,r,i,t,y){
              c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
              t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
              y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
            })(window, document, "clarity", "script", "${CLARITY_ID}");`}
        </Script>
      </body>
    </html>
  );
}
