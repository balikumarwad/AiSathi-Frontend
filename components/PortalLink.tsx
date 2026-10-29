import Link from "next/link";
import type { ReactNode } from "react";

/** A real navigation link with a clipped, four-ray optical glint. */
export default function PortalLink({ children = "Start chatting", href = "/playground", className = "" }: { children?: ReactNode; href?: string; className?: string }) {
  return <Link href={href} className={`portal-link ${className}`} data-cosmic-interactive>
    <span className="portal-link__surface" aria-hidden="true"><i className="portal-link__reflection"/><i className="portal-link__glint"/></span>
    <span className="portal-link__label">{children}</span><span className="portal-link__arrow" aria-hidden="true">↗</span>
  </Link>;
}
