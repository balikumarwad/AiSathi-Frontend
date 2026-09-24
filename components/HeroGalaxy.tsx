"use client";

/**
 * Hero: the live model catalogue drawn as a galaxy.
 *
 * Every star is a real model from /api/v1/models — distance from the centre is
 * price, size is context window, colour runs pale to brand coral. The gateway
 * sits at the core. It is the product, not decoration: when we add models, the
 * hero changes on its own.
 *
 * It has no edge. The canvas clears to transparent and a radial mask fades the
 * outer third away, so it dissolves into the page rather than sitting on it in
 * a box.
 *
 * Budget, because this hero used to be a 5 MB video:
 *   - canvas 2D, no 3D library, no image request
 *   - the catalogue is fetched from our own API, the same call /models makes
 *   - the nebula and star field are rendered ONCE into offscreen canvases, so
 *     each frame is two bitmap blits plus the model stars
 *
 * Guards: pauses when scrolled out of view or the tab is hidden, caps device
 * pixel ratio, thins the field on small screens, and renders a single static
 * frame for prefers-reduced-motion.
 */

import { useEffect, useRef } from "react";

type Star = {
  x: number; y: number; r: number; size: number;
  pn: number; cn: number; a: number; drift: number; tw: number;
};

/* Brand coral and its neighbours. Kept off a single hue on purpose: a galaxy
   built from one number reads as a flat gradient, so these walk from orange
   through coral into pink and the arms separate. */
const HUES = [8, 352, 20, 340];

/* The cool end of the star ramp — the palest models. Warm, not lavender, so
   the whole sky belongs to one family. The hot end is --primary itself. */
const COOL: [number, number, number] = [255, 233, 226];
const HOT: [number, number, number] = [244, 86, 78];

/* The radii are 50%/50% — an ellipse inscribed in the box — and that is not a
   taste call. A radial-gradient measures its stops along its own radius, so an
   ellipse wider than the box runs out of gradient before it runs out of box
   and the mid-edges stay half opaque: a softer rectangle, still a rectangle. At
   50% the top, bottom, left and right edges all land exactly on the final
   stop, and the corners are past it. The star orbit is sized to fit inside
   this same ellipse — see rMax in makeStars. */
const MASK =
  "radial-gradient(ellipse 50% 50% at 50% 50%, #000 0%, #000 46%, rgba(0,0,0,0.5) 74%, transparent 100%)";

