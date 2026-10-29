"use client";
import { useEffect, useRef, type ReactNode } from "react";

/** Progressive enhancement: content is readable before JavaScript or motion. */
export default function CosmicJourney({ children }: { children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = root.current;
    if (!element) return;
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const animations = new Set<Animation>();
    const revealed = new WeakSet<Element>();
    let frame = 0;
    const sections = [...element.querySelectorAll<HTMLElement>("[data-chapter]")];
    const update = () => {
      frame = 0;
      if (media.matches || document.hidden) return;
      for (const section of sections) {
        const box = section.getBoundingClientRect();
        if (box.bottom < 0 || box.top > innerHeight) continue;
        section.style.setProperty("--chapter-travel", `${Math.max(-35, Math.min(35, (innerHeight / 2 - box.top - box.height / 2) * .065))}px`);
      }
    };
    const scroll = () => { if (!frame && !media.matches) frame = requestAnimationFrame(update); };
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        (entry.target as HTMLElement).dataset.inview = String(entry.isIntersecting);
        if (!entry.isIntersecting) continue;
        if (revealed.has(entry.target)) continue;
        revealed.add(entry.target);
        if (media.matches) continue;
        const ornament = entry.target.querySelector(".chapter-orbit, .destination-art, .transmission-lines");
        if (ornament) {
          const animation = ornament.animate([{ opacity: 0, transform: "translateY(24px) scale(.96)" }, { opacity: getComputedStyle(ornament).opacity, transform: getComputedStyle(ornament).transform }], { duration: 1100, easing: "cubic-bezier(.16,1,.3,1)" });
          animations.add(animation);
          animation.onfinish = () => animations.delete(animation);
        }
      }
    }, { threshold: .12 });
    sections.forEach(section => observer.observe(section));
    const reset = () => { animations.forEach(a => a.cancel()); animations.clear(); sections.forEach(s => s.style.removeProperty("--chapter-travel")); scroll(); };
    media.addEventListener("change", reset);
    window.addEventListener("scroll", scroll, { passive: true });
    window.addEventListener("resize", scroll);
    scroll();
    return () => { cancelAnimationFrame(frame); observer.disconnect(); animations.forEach(a => a.cancel()); window.removeEventListener("scroll", scroll); window.removeEventListener("resize", scroll); media.removeEventListener("change", reset); };
  }, []);
  return <div ref={root} className="cosmic-journey">{children}</div>;
}
