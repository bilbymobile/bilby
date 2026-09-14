import { motion, useInView } from "framer-motion";
import { useEffect, useRef, useState, type ReactNode } from "react";

export function Reveal({ children, delay = 0, y = 36, className = "" }: { children: ReactNode; delay?: number; y?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  return (
    <motion.div
      ref={ref}
      className={className}
      initial={{ opacity: 0, y }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.9, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

export function SectionTag({ no, label, accent = "#FFB43A" }: { no: string; label: string; accent?: string }) {
  return (
    <div className="flex items-center gap-3 mb-6">
      <span className="font-monox text-[11px] tracking-[0.25em] px-3 py-1.5 border border-white/15 rounded-full text-white/70" style={{ borderColor: `${accent}55`, color: accent }}>
        {no}
      </span>
      <span className="font-monox text-[11px] tracking-[0.3em] text-white/50 uppercase">{label}</span>
      <div className="h-px flex-1 bg-gradient-to-r from-white/20 to-transparent" />
    </div>
  );
}

export function useCountUp(target: number, active: boolean, dur = 1600) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!active) return;
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / dur);
      const e = 1 - Math.pow(1 - p, 3);
      setV(target * e);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, target, dur]);
  return v;
}
