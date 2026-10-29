/**
 * Hero diagram: requests moving through the gateway in real time.
 *
 * Three people on the left, the AIsathi gateway in the middle, four model
 * providers on the right. Coral pulses travel person -> gateway -> model and
 * back, so the picture shows what the product actually does: many people
 * sharing one gateway, routed live to whichever model fits.
 *
 * Inline SVG with SMIL, no JS and no image request — about 4 KB of markup,
 * which matters because the hero it replaces used to be a 5 MB video.
 * `motion-reduce:hidden` on the pulses freezes it to a clean static diagram
 * for anyone who asks for less motion.
 */

const PEOPLE = [
  { y: 60, label: "Student" },
  { y: 150, label: "Team" },
  { y: 240, label: "App" },
];

const MODELS = [
  { y: 40, label: "GPT" },
  { y: 110, label: "Claude" },
  { y: 180, label: "Gemini" },
  { y: 250, label: "Llama" },
];

const HUB = { x: 232, y: 128, w: 96, h: 64 };

/** person -> gateway. Each lane turns at its own x so the three wires route
 *  side by side instead of collapsing onto one shared vertical. */
function leg(fromY: number, lane: number) {
  const x1 = 92;
  const x2 = HUB.x;
  const turn = 132 + lane * 26;
  const midY = HUB.y + HUB.h / 2;
  return `M ${x1} ${fromY + 22} H ${turn} V ${midY} H ${x2}`;
}
function out(toY: number, lane: number) {
  const x1 = HUB.x + HUB.w;
  const x2 = 432;
  const turn = 352 + lane * 18;
  const midY = HUB.y + HUB.h / 2;
  return `M ${x1} ${midY} H ${turn} V ${toY + 18} H ${x2}`;
}

export default function HeroFlow() {
  return (
    <svg
      viewBox="0 0 560 330"
      role="img"
      aria-label="Diagram: several people send requests through the AIsathi gateway, which routes each one to a model such as GPT, Claude, Gemini or Llama."
      className="h-auto w-full max-w-[560px]"
    >
      {/* wires */}
      <g fill="none" stroke="var(--border-strong)" strokeWidth="1">
        {PEOPLE.map((p, i) => (
          <path key={"in" + p.y} d={leg(p.y, i)} />
        ))}
        {MODELS.map((m, i) => (
          <path key={"out" + m.y} d={out(m.y, i)} strokeDasharray="3 4" />
        ))}
      </g>

      {/* people */}
      {PEOPLE.map((p, i) => (
        <g key={p.label}>
          <rect x="24" y={p.y} width="68" height="44" rx="10"
            fill="var(--elevated)" stroke="var(--border-strong)" />
          <circle cx="42" cy={p.y + 22} r="6" fill="none" stroke="var(--text-2)" />
          <path d={`M 54 ${p.y + 17} h 24 M 54 ${p.y + 25} h 16`} stroke="var(--border-strong)" />
          <text x="58" y={p.y + 60} textAnchor="middle" fontSize="9"
            fill="var(--text-2)" letterSpacing="0.08em">{p.label.toUpperCase()}</text>
          {/* request pulse */}
          <circle r="3.5" fill="var(--primary)" className="motion-reduce:hidden">
            <animateMotion dur="2.8s" begin={`${i * 0.55}s`} repeatCount="indefinite"
              path={leg(p.y, i)} keyPoints="0;1" keyTimes="0;1" calcMode="spline"
              keySplines="0.4 0 0.2 1" />
          </circle>
        </g>
      ))}

      {/* gateway */}
      <g>
        <rect x={HUB.x} y={HUB.y} width={HUB.w} height={HUB.h} rx="12"
          fill="var(--elevated)" stroke="var(--primary)" strokeWidth="1.5" />
        <g transform={`translate(${HUB.x + HUB.w / 2 - 13} ${HUB.y + 14})`}>
          {[[0, 0], [13, 7], [0, 14], [13, 21], [26, 14], [26, 0]].map(([x, y], i) => (
            <circle key={i} cx={x + 3} cy={y + 3} r="3.4"
              fill={i === 1 ? "var(--primary)" : "var(--text)"} opacity={i === 1 ? 1 : 0.8} />
          ))}
        </g>
        <text x={HUB.x + HUB.w / 2} y={HUB.y + HUB.h + 16} textAnchor="middle"
          fontSize="9" fill="var(--text-2)" letterSpacing="0.08em">ROUTING · NPR METERED</text>
      </g>

      {/* models */}
      {MODELS.map((m, i) => (
        <g key={m.label}>
          <rect x="432" y={m.y} width="104" height="36" rx="18"
            fill="var(--elevated)" stroke="var(--border-strong)" />
          <circle cx="452" cy={m.y + 18} r="4" fill="var(--primary)" opacity="0.55" />
          <text x="466" y={m.y + 22} fontSize="11" fill="var(--text)">{m.label}</text>
          {/* answer pulse */}
          <circle r="3" fill="var(--primary)" opacity="0.75" className="motion-reduce:hidden">
            <animateMotion dur="2.8s" begin={`${1.2 + i * 0.4}s`} repeatCount="indefinite"
              path={out(m.y, i)} />
          </circle>
        </g>
      ))}
    </svg>
  );
}
