"use client";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

/** One shared environment; route changes do not create additional render loops. */
export default function Universe() {
  const path = usePathname();
  const canvas = useRef<HTMLCanvasElement>(null);
  const pointer = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const cv = canvas.current;
    const light = pointer.current;
    const ctx = cv?.getContext("2d");
    if (!cv || !ctx || !light) return;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)");
    const fine = matchMedia("(pointer: fine) and (hover: hover)");
    const compact = matchMedia("(max-width: 767px)");
    const lowPower = navigator.hardwareConcurrency > 0 && navigator.hardwareConcurrency <= 4;
    const animate = () => !reduce.matches && !compact.matches && !lowPower && fine.matches;
    let w = 0, h = 0, raf = 0, last = 0, time = 0, mx = 0, my = 0, scroll = 0;
    let texture: HTMLCanvasElement;
    const stars = Array.from({ length: 160 }, () => ({
      x: Math.random(), y: Math.random(), r: .25 + Math.random(),
      depth: .2 + Math.random(), phase: Math.random() * 6,
    }));

    function paint(now = 0) {
      raf = 0;
      if (document.hidden) return;
      if (animate() && now - last < 48) { raf = requestAnimationFrame(paint); return; }
      time += Math.min((now - last) / 1000, .1);
      last = now;
      ctx!.clearRect(0, 0, w, h);
      if (texture) ctx!.drawImage(texture, -40 + mx * 8, -40 + my * 5 - scroll * 15, w + 80, h + 80);
      for (const s of stars.slice(0, compact.matches ? 70 : 160)) {
        ctx!.fillStyle = `rgba(233,220,255,${animate() ? .35 + .25 * Math.sin(time * .3 + s.phase) : .55})`;
        ctx!.beginPath();
        ctx!.arc(s.x * w + mx * s.depth * 12, s.y * h + my * s.depth * 8 - scroll * s.depth * 10, s.r, 0, Math.PI * 2);
        ctx!.fill();
      }
      if (animate()) raf = requestAnimationFrame(paint);
    }
    function wake() { cancelAnimationFrame(raf); last = 0; paint(); }
    function resize() {
      w = innerWidth; h = innerHeight;
      const dpr = Math.min(devicePixelRatio, 1.4);
      cv!.width = w * dpr; cv!.height = h * dpr;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      texture = document.createElement("canvas");
      texture.width = 1000; texture.height = 800;
      const t = texture.getContext("2d")!;
      // Pre-render the irregular dust band once; live frames only blit it.
      for (let i = 0; i < 130; i++) {
        const x = Math.random() * 1100 - 50, y = 590 - x * .5 + (Math.random() - .5) * 170, r = 25 + Math.random() * 115;
        const g = t.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, i % 4 === 0 ? "rgba(186,92,94,.035)" : "rgba(108,79,165,.045)");
        g.addColorStop(1, "rgba(18,15,38,0)");
        t.fillStyle = g; t.fillRect(x - r, y - r, r * 2, r * 2);
      }
      for (let i = 0; i < 2400; i++) {
        const x = Math.random() * 1000, y = 590 - x * .5 + (Math.random() - .5) * Math.random() * 260;
        t.fillStyle = `rgba(222,191,227,${Math.random() * .13})`;
        t.fillRect(x, y, .6, .6);
      }
      wake();
    }
    const move = (e: PointerEvent) => {
      if (!fine.matches || reduce.matches || compact.matches) return;
      mx = e.clientX / w - .5; my = e.clientY / h - .5;
      light.style.transform = `translate3d(${e.clientX}px,${e.clientY}px,0)`;
      light.dataset.visible = "true";
      light.dataset.active = String(e.target instanceof Element && !!e.target.closest("a,button,summary,[data-cosmic-interactive]"));
    };
    const leave = () => { light.dataset.visible = "false"; mx = 0; my = 0; };
    const onScroll = () => { if (animate()) scroll = window.scrollY / Math.max(1, document.documentElement.scrollHeight - h); };
    const preference = () => { leave(); scroll = 0; wake(); };
    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", move, { passive: true });
    document.addEventListener("pointerleave", leave);
    window.addEventListener("scroll", onScroll, { passive: true });
    document.addEventListener("visibilitychange", wake);
    reduce.addEventListener("change", preference);
    fine.addEventListener("change", preference);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", move);
      document.removeEventListener("pointerleave", leave);
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("visibilitychange", wake);
      reduce.removeEventListener("change", preference);
      fine.removeEventListener("change", preference);
    };
  }, []);

  return <>
    <div className={`universe-sky ${path === "/" ? "universe-sky--home" : ""}`} aria-hidden="true">
      <div className="universe-nebula" /><canvas ref={canvas} /><div className="universe-horizon" />
    </div>
    <div ref={pointer} className="universe-pointer" aria-hidden="true"><i /><b /></div>
  </>;
}