export default function HeroGalaxy() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const small = window.matchMedia("(max-width: 767px)").matches;
    const dpr = Math.min(window.devicePixelRatio || 1, small ? 1.4 : 2);

    let W = 0, H = 0, CX = 0, CY = 0;
    // The nebula is rendered on a square the size of the canvas DIAGONAL and
    // blitted centred, because it is the one layer that rotates: on a W x H
    // bitmap the corners sweep through the frame and its own straight edge
    // becomes a visible diagonal seam. D x D means no edge can ever reach the
    // viewport, whatever the angle.
    let D = 0, NX = 0, NY = 0;
    let nebula: HTMLCanvasElement | null = null;
    let field: HTMLCanvasElement | null = null;
    let stars: Star[] = [];
    let raf = 0, t = 0, visible = true, alive = true;

    const layer = (w: number, h: number) => {
      const c = document.createElement("canvas");
      c.width = w; c.height = h;
      return c;
    };

    function buildNebula() {
      const c = layer(D, D);
      const x = c.getContext("2d")!;
      const cx = D / 2, cy = D / 2;
      x.globalCompositeOperation = "lighter";
      const arms = small ? 2 : 3;
      const per = small ? 30 : 46;
      for (let arm = 0; arm < arms; arm++) {
        const off = (arm / arms) * Math.PI * 2;
        for (let i = 0; i < per; i++) {
          const a = off + i * 0.19 + Math.random() * 0.06;
          const r = 26 + i * (H / 68);
          const px = cx + Math.cos(a) * r * 1.62 + (Math.random() - 0.5) * 42;
          const py = cy + Math.sin(a) * r * 0.74 + (Math.random() - 0.5) * 24;
          const rad = (H / 5.4) * (0.5 + Math.random()) - i * 0.22;
          const hue = HUES[(arm + (i % 2)) % HUES.length] + (Math.random() * 18 - 9);
          const alpha = 0.085 * (1 - i / 60) + 0.012;
          const g = x.createRadialGradient(px, py, 0, px, py, Math.max(rad, 8));
          g.addColorStop(0, `hsla(${hue},88%,66%,${alpha})`);
          g.addColorStop(0.55, `hsla(${hue + 12},85%,52%,${alpha * 0.45})`);
          g.addColorStop(1, `hsla(${hue},80%,40%,0)`);
          x.fillStyle = g;
          x.beginPath(); x.arc(px, py, Math.max(rad, 8), 0, 7); x.fill();
        }
      }
      const b = layer(D, D);
      const bx = b.getContext("2d")!;
      bx.filter = "blur(16px)";
      bx.drawImage(c, 0, 0);
      return b;
    }

    function buildField() {
      const c = layer(W, H);
      const x = c.getContext("2d")!;
      x.fillStyle = `rgb(${COOL[0]},${COOL[1]},${COOL[2]})`;
      const n = small ? 480 : 1200;
      for (let i = 0; i < n; i++) {
        const px = Math.random() * W, py = Math.random() * H;
        const d = Math.hypot((px - CX) / (W * 0.5), (py - CY) / (H * 0.5));
        if (Math.random() < d * 0.45) continue;
        x.globalAlpha = 0.18 + Math.random() * 0.75;
        const r = Math.random() < 0.9 ? Math.random() * 0.8 + 0.25 : Math.random() * 1.5 + 0.7;
        x.beginPath(); x.arc(px, py, r, 0, 7); x.fill();
      }
      return c;
    }

    function makeStars(rows: { price: number; ctx: number }[]) {
      const prices = rows.map((r) => r.price).filter((v) => v > 0);
      const lo = Math.log(Math.min(...prices, 1)), hi = Math.log(Math.max(...prices, 2));
      const cl = Math.log(4096), ch = Math.log(2_000_000);
      const norm = (v: number, a: number, b: number) =>
        Math.max(0, Math.min(1, (Math.log(Math.max(v, 1)) - a) / (b - a)));
      // The orbit is 1.6 wide by 0.73 tall against a mask ellipse of W/2 by
      // H/2, so the horizontal extent is what binds: a reach tuned to the
      // short side used to push the priciest models straight out through the
      // left and right edges, where the mask now deletes them. 0.94 leaves
      // the outermost star inside the fade rather than exactly on zero.
      const rMax = Math.min((W / 2) * 0.94 / 1.6, (H / 2) * 0.94 / 0.73);
      const reach = Math.max(rMax - H * 0.07, H * 0.12);
      stars = rows.map((row, i) => {
        const pn = row.price > 0 ? norm(row.price, lo, hi) : 0.02;
        const cn = row.ctx > 0 ? norm(row.ctx, cl, ch) : 0.2;
        return {
          x: 0, y: 0, pn, cn,
          r: H * 0.07 + pn * reach,
          size: (0.8 + cn * 2.6) * (small ? 0.8 : 1),
          a: i * 2.399963,
          drift: 0.05 * (1 - pn * 0.55),
          tw: Math.random() * Math.PI * 2,
        };
      });
    }

    function resize() {
      const box = cv!.getBoundingClientRect();
      W = Math.round(box.width * dpr);
      H = Math.round(box.height * dpr);
      if (!W || !H) return;
      cv!.width = W; cv!.height = H;
      CX = W / 2; CY = H / 2;
      D = Math.ceil(Math.hypot(W, H));
      NX = CX - D / 2; NY = CY - D / 2;
      nebula = buildNebula();
      field = buildField();
    }

    function draw() {
      if (!alive) return;
      if (!visible || document.hidden) { raf = requestAnimationFrame(draw); return; }
      ctx!.clearRect(0, 0, W, H);

      if (nebula) {
        ctx!.save();
        ctx!.globalCompositeOperation = "lighter";
        ctx!.translate(CX, CY); ctx!.rotate(t * 0.012); ctx!.translate(-CX, -CY);
        ctx!.globalAlpha = 0.72; ctx!.drawImage(nebula, NX, NY);
        ctx!.restore();
      }
      if (field) { ctx!.globalAlpha = 0.85; ctx!.drawImage(field, 0, 0); ctx!.globalAlpha = 1; }

      ctx!.save();
      ctx!.globalCompositeOperation = "lighter";
      for (const s of stars) {
        const a = s.a + t * s.drift;
        s.x = CX + Math.cos(a) * s.r * 1.6;
        s.y = CY + Math.sin(a) * s.r * 0.73;
        const tw = reduce ? 1 : 0.7 + 0.3 * Math.sin(t * 2 + s.tw);
        const v = s.pn;
        ctx!.fillStyle = `rgb(${Math.round(COOL[0] + (HOT[0] - COOL[0]) * v)},${Math.round(COOL[1] + (HOT[1] - COOL[1]) * v)},${Math.round(COOL[2] + (HOT[2] - COOL[2]) * v)})`;
        ctx!.globalAlpha = (0.3 + 0.5 * s.cn) * tw;
        ctx!.beginPath(); ctx!.arc(s.x, s.y, s.size * dpr, 0, 7); ctx!.fill();
      }
      ctx!.restore();

      // core flare
      const pulse = reduce ? 1 : 1 + Math.sin(t * 1.4) * 0.05;
      const beam = H * 0.42 * pulse;
      ctx!.save();
      ctx!.globalCompositeOperation = "lighter";
      ctx!.save(); ctx!.translate(CX, CY); ctx!.scale(0.075, 1);
      const g1 = ctx!.createRadialGradient(0, 0, 0, 0, 0, beam);
      g1.addColorStop(0, "rgba(255,255,255,0.8)");
      g1.addColorStop(0.25, "rgba(255,214,204,0.2)");
      g1.addColorStop(1, "rgba(255,150,132,0)");
      ctx!.fillStyle = g1; ctx!.beginPath(); ctx!.arc(0, 0, beam, 0, 7); ctx!.fill(); ctx!.restore();
      ctx!.save(); ctx!.translate(CX, CY); ctx!.scale(1, 0.1);
      const g2 = ctx!.createRadialGradient(0, 0, 0, 0, 0, beam * 0.74);
      g2.addColorStop(0, "rgba(255,255,255,0.5)");
      g2.addColorStop(1, "rgba(255,160,140,0)");
      ctx!.fillStyle = g2; ctx!.beginPath(); ctx!.arc(0, 0, beam * 0.74, 0, 7); ctx!.fill(); ctx!.restore();
      const g3 = ctx!.createRadialGradient(CX, CY, 0, CX, CY, H * 0.06 * pulse);
      g3.addColorStop(0, "#ffffff");
      g3.addColorStop(0.35, "rgba(255,246,244,0.55)");
      g3.addColorStop(1, "rgba(255,246,244,0)");
      ctx!.fillStyle = g3; ctx!.beginPath(); ctx!.arc(CX, CY, H * 0.06 * pulse, 0, 7); ctx!.fill();
      ctx!.restore();

      if (reduce) return;           // one static frame is enough
      t += 0.016;
      raf = requestAnimationFrame(draw);
    }

    resize();
    // A believable sky before the catalogue lands, replaced once it does.
    makeStars(Array.from({ length: 180 }, () => ({ price: Math.random() * 400 + 5, ctx: 128000 })));
    draw();

    fetch("/api/v1/models")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!j?.data || !alive) return;
        makeStars(
          j.data.map((m: { pricing?: { prompt_npr_per_m?: number }; context_length?: number }) => ({
            price: Number(m.pricing?.prompt_npr_per_m ?? 0),
            ctx: Number(m.context_length ?? 0),
          })),
        );
      })
      .catch(() => { /* the placeholder sky stays; the hero never looks broken */ });

    const io = new IntersectionObserver((e) => { visible = e[0].isIntersecting; }, { threshold: 0 });
    io.observe(cv);
    const onResize = () => { resize(); };
    window.addEventListener("resize", onResize);

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      io.disconnect();
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return (
    <canvas
      ref={ref}
      aria-label="A galaxy of every AI model AIsathi serves. Distance from the centre is price, size is context window."
      role="img"
      className="h-[280px] w-full sm:h-[360px] lg:h-[420px]"
      style={{
        // Two halves of one idea. The canvas paints no ground of its own
        // (draw() clears to transparent), so the page colour IS the space
        // between the stars; and this mask fades the outer third to nothing,
        // so the sky runs out instead of stopping at a border. The ellipse is
        // wider than tall to match the galaxy's own 1.6 : 0.73 proportions,
        // otherwise the mask clips the arms before it reaches the corners.
        WebkitMaskImage: MASK,
        maskImage: MASK,
      }}
    />
  );
}
