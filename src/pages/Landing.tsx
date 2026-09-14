import { useMemo, useRef, useState } from "react";
import { motion, useInView } from "framer-motion";
import { Link } from "react-router-dom";
import {
  ArrowUpRight, Check, Copy, Smartphone, MonitorSmartphone, Apple,
  Play, QrCode, Wifi, ShieldCheck, Zap, Globe2, Star, ChevronDown,
  Radar, Clapperboard, SquareCode, MoonStar, Orbit, BadgeCheck, SignalHigh, CreditCard, Timer, Rabbit, Briefcase
} from "lucide-react";
import Navbar from "../components/Navbar";
import Hero from "../components/Hero";
import Marquee from "../components/Marquee";
import { Reveal, SectionTag, useCountUp } from "../components/ui";
import { destinations, competitors, tiers, reviews, faqs, agents, sprint, sources, planTabs } from "../data/content";

const agentIcons: Record<string, any> = { Radar, Clapperboard, SquareCode, MoonStar, Orbit };

function Stats() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true });
  const c1 = useCountUp(190, inView);
  const c2 = useCountUp(2.1, inView);
  const c3 = useCountUp(86, inView);
  const c4 = useCountUp(99.98, inView);
  const stats = [
    { v: `${Math.round(c1)}+`, l: "Countries & territories", s: "Global-first · regional next" },
    { v: `${c2.toFixed(1)}M`, l: "Hoppers connected", s: "BilbyMobile target '26" },
    { v: `${Math.round(c3)}K`, l: "Five-star reviews", s: "4.9 average · iOS + Play" },
    { v: `${c4.toFixed(2)}%`, l: "Activation success", s: "Median setup: 2 min 41 s" },
  ];
  return (
    <div ref={ref} className="max-w-7xl mx-auto px-5 md:px-8 py-20 grid grid-cols-2 lg:grid-cols-4 gap-px bg-white/10 border border-white/10 rounded-3xl overflow-hidden">
      {stats.map((s) => (
        <div key={s.l} className="bg-[#060913] p-7 md:p-9">
          <div className="font-display text-5xl md:text-6xl text-[#FFB43A] tick">{s.v}</div>
          <div className="mt-2 font-semibold">{s.l}</div>
          <div className="font-monox text-[11px] tracking-wider text-white/40 mt-1">{s.s}</div>
        </div>
      ))}
    </div>
  );
}

