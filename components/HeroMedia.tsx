"use client";

/**
 * Hero background media: a still poster everywhere, the video on desktop only.
 *
 * The poster (hero-poster.webp, ~60 KB) renders immediately on every device,
 * so phones get a real image instead of an empty hero. It is also frame 0 of
 * the video, so on desktop the hand-off to the moving version is seamless.
 *
 * The video is never rendered on phones, data-saver connections or for
 * reduced-motion users — not hidden, not preload="none", but absent from the
 * DOM — so neither hero.webm nor hero.mp4 appears in the request list at all.
 * On desktop it mounts only after the page has fully loaded, then fades in
 * once frames are actually PLAYING. WebM (VP9) is offered first; Safari and
 * older browsers fall through to the MP4.
 *
 * Both layers sit inside one opacity-40 wrapper, so the composite over the
 * black hero is identical to the old video-only look rather than double-bright
 * while poster and video overlap.
 */

import { useEffect, useRef, useState } from "react";

export default function HeroMedia() {
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const small = window.matchMedia("(max-width: 767px)").matches;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
    if (small || reducedMotion || saveData) return;

    // Wait for the page (fonts, JS, everything) before touching the video.
    // Deferred a frame even when already loaded, so the poster paints first
    // and we never setState synchronously inside the effect.
    if (document.readyState === "complete") {
      const id = requestAnimationFrame(() => setReady(true));
      return () => cancelAnimationFrame(id);
    } else {
      const onLoad = () => setReady(true);
      window.addEventListener("load", onLoad);
      return () => window.removeEventListener("load", onLoad);
    }
  }, []);

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 opacity-40">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/hero-poster.webp"
        alt=""
        width={1280}
        height={720}
        decoding="async"
        fetchPriority="high"
        className="absolute inset-0 h-full w-full object-cover"
      />
      {ready && (
        <video
          ref={ref}
          className={
            "absolute inset-0 h-full w-full object-cover transition-opacity duration-1000 " +
            (playing ? "opacity-100" : "opacity-0")
          }
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          // Some browsers ignore the autoplay attribute on late-inserted videos —
          // ask explicitly, and only fade in once frames are actually rendering.
          onCanPlay={() => ref.current?.play().catch(() => { /* autoplay blocked: poster carries the hero */ })}
          onPlaying={() => setPlaying(true)}
        >
          <source src="/hero.webm" type="video/webm" />
          <source src="/hero.mp4" type="video/mp4" />
        </video>
      )}
    </div>
  );
}
