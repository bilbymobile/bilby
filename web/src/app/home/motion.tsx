"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Two pieces of motion, and no library.
 *
 * Both check `prefers-reduced-motion` and both degrade to the finished state
 * rather than to nothing, because a scroll reveal that fails leaves the page
 * blank and a parallax that fails just sits still.
 */

function reduced() {
  return typeof window !== "undefined"
    && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Parallax on the hero art.
 *
 * The image moves at roughly a fifth of scroll speed, which is enough to read
 * as depth and little enough that nobody notices it as an effect. Driven by a
 * CSS variable set inside requestAnimationFrame: writing `transform` directly
 * from a scroll handler forces a layout on every frame, and on a mid range
 * Android that is the difference between smooth and visibly stuttering.
 */
export function HeroParallax({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || reduced()) return;

    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const y = Math.min(window.scrollY, 900);
        el.style.setProperty("--shift", `${y * 0.18}px`);
      });
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return <div ref={ref} style={{ display: "contents" }}>{children}</div>;
}

/**
 * Reveal on first intersection, then stop observing.
 *
 * Once is deliberate. Elements that re-animate every time they scroll back into
 * view read as a demo rather than a product, and they make the page feel busy
 * on a phone where everything crosses the viewport twice.
 */
export function Reveal({
  children,
  delay = 0,
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (reduced()) {
      setShown(true);
      return;
    }
    const el = ref.current;
    if (!el) return;

    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      { threshold: 0.08, rootMargin: "0px 0px -60px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`${className} ${shown ? "is-revealed" : "is-hidden"}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}
