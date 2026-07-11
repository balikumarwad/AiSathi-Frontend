"use client";

/**
 * Deferred hero video: the page paints instantly (the animated aurora underlay
 * carries the scene), and the ~5MB video only starts downloading after the
 * page has fully loaded — then fades in once it is actually PLAYING.
 *
 * Phones are skipped entirely: 5MB of background video is hostile on mobile
 * data, and iOS Low-Power Mode / data-saver block autoplay anyway. Mobile
 * gets the CSS aurora animation instead, which always moves and costs nothing.
 */

import { useEffect, useRef, useState } from "react";

export default function HeroVideo() {
  const [ready, setReady] = useState(false);
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    // Skip on small screens and on data-saver connections.
    const small = window.matchMedia("(max-width: 767px)").matches;
    const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
    if (small || saveData) return;

    // Wait for the page (fonts, JS, everything) before touching the video.
    if (document.readyState === "complete") setReady(true);
    else {
      const onLoad = () => setReady(true);
      window.addEventListener("load", onLoad);
      return () => window.removeEventListener("load", onLoad);
    }
  }, []);

  if (!ready) return null;

  return (
    <video
      ref={ref}
      className={
        "absolute inset-0 h-full w-full object-cover transition-opacity duration-1000 " +
        (visible ? "opacity-40" : "opacity-0")
      }
      autoPlay
      muted
      loop
      playsInline
      preload="auto"
      // Some browsers ignore the autoplay attribute on late-inserted videos —
      // ask explicitly, and only fade in once frames are actually rendering.
      onCanPlay={() => ref.current?.play().catch(() => { /* autoplay blocked: aurora carries the hero */ })}
      onPlaying={() => setVisible(true)}
    >
      <source src="/hero.mp4" type="video/mp4" />
    </video>
  );
}
