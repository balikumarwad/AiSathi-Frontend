import type { Metadata } from "next";
import Link from "next/link";
import Nav from "@/components/Nav";
import Content from "@/components/Markdown";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

type ShareMsg = { role: "user" | "assistant"; content: string; model?: string };
type Shared = { id: string; title: string; messages: ShareMsg[] };

async function getShare(id: string): Promise<Shared | null> {
  const db = supabaseAdmin();
  if (!db) return null;
  const { data } = await db
    .from("shared_chats")
    .select("id,title,messages")
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;
  return { id: data.id as string, title: (data.title as string) ?? "Shared chat", messages: (data.messages ?? []) as ShareMsg[] };
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const share = await getShare(id);
  const title = share ? `${share.title} — AIsathi` : "Shared chat — AIsathi";
  return {
    title,
    description: "A conversation shared from AIsathi — chat with any AI model and pay in NPR.",
    openGraph: { title, images: ["/og.png"], type: "article" },
    twitter: { card: "summary_large_image", title, images: ["/og.png"] },
  };
}

export default async function SharePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const share = await getShare(id);

  return (
    <div className="min-h-screen" style={{ background: "var(--surface-page)", color: "var(--text-strong)" }}>
      <Nav />
      {!share ? (
        <main className="mx-auto max-w-2xl px-6 py-24 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/mark-light.svg" alt="" aria-hidden className="mx-auto h-16 w-auto opacity-70" />
          <h1 className="mt-6 font-[family-name:var(--font-display)] text-3xl font-bold">This shared chat isn&apos;t available</h1>
          <p className="mt-3 text-zinc-400">The link may be wrong, or the conversation was deleted.</p>
          <Link href="/playground" className="mt-8 inline-block rounded-full bg-[var(--primary)] px-7 py-3 font-medium text-white transition hover:bg-[var(--primary-hover)]">
            Try AIsathi free →
          </Link>
        </main>
      ) : (
        <main className="mx-auto w-full max-w-3xl px-6 py-10">
          <div className="mb-2 text-xs uppercase tracking-widest" style={{ color: "var(--text-faint)" }}>Shared conversation</div>
          <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold sm:text-4xl">{share.title}</h1>

          <div className="mt-8 space-y-6">
            {share.messages.map((m, i) =>
              m.role === "user" ? (
                <div key={i} className="flex justify-end">
                  <div className="max-w-[85%] px-4 py-3 text-[15px] leading-relaxed" style={{ background: "var(--ev-white-05)", border: "1px solid var(--border-hairline)", borderRadius: "16px 16px 4px 16px" }}>
                    <Content text={m.content} />
                  </div>
                </div>
              ) : (
                <div key={i} className="flex gap-3.5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/icon.svg" alt="" className="h-7 w-7 flex-none rounded-full" />
                  <div className="min-w-0 flex-1 pt-0.5 text-[15px] leading-relaxed">
                    <Content text={m.content} />
                    {m.model && (
                      <div className="mt-2 text-[11px]" style={{ color: "var(--text-faint)" }}>{m.model.split("/").pop()}</div>
                    )}
                  </div>
                </div>
              ),
            )}
          </div>

          {/* Try-free CTA — the viral loop */}
          <div className="mt-14 rounded-2xl border border-zinc-800 bg-zinc-950 p-6 text-center">
            <div className="font-[family-name:var(--font-display)] text-xl font-semibold">Made with AIsathi</div>
            <p className="mt-2 text-sm text-zinc-400">
              Any AI model — GPT, Claude, Gemini — pay in NPR. Free models to start, no card needed.
            </p>
            <Link href="/playground" className="mt-5 inline-block rounded-full bg-[var(--primary)] px-7 py-3 text-sm font-semibold text-white transition hover:bg-[var(--primary-hover)]">
              Start chatting free →
            </Link>
          </div>
        </main>
      )}
    </div>
  );
}
