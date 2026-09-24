import type { ReactNode } from "react";
import Link from "next/link";
import { Brain, Check, MapPin, Palette, Plug, Receipt, Rocket, Zap } from "lucide-react";
import Nav from "@/components/Nav";
import CopyButton from "@/components/CopyButton";

const CURL = `curl https://aisathi.io/api/v1/chat/completions \\
  -H "Authorization: Bearer np-your-key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "openai/gpt-4o-mini",
    "messages": [{"role": "user", "content": "नमस्ते!"}]
  }'`;

const MODELS = [
  "GPT-5.2", "Claude Sonnet 5", "Gemini 3 Flash", "Llama 4", "DeepSeek V3.2", "Claude Haiku 4.5",
];

/* Honest signals only — no invented user counts (audit item 1). */
const TRUST: [ReactNode, string][] = [
  ["340+", "live models"],
  [<><span lang="ne">रू</span>0</>, "to start — free models"],
  ["eSewa · Khalti · card", "local payments"],
  [<MapPin key="np" size={22} className="mx-auto" aria-hidden />, "built in Nepal"],
];

const COMPARISON: [string, string, string][] = [
  ["Payment", "eSewa, Khalti, or any card — in NPR", "USD credit card only"],
  ["Accounts", "One login for every model", "Separate account per provider"],
  ["Models", "GPT, Claude, Gemini, Llama + 340 more", "One vendor's models"],
  ["Starting cost", "Free models, no card needed", "$5+ minimum, card upfront"],
  ["Switching models", "Change one word in your request", "Rewrite your integration"],
];

const USE_CASES = [
  { icon: Zap, title: "Everyday questions", pick: "Fast", detail: <>Homework, translations, quick answers. From <span lang="ne">रू</span>44 per million tokens.</> },
  { icon: Brain, title: "Writing & coding", pick: "Smart", detail: "Claude Sonnet 5 — essays, documents, real programming help." },
  { icon: Rocket, title: "Hardest problems", pick: "Genius", detail: "Claude Fable 5 — deep reasoning for research and complex work." },
  { icon: Palette, title: "Images & documents", pick: "Create", detail: "Say \"make an image of…\" or \"write a cover letter\" — the playground routes it." },
];

const FAQ: [string, string][] = [
  [
    "Is AIsathi a real, working product?",
    "Yes. AIsathi is live — every chat message is metered and billed to the paisa through our credit ledger, and the playground, API, and dashboard all run on the same production gateway. Try a free model right now without paying anything.",
  ],
  [
    "How do payments work?",
    "You top up credits in Nepali rupees via Khalti or eSewa (or an international card via Stripe). Credits are spent per token at the NPR prices shown on the models page — no subscription required, no hidden FX fees.",
  ],
  [
    "What happens to my chats and prompts?",
    "Signed-in chats are stored in your account so they sync across devices — only you can read them. Prompts are passed to the model provider you chose to generate the answer. We never sell your data and never use your chats to train models. See our privacy policy.",
  ],
  [
    "What's free, exactly?",
    "26+ models are completely free to chat with after signup — no card, no top-up. Free models are best-effort (they can be busy at peak times). Paid models unlock when you add credits.",
  ],
  [
    "Which AI models do you support?",
    "340+ models through one gateway: OpenAI (GPT-5.x), Anthropic (Claude Fable, Sonnet, Haiku), Google (Gemini), Meta (Llama), DeepSeek, Mistral and more — including image-generation models. The models page shows live NPR prices for all of them.",
  ],
  [
    "Can I get a refund?",
    "If something went wrong with a top-up (double charge, failed credit), contact us and we'll fix it. For unused credits, write to us within 7 days of purchase and we'll work it out.",
  ],
  [
    "Are there rate limits?",
    "Yes — 60 requests per minute per API key, and free models have daily caps set upstream. If you hit a limit, the response tells you exactly how long to wait.",
  ],
  [
    "I'm a developer — is the API really OpenAI-compatible?",
    "Yes. Point any OpenAI SDK at https://aisathi.io/api/v1 with your np- key and your existing code works, including streaming. See the docs for copy-paste examples.",
  ],
];

