"use client";

/**
 * Deferred hero video: the page paints instantly (the aurora underlay carries
 * the scene), and the 5MB video only starts downloading after the page has
 * fully loaded — then fades in. On slow connections the site never feels
 * blocked by the video.
 */

import { useEffect, useState } from "react";

export default function HeroVideo() {
  const [ready, setReady] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
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
      className={
        "absolute inset-0 h-full w-full object-cover transition-opacity duration-1000 " +
        (visible ? "opacity-40" : "opacity-0")
      }
      autoPlay
      muted
      loop
      playsInline
      preload="auto"
      onCanPlay={() => setVisible(true)}
    >
      <source src="/hero.mp4" type="video/mp4" />
    </video>
  );
}
