import Link from "next/link";
import Nav from "@/components/Nav";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col bg-black text-zinc-100">
      <Nav />
      <main className="flex flex-1 flex-col items-center justify-center px-6 pb-24 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/mark-loader.svg" alt="" aria-hidden className="h-20 w-auto opacity-80" />
        <h1 lang="ne" className="mt-8 font-[family-name:var(--font-display)] text-4xl font-bold sm:text-6xl">
          यो पेज हरायो।
        </h1>
        <p className="mt-4 text-lg text-zinc-400">
          This page has wandered off. Let&apos;s get you back.
        </p>
        <div className="mt-10 flex gap-4">
          <Link href="/" className="rounded-full bg-red-600 px-7 py-3 font-medium transition hover:bg-red-500">
            Go home
          </Link>
          <Link href="/playground" className="rounded-full border border-zinc-700 px-7 py-3 font-medium transition hover:border-zinc-500">
            Open the playground
          </Link>
        </div>
      </main>
    </div>
  );
}