export default function Home() {
  return (
    <div className="min-h-screen bg-black text-zinc-100">
      {/* ============ HERO ============ */}
      <section className="relative flex min-h-[100svh] flex-col overflow-hidden">
        {/* No hero media and no colour wash. On a light ground the type is
            the hero; the video, the aurora and the black scrim all existed to
            keep text readable over a dark image that is no longer there. */}

        <div className="relative z-10">
          <Nav />
        </div>

        <div className="relative z-10 mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center px-6 text-center 2xl:max-w-6xl">
          <p className="mb-6 rounded-full border border-zinc-700/60 bg-zinc-900/60 px-4 py-1.5 text-xs tracking-widest text-zinc-300 backdrop-blur">
            <span lang="ne">तपाईंको AI साथी</span> — YOUR AI COMPANION
          </p>
          <h1 className="font-[family-name:var(--font-display)] text-[2.75rem] font-bold leading-[1.05] sm:text-7xl md:text-8xl 2xl:text-[8.5rem]">
            Any AI model.
            <br />
            <span style={{ color: "var(--primary)" }}>
              Pay in <span lang="ne">रुपैयाँ</span>.
            </span>
          </h1>
          <p className="mt-8 max-w-2xl text-lg text-zinc-300 sm:text-xl 2xl:max-w-3xl 2xl:text-2xl">
            One login for hundreds of AI models — GPT, Claude, Gemini, Llama and more.
            Top up with eSewa, Khalti, or card. No USD card. No foreign billing.
          </p>

          {/* One dominant CTA; secondary de-emphasized (audit item 3) */}
          <div className="mt-10 flex flex-col items-center gap-4">
            <Link
              href="/playground"
              className="rounded-full bg-[var(--primary)] px-10 py-4 text-lg font-semibold text-white transition hover:bg-[var(--primary-hover)]"
            >
              Start free — no card needed →
            </Link>
            <Link href="/models" className="text-sm text-zinc-400 underline decoration-zinc-700 underline-offset-4 transition hover:text-zinc-200">
              or browse all 340+ models & prices
            </Link>
          </div>

          {/* Trust bar (audit item 1) */}
          <dl className="mt-12 flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
            {TRUST.map(([big, small]) => (
              <div key={small} className="text-center">
                <dt className="sr-only">{small}</dt>
                <dd className="font-[family-name:var(--font-display)] text-xl text-zinc-100">{big}</dd>
                <dd className="text-[11px] uppercase tracking-wider text-zinc-500">{small}</dd>
              </div>
            ))}
          </dl>
        </div>

        {/* Model ticker */}
        <div className="relative z-10 border-t border-zinc-800/60 bg-black/40 py-4 backdrop-blur">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-x-10 gap-y-2 px-6 text-sm text-zinc-500">
            {MODELS.map((m) => (
              <span key={m} className="font-[family-name:var(--font-display)] tracking-wide">{m}</span>
            ))}
          </div>
        </div>
      </section>

      {/* ============ VALUE PROPS ============ */}
      <section className="mx-auto max-w-6xl px-6 py-24">
        <h2 className="font-[family-name:var(--font-display)] text-center text-3xl font-bold sm:text-5xl">
          Built for Nepal. <span className="text-zinc-500">Open to the world.</span>
        </h2>
        <div className="mt-16 grid gap-6 sm:grid-cols-3">
          {([
            [MapPin, "Local payments", "Top up credits with eSewa or Khalti in seconds — or card via Stripe from anywhere."],
            [Receipt, "NPR pricing", "Transparent per-token prices in rupees. Start free. No FX surprises."],
            [Plug, "Drop-in API", "OpenAI-compatible. Point any SDK at our base URL — your code doesn't change."],
          ] as const).map(([Icon, title, body]) => (
            <div
              key={title}
              className="group rounded-2xl border border-zinc-800 bg-zinc-950 p-8 transition hover:border-zinc-600 hover:bg-zinc-900/60"
            >
              <Icon size={28} style={{ color: "var(--ev-red)" }} aria-hidden />
              <div className="mt-4 font-[family-name:var(--font-display)] text-xl font-semibold">{title}</div>
              <p className="mt-3 text-sm leading-relaxed text-zinc-400">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ============ PRICING (audit item 2) ============ */}
      <section id="pricing" className="mx-auto max-w-6xl px-6 pb-24">
        <h2 className="font-[family-name:var(--font-display)] text-center text-3xl font-bold sm:text-5xl">
          Simple, honest pricing
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-center text-zinc-400">
          Chat free forever, or get a credit package — cheaper than ChatGPT Go, paid in rupees.
        </p>
        <div className="mt-14 grid gap-6 sm:grid-cols-3">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-8">
            <div className="font-[family-name:var(--font-display)] text-lg text-zinc-400">Free</div>
            <div className="mt-2 font-[family-name:var(--font-display)] text-4xl font-bold"><span lang="ne">रू</span>0</div>
            <ul className="mt-6 space-y-2.5 text-sm text-zinc-400">
              <li className="flex items-start gap-2"><Check size={15} className="mt-0.5 flex-none" style={{ color: "var(--ev-red)" }} />26+ free models, 150 messages a day</li>
              <li className="flex items-start gap-2"><Check size={15} className="mt-0.5 flex-none" style={{ color: "var(--ev-red)" }} />Full playground — history, images in, voice</li>
              <li className="flex items-start gap-2"><Check size={15} className="mt-0.5 flex-none" style={{ color: "var(--ev-red)" }} />No card, no top-up required</li>
            </ul>
          </div>
          <div className="relative rounded-2xl border border-[var(--primary)]/40 bg-zinc-950 p-8 shadow-lg shadow-zinc-950/20">
            <div className="absolute -top-3 left-8 rounded-full bg-[var(--primary)] px-3 py-0.5 text-[11px] font-bold uppercase tracking-wider">Most popular</div>
            <div className="font-[family-name:var(--font-display)] text-lg text-zinc-400">Starter</div>
            <div className="mt-2 font-[family-name:var(--font-display)] text-4xl font-bold"><span lang="ne">रू</span>499</div>
            <div className="mt-1 text-sm font-semibold text-green-400">5,990 credits — 20% bonus</div>
            <ul className="mt-5 space-y-2.5 text-sm text-zinc-400">
              <li className="flex items-start gap-2"><Check size={15} className="mt-0.5 flex-none" style={{ color: "var(--ev-red)" }} />Every model — GPT, Claude, Gemini + images</li>
              <li className="flex items-start gap-2"><Check size={15} className="mt-0.5 flex-none" style={{ color: "var(--ev-red)" }} />~1,200 smart replies or 6,000 fast ones</li>
              <li className="flex items-start gap-2"><Check size={15} className="mt-0.5 flex-none" style={{ color: "var(--ev-red)" }} />Pay with Khalti, eSewa, or card</li>
            </ul>
            <Link href="/topup" className="mt-5 inline-block text-sm font-semibold text-[var(--primary)] hover:opacity-800">
              Get Starter →
            </Link>
          </div>
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-8">
            <div className="font-[family-name:var(--font-display)] text-lg text-zinc-400">Pro</div>
            <div className="mt-2 font-[family-name:var(--font-display)] text-4xl font-bold"><span lang="ne">रू</span>999</div>
            <div className="mt-1 text-sm font-semibold text-green-400">12,990 credits — 30% bonus</div>
            <ul className="mt-5 space-y-2.5 text-sm text-zinc-400">
              <li className="flex items-start gap-2"><Check size={15} className="mt-0.5 flex-none" style={{ color: "var(--ev-red)" }} />Everything in Starter, 2.2x the credits</li>
              <li className="flex items-start gap-2"><Check size={15} className="mt-0.5 flex-none" style={{ color: "var(--ev-red)" }} />Best value for daily Claude & GPT use</li>
              <li className="flex items-start gap-2"><Check size={15} className="mt-0.5 flex-none" style={{ color: "var(--ev-red)" }} />Credits never expire — use at your pace</li>
            </ul>
            <Link href="/topup" className="mt-5 inline-block text-sm font-semibold text-zinc-300 hover:text-white">
              Get Pro →
            </Link>
          </div>
        </div>
        <p className="mx-auto mt-6 max-w-xl text-center text-xs text-zinc-600">
          Need more? Top up any amount from <span lang="ne">रू</span>200. Developers get the same credits via the{" "}
          <Link href="/docs" className="underline hover:text-zinc-400">OpenAI-compatible API</Link>.
        </p>
      </section>

      {/* ============ WHY NOT GO DIRECT (audit item 5) ============ */}
      <section className="mx-auto max-w-4xl px-6 pb-24">
        <h2 className="font-[family-name:var(--font-display)] text-center text-3xl font-bold sm:text-5xl">
          Why not just use OpenAI directly?
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-center text-zinc-400">
          Fair question. If you have a USD credit card and only want one provider, go direct.
          Here's what AIsathi changes:
        </p>
        <div className="mt-12 overflow-x-auto rounded-2xl border border-zinc-800">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-950 text-left">
                <th className="px-5 py-4 font-medium text-zinc-500"></th>
                <th className="px-5 py-4 font-[family-name:var(--font-display)] text-base text-[var(--primary)]">AIsathi</th>
                <th className="px-5 py-4 font-[family-name:var(--font-display)] text-base text-zinc-500">Going direct</th>
              </tr>
            </thead>
            <tbody>
              {COMPARISON.map(([label, us, them]) => (
                <tr key={label} className="border-b border-zinc-900 last:border-0">
                  <td className="px-5 py-4 font-semibold text-zinc-300">{label}</td>
                  <td className="px-5 py-4 text-zinc-300">{us}</td>
                  <td className="px-5 py-4 text-zinc-500">{them}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ============ WHICH MODEL? (audit item 6) ============ */}
      <section className="mx-auto max-w-6xl px-6 pb-24">
        <h2 className="font-[family-name:var(--font-display)] text-center text-3xl font-bold sm:text-5xl">
          Which model should I use?
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-center text-zinc-400">
          Don't overthink it — the playground has these as one-click presets.
        </p>
        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {USE_CASES.map((u) => (
            <div key={u.title} className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6 transition hover:border-zinc-600">
              <u.icon size={28} style={{ color: "var(--ev-red)" }} aria-hidden />
              <div className="mt-3 font-[family-name:var(--font-display)] text-lg font-semibold">{u.title}</div>
              <div className="mt-1 text-xs font-bold uppercase tracking-wider text-[var(--primary)]">→ {u.pick}</div>
              <p className="mt-3 text-sm leading-relaxed text-zinc-400">{u.detail}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ============ CODE ============ */}
      <section className="mx-auto max-w-4xl px-6 pb-24">
        <h2 className="font-[family-name:var(--font-display)] text-sm font-medium uppercase tracking-[0.3em] text-zinc-500">
          One URL change and you&apos;re in
        </h2>
        <div className="relative mt-6">
          <CopyButton text={CURL} />
          <pre className="overflow-x-auto rounded-2xl border border-zinc-800 bg-zinc-950 p-6 font-[family-name:var(--font-mono)] text-sm leading-relaxed text-zinc-300 shadow-2xl shadow-red-950/20">
            {CURL}
          </pre>
        </div>
        <Link href="/docs" className="mt-4 inline-block text-sm font-semibold text-[var(--primary)] hover:opacity-800">
          Full API documentation →
        </Link>
      </section>

      {/* ============ FAQ (audit item 8) ============ */}
      <section className="mx-auto max-w-3xl px-6 pb-24">
        <h2 className="font-[family-name:var(--font-display)] text-center text-3xl font-bold sm:text-5xl">
          Questions, answered
        </h2>
        <div className="mt-12 space-y-3">
          {FAQ.map(([q, a]) => (
            <details key={q} className="group rounded-xl border border-zinc-800 bg-zinc-950 px-6 py-4 transition hover:border-zinc-700">
              <summary className="cursor-pointer list-none text-[15px] font-semibold text-zinc-200 marker:content-none">
                <span className="mr-2 inline-block text-zinc-400 transition-transform group-open:rotate-90">›</span>
                {q}
              </summary>
              <p className="mt-3 pl-5 text-sm leading-relaxed text-zinc-400">{a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* ============ CTA ============ */}
      <section className="border-t border-zinc-900">
        <div className="mx-auto max-w-4xl px-6 py-24 text-center">
          {/* The mark, on its own. */}
          <div className="relative mx-auto mb-8 w-fit">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/mark-light.svg" alt="" aria-hidden className="relative h-20 w-auto sm:h-24" />
          </div>
          <h2 lang="ne" className="font-[family-name:var(--font-display)] text-4xl font-bold sm:text-6xl">
            साथी बनाउनुहोस्।
          </h2>
          <p className="mt-4 text-lg text-zinc-400">Make a friend. Free models are waiting.</p>
          <Link
            href="/playground"
            className="mt-10 inline-block rounded-full bg-[var(--primary)] px-10 py-4 font-medium text-white transition hover:bg-[var(--primary-hover)]"
          >
            Start chatting free →
          </Link>
        </div>
        <footer className="border-t border-zinc-900 px-6 py-10">
          <div className="mx-auto flex max-w-4xl flex-col items-center gap-4 text-center text-xs text-zinc-600">
            <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
              <Link href="/docs" className="hover:text-zinc-400">Docs</Link>
              <Link href="/models" className="hover:text-zinc-400">Models</Link>
              <Link href="/#pricing" className="hover:text-zinc-400">Pricing</Link>
              <Link href="/privacy" className="hover:text-zinc-400">Privacy</Link>
              <Link href="/terms" className="hover:text-zinc-400">Terms</Link>
              <a href="mailto:neupaneoscar143@gmail.com" className="hover:text-zinc-400">Contact</a>
            </nav>
            <div>
              AIsathi · <span lang="ne">तपाईंको AI साथी</span> · aisathi.io · Kathmandu ↔ the world
            </div>
          </div>
        </footer>
      </section>
    </div>
  );
}
