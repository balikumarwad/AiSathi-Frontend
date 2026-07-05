import Link from "next/link";

export default function Nav() {
  return (
    <nav className="flex items-center justify-between border-b border-zinc-800 px-6 py-4">
      <Link href="/" className="text-lg font-bold tracking-tight">
        Sathi<span className="text-red-500">AI</span>
      </Link>
      <div className="flex gap-6 text-sm text-zinc-400">
        <Link href="/models" className="hover:text-white">Models</Link>
        <Link href="/playground" className="hover:text-white">Playground</Link>
        <Link href="/dashboard" className="hover:text-white">Dashboard</Link>
        <Link href="/topup" className="font-medium text-purple-400 hover:text-purple-300">Top up</Link>
      </div>
    </nav>
  );
}
