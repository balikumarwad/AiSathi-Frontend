import type { Metadata } from "next";
import Nav from "@/components/Nav";

export const metadata: Metadata = {
  title: "Privacy Policy — AIsathi",
  description: "What AIsathi stores, what happens to your prompts, and how to delete your data.",
};

export default function Privacy() {
  return (
    <div className="min-h-screen bg-black text-zinc-100">
      <Nav />
      <main className="mx-auto max-w-3xl px-6 py-14">
        <h1 className="font-[family-name:var(--font-display)] text-4xl font-bold">Privacy Policy</h1>
        <p className="mt-2 text-sm text-zinc-500">Last updated: July 2026 · Plain language on purpose.</p>

        <div className="mt-10 space-y-8 text-[15px] leading-relaxed text-zinc-300">
          <section>
            <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold text-zinc-100">What we store</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-zinc-400">
              <li><strong className="text-zinc-300">Account:</strong> your email, name (if provided), and sign-in method. Passwords are handled by Supabase Auth — we never see them.</li>
              <li><strong className="text-zinc-300">Chats:</strong> if you're signed in, playground conversations are saved to your account so they sync across your devices. Only you can access them. Attached images are not uploaded to our servers.</li>
              <li><strong className="text-zinc-300">Usage records:</strong> for billing we log which model you called, token counts, cost, and timestamps — not the content of API requests.</li>
              <li><strong className="text-zinc-300">API keys:</strong> stored as one-way hashes. We cannot recover a key after showing it once.</li>
              <li><strong className="text-zinc-300">Payments:</strong> transaction references from Khalti/eSewa/Stripe. Card and wallet details stay with the payment provider — they never touch our servers.</li>
            </ul>
          </section>

          <section>
            <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold text-zinc-100">What happens to your prompts</h2>
            <p className="mt-3 text-zinc-400">
              To answer you, your message is sent to the AI model you chose, via our routing partner (OpenRouter) to the model's
              provider (OpenAI, Anthropic, Google, etc.). Their processing is governed by their policies. We choose routing
              partners that do not train on API traffic by default.
            </p>
          </section>

          <section>
            <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold text-zinc-100">What we never do</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-zinc-400">
              <li>We never sell your data or your conversations. To anyone.</li>
              <li>We never use your chats to train AI models.</li>
              <li>We never show your conversations to other users or staff except when legally required or when you explicitly ask us to debug something.</li>
            </ul>
          </section>

          <section>
            <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold text-zinc-100">Deleting your data</h2>
            <p className="mt-3 text-zinc-400">
              Delete individual chats anytime from the playground sidebar — deletion is immediate and permanent. To delete your
              entire account and all associated data, email us and we'll complete it within 7 days.
            </p>
          </section>

          <section>
            <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold text-zinc-100">Security</h2>
            <p className="mt-3 text-zinc-400">
              Everything is encrypted in transit (TLS) and at rest. Database access is protected by row-level security so each
              account can only read its own rows. We keep daily backups for disaster recovery.
            </p>
          </section>

          <section>
            <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold text-zinc-100">Contact</h2>
            <p className="mt-3 text-zinc-400">
              Questions about privacy: <a href="mailto:neupaneoscar143@gmail.com" className="text-red-400 underline underline-offset-2">contact us</a>.
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
