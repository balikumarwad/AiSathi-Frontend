import Link from "next/link";

export function BrandMark({ width = 38, className }: { width?: number; className?: string }) {
  // This is the supplied vector, never an independently redrawn symbol.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/mark.svg" alt="" width={width} height={Math.round(width * 40 / 38)} className={className} />;
}

export default function Brand() {
  return (
    <Link href="/" className="brand-lockup" aria-label="AIsathi home">
      <BrandMark />
      <span><b>AI</b>sathi</span>
    </Link>
  );
}
