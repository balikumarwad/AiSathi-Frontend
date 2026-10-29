"use client";
import { useEffect, useRef } from "react";
import { BrandMark } from "@/components/Brand";

/** Decorative spiral, never a model count or live traffic display. */
export default function HeroGalaxy() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    const pointer = matchMedia("(hover: hover) and (pointer: fine)");
    const limited = matchMedia("(max-width: 767px)");
    const lowPower = navigator.hardwareConcurrency > 0 && navigator.hardwareConcurrency <= 4;
    const animate = () => !motion.matches && !limited.matches && !lowPower && pointer.matches;
    const particles = Array.from({ length: innerWidth < 768 ? 1800 : 3400 }, (_, i) => {
      const r = Math.pow(Math.random(), .7);
      const a = r * 7 + (i % 3) * Math.PI * 2 / 3 + (Math.random() - .5) * (.24 + r * .6);
      return { x: Math.cos(a) * r, z: Math.sin(a) * r, y: (Math.random() - .5) * .08 * (1 - r), size: .4 + Math.random(), color: r < .23 ? "255,220,183" : r < .58 ? "246,128,132" : "151,113,245" };
    });
    // Soft stellar nurseries are baked once, then projected as one dust layer.
    const dust = document.createElement("canvas");
    dust.width = dust.height = 800;
    const dc = dust.getContext("2d")!;
    for (let i = 0; i < 650; i++) {
      const r = Math.pow(Math.random(), .8);
      const a = r * 7 + (i % 3) * Math.PI * 2 / 3 + (Math.random() - .5) * .45;
      const x = 400 + Math.cos(a) * r * 360, y = 400 + Math.sin(a) * r * 360;
      const radius = 7 + Math.random() * 24;
      const mist = dc.createRadialGradient(x, y, 0, x, y, radius);
      mist.addColorStop(0, r < .28 ? "rgba(255,215,176,.18)" : r < .6 ? "rgba(224,128,151,.10)" : "rgba(164,133,223,.10)");
      mist.addColorStop(1, "rgba(25,15,40,0)");
      dc.fillStyle = mist; dc.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    }
    let width = 0, height = 0, raf = 0, angle = 0, last = 0, visible = true;
    let px = 0, py = 0, targetX = 0, targetY = 0;
    function paint(now = 0) {
      raf = 0;
      if (!visible || document.hidden) return;
      if (animate() && now - last < 32) { raf = requestAnimationFrame(paint); return; }
      const dt = Math.min((now - last) / 1000, .05);
      last = now;
      if (animate()) { angle += dt * .025; px += (targetX - px) * .07; py += (targetY - py) * .07; }
      else { px = 0; py = 0; }
      ctx!.clearRect(0, 0, width, height);
      const cx = width * .5 + px * 12, cy = height * .5 + py * 10;
      const scale = Math.min(width * .46, height * .65);
      const glow = ctx!.createRadialGradient(cx, cy, 0, cx, cy, scale * .65);
      glow.addColorStop(0, "rgba(255,199,160,.3)");
      glow.addColorStop(.18, "rgba(255,106,93,.13)");
      glow.addColorStop(1, "rgba(107,68,196,0)");
      ctx!.fillStyle = glow; ctx!.fillRect(0, 0, width, height);
      const tilt = .65 + py * .04, spin = angle + px * .04;
      ctx!.save();
      ctx!.translate(cx, cy); ctx!.scale(1, -Math.sin(tilt)); ctx!.rotate(spin);
      ctx!.drawImage(dust, -scale * 1.11, -scale * 1.11, scale * 2.22, scale * 2.22);
      ctx!.restore();
      ctx!.globalCompositeOperation = "lighter";
      for (const p of particles) {
        const x = p.x * Math.cos(spin) - p.z * Math.sin(spin);
        const z = p.x * Math.sin(spin) + p.z * Math.cos(spin);
        const y = p.y * Math.cos(tilt) - z * Math.sin(tilt);
        const depth = 1 / (1 + z * .25);
        ctx!.fillStyle = `rgba(${p.color},${.35 + p.size * .4})`;
        ctx!.fillRect(cx + x * scale * depth, cy + y * scale * depth, p.size * depth, p.size * depth);
      }
      ctx!.globalCompositeOperation = "source-over";
      if (animate()) raf = requestAnimationFrame(paint);
    }
    function wake() { cancelAnimationFrame(raf); raf = 0; last = 0; paint(); }
    function resize() {
      const box = canvas!.getBoundingClientRect();
      width = box.width; height = box.height;
      const dpr = Math.min(devicePixelRatio || 1, 1.5);
      canvas!.width = Math.round(width * dpr); canvas!.height = Math.round(height * dpr);
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0); wake();
    }
    const move = (event: PointerEvent) => {
      if (!animate()) return;
      targetX = event.clientX / innerWidth * 2 - 1;
      targetY = event.clientY / innerHeight * 2 - 1;
    };
    const leave = () => { targetX = 0; targetY = 0; };
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; wake(); });
    const ro = new ResizeObserver(resize);
    observer.observe(canvas); ro.observe(canvas);
    document.addEventListener("visibilitychange", wake);
    window.addEventListener("pointermove", move, { passive: true });
    document.addEventListener("pointerleave", leave);
    motion.addEventListener("change", wake);
    resize();
    return () => {
      cancelAnimationFrame(raf); observer.disconnect(); ro.disconnect();
      document.removeEventListener("visibilitychange", wake);
      window.removeEventListener("pointermove", move);
      document.removeEventListener("pointerleave", leave);
      motion.removeEventListener("change", wake);
    };
  }, []);
  return (
    <div className="galaxy-stage" aria-hidden="true">
      <canvas ref={ref} />
      <div className="galaxy-core">
        <BrandMark width={52} />
      </div>
      <span className="galaxy-caption">A universe of intelligence. A little closer to home.</span>
    </div>
  );
}
