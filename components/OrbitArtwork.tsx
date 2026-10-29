/** Shared orbital geometry. All ornament is inert and excluded from speech. */
export default function OrbitArtwork({ variant = "orbit" }: { variant?: "orbit" | "signal" | "portal" }) {
  return <div className={`orbit-art orbit-art--${variant}`} aria-hidden="true">
    <svg viewBox="0 0 600 400" fill="none">
      <ellipse cx="300" cy="200" rx="270" ry="110" transform="rotate(-22 300 200)" />
      <ellipse cx="300" cy="200" rx="240" ry="150" transform="rotate(28 300 200)" />
      <ellipse cx="300" cy="200" rx="160" ry="160" />
      <path className="orbital-signal" d="M35 250 Q180 30 300 200 T565 155" />
      <path className="orbital-route" d="M35 250 Q180 30 300 200 T565 155" />
      <circle cx="80" cy="190" r="4"/><circle cx="465" cy="116" r="5"/><circle cx="390" cy="323" r="3"/>
    </svg>
    <i className="orbit-art__planet"/><i className="orbit-art__satellite"/>
  </div>;
}
