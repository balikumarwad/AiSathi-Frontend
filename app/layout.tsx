import type { Metadata } from "next";
import { Bebas_Neue, Geist_Mono, Give_You_Glory, Inter } from "next/font/google";
import "./globals.css";

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
  title: "AIsathi — Any AI model. Pay in NPR.",
  description:
    "AIsathi: one API for hundreds of AI models. Top up with eSewa, Khalti or card. Built for Nepal.",
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
      </body>
    </html>
  );
}
