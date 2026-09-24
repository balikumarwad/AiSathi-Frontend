import type { Metadata } from "next";
import Link from "next/link";
import Nav from "@/components/Nav";
import CopyButton from "@/components/CopyButton";

export const metadata: Metadata = {
  title: "API Docs — AIsathi",
  description: "AIsathi API reference: OpenAI-compatible chat completions in NPR. Base URL, authentication, streaming, image generation, errors.",
};

const BASE = "https://aisathi.io/api/v1";

const SNIPPETS: { title: string; note?: string; code: string }[] = [
  {
    title: "Chat completion (curl)",
    code: `curl ${BASE}/chat/completions \\
  -H "Authorization: Bearer np-your-key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "openai/gpt-4o-mini",
    "messages": [{"role": "user", "content": "नमस्ते!"}]
  }'`,
  },
  {
    title: "Python (OpenAI SDK)",
    note: "Your existing OpenAI code works — change the base_url and key.",
    code: `from openai import OpenAI

client = OpenAI(
    base_url="${BASE}",
    api_key="np-your-key",
)

resp = client.chat.completions.create(
    model="anthropic/claude-sonnet-5",
    messages=[{"role": "user", "content": "Explain recursion simply"}],
)
print(resp.choices[0].message.content)`,
  },
  {
    title: "JavaScript / TypeScript",
    code: `import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "${BASE}",
  apiKey: "np-your-key",
});

const stream = await client.chat.completions.create({
  model: "openai/gpt-4o-mini",
  messages: [{ role: "user", content: "Write a haiku about Kathmandu" }],
  stream: true,
});
for await (const chunk of stream) {
  process.stdout.write(chunk.choices[0]?.delta?.content ?? "");
}`,
  },
  {
    title: "Image generation",
    note: "Use an image-output model (marked as image-capable in the catalog) and ask for image output. Images come back as base64 data URLs.",
    code: `curl ${BASE}/chat/completions \\
  -H "Authorization: Bearer np-your-key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "google/gemini-3.1-flash-image",
    "messages": [{"role": "user", "content": "A honeycomb pattern, flat logo style"}],
    "modalities": ["image", "text"]
  }'`,
  },
  {
    title: "List models with NPR prices",
    code: `curl ${BASE}/models`,
  },
  {
    title: "Check your balance & usage",
    code: `curl ${BASE}/me -H "Authorization: Bearer np-your-key"`,
  },
];

const ERRORS: [string, string, string][] = [
  ["401", "Invalid or revoked API key", "Check the key, or create a new one on your account page."],
  ["402", "Insufficient credits", "The response includes estimated_cost_npr. Top up, or use a free model."],
  ["429", "Rate limit (60 req/min per key)", "Wait for the Retry-After header, then retry."],
  ["502", "Upstream model error", "Usually temporary — retry, or switch models."],
];

export default function Docs() {
  return (
    <div className="min-h-screen bg-black text-zinc-100">
      <Nav />
      <main className="mx-auto max-w-3xl px-6 py-14">
        <h1 className="font-[family-name:var(--font-display)] text-4xl font-bold sm:text-5xl">API Documentation</h1>
        <p className="mt-4 text-zinc-400">
          The AIsathi API is <strong className="text-zinc-200">OpenAI-compatible</strong>. Anything that speaks the OpenAI
          chat-completions format — SDKs, LangChain, your existing code — works by changing two lines: the base URL and the key.
        </p>

        <div className="mt-8 rounded-xl border border-zinc-800 bg-zinc-950 p-5 text-sm">
          <div className="grid gap-2 sm:grid-cols-[130px_1fr]">
            <span className="font-semibold text-zinc-500">Base URL</span>
            <code className="font-[family-name:var(--font-mono)] text-[var(--primary)]">{BASE}</code>
            <span className="font-semibold text-zinc-500">Auth</span>
            <span><code className="font-[family-name:var(--font-mono)] text-zinc-300">Authorization: Bearer np-…</code> — create keys on your <Link href="/account" className="text-[var(--primary)] underline underline-offset-2">account page</Link></span>
            <span className="font-semibold text-zinc-500">Billing</span>
            <span>Per token, in NPR, deducted from your prepaid balance. Every response includes a <code className="font-[family-name:var(--font-mono)]">nepalai.cost_npr</code> field.</span>
            <span className="font-semibold text-zinc-500">Streaming</span>
            <span>Standard SSE — pass <code className="font-[family-name:var(--font-mono)]">&quot;stream&quot;: true</code>. The final chunk carries the cost.</span>
          </div>
        </div>

        {SNIPPETS.map((s) => (
          <section key={s.title} className="mt-10">
            <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">{s.title}</h2>
            {s.note && <p className="mt-1 text-sm text-zinc-500">{s.note}</p>}
            <div className="relative mt-3">
              <CopyButton text={s.code} />
              <pre className="overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-950 p-5 font-[family-name:var(--font-mono)] text-[13px] leading-relaxed text-zinc-300">
                {s.code}
              </pre>
            </div>
          </section>
        ))}

        <section className="mt-12">
          <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">Errors</h2>
          <div className="mt-4 overflow-hidden rounded-xl border border-zinc-800">
            <table className="w-full text-sm">
              <tbody>
                {ERRORS.map(([code, what, fix]) => (
                  <tr key={code} className="border-b border-zinc-900 last:border-0">
                    <td className="px-4 py-3 font-[family-name:var(--font-mono)] font-bold text-[var(--primary)]">{code}</td>
                    <td className="px-4 py-3 text-zinc-300">{what}</td>
                    <td className="px-4 py-3 text-zinc-500">{fix}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-12 rounded-xl border border-zinc-800 bg-zinc-950 p-6">
          <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">Good to know</h2>
          <ul className="mt-3 space-y-2 text-sm text-zinc-400">
            <li>• Completion length is capped at 8,192 tokens per request.</li>
            <li>• Vision input works on image-capable models — send OpenAI-style <code className="font-[family-name:var(--font-mono)]">image_url</code> content parts (base64 data URLs are most reliable).</li>
            <li>• Your balance must cover the worst-case cost of a request before it starts — the 402 error tells you the estimate.</li>
            <li>• Keys are shown once at creation and stored hashed. Revoke any key instantly from your account page.</li>
          </ul>
        </section>

        <p className="mt-10 text-sm text-zinc-500">
          Questions? <a href="mailto:neupaneoscar143@gmail.com" className="text-[var(--primary)] underline underline-offset-2">Contact us</a> — or try everything in the{" "}
          <Link href="/playground" className="text-[var(--primary)] underline underline-offset-2">playground</Link> first.
        </p>
      </main>
    </div>
  );
}
