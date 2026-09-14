import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Search, ShoppingCart, X, QrCode, Check, Wifi, ShieldCheck,
  Zap, Smartphone, CreditCard, Trash2, Plus, Minus, SignalHigh, Star, ChevronRight, BadgeCheck
} from "lucide-react";
import { destinations, type Destination } from "../data/content";

type CartItem = Destination & { qty: number };
type Order = { id: string; items: CartItem[]; total: number; date: string; status: "active" | "pending" };

const usage = [
  { d: "Mon", gb: 1.2 }, { d: "Tue", gb: 2.1 }, { d: "Wed", gb: 0.8 },
  { d: "Thu", gb: 3.4 }, { d: "Fri", gb: 2.6 }, { d: "Sat", gb: 4.1 }, { d: "Sun", gb: 1.9 },
];
const maxGb = Math.max(...usage.map((u) => u.gb));

function fakeQR(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const cells: boolean[] = [];
  for (let i = 0; i < 441; i++) { h = (h * 1103515245 + 12345) >>> 0; cells.push(h % 100 < 46); }
  return cells;
}

export default function Console() {
  const [q, setQ] = useState("");
  const [region, setRegion] = useState("All");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkout, setCheckout] = useState(false);
  const [card, setCard] = useState({ n: "4242 4242 4242 4242", e: "09 / 28", c: "424" });
  const [paying, setPaying] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);
  const [actStage, setActStage] = useState(0); // 0 scan, 1 installing, 2 active
  const [compat, setCompat] = useState<"idle" | "scanning" | "pass" | "fail">("idle");
  const [model, setModel] = useState("iPhone 15 Pro");
  const [topupMsg, setTopupMsg] = useState("");

  const regions = ["All", ...Array.from(new Set(destinations.map((d) => d.region)))];
  const list = destinations.filter((d) => (region === "All" || d.region === region) && (d.city + d.country).toLowerCase().includes(q.toLowerCase()));
  const total = useMemo(() => cart.reduce((s, i) => s + i.price * i.qty, 0), [cart]);

  const add = (d: Destination) => {
    setCart((c) => { const f = c.find((i) => i.id === d.id && i.city === d.city); return f ? c.map((i) => (i === f ? { ...i, qty: i.qty + 1 } : i)) : [...c, { ...d, qty: 1 }]; });
    setCartOpen(true);
  };
  const bump = (idx: number, d: number) => setCart((c) => c.map((i, k) => (k === idx ? { ...i, qty: Math.max(1, i.qty + d) } : i)));
  const rm = (idx: number) => setCart((c) => c.filter((_, k) => k !== idx));

  const pay = () => {
    setPaying(true);
    setTimeout(() => {
      const o: Order = { id: "RM-" + Math.floor(100000 + Math.random() * 899999), items: [...cart], total, date: "Sep 8, 2026", status: "pending" };
      setOrders((p) => [o, ...p]);
      setActiveOrder(o);
      setCart([]); setPaying(false); setCheckout(false); setCartOpen(false); setActStage(0);
    }, 1800);
  };

  const runActivation = () => {
    setActStage(1);
    setTimeout(() => {
      setActStage(2);
      if (activeOrder) setOrders((p) => p.map((o) => (o.id === activeOrder.id ? { ...o, status: "active" } : o)));
    }, 2600);
  };

  const scan = () => {
    setCompat("scanning");
    setTimeout(() => setCompat(/nokia|2015|2016|2017/i.test(model) ? "fail" : "pass"), 1400);
  };

  const topup = () => { setTopupMsg("✓ +5 GB added — receipt emailed. New balance: 12.2 GB."); setTimeout(() => setTopupMsg(""), 4000); };
  const qrCells = activeOrder ? fakeQR(activeOrder.id) : [];

  return (
    <div className="grain min-h-screen bg-[#060913] text-[#f4efe6]">
      <header className="sticky top-0 z-[70] glass border-b border-white/10">
        <div className="max-w-7xl mx-auto px-5 md:px-8 py-4 flex items-center gap-4">
          <Link to="/" className="w-10 h-10 rounded-full border border-white/15 grid place-items-center hover:border-[#FFB43A] hover:text-[#FFB43A] transition-colors"><ArrowLeft className="w-5 h-5" /></Link>
          <Link to="/" className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-2xl overflow-hidden border border-[#FFB43A]/50 shrink-0"><img src="/images/bilby-hero.png" alt="Bilby mascot" className="w-full h-full object-cover" /></span>
          <div><div className="font-display text-2xl tracking-[0.08em] leading-none">BILBY<span className="text-[#FFB43A]">MOBILE</span> CONSOLE</div><div className="font-monox text-[10px] tracking-[0.25em] text-white/40">WEB APP · LIVE PROTOTYPE</div></div>
          </Link>
          <div className="ml-auto flex items-center gap-3">
            <span className="hidden md:inline font-monox text-[11px] text-white/50">{orders.length} ORDER{orders.length === 1 ? "" : "S"}</span>
            <button onClick={() => setCartOpen(true)} className="relative bg-[#FFB43A] text-black rounded-full pl-5 pr-6 py-2.5 font-bold text-sm flex items-center gap-2 hover:bg-white transition-colors">
              <ShoppingCart className="w-4 h-4" /> Cart · ${total.toFixed(2)}
              {cart.length > 0 && <span className="absolute -top-2 -right-1 w-6 h-6 rounded-full bg-black text-[#FFB43A] text-xs grid place-items-center border border-[#FFB43A]">{cart.reduce((s, i) => s + i.qty, 0)}</span>}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-5 md:px-8 py-8 grid lg:grid-cols-[1fr_360px] gap-6">
        <div>
          {/* compat */}
          <div className="rounded-3xl border border-white/10 bg-[#0c1220] p-6 md:p-7 mb-6">
            <div className="flex items-center gap-2 font-monox text-[10px] tracking-[0.25em] text-[#6EE7FF] mb-3"><Smartphone className="w-4 h-4" /> FREE 10-SECOND COMPATIBILITY SCAN</div>
            <div className="flex flex-col sm:flex-row gap-3">
              <input value={model} onChange={(e) => setModel(e.target.value)} placeholder="Your phone model — e.g. iPhone 15 Pro" className="flex-1 bg-black/50 border border-white/15 rounded-full px-5 py-3 text-sm outline-none focus:border-[#6EE7FF] placeholder:text-white/30" />
              <button onClick={scan} className="bg-[#6EE7FF] text-black font-bold rounded-full px-6 py-3 text-sm hover:bg-white transition-colors whitespace-nowrap">SCAN DEVICE</button>
            </div>
            {compat === "scanning" && <div className="mt-4 font-monox text-xs text-white/60">▓▓▓▓▓▓░░ scanning eSIM entitlement…</div>}
            {compat === "pass" && <div className="mt-4 flex items-center gap-2 text-emerald-400 text-sm font-semibold"><BadgeCheck className="w-5 h-5" /> {model} is eSIM-ready — dual-SIM + 5G confirmed. Shop below.</div>}
            {compat === "fail" && <div className="mt-4 text-sm text-[#FF5A5A] font-semibold">Hmm — “{model}” looks pre-eSIM. Any iPhone 11+, Pixel 3+ or Galaxy S20+ will work.</div>}
          </div>

          {/* search */}
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="relative flex-1"><Search className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search 190+ countries…" className="w-full bg-white/5 border border-white/15 rounded-full pl-12 pr-5 py-3.5 text-sm outline-none focus:border-[#FFB43A] placeholder:text-white/30" /></div>
          </div>
          <div className="flex gap-2 flex-wrap mb-6">
            {regions.map((r) => (<button key={r} onClick={() => setRegion(r)} className={`font-monox text-[11px] tracking-[0.12em] uppercase rounded-full px-4 py-2 border transition-all ${region === r ? "bg-[#FFB43A] text-black border-[#FFB43A] font-bold" : "border-white/15 text-white/60 hover:border-white/40"}`}>{r}</button>))}
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            {list.map((d) => (
              <div key={d.id + d.city} className="card-sheen rounded-3xl overflow-hidden border border-white/10 bg-[#0c1220] hover:border-[#FFB43A]/50 transition-colors">
                <div className="relative h-44"><img src={d.img} alt={d.city} className="w-full h-full object-cover" /><div className="absolute inset-0 bg-gradient-to-t from-[#0c1220] via-transparent to-transparent" />
                  <span className="absolute top-3 left-3 font-monox text-[10px] bg-black/60 border border-white/20 rounded-full px-3 py-1">{d.tag}</span>
                  <span className="absolute bottom-3 left-4 font-display text-3xl tracking-wide">{d.city.toUpperCase()}</span>
                  <span className="absolute bottom-3 right-4 font-monox text-[10px] text-white/60 flex items-center gap-1"><Star className="w-3 h-3 text-[#FFB43A] fill-current" />{d.rating}</span>
                </div>
                <div className="p-5">
                  <div className="flex items-center gap-3 font-monox text-[11px] text-white/50 mb-1"><span className="flex items-center gap-1"><Wifi className="w-3.5 h-3.5 text-[#6EE7FF]" />{d.net}</span><span>·</span><span>{d.data} · {d.days} DAYS</span></div>
                  <div className="flex items-center justify-between mt-3">
                    <div><span className="font-display text-4xl text-[#FFB43A]">${d.price}</span><span className="font-monox text-[10px] text-white/40 ml-2">ONE-TIME</span></div>
                    <button onClick={() => add(d)} className="bg-white text-black font-bold text-sm rounded-full px-5 py-2.5 hover:bg-[#FFB43A] transition-colors flex items-center gap-1.5">ADD <Plus className="w-4 h-4" /></button>
                  </div>
                </div>
              </div>
            ))}
            {list.length === 0 && <div className="col-span-2 text-center py-16 text-white/40 font-monox text-sm">NO SCENES MATCH “{q.toUpperCase()}” — TRY “TOKYO” OR CLEAR FILTERS.</div>}
          </div>

          {/* usage */}
          <div className="mt-6 rounded-3xl border border-white/10 bg-[#0c1220] p-6 md:p-7">
            <div className="flex items-center justify-between mb-5"><div className="font-display text-2xl tracking-wide">LIVE BURN METER</div><span className="font-monox text-[10px] tracking-[0.2em] text-white/40">LAST 7 DAYS · DEMO FEED</span></div>
            <div className="flex items-end gap-2.5 h-40">
              {usage.map((u) => (
                <div key={u.d} className="flex-1 flex flex-col items-center gap-2 group">
                  <span className="font-monox text-[10px] text-white/0 group-hover:text-[#FFB43A] transition-colors">{u.gb}GB</span>
                  <motion.div initial={{ height: 0 }} whileInView={{ height: `${(u.gb / maxGb) * 100}%` }} viewport={{ once: true }} transition={{ duration: 0.9, delay: 0.05 * usage.indexOf(u) }} className="w-full min-h-[8px] rounded-t-lg bg-gradient-to-t from-[#FFB43A]/40 to-[#FFB43A] group-hover:from-[#6EE7FF]/60 group-hover:to-[#6EE7FF] transition-colors" />
                  <span className="font-monox text-[10px] text-white/40">{u.d}</span>
                </div>
              ))}
            </div>
            <div className="mt-5 flex flex-wrap gap-4 font-monox text-[11px] text-white/50"><span className="flex items-center gap-1.5"><Zap className="w-3.5 h-3.5 text-[#FFB43A]" /> TikTok ≈ 1.2 GB/hr</span><span className="flex items-center gap-1.5"><SignalHigh className="w-3.5 h-3.5 text-[#6EE7FF]" /> Maps ≈ 60 MB/hr</span><span className="flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> VPN overhead ≈ 4%</span></div>
          </div>
        </div>

        {/* side: activation */}
        <aside className="space-y-6">
          <div className="rounded-3xl border border-[#FFB43A]/30 bg-black p-6 sticky top-24">
            <div className="font-monox text-[10px] tracking-[0.25em] text-[#FFB43A] mb-2">● ACTIVATION STUDIO</div>
            {!activeOrder && <div className="text-sm text-white/55 leading-relaxed py-6 text-center">Your QR stage is empty.<br />Add a destination and check out —<br />the spotlight turns on here.<br /><br /><QrCode className="w-14 h-14 mx-auto text-white/15" /></div>}
            {activeOrder && (
              <div>
                <div className="flex items-center justify-between mb-3"><span className="font-monox text-xs text-white/60">{activeOrder.id}</span><span className={`font-monox text-[10px] tracking-widest px-3 py-1 rounded-full ${actStage === 2 ? "bg-emerald-400/15 text-emerald-400" : "bg-[#FFB43A]/15 text-[#FFB43A]"}`}>{actStage === 0 ? "◌ READY TO SCAN" : actStage === 1 ? "◉ INSTALLING…" : "● ACTIVE · 5G"}</span></div>
                <div className="bg-white rounded-2xl p-4 grid place-items-center relative overflow-hidden">
                  <div className="grid grid-cols-[repeat(21,1fr)] gap-[1.5px] w-48 h-48">
                    {qrCells.map((c, i) => (<span key={i} className={c ? "bg-black" : "bg-transparent"} />))}
                  </div>
                  {actStage === 1 && <div className="absolute inset-x-4 h-0.5 bg-[#FFB43A] shadow-[0_0_18px_#FFB43A]" style={{ animation: "scanline 1.4s linear infinite", top: 0, position: "absolute" }} />}
                  {actStage === 2 && <div className="absolute inset-0 bg-emerald-400/10 grid place-items-center"><span className="w-16 h-16 rounded-full bg-emerald-400 grid place-items-center"><Check className="w-8 h-8 text-black" /></span></div>}
                </div>
                <div className="font-monox text-[10px] text-white/40 text-center mt-2 tracking-widest">SETTINGS → CELLULAR → ADD ESIM → SCAN</div>
                <div className="flex gap-1.5 mt-4 mb-4">{["Scan QR", "Install", "Connected"].map((s, i) => (<div key={s} className="flex-1 text-center"><div className={`h-1.5 rounded-full ${i <= actStage ? "bg-[#FFB43A]" : "bg-white/10"}`} /><div className="font-monox text-[9px] text-white/40 mt-1">{s.toUpperCase()}</div></div>))}</div>
                {actStage === 0 && <button onClick={runActivation} className="w-full bg-[#FFB43A] text-black font-bold rounded-full py-3 text-sm hover:bg-white transition-colors">SIMULATE INSTALL</button>}
                {actStage === 1 && <div className="text-center font-monox text-xs text-[#FFB43A] py-3">INSTALLING PROFILE… KEEP THIS SCREEN OPEN</div>}
                {actStage === 2 && (
                  <div>
                    <div className="rounded-2xl bg-white/5 border border-white/10 p-4 mb-3"><div className="flex justify-between font-monox text-[11px] text-white/60 mb-2"><span>DATA LEFT · {activeOrder.items[0]?.city.toUpperCase()}</span><span className="text-[#FFB43A] font-bold">7.2 / 10 GB</span></div><div className="h-2 rounded-full bg-white/10"><div className="h-full w-[72%] rounded-full bg-gradient-to-r from-[#FFB43A] to-[#6EE7FF]" /></div></div>
                    <button onClick={topup} className="w-full border border-[#FFB43A]/60 text-[#FFB43A] font-bold rounded-full py-3 text-sm hover:bg-[#FFB43A] hover:text-black transition-colors">TOP UP +5 GB · $4.50</button>
                    {topupMsg && <div className="mt-3 text-xs text-emerald-400 font-semibold text-center">{topupMsg}</div>}
                  </div>
                )}
                <div className="mt-4 pt-4 border-t border-white/10 text-xs text-white/50 space-y-1.5">
                  {activeOrder.items.map((i) => (<div key={i.city} className="flex justify-between"><span>{i.city} · {i.data}</span><span>${(i.price * i.qty).toFixed(2)}</span></div>))}
                </div>
              </div>
            )}
          </div>

          {orders.length > 0 && (
            <div className="rounded-3xl border border-white/10 bg-[#0c1220] p-6">
              <div className="font-display text-2xl tracking-wide mb-4">MY PASSES</div>
              {orders.map((o) => (
                <button key={o.id} onClick={() => { setActiveOrder(o); setActStage(o.status === "active" ? 2 : 0); }} className={`w-full text-left rounded-2xl border p-4 mb-2.5 transition-colors ${activeOrder?.id === o.id ? "border-[#FFB43A]/60 bg-white/[0.04]" : "border-white/10 hover:border-white/30"}`}>
                  <div className="flex justify-between items-center"><span className="font-monox text-xs font-bold">{o.id}</span><ChevronRight className="w-4 h-4 text-white/40" /></div>
                  <div className="text-xs text-white/50 mt-1">{o.items.map((i) => i.city).join(" + ")} · ${o.total.toFixed(2)} · {o.date}</div>
                </button>
              ))}
            </div>
          )}
        </aside>
      </main>

      {/* cart drawer */}
      <AnimatePresence>
        {cartOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[85] bg-black/70 backdrop-blur-sm" onClick={() => setCartOpen(false)}>
            <motion.div initial={{ x: 420 }} animate={{ x: 0 }} exit={{ x: 420 }} transition={{ type: "spring", damping: 30 }} onClick={(e) => e.stopPropagation()} className="absolute right-0 top-0 bottom-0 w-full max-w-md bg-[#0c1220] border-l border-white/10 p-7 flex flex-col">
              <div className="flex items-center justify-between mb-6"><div className="font-display text-3xl tracking-wide">YOUR POUCH <span className="text-[#FFB43A]">({cart.reduce((s, i) => s + i.qty, 0)})</span></div><button onClick={() => setCartOpen(false)}><X className="w-6 h-6 text-white/50 hover:text-white" /></button></div>
              <div className="flex-1 overflow-y-auto space-y-3">
                {cart.length === 0 && <div className="text-center text-white/40 py-16 font-monox text-xs tracking-widest">CART IS AN EMPTY TIMELINE.<br />ADD A DESTINATION TO START.</div>}
                {cart.map((i, k) => (
                  <div key={k} className="rounded-2xl border border-white/10 bg-black/40 p-4 flex gap-4">
                    <img src={i.img} className="w-16 h-16 rounded-xl object-cover shrink-0" alt="" />
                    <div className="flex-1"><div className="font-bold text-sm">{i.city}, {i.country}</div><div className="font-monox text-[11px] text-white/40">{i.data} · {i.days} DAYS</div>
                      <div className="flex items-center gap-2 mt-2"><button onClick={() => bump(k, -1)} className="w-7 h-7 rounded-full border border-white/20 grid place-items-center hover:border-[#FFB43A]"><Minus className="w-3.5 h-3.5" /></button><span className="font-bold text-sm w-5 text-center tick">{i.qty}</span><button onClick={() => bump(k, 1)} className="w-7 h-7 rounded-full border border-white/20 grid place-items-center hover:border-[#FFB43A]"><Plus className="w-3.5 h-3.5" /></button></div>
                    </div>
                    <div className="text-right"><div className="font-display text-2xl text-[#FFB43A]">${(i.price * i.qty).toFixed(2)}</div><button onClick={() => rm(k)} className="text-white/30 hover:text-[#FF5A5A] mt-1"><Trash2 className="w-4 h-4" /></button></div>
                  </div>
                ))}
              </div>
              {cart.length > 0 && (
                <div className="pt-5 border-t border-white/10 mt-4">
                  <div className="flex justify-between font-monox text-xs text-white/50 mb-1"><span>SUBTOTAL</span><span>${total.toFixed(2)}</span></div>
                  <div className="flex justify-between font-monox text-xs text-emerald-400 mb-3"><span>ROAMING FEES BURIED</span><span>−$184.00</span></div>
                  <button onClick={() => { setCartOpen(false); setCheckout(true); }} className="w-full bg-[#FFB43A] text-black font-bold rounded-full py-4 text-sm hover:bg-white transition-colors">CHECKOUT · ${total.toFixed(2)}</button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* checkout modal */}
      <AnimatePresence>
        {checkout && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[90] bg-black/80 backdrop-blur grid place-items-center p-4" onClick={() => setCheckout(false)}>
            <motion.div initial={{ scale: 0.92, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.92, y: 20 }} onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-3xl bg-[#0c1220] border border-white/15 p-8">
              <div className="font-display text-4xl tracking-wide mb-1">CHECKOUT</div>
              <div className="font-monox text-[11px] text-white/40 tracking-widest mb-6">256-BIT ENCRYPTED · DEMO MODE, NO CHARGE</div>
              <label className="font-monox text-[10px] tracking-[0.2em] text-white/50">CARD NUMBER</label>
              <div className="flex items-center gap-2 bg-black/50 border border-white/15 rounded-2xl px-4 py-3 mt-1.5 mb-4"><CreditCard className="w-4 h-4 text-white/40" /><input value={card.n} onChange={(e) => setCard({ ...card, n: e.target.value })} className="bg-transparent outline-none flex-1 font-monox text-sm" /></div>
              <div className="grid grid-cols-2 gap-3 mb-6">
                <div><label className="font-monox text-[10px] tracking-[0.2em] text-white/50">EXPIRY</label><input value={card.e} onChange={(e) => setCard({ ...card, e: e.target.value })} className="mt-1.5 w-full bg-black/50 border border-white/15 rounded-2xl px-4 py-3 font-monox text-sm outline-none" /></div>
                <div><label className="font-monox text-[10px] tracking-[0.2em] text-white/50">CVC</label><input value={card.c} onChange={(e) => setCard({ ...card, c: e.target.value })} className="mt-1.5 w-full bg-black/50 border border-white/15 rounded-2xl px-4 py-3 font-monox text-sm outline-none" /></div>
              </div>
              <button onClick={pay} disabled={paying} className="w-full bg-[#FFB43A] text-black font-bold rounded-full py-4 text-sm hover:bg-white transition-colors disabled:opacity-60">
                {paying ? "PROCESSING… CONTACTING CARRIER" : `PAY $${total.toFixed(2)} · GET QR INSTANTLY`}
              </button>
              <div className="mt-4 flex items-center justify-center gap-4 font-monox text-[10px] text-white/35"><span className="flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5" /> VPN INCLUDED</span><span className="flex items-center gap-1"><Wifi className="w-3.5 h-3.5" /> INSTANT QR</span></div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
