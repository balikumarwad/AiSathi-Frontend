import type { Metadata } from "next";
import Nav from "@/components/Nav";

export const metadata: Metadata = {
  title: "Terms of Service — AIsathi",
  description: "AIsathi terms: credits, refunds, acceptable use, and availability.",
};

export default function Terms() {
  return (
    <div className="min-h-screen bg-black text-zinc-100">
      <Nav />
      <main id="main-content" tabIndex={-1} className="mx-auto max-w-3xl px-6 py-14">
        <h1 className="font-[family-name:var(--font-display)] text-4xl font-bold">Terms of Service</h1>
        <p className="mt-2 text-sm text-zinc-500">Last updated: July 2026 · Short and readable on purpose.</p>

        <div className="mt-10 space-y-8 text-[15px] leading-relaxed text-zinc-300">
          <section>
            <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold text-zinc-100">The service</h2>
            <p className="mt-3 text-zinc-400">
              AIsathi gives you access to third-party AI models through one account, billed in Nepali rupees. AI output can be
              wrong, biased, or incomplete — verify anything important before acting on it. You own your inputs and, to the
              extent permitted by the underlying model providers, the outputs you generate.
            </p>
          </section>

          <section>
            <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold text-zinc-100">Credits & refunds</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-zinc-400">
              <li>Credits are prepaid, non-transferable, and consumed per token at the prices shown on the models page at the time of the request.</li>
              <li>If a top-up fails or double-charges, contact us — we'll credit or refund it once verified with the payment gateway.</li>
              <li>For unused credits, contact us within 7 days of purchase and we'll arrange a refund minus gateway fees.</li>
            </ul>
          </section>

          <section>
            <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold text-zinc-100">Acceptable use</h2>
            <p className="mt-3 text-zinc-400">
              Don't use AIsathi for anything illegal, to harm others, to generate spam or malware, or to attempt to bypass rate
              limits and billing. Model providers apply their own content policies. We may suspend accounts that abuse the
              platform; unused legitimate credits are refunded if we do.
            </p>
          </section>

          <section>
            <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold text-zinc-100">Availability</h2>
            <p className="mt-3 text-zinc-400">
              We aim for continuous availability, but the service depends on upstream model providers and is provided "as is"
              without uptime guarantees. Free models are best-effort by nature. Our liability is limited to the amount of unused
              credits in your account.
            </p>
          </section>

          <section>
            <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold text-zinc-100">Changes</h2>
            <p className="mt-3 text-zinc-400">
              We may update these terms; significant changes will be announced by email or on the site. Continued use after a
              change means you accept it.
            </p>
          </section>

          <section>
            <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold text-zinc-100">Contact</h2>
            <p className="mt-3 text-zinc-400">
              AIsathi is operated from Kathmandu, Nepal. Reach us at{" "}
              <a href="mailto:neupaneoscar143@gmail.com" className="text-[var(--primary)] underline underline-offset-2">our contact email</a>.
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