function Destinations() {
  const [region, setRegion] = useState("All");
  const [q, setQ] = useState("");
  const regions = ["All", ...Array.from(new Set(destinations.map((d) => d.region)))];
  const list = destinations.filter((d) => (region === "All" || d.region === region) && (d.city + d.country).toLowerCase().includes(q.toLowerCase()));
  return (
    <section id="destinations" className="max-w-7xl mx-auto px-5 md:px-8 py-24">
      <SectionTag no="SCENE 02" label="Now showing — global destinations" />
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-10">
        <h2 className="font-display text-6xl md:text-8xl leading-[0.9]">PICK YOUR<br /><span className="font-serifx italic font-normal text-[#FFB43A] tracking-normal">next hop.</span></h2>
        <div className="flex flex-col sm:flex-row gap-3">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search Tokyo, Bali, Chile…" className="bg-white/5 border border-white/15 rounded-full px-5 py-3 text-sm outline-none focus:border-[#FFB43A] w-full sm:w-64 placeholder:text-white/30" />
          <Link to="/app" className="bg-white text-black rounded-full px-6 py-3 font-bold text-sm flex items-center gap-2 hover:bg-[#FFB43A] transition-colors whitespace-nowrap">Open full store <ArrowUpRight className="w-4 h-4" /></Link>
        </div>
      </div>
      <div className="flex gap-2 flex-wrap mb-8">
        {regions.map((r) => (
          <button key={r} onClick={() => setRegion(r)} className={`font-monox text-[11px] tracking-[0.15em] uppercase rounded-full px-4 py-2 border transition-all ${region === r ? "bg-[#FFB43A] text-black border-[#FFB43A] font-bold" : "border-white/15 text-white/60 hover:border-white/40"}`}>{r}</button>
        ))}
      </div>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
        {list.map((d, i) => (
          <Reveal key={d.id + d.city} delay={(i % 3) * 0.08}>
            <Link to="/app" className="card-sheen group block rounded-3xl overflow-hidden border border-white/10 bg-[#0c1220] hover:border-[#FFB43A]/60 transition-colors">
              <div className="relative h-60 overflow-hidden">
                <img src={d.img} alt={d.city} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-[1.2s]" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0c1220] via-transparent to-black/30" />
                <span className="absolute top-4 left-4 font-monox text-[10px] tracking-[0.2em] bg-black/60 backdrop-blur border border-white/20 rounded-full px-3 py-1.5">{d.tag}</span>
                <span className="absolute top-4 right-4 font-monox text-[10px] tracking-wider bg-[#FFB43A] text-black font-bold rounded-full px-3 py-1.5">FROM ${d.price}</span>
                <div className="absolute bottom-4 left-5 right-5 flex items-end justify-between">
                  <div><div className="font-display text-4xl tracking-wide leading-none">{d.city.toUpperCase()}</div><div className="font-monox text-[11px] tracking-[0.2em] text-white/60">{d.country.toUpperCase()} · {d.net.toUpperCase()}</div></div>
                  <div className="text-right"><div className="flex items-center gap-1 text-[#FFB43A] text-sm font-bold"><Star className="w-3.5 h-3.5 fill-current" />{d.rating}</div><div className="font-monox text-[10px] text-white/50">{d.data} · {d.days} DAYS</div></div>
                </div>
              </div>
              <div className="p-5 flex items-center justify-between">
                <span className="font-monox text-[11px] tracking-[0.15em] text-white/50">{d.data} · {d.days} DAYS · 5G</span>
                <span className="font-monox text-[11px] tracking-[0.15em] font-bold text-[#FFB43A] flex items-center gap-1 group-hover:gap-2.5 transition-all">GET ESIM <ArrowUpRight className="w-4 h-4" /></span>
              </div>
            </Link>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

function Bilby() {
  const [tab, setTab] = useState("global");
  const active = planTabs.find((t) => t.id === tab)!;
  const traits = [
    { icon: Rabbit, t: "Long ears, long range", x: "Bilby's outback ears became our signal arcs — tier-1 5G partners in every country, no cheapest-bidder roulette." },
    { icon: MoonStar, t: "Nocturnal, like support", x: "Bilbies roam at night. So do we — humans reply in under a minute, 24/7, even at 3 AM in Reykjavik." },
    { icon: Briefcase, t: "A pouch for everything", x: "Rollover data rides in Bilby's pouch. Regional passports next, then pooled business data for the whole mob." },
  ];
  return (
    <section id="bilby" className="bg-[#0c1220] border-y border-white/10 py-24 overflow-hidden">
      <div className="max-w-7xl mx-auto px-5 md:px-8 grid lg:grid-cols-2 gap-12 items-center">
        <Reveal className="relative order-2 lg:order-1">
          <div className="absolute inset-0 grid place-items-center pointer-events-none">
            <span className="ping-ring absolute w-[78%] aspect-square rounded-full border border-[#FFB43A]/60" />
            <span className="ping-ring absolute w-[78%] aspect-square rounded-full border border-[#6EE7FF]/50" style={{ animationDelay: "1.4s" }} />
            <span className="spin-slower absolute w-[94%] aspect-square rounded-full border border-dashed border-white/15" />
          </div>
          <div className="floaty-soft relative rounded-[2.5rem] overflow-hidden border border-white/20 bilby-glow max-w-[440px] mx-auto">
            <img src="/images/bilby-hero.png" alt="Bilby, the BilbyMobile mascot, hopping over Australia beaming 5G signal" className="w-full aspect-[4/5] object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
            <div className="absolute top-4 left-4 font-monox text-[10px] tracking-[0.2em] bg-black/60 backdrop-blur border border-white/20 rounded-full px-3 py-1.5">● FROM BILBYMOBILE.COM</div>
            <div className="absolute top-4 right-4 font-monox text-[10px] tracking-wider bg-[#FFB43A] text-black font-bold rounded-full px-3 py-1.5">YOUR SIGNAL BUDDY</div>
            <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between">
              <div><div className="font-display text-3xl tracking-wide leading-none">HOP WITH BILBY</div><div className="font-monox text-[10px] tracking-[0.2em] text-white/60">SCANS · GUIDES · CONNECTS</div></div>
              <div className="font-monox text-[10px] text-[#6EE7FF] border border-[#6EE7FF]/40 bg-black/50 rounded-full px-3 py-1.5">≋ 5 BARS</div>
            </div>
          </div>
        </Reveal>
        <div className="order-1 lg:order-2">
          <SectionTag no="STARRING" label="Meet Bilby — the mascot" />
          <h2 className="font-display text-6xl md:text-7xl leading-[0.9] mb-5">SMALL MARSUPIAL.<br /><span className="font-serifx italic font-normal text-[#FFB43A]">giant signal.</span></h2>
          <p className="text-white/65 text-sm md:text-base leading-relaxed mb-8 max-w-xl">Uplifted from your cinematic concept and the mascot at bilbymobile.com: Bilby hops over Australia beaming 5G across the dawn. Every screen of this launch — landing, web console, Android and iPhone apps — is guided by those long ears and that warm outback glow.</p>
          <div className="space-y-3 mb-8">
            {traits.map((t) => (
              <div key={t.t} className="rounded-2xl border border-white/10 bg-black/40 p-5 flex gap-4">
                <span className="w-11 h-11 rounded-2xl grid place-items-center shrink-0 bg-[#FFB43A]/10 border border-[#FFB43A]/40"><t.icon className="w-5 h-5 text-[#FFB43A]" /></span>
                <div><div className="font-bold text-sm">{t.t}</div><p className="text-xs text-white/55 mt-1 leading-relaxed">{t.x}</p></div>
              </div>
            ))}
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/50 p-5">
            <div className="font-monox text-[10px] tracking-[0.25em] text-white/40 mb-3">WHERE BILBY HOPS NEXT</div>
            <div className="flex gap-2 flex-wrap mb-3">
              {planTabs.map((t) => (
                <button key={t.id} onClick={() => setTab(t.id)} className={`font-monox text-[11px] tracking-[0.15em] rounded-full px-4 py-2 border transition-all ${tab === t.id ? "bg-[#FFB43A] text-black border-[#FFB43A] font-bold" : "border-white/15 text-white/60 hover:border-white/40"}`}>{t.label}</button>
              ))}
            </div>
            <p className="text-sm text-white/65">{active.blurb}</p>
          </div>
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    { n: "01", t: "CAST", x: "Pick a country or region in the console. The 10-second compatibility scan checks your device free — iPhone 11+, Pixel 3+, Galaxy S20+ and most 5G phones pass.", icon: Globe2 },
    { n: "02", t: "ACTION", x: "Pay once, get a QR + one-tap install. No kiosks, no passport photocopies, no plastic. Your home SIM stays put for calls and 2FA codes.", icon: QrCode },
    { n: "03", t: "ARRIVE", x: "The plan sleeps until touchdown, then wakes on first network contact. Track every MB on the burn meter, top up mid-film, roll over what's left.", icon: SignalHigh },
  ];
  return (
    <section className="max-w-7xl mx-auto px-5 md:px-8 py-24">
      <SectionTag no="SCENE 03" label="How the magic trick works" />
      <h2 className="font-display text-6xl md:text-8xl leading-[0.9] mb-12">THREE TAKES.<br /><span className="text-stroke">ZERO ROAMING FEES.</span></h2>
      <div className="grid md:grid-cols-3 gap-5">
        {steps.map((s, i) => (
          <Reveal key={s.n} delay={i * 0.1}>
            <div className="rounded-3xl border border-white/10 bg-[#0c1220] p-8 h-full hover:border-[#FFB43A]/50 transition-colors group">
              <div className="flex items-center justify-between mb-8"><span className="font-display text-6xl text-white/15 group-hover:text-[#FFB43A] transition-colors">{s.n}</span><s.icon className="w-8 h-8 text-[#FFB43A]" /></div>
              <div className="font-display text-3xl tracking-wider mb-3">{s.t}</div>
              <p className="text-white/60 text-sm leading-relaxed">{s.x}</p>
            </div>
          </Reveal>
        ))}
      </div>
      <Reveal className="mt-8">
        <div className="rounded-3xl overflow-hidden border border-white/10 grid lg:grid-cols-2">
          <img src="/images/traveler.jpg" alt="Traveler activating BilbyMobile eSIM" className="h-72 lg:h-full object-cover w-full" />
          <div className="p-8 md:p-12 bg-black flex flex-col justify-center">
            <div className="font-monox text-[11px] tracking-[0.25em] text-[#6EE7FF] mb-4">● FIELD NOTE — 02:41 AM, NARITA T1</div>
            <p className="font-serifx italic text-2xl md:text-3xl leading-snug text-white/90">“Seatbelt sign off. QR scanned. Four bars before the jet bridge. My roaming bill used to be a horror film — <span className="text-[#FFB43A]">now it is a short.</span>”</p>
            <div className="mt-6 font-monox text-xs text-white/40 tracking-wider">— MAYA C., DIRECTOR OF PHOTOGRAPHY · VERIFIED HOPPER</div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

function Intel() {
  const [active, setActive] = useState(0);
  const c = competitors[active];
  const rows = useMemo(() => [
    { f: "Entry price", vals: ["USA 5 GB · $13", "Unlimited 5-day · ~$18.50", "USA 5 GB · $12", "1 GB · $4.99", "EU unlimited · from $28", "From $4.99 · rollover"] },
    { f: "Unlimited tier", vals: ["—", "$64.90/mo · hotspot", "—", "Ultra ~$60/mo", "EU from $28", "$59/mo · 100 GB hotspot"] },
    { f: "Coverage", vals: ["190+ countries", "160+ countries", "170+ countries", "150+ countries", "190+ countries", "190+ countries"] },
    { f: "Security stack", vals: ["—", "—", "—", "VPN + ad-block", "—", "VPN + ad-block inbuilt"] },
    { f: "Rollover", vals: ["—", "—", "Day-pass only", "—", "—", "Yes · all tiers"] },
    { f: "iOS rating", vals: ["4.6 ★", "4.6 ★", "4.7 ★", "4.7 ★", "4.5 ★", "4.9 ★ target"] },
  ], []);
  return (
    <section id="intel" className="max-w-7xl mx-auto px-5 md:px-8 py-24">
      <SectionTag no="SCENE 04" label="Competitive intel — Sept 2026 research" accent="#6EE7FF" />
      <h2 className="font-display text-6xl md:text-8xl leading-[0.9] mb-4">KNOW EVERY<br /><span className="font-serifx italic font-normal text-[#6EE7FF]">rival frame.</span></h2>
      <p className="max-w-2xl text-white/60 mb-10 text-sm md:text-base leading-relaxed">We studied the five operators that own the travel-eSIM conversation — their offers, voice, and visual language — then designed BilbyMobile to absorb their strengths and erase their gaps. Tap a dossier. Sources are linked at the foot of this scene.</p>
      <div className="flex gap-2 flex-wrap mb-6">
        {competitors.map((k, i) => (
          <button key={k.name} onClick={() => setActive(i)} className={`rounded-full px-5 py-2.5 font-monox text-[11px] tracking-[0.15em] uppercase border transition-all ${i === active ? "text-black font-bold" : "border-white/15 text-white/60 hover:border-white/40"}`} style={i === active ? { background: k.color, borderColor: k.color } : {}}>{k.name}</button>
        ))}
      </div>
      <motion.div key={c.name} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="rounded-3xl border border-white/10 overflow-hidden">
        <div className="p-7 md:p-10 grid lg:grid-cols-[1.2fr_1fr] gap-8" style={{ background: `linear-gradient(135deg, ${c.color}22, #060913 60%)` }}>
          <div>
            <div className="flex items-center gap-3 mb-2"><span className="w-3 h-3 rounded-full" style={{ background: c.color }} /><span className="font-monox text-[11px] tracking-[0.2em] text-white/50">{c.founded.toUpperCase()} · {c.coverage.toUpperCase()}</span></div>
            <div className="font-display text-6xl md:text-7xl tracking-wide mb-1">{c.name.toUpperCase()}</div>
            <div className="font-serifx italic text-lg text-white/70 mb-5">{c.voice}</div>
            <div className="flex gap-2 mb-6">{c.palette.map((p) => (<span key={p} className="h-10 flex-1 rounded-xl border border-white/20" style={{ background: p }} title={p} />))}</div>
            <div className="grid sm:grid-cols-2 gap-4 text-sm">
              <div className="rounded-2xl bg-black/40 border border-white/10 p-5"><div className="font-monox text-[10px] tracking-[0.2em] text-emerald-400 mb-3">STRENGTHS — STEAL THESE</div>{c.strengths.map((s) => (<div key={s} className="flex gap-2 mb-2 text-white/75"><Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />{s}</div>))}</div>
              <div className="rounded-2xl bg-black/40 border border-white/10 p-5"><div className="font-monox text-[10px] tracking-[0.2em] text-[#FF5A5A] mb-3">GAPS — EXPLOIT THESE</div>{c.gaps.map((s) => (<div key={s} className="flex gap-2 mb-2 text-white/75"><span className="text-[#FF5A5A] font-bold">✕</span>{s}</div>))}</div>
            </div>
          </div>
          <div className="rounded-2xl bg-black/60 border border-white/10 p-6 font-monox text-xs leading-relaxed">
            <div className="text-[10px] tracking-[0.25em] text-white/40 mb-4">PRICE ANCHOR · SEPT 2026</div>
            <div className="text-lg text-white font-bold mb-1">{c.priceAnchor}</div>
            <div className="text-white/50 mb-5">{c.model}<br />Rating: {c.rating}</div>
            <div className="border-t border-white/10 pt-5">
              <div className="text-[10px] tracking-[0.25em] text-[#FFB43A] mb-3">BILBY'S ANSWER</div>
              <p className="text-white/75 text-sm leading-relaxed" style={{ fontFamily: "Space Grotesk" }}>Match the anchor, then over-deliver: same entry price, plus rollover in Bilby's pouch, plus VPN + ad-block, plus activation that starts at touchdown — not at checkout.</p>
              <Link to="/app" className="mt-5 inline-flex items-center gap-2 bg-[#FFB43A] text-black font-bold rounded-full px-5 py-2.5 text-xs tracking-wider hover:bg-white transition-colors">BEAT THIS PRICE <ArrowUpRight className="w-3.5 h-3.5" /></Link>
            </div>
          </div>
        </div>
      </motion.div>
      <div className="mt-8 rounded-3xl border border-white/10 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[820px]">
            <thead><tr className="bg-white/5 font-monox text-[10px] tracking-[0.2em] text-white/50"><th className="text-left p-4">FEATURE</th><th className="p-4">AIRALO</th><th className="p-4">HOLAFLY</th><th className="p-4">NOMAD</th><th className="p-4">SAILY</th><th className="p-4">UBIGI</th><th className="p-4 bg-[#FFB43A]/10 text-[#FFB43A]">BILBY ★</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.f} className="border-t border-white/10 hover:bg-white/[0.03]">
                  <td className="p-4 font-bold whitespace-nowrap">{r.f}</td>
                  {r.vals.map((v, i) => (<td key={i} className={`p-4 text-center text-white/70 ${i === 5 ? "bg-[#FFB43A]/10 text-white font-semibold" : ""}`}>{v}</td>))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        {sources.map((s) => (<a key={s.url} href={s.url} target="_blank" rel="noreferrer" className="font-monox text-[10px] tracking-wider text-white/40 hover:text-[#6EE7FF] border border-white/10 hover:border-[#6EE7FF]/50 rounded-full px-3 py-1.5 transition-colors">↗ {s.label}</a>))}
      </div>
    </section>
  );
}

function Passes() {
  const [yearly, setYearly] = useState(false);
  return (
    <section id="passes" className="bg-[#0c1220] border-y border-white/10 py-24">
      <div className="max-w-7xl mx-auto px-5 md:px-8">
        <SectionTag no="SCENE 05" label="Plans — global first, regional + business next" />
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-10">
          <h2 className="font-display text-6xl md:text-8xl leading-[0.9]">THREE PASSES.<br /><span className="text-stroke-amber">NO PLOT TWISTS.</span></h2>
          <div className="flex items-center gap-3 font-monox text-xs tracking-widest">
            <span className={!yearly ? "text-white" : "text-white/40"}>MONTHLY</span>
            <button onClick={() => setYearly(!yearly)} className={`w-14 h-7 rounded-full p-1 transition-colors ${yearly ? "bg-[#FFB43A]" : "bg-white/15"}`}><div className={`w-5 h-5 rounded-full bg-white transition-transform ${yearly ? "translate-x-7" : ""}`} style={yearly ? { background: "#000" } : {}} /></button>
            <span className={yearly ? "text-white" : "text-white/40"}>YEARLY <span className="text-[#FFB43A]">−20%</span></span>
          </div>
        </div>
        <div className="grid md:grid-cols-3 gap-5">
          {tiers.map((t, i) => (
            <Reveal key={t.name} delay={i * 0.1}>
              <div className={`relative rounded-3xl p-8 h-full flex flex-col ${t.hot ? "bg-[#FFB43A] text-black border-2 border-[#FFB43A]" : "bg-[#060913] border border-white/10"}`}>
                {t.hot && <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-black text-[#FFB43A] font-monox text-[10px] tracking-[0.2em] rounded-full px-4 py-1.5">★ BILBY'S PICK</span>}
                <div className={`font-monox text-[11px] tracking-[0.25em] ${t.hot ? "text-black/60" : "text-white/40"}`}>{t.tag.toUpperCase()}</div>
                <div className="font-display text-5xl tracking-wide mt-1">{t.name}</div>
                <div className="mt-4 flex items-end gap-2"><span className="font-display text-7xl leading-none tick">${yearly ? Math.round(t.price * 0.8) : t.price}</span><span className={`mb-2 font-monox text-xs ${t.hot ? "text-black/60" : "text-white/40"}`}>/ MO{yearly ? " · BILLED YEARLY" : ""}</span></div>
                <p className={`text-sm mt-3 ${t.hot ? "text-black/70" : "text-white/60"}`}>{t.desc}</p>
                <div className="my-6 h-px bg-current opacity-15" />
                {t.feats.map((f) => (<div key={f} className="flex gap-2.5 mb-2.5 text-sm font-medium"><span className={`w-5 h-5 rounded-full grid place-items-center shrink-0 ${t.hot ? "bg-black text-[#FFB43A]" : "bg-[#FFB43A]/15 text-[#FFB43A]"}`}><Check className="w-3 h-3" /></span>{f}</div>))}
                <Link to="/app" className={`mt-7 text-center font-bold rounded-full py-3.5 text-sm transition-all ${t.hot ? "bg-black text-[#FFB43A] hover:bg-[#1a1a1a]" : "bg-white/10 hover:bg-[#FFB43A] hover:text-black"}`}>{t.cta}</Link>
              </div>
            </Reveal>
          ))}
        </div>
        <p className="mt-6 font-monox text-[11px] tracking-wider text-white/35 text-center">MOB “UNLIMITED” = 100 GB FULL-SPEED + UNLIMITED AT 2 MBPS AFTER · HOTSPOT 100 GB · BUSINESS POOLING + TEAM CONSOLE SHIP IN THE HANDOVER — FAIR-USE PRINTED ON THE SAME SCREEN, NOT PAGE 14.</p>
      </div>
    </section>
  );
}

function Apps() {
  return (
    <section id="apps" className="max-w-7xl mx-auto px-5 md:px-8 py-24">
      <SectionTag no="SCENE 06" label="Full package — preview before handover" accent="#D9FF4B" />
      <h2 className="font-display text-6xl md:text-8xl leading-[0.9] mb-4">WEB. ANDROID.<br /><span className="font-serifx italic font-normal text-[#D9FF4B]">iPhone. One burrow.</span></h2>
      <p className="max-w-2xl text-white/60 mb-4 text-sm md:text-base">Landing page first — this is the preview you approve. The web console is already live in this build; Android and iPhone shells ride the same tokens and ship in the handover package.</p>
      <div className="mb-12 flex flex-wrap gap-2">
        {[["WEB APP", "LIVE NOW · /APP"], ["ANDROID APP", "HANDOVER TRACK"], ["IPHONE APP", "HANDOVER TRACK"]].map(([a, b], i) => (
          <span key={a} className={`font-monox text-[11px] tracking-[0.15em] rounded-full px-4 py-2 border ${i === 0 ? "bg-[#D9FF4B]/10 border-[#D9FF4B]/50 text-[#D9FF4B]" : "border-white/15 text-white/50"}`}>{i === 0 ? "●" : "○"} {a} · {b}</span>
        ))}
      </div>
      <div className="grid lg:grid-cols-3 gap-5">
        <Reveal>
          <div className="rounded-3xl border border-[#D9FF4B]/30 bg-gradient-to-b from-[#D9FF4B]/10 to-transparent p-8 h-full">
            <MonitorSmartphone className="w-9 h-9 text-[#D9FF4B] mb-5" />
            <div className="font-monox text-[10px] tracking-[0.25em] text-[#D9FF4B]">01 · LIVE IN THIS BUILD</div>
            <div className="font-display text-4xl tracking-wide mt-1 mb-3">WEB CONSOLE</div>
            <p className="text-sm text-white/60 leading-relaxed mb-6">Search 190+ countries, checkout in two taps, watch the QR ignite, and track burn on a live meter. Fully working prototype — click through.</p>
            <div className="rounded-2xl bg-black/60 border border-white/10 p-4 font-monox text-[11px] text-white/60 mb-6">bilbymobile · console <span className="text-emerald-400">● live</span><br /><span className="text-white/30">search → cart → QR → meter</span></div>
            <Link to="/app" className="block text-center bg-[#D9FF4B] text-black font-bold rounded-full py-3 text-sm hover:bg-white transition-colors">LAUNCH CONSOLE <Play className="inline w-4 h-4 ml-1" /></Link>
          </div>
        </Reveal>
        {[["ANDROID", "QR + Companion Sheet", "Material You dynamic color"], ["IPHONE", "SM-DP+ deep link", "Live Activities + widgets"]].map(([p, inst, feat], i) => (
          <Reveal key={p} delay={(i + 1) * 0.1}>
            <div className="rounded-3xl border border-white/10 bg-[#0c1220] p-8 h-full flex flex-col">
              {p === "ANDROID" ? <Smartphone className="w-9 h-9 text-[#6EE7FF] mb-5" /> : <Apple className="w-9 h-9 text-white mb-5" />}
              <div className="font-monox text-[10px] tracking-[0.25em] text-white/40">0{i + 2} · HANDOVER PROTOTYPE</div>
              <div className="font-display text-4xl tracking-wide mt-1 mb-3">{p} APP</div>
              <div className="mx-auto my-4 w-[190px] h-[390px] rounded-[2.2rem] border-[6px] border-[#232c44] bg-black overflow-hidden relative floaty" style={{ animationDelay: `${i * 1.4}s` }}>
                <div className="absolute top-2.5 left-1/2 -translate-x-1/2 w-20 h-5 bg-[#232c44] rounded-full" />
                <div className="pt-12 px-4">
                  <div className="font-monox text-[9px] tracking-[0.2em] text-[#FFB43A] flex items-center gap-1.5"><img src="/images/bilby-hero.png" alt="Bilby" className="w-4 h-4 rounded-full object-cover" />BILBY · {p}</div>
                  <div className="font-display text-2xl tracking-wide">TOKYO 10GB</div>
                  <div className="mt-3 h-24 rounded-xl overflow-hidden"><img src={i === 0 ? "/images/dest-santorini.jpg" : "/images/dest-iceland.jpg"} className="w-full h-full object-cover" alt="" /></div>
                  <div className="mt-3 rounded-xl bg-white/5 border border-white/10 p-3"><div className="flex justify-between font-monox text-[9px] text-white/50 mb-1.5"><span>DATA LEFT</span><span className="text-[#FFB43A]">7.2 GB</span></div><div className="h-1.5 rounded-full bg-white/10"><div className="h-full w-[72%] rounded-full bg-gradient-to-r from-[#FFB43A] to-[#6EE7FF]" /></div></div>
                  <div className="mt-3 grid grid-cols-3 place-items-center py-2 rounded-xl bg-white/[0.04] border border-white/10">
                    <QrCode className="w-8 h-8 text-white/80" /><Wifi className="w-5 h-5 text-[#6EE7FF]" /><ShieldCheck className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div className="mt-3 text-center bg-[#FFB43A] text-black text-[11px] font-bold rounded-full py-2">TOP UP $9.50</div>
                </div>
                <div className="absolute inset-x-0 top-1/2 h-px bg-[#6EE7FF]/60" style={{ animation: "scanline 3.4s linear infinite", position: "absolute" }} />
              </div>
              <ul className="text-sm text-white/60 space-y-2 mt-2 mb-2">
                <li className="flex gap-2"><Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />One-tap eSIM install via {inst}</li>
                <li className="flex gap-2"><Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />Burn meter + overage alerts</li>
                <li className="flex gap-2"><Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />{feat}</li>
              </ul>
            </div>
          </Reveal>
        ))}
      </div>
      <div className="mt-6 rounded-3xl border border-white/10 bg-black p-6 md:p-8 flex flex-col md:flex-row items-center gap-6">
        <div className="w-28 h-28 shrink-0 rounded-2xl bg-white p-2 grid place-items-center"><QrCode className="w-20 h-20 text-black" /></div>
        <div className="text-center md:text-left"><div className="font-display text-3xl tracking-wide">APPROVE THIS PAGE → WE PACK THE HANDOVER</div><p className="text-sm text-white/50">Web console, Android + iPhone builds, store listings and Kimi/Claude docs ship once the landing preview is signed off.</p></div>
        <div className="md:ml-auto flex gap-6 font-monox text-[10px] tracking-[0.2em] text-white/50"><span className="flex items-center gap-2"><Timer className="w-4 h-4 text-[#FFB43A]" />2:41 MEDIAN SETUP</span><span className="flex items-center gap-2"><BadgeCheck className="w-4 h-4 text-emerald-400" />STORE-READY COPY</span></div>
      </div>
    </section>
  );
}

function Squad() {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = (tool: string, prompt: string) => { navigator.clipboard?.writeText(prompt); setCopied(tool); setTimeout(() => setCopied(null), 1600); };
  return (
    <section id="sprint" className="bg-[#0c1220] border-y border-white/10 py-24">
      <div className="max-w-7xl mx-auto px-5 md:px-8">
        <SectionTag no="SCENE 07" label="Handover crew — Kimi + Claude pack the launch" accent="#FF9E5A" />
        <h2 className="font-display text-6xl md:text-8xl leading-[0.9] mb-4">FIVE TOOLS.<br /><span className="font-serifx italic font-normal text-[#FF9E5A]">one handover.</span></h2>
        <p className="max-w-2xl text-white/60 mb-10 text-sm md:text-base">Landing preview first — then the full package. Each AI owns one department; Kimi holds the memory and Claude directs the story. Copy a briefing prompt, paste it into that tool, bring the output back.</p>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {agents.map((a, i) => {
            const Icon = agentIcons[a.icon] || Zap;
            return (
              <Reveal key={a.tool} delay={(i % 3) * 0.08}>
                <div className="rounded-3xl border border-white/10 bg-[#060913] p-7 h-full flex flex-col hover:-translate-y-1.5 transition-transform">
                  <div className="flex items-center justify-between mb-5">
                    <span className="w-11 h-11 rounded-2xl grid place-items-center" style={{ background: `${a.color}22`, border: `1px solid ${a.color}55` }}><Icon className="w-5 h-5" style={{ color: a.color }} /></span>
                    <span className="font-monox text-[10px] tracking-[0.2em] px-3 py-1.5 rounded-full border border-white/15 text-white/60">DEPT 0{i + 1}</span>
                  </div>
                  <div className="font-display text-3xl tracking-wide" style={{ color: a.color }}>{a.tool.toUpperCase()}</div>
                  <div className="font-monox text-[11px] tracking-[0.15em] text-white/50 mt-1 mb-3 uppercase">{a.role}</div>
                  <p className="text-sm text-white/65 leading-relaxed mb-4">{a.mission}</p>
                  <div className="mb-5">{a.outputs.map((o) => (<div key={o} className="flex gap-2 text-xs text-white/55 mb-1.5"><CreditCard className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: a.color }} />{o}</div>))}</div>
                  <button onClick={() => copy(a.tool, a.prompt)} className="mt-auto rounded-full py-2.5 text-xs font-bold font-monox tracking-widest border transition-all flex items-center justify-center gap-2" style={copied === a.tool ? { background: a.color, color: "#000", borderColor: a.color } : { borderColor: `${a.color}66`, color: a.color }}>
                    {copied === a.tool ? <><Check className="w-3.5 h-3.5" /> COPIED — PASTE INTO {a.tool.toUpperCase()}</> : <><Copy className="w-3.5 h-3.5" /> COPY BRIEFING PROMPT</>}
                  </button>
                </div>
              </Reveal>
            );
          })}
          <Reveal delay={0.15}>
            <div className="rounded-3xl bg-[#FFB43A] text-black p-7 h-full flex flex-col justify-between">
              <div><div className="font-monox text-[10px] tracking-[0.25em] text-black/60 mb-2">HANDOVER RULE</div><div className="font-display text-4xl leading-[0.95] tracking-wide">KIMI REMEMBERS EVERYTHING. CLAUDE SAYS IT BEAUTIFULLY. CODEX SHIPS IT.</div></div>
              <div className="mt-6 font-monox text-[11px] tracking-wider text-black/70 leading-relaxed">PERPLEXITY BRINGS THE TRUTH · ANTIGRAVITY RUNS TRACKS IN PARALLEL<br /><br />→ Approve landing → pack web + Android + iPhone → launch.</div>
            </div>
          </Reveal>
        </div>
        <div className="mt-12">
          <div className="font-monox text-[11px] tracking-[0.3em] text-white/40 mb-5">— HANDOVER LADDER, STEP BY STEP</div>
          <div className="grid md:grid-cols-5 gap-3">
            {sprint.map((s, i) => (
              <div key={s.t} className="rounded-2xl border border-white/10 bg-black p-5 relative overflow-hidden">
                <div className="font-display text-4xl text-stroke opacity-80">0{i + 1}</div>
                <div className="font-monox text-[10px] tracking-[0.2em] text-[#FFB43A] mt-1">{s.d.toUpperCase()}</div>
                <div className="font-display text-2xl tracking-wide mt-1">{s.t}</div>
                <p className="text-xs text-white/55 mt-2 leading-relaxed">{s.x}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function ReviewsFaq() {
  const [open, setOpen] = useState(0);
  return (
    <section id="faq" className="max-w-7xl mx-auto px-5 md:px-8 py-24">
      <SectionTag no="SCENE 08" label="Reviews & fine print" />
      <h2 className="font-display text-6xl md:text-8xl leading-[0.9] mb-10">LOVED ON<br /><span className="text-stroke">EVERY CONTINENT.</span></h2>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5 mb-20">
        {reviews.map((r, i) => (
          <Reveal key={r.name} delay={(i % 3) * 0.07}>
            <div className="rounded-3xl border border-white/10 bg-[#0c1220] p-7 h-full">
              <div className="flex gap-1 mb-4">{Array.from({ length: 5 }).map((_, k) => (<Star key={k} className={`w-4 h-4 ${k < r.stars ? "text-[#FFB43A] fill-current" : "text-white/15"}`} />))}</div>
              <p className="font-serifx italic text-lg leading-snug text-white/85 mb-5">“{r.text}”</p>
              <div className="font-bold text-sm">{r.name}</div>
              <div className="font-monox text-[11px] text-white/40 tracking-wider">{r.role}</div>
            </div>
          </Reveal>
        ))}
      </div>
      <div className="grid lg:grid-cols-[1fr_1.2fr] gap-10">
        <div>
          <h3 className="font-display text-5xl leading-[0.95]">FINE PRINT,<br /><span className="font-serifx italic font-normal text-[#FFB43A]">big type.</span></h3>
          <p className="text-sm text-white/55 mt-4 leading-relaxed">The questions support hears at 3 AM. Honest answers, no asterisks. Still stuck? Humans reply in under a minute, day or night.</p>
          <Link to="/app" className="mt-6 inline-flex items-center gap-2 bg-white text-black font-bold rounded-full px-6 py-3 text-sm hover:bg-[#FFB43A] transition-colors">Test compatibility free <Zap className="w-4 h-4" /></Link>
        </div>
        <div className="space-y-3">
          {faqs.map((f, i) => (
            <div key={f.q} className={`rounded-2xl border transition-colors ${open === i ? "border-[#FFB43A]/60 bg-white/[0.04]" : "border-white/10 bg-white/[0.02]"}`}>
              <button onClick={() => setOpen(open === i ? -1 : i)} className="w-full flex items-center justify-between gap-4 text-left p-5 font-bold text-sm md:text-base">{f.q}<ChevronDown className={`w-5 h-5 shrink-0 transition-transform ${open === i ? "rotate-180 text-[#FFB43A]" : "text-white/40"}`} /></button>
              {open === i && <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="px-5 pb-5 text-sm text-white/60 leading-relaxed">{f.a}</motion.p>}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Finale() {
  return (
    <section id="film" className="relative overflow-hidden">
      <img src="/images/dest-marrakech.jpg" alt="" className="absolute inset-0 w-full h-full object-cover" />
      <div className="absolute inset-0 bg-black/70" />
      <div className="relative max-w-7xl mx-auto px-5 md:px-8 py-28 text-center">
        <Reveal>
          <div className="font-monox text-[11px] tracking-[0.3em] text-[#FFB43A] mb-5">FINAL SCENE · YOUR MOVE · STARRING BILBY</div>
          <h2 className="font-display leading-[0.88] text-[15vw] md:text-[9rem]">DON'T JUST ROAM.<br /><span className="font-serifx italic font-normal text-[#FFB43A] tracking-normal">hop with Bilby.</span></h2>
          <p className="max-w-xl mx-auto text-white/70 mt-6">Global travel eSIM from $4.99 — activates at touchdown, not at checkout. Regional passports and business pooling dock next.</p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Link to="/app" className="bg-[#FFB43A] text-black font-bold rounded-full px-8 py-4 text-sm tracking-wide hover:bg-white transition-colors">GET YOUR ESIM NOW</Link>
            <a href="#sprint" className="border border-white/30 hover:border-white rounded-full px-8 py-4 text-sm font-monox tracking-widest transition-colors">SEE THE HANDOVER PLAN</a>
          </div>
        </Reveal>
      </div>
      <footer className="relative border-t border-white/15 glass">
        <div className="max-w-7xl mx-auto px-5 md:px-8 py-10 flex flex-col md:flex-row items-center gap-5 justify-between">
          <div className="font-display text-2xl tracking-[0.08em] flex items-center gap-2"><img src="/images/bilby-hero.png" alt="Bilby mascot" className="w-8 h-8 rounded-lg object-cover border border-white/20" />BILBY<span className="text-[#FFB43A]">MOBILE</span><span className="font-monox text-[10px] tracking-[0.2em] text-white/40 ml-2">© 2026 · BILBYMOBILE.COM</span></div>
          <div className="flex gap-5 font-monox text-[10px] tracking-[0.2em] text-white/45">
            <Link to="/app" className="hover:text-[#FFB43A]">CONSOLE</Link><span>PRIVACY</span><span>TERMS</span><span>SUPPORT 24/7</span>
          </div>
        </div>
        <div className="border-t border-white/10 py-4 text-center font-monox text-[10px] tracking-wider text-white/30 px-4">Competitor prices researched Sept 2026 via public sources linked above — verify at purchase. Bilby mascot concept tribute; all rival marks belong to their owners.</div>
      </footer>
    </section>
  );
}

export default function Landing() {
  return (
    <div className="grain bg-[#060913] text-[#f4efe6] min-h-screen">
      <Navbar />
      <Hero />
      <Marquee items={["190+ COUNTRIES", "FROM $4.99", "MEET BILBY", "ACTIVATES AT TOUCHDOWN", "ROLLOVER IN THE POUCH", "REGIONAL + BUSINESS NEXT"]} />
      <div className="py-14 px-5 md:px-8"><Stats /></div>
      <Destinations />
      <Bilby />
      <HowItWorks />
      <Intel />
      <Marquee fast outline items={["AIRALO", "HOLAFLY", "NOMAD", "SAILY", "UBIGI", "BILBY TAKES THE BEST OF ALL"]} />
      <Passes />
      <Apps />
      <Squad />
      <ReviewsFaq />
      <Finale />
    </div>
  );
}
