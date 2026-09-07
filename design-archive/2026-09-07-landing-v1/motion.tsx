"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Three pieces of motion, and no library.
 *
 * Every one checks `prefers-reduced-motion` and every one degrades to the
 * finished state rather than to nothing, because a scroll reveal that fails
 * leaves the page blank while a parallax that fails just sits still.
 *
 * No library is a decision, not an omission. A scroll animation package would
 * be 30 to 60 kilobytes on the critical path of a page whose entire job is to
 * load fast enough that an anxious traveller does not leave, in exchange for
 * conveniences this page uses none of.
 */

function reduced() {
  return typeof window !== "undefined"
    && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * The hero's relationship with the scroll.
 *
 * One listener, one rAF, two variables. `--shift` is the parallax; `--exit`
 * runs 0 to 1 over the first 720 pixels and drives a slow push in and a fade,
 * so scrolling off the hero reads as a shot ending rather than a picture
 * sliding out of the way.
 *
 * Both are CSS variables set inside requestAnimationFrame rather than styles
 * written from the scroll handler. Writing `transform` directly from a scroll
 * event forces layout on every frame, and on a mid range Android that is the
 * difference between smooth and visibly stuttering.
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
        const y = window.scrollY;
        el.style.setProperty("--shift", `${Math.min(y, 900) * 0.18}px`);
        el.style.setProperty("--exit", `${Math.min(y / 720, 1)}`);
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
 * Dust in the light.
 *
 * Twenty two specks drifting up and right through the warm half of the frame.
 * It is the cheapest atmosphere available and the reason it works is that it is
 * barely visible: at these opacities nobody consciously sees a particle, they
 * just stop reading the picture as a flat asset.
 *
 * Drawn on one canvas rather than as DOM nodes. Twenty two animated elements is
 * twenty two things for the compositor to track every frame; a canvas is one.
 * The whole loop stops when the hero leaves the viewport, because painting dust
 * nobody can see is the definition of wasted battery.
 */
export function Motes({ className = "" }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = ref.current;
    if (!cv || reduced()) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let w = 0;
    let h = 0;

    const size = () => {
      const r = cv.getBoundingClientRect();
      w = r.width;
      h = r.height;
      cv.width = Math.max(1, Math.round(w * dpr));
      cv.height = Math.max(1, Math.round(h * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    size();

    const N = 22;
    const dust = Array.from({ length: N }, () => ({
      x: Math.random(),
      y: Math.random(),
      r: 0.8 + Math.random() * 1.9,
      // Slow, and slightly different per speck. Identical speeds read as a
      // texture scrolling rather than as particles.
      vx: 0.012 + Math.random() * 0.022,
      vy: -(0.008 + Math.random() * 0.018),
      a: 0.06 + Math.random() * 0.2,
      // Phase offset so they do not all twinkle together.
      p: Math.random() * Math.PI * 2,
    }));

    let raf = 0;
    let running = true;
    let t = 0;

    const frame = () => {
      if (!running) return;
      t += 0.016;
      ctx.clearRect(0, 0, w, h);
      for (const d of dust) {
        d.x += (d.vx / 100);
        d.y += (d.vy / 100);
        if (d.x > 1.05) d.x = -0.05;
        if (d.y < -0.05) d.y = 1.05;
        const twinkle = 0.65 + 0.35 * Math.sin(t * 0.7 + d.p);
        ctx.beginPath();
        ctx.arc(d.x * w, d.y * h, d.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 246, 228, ${d.a * twinkle})`;
        ctx.fill();
      }
      raf = requestAnimationFrame(frame);
    };

    // Pause when the hero is off screen, and when the tab is hidden.
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !running) {
        running = true;
        frame();
      } else if (!e.isIntersecting) {
        running = false;
        if (raf) cancelAnimationFrame(raf);
      }
    });
    io.observe(cv);

    const onVis = () => {
      if (document.hidden) {
        running = false;
        if (raf) cancelAnimationFrame(raf);
      } else if (!running) {
        running = true;
        frame();
      }
    };
    document.addEventListener("visibilitychange", onVis);

    const ro = new ResizeObserver(size);
    ro.observe(cv);

    frame();
    return () => {
      running = false;
      if (raf) cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  return <canvas ref={ref} className={className} aria-hidden="true" />;
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
    // The gate in the document head decides whether this page is allowed to
    // hide anything. If it never ran, or ran and declined, the CSS that hides
    // this element is inert, so the observer would only be maintaining a class
    // nobody reads. Marking it shown keeps the DOM honest about what a person
    // can actually see.
    if (reduced() || document.documentElement.dataset.motion !== "on") {
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
