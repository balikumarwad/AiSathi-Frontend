"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Menu, X } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import Brand from "@/components/Brand";

const LINKS = [
  { href: "/models", label: "Models" },
  { href: "/playground", label: "Chat" },
  { href: "/docs", label: "Developers" },
  { href: "/dashboard", label: "Usage" },
  { href: "/topup", label: "Top up" },
];
const WORKSPACE = [...LINKS.filter(link => link.href !== "/docs"), {href:"/account",label:"Account & API keys"}];

export default function Nav() {
  const [email, setEmail] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const toggle = useRef<HTMLButtonElement>(null);
  const workspace = ["/account","/dashboard","/topup","/admin"].includes(pathname);
  useEffect(() => {
    const sb = supabaseBrowser();
    if (!sb) return;
    let active = true;
    sb.auth.getSession().then(({ data }) => {if(active)setEmail(data.session?.user.email ?? null);});
    const { data: sub } = sb.auth.onAuthStateChange((_e, session) => setEmail(session?.user.email ?? null));
    return () => {active=false;sub.subscription.unsubscribe();};
  }, []);
  useEffect(() => {
    if(!open)return;
    const close = (event: KeyboardEvent) => {if(event.key === "Escape"){setOpen(false);toggle.current?.focus();}};
    const media = matchMedia("(min-width: 1024px)");
    const resize = () => {if(media.matches)setOpen(false);};
    document.addEventListener("keydown",close);media.addEventListener("change",resize);
    return () => {document.removeEventListener("keydown",close);media.removeEventListener("change",resize);};
  }, [open]);
  return <>
    <header className="sticky top-0 z-30 backdrop-blur-xl" style={{background:"var(--surface-header)",borderBottom:"1px solid var(--border)"}}>
      <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-4 px-5 py-4 sm:px-8">
        <Brand />
        <nav aria-label="Main navigation" className="hidden items-center gap-7 text-sm font-medium lg:flex">
          {LINKS.map(link=><Link key={link.href} href={link.href} aria-current={pathname===link.href?"page":undefined} style={{color:pathname===link.href?"var(--text)":"var(--text-2)"}}>{link.label}</Link>)}
          <Link href={email?"/account":"/login"} className="primary-action">{email?"My account":"Sign in"}</Link>
        </nav>
        <div className="flex items-center gap-3 lg:hidden">
          <Link href={email?"/account":"/login"} className="primary-action text-xs">{email?"Account":"Sign in"}</Link>
          <button ref={toggle} onClick={()=>setOpen(!open)} aria-expanded={open} aria-controls="mobile-navigation" aria-label={open?"Close menu":"Open menu"} className="flex h-11 w-11 items-center justify-center rounded-full border border-zinc-700">{open?<X size={20}/>:<Menu size={20}/>}</button>
        </div>
      </div>
      {open&&<nav id="mobile-navigation" aria-label="Mobile navigation" className="flex flex-col gap-1 border-t border-zinc-800 px-5 py-3 lg:hidden">
        {LINKS.map(link=><Link key={link.href} href={link.href} onClick={()=>setOpen(false)} aria-current={pathname===link.href?"page":undefined} className="rounded-lg px-3 py-3 text-sm hover:bg-white/5">{link.label}</Link>)}
      </nav>}
    </header>
    {workspace&&<nav aria-label="Workspace" className="workspace-tabs">{WORKSPACE.map(link=><Link href={link.href} key={link.href} aria-current={pathname===link.href?"page":undefined}>{link.label}</Link>)}</nav>}
  </>;
}
