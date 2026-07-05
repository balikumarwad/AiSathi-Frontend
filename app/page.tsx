import Link from "next/link";
import Nav from "@/components/Nav";

const CURL = `curl https://sathiai.io/api/v1/chat/completions \\
  -H "Authorization: Bearer np-your-key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "openai/gpt-4o-mini",
    "messages": [{"role": "user", "content": "नमस्ते!"}]
  }'`;

const MODELS = [
  "GPT-5.2", "Claude Sonnet 5", "Gemini 3 Flash", "Llama 4", "DeepSeek V3.2", "Claude Haiku 4.5",
];

export default function Home() {
  return (
    <div className="min-h-screen bg-black text-zinc-100">
      {/* ============ HERO ============ */}
      <section className="relative flex min-h-[100svh] flex-col overflow-hidden">
        {/* High-res background video (public/hero.mp4). If absent, the
            animated aurora below still carries the scene. */}
        <video
          className="absolute inset-0 h-full w-full object-cover opacity-40"
          autoPlay
          muted
          loop
          playsInline
          poster="/hero-poster.jpg"
        >
          <source src="/hero.mp4" type="video/mp4" />
        </video>

        {/* Animated aurora fallback / underlay */}
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="absolute -top-1/3 left-1/2 h-[80vh] w-[80vw] -translate-x-1/2 rounded-full bg-red-600/20 blur-[120px] animate-pulse" />
          <div className="absolute bottom-0 left-0 h-[50vh] w-[50vw] rounded-full bg-purple-700/20 blur-[100px]" />
          <div className="absolute right-0 top-1/3 h-[40vh] w-[40vw] rounded-full bg-blue-700/15 blur-[100px]" />
        </div>

        {/* Dark gradient so text always wins over the video */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/30 to-black" />

        <div className="relative z-10">
          <Nav />
        </div>

        <div className="relative z-10 mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center px-6 text-center">
          <p className="mb-6 rounded-full border border-zinc-700/60 bg-zinc-900/60 px-4 py-1.5 text-xs tracking-widest text-zinc-300 backdrop-blur">
            तपाईंको AI साथी — YOUR AI COMPANION
          </p>
          <h1 className="font-[family-name:var(--font-display)] text-5xl font-bold leading-[1.05] sm:text-7xl md:text-8xl">
            Any AI model.
            <br />
            <span className="bg-gradient-to-r from-red-500 via-rose-400 to-purple-500 bg-clip-text text-transparent">
              Pay in रुपैयाँ.
            </span>
          </h1>
          <p className="mt-8 max-w-2xl text-lg text-zinc-300 sm:text-xl">
            One API for hundreds of AI models — GPT, Claude, Gemini, Llama and more.
            Top up with eSewa, Khalti, or card. No USD card. No foreign billing.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/playground"
              className="rounded-full bg-red-600 px-8 py-3.5 font-medium shadow-lg shadow-red-900/40 transition hover:bg-red-500 hover:shadow-red-800/50"
            >
              Try the playground →
            </Link>
            <Link
              href="/models"
              className="rounded-full border border-zinc-600 bg-black/40 px-8 py-3.5 font-medium backdrop-blur transition hover:border-zinc-400"
            >
              Browse models
            </Link>
          </div>
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
          {[
            ["🇳🇵", "Local payments", "Top up credits with eSewa or Khalti in seconds — or card via Stripe from anywhere."],
            ["🧾", "NPR pricing", "Transparent per-token prices in rupees. Plans from रू399. No FX surprises."],
            ["🔌", "Drop-in API", "OpenAI-compatible. Point any SDK at our base URL — your code doesn't change."],
          ].map(([icon, title, body]) => (
            <div
              key={title}
              className="group rounded-2xl border border-zinc-800 bg-zinc-950 p-8 transition hover:border-zinc-600 hover:bg-zinc-900/60"
            >
              <div className="text-3xl">{icon}</div>
              <div className="mt-4 font-[family-name:var(--font-display)] text-xl font-semibold">{title}</div>
              <p className="mt-3 text-sm leading-relaxed text-zinc-400">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ============ CODE ============ */}
      <section className="mx-auto max-w-4xl px-6 pb-24">
        <h2 className="font-[family-name:var(--font-display)] text-sm font-medium uppercase tracking-[0.3em] text-zinc-500">
          One URL change and you&apos;re in
        </h2>
        <pre className="mt-6 overflow-x-auto rounded-2xl border border-zinc-800 bg-zinc-950 p-6 font-[family-name:var(--font-mono)] text-sm leading-relaxed text-zinc-300 shadow-2xl shadow-red-950/20">
          {CURL}
        </pre>
      </section>

      {/* ============ CTA ============ */}
      <section className="border-t border-zinc-900">
        <div className="mx-auto max-w-4xl px-6 py-24 text-center">
          <h2 className="font-[family-name:var(--font-display)] text-4xl font-bold sm:text-6xl">
            साथी बनाउनुहोस्।
          </h2>
          <p className="mt-4 text-lg text-zinc-400">Make a friend. Start with रू200.</p>
          <Link
            href="/topup"
            className="mt-10 inline-block rounded-full bg-gradient-to-r from-red-600 to-purple-600 px-10 py-4 font-medium shadow-xl shadow-purple-950/40 transition hover:from-red-500 hover:to-purple-500"
          >
            Top up & go →
          </Link>
        </div>
        <footer className="border-t border-zinc-900 py-8 text-center text-xs text-zinc-600">
          SathiAI · sathiai.io · Kathmandu ↔ the world
        </footer>
      </section>
    </div>
  );
}
