import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import { ArrowDown, Play, ShieldCheck, Star } from "lucide-react";
import { Link } from "react-router-dom";

export default function Hero() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [0, 220]);
  const scale = useTransform(scrollYProgress, [0, 1], [1, 1.18]);
  return (
    <section ref={ref} className="relative min-h-[108vh] flex flex-col overflow-hidden bg-black">
      <motion.div style={{ y, scale }} className="absolute inset-0">
        <video autoPlay muted loop playsInline poster="/images/bilby-hero.png" className="w-full h-full object-cover opacity-50">
          <source src="/videos/hero.mp4" type="video/mp4" />
        </video>
        <div className="absolute inset-0 bg-gradient-to-b from-black/75 via-black/35 to-[#060913]" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/20 to-black/50" />
        <div className="absolute inset-0 dawn-drift bg-[radial-gradient(60%_50%_at_70%_30%,rgba(255,180,58,0.16),transparent_70%)]" />
      </motion.div>

      <div className="letterbox-top"><div className="max-w-7xl mx-auto px-5 md:px-8 h-full flex items-center justify-between font-monox text-[10px] tracking-[0.3em] text-white/50"><span>BILBYMOBILE PRESENTS · MEET BILBY</span><span className="hidden md:inline">GLOBAL TRAVEL ESIM · 190+ COUNTRIES</span><span className="text-[#FFB43A]">● REC</span></div></div>

      <div className="relative z-10 flex-1 flex items-center max-w-7xl mx-auto w-full px-5 md:px-8 pt-36 pb-16">
        <div className="grid lg:grid-cols-[1.15fr_0.85fr] gap-10 items-center w-full">
          <div>
            <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }} className="flex flex-wrap items-center gap-3 mb-7">
              <span className="font-monox text-[11px] tracking-[0.2em] bg-white/10 border border-white/20 backdrop-blur rounded-full px-4 py-2 flex items-center gap-2"><img src="/images/bilby-hero.png" alt="" className="w-5 h-5 rounded-full object-cover" /> BILBY IS CLEARED FOR TAKEOFF</span>
              <span className="font-monox text-[11px] tracking-[0.2em] bg-[#FFB43A]/15 border border-[#FFB43A]/40 text-[#FFB43A] rounded-full px-4 py-2 flex items-center gap-1.5"><Star className="w-3 h-3 fill-current" /> 4.9 · 86K REVIEWS</span>
              <span className="hidden md:inline font-monox text-[11px] tracking-[0.2em] bg-white/10 border border-white/20 rounded-full px-4 py-2 items-center gap-1.5"><ShieldCheck className="w-3 h-3" /> VPN + AD-BLOCK INSIDE</span>
            </motion.div>

            <h1 className="font-display leading-[0.86] tracking-tight">
              <motion.span initial={{ opacity: 0, y: 80 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1, delay: 0.1 }} className="block text-[17vw] md:text-[9rem] lg:text-[10rem]">HOP THE</motion.span>
              <motion.span initial={{ opacity: 0, y: 80 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1, delay: 0.22 }} className="block text-[17vw] md:text-[9rem] lg:text-[10rem] dawn-text">PLANET.</motion.span>
            </h1>

            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5, duration: 0.9 }} className="max-w-xl text-white/75 text-base md:text-lg leading-relaxed mt-7">
              BilbyMobile is the cinematic global travel eSIM — <span className="font-serifx italic text-[#FFB43A] text-xl">instant activation</span> in 190+ countries from $4.99, guided by Bilby, the outback-hopping signal buddy from bilbymobile.com. Regional &amp; business plans dock next.
            </motion.p>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.65 }} className="flex flex-wrap items-center gap-4 mt-7">
              <Link to="/app" className="group bg-[#FFB43A] text-black font-bold rounded-full pl-7 pr-2 py-2 flex items-center gap-4 hover:bg-[#ffd07a] transition-colors">
                <span className="font-monox text-xs tracking-[0.15em]">GET YOUR ESIM — FROM $4.99</span>
                <span className="w-10 h-10 rounded-full bg-black text-[#FFB43A] grid place-items-center group-hover:rotate-45 transition-transform"><Play className="w-4 h-4 fill-current" /></span>
              </Link>
              <a href="#bilby" className="font-monox text-[11px] tracking-[0.2em] text-white/70 hover:text-white border-b border-white/30 hover:border-[#FFB43A] pb-1 transition-colors">MEET BILBY ▼</a>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.85, duration: 0.9 }} className="mt-10 grid grid-cols-2 md:grid-cols-4 border-t border-white/15 pt-6 gap-6">
              {["190+ countries", "$4.99 entry pack", "< 3 min activation", "Regional + Biz soon"].map((s) => (
                <div key={s} className="font-monox text-[11px] md:text-xs tracking-[0.18em] text-white/60 uppercase flex items-center gap-2.5"><span className="w-1.5 h-1.5 bg-[#FFB43A] rotate-45 shrink-0" />{s}</div>
              ))}
            </motion.div>
          </div>

          <motion.div initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 1.1, delay: 0.35 }} className="relative mx-auto w-full max-w-[420px]">
            <div className="absolute inset-0 grid place-items-center pointer-events-none">
              <span className="ping-ring absolute w-[86%] aspect-square rounded-full border border-[#FFB43A]/60" />
              <span className="ping-ring absolute w-[86%] aspect-square rounded-full border border-[#6EE7FF]/50" style={{ animationDelay: "1.4s" }} />
              <span className="spin-slower absolute w-[102%] aspect-square rounded-full border border-dashed border-white/15" />
            </div>
            <div className="floaty-soft relative rounded-[2.5rem] overflow-hidden border border-white/20 bilby-glow">
              <img src="/images/bilby-hero.png" alt="Bilby — the BilbyMobile mascot hopping over Australia beaming 5G signal" className="w-full aspect-[4/5] object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
              <div className="absolute top-4 left-4 font-monox text-[10px] tracking-[0.2em] bg-black/60 backdrop-blur border border-white/20 rounded-full px-3 py-1.5">● BILBY · SIGNAL BUDDY</div>
              <div className="absolute top-4 right-4 font-monox text-[10px] tracking-wider bg-[#FFB43A] text-black font-bold rounded-full px-3 py-1.5">5G · 190+ COUNTRIES</div>
              <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between">
                <div><div className="font-display text-3xl tracking-wide leading-none">BILBY SAYS HI</div><div className="font-monox text-[10px] tracking-[0.2em] text-white/60">FROM BILBYMOBILE.COM · NOW IN ORBIT</div></div>
                <div className="font-monox text-[10px] text-[#6EE7FF] border border-[#6EE7FF]/40 bg-black/50 rounded-full px-3 py-1.5">≋ 5 BARS</div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      <div className="letterbox-bottom"><div className="max-w-7xl mx-auto px-5 md:px-8 h-full flex items-center justify-between font-monox text-[10px] tracking-[0.3em] text-white/50"><span>SCENE 01 · DEPARTURE · STARRING BILBY</span><span className="flex items-center gap-2">SCROLL <ArrowDown className="w-3 h-3 animate-bounce" /></span><span className="hidden md:inline">35MM · ANAMORPHIC · 5G</span></div></div>
    </section>
  );
}
