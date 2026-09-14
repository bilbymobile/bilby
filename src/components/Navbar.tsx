import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Menu, X, ArrowUpRight } from "lucide-react";

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  const nav = useNavigate();
  useEffect(() => {
    const f = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", f);
    return () => window.removeEventListener("scroll", f);
  }, []);
  const go = (id: string) => {
    setOpen(false);
    if (loc.pathname !== "/") { nav("/"); setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth" }), 350); }
    else document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };
  const links = [["Destinations", "destinations"], ["Bilby", "bilby"], ["Intel", "intel"], ["Plans", "passes"], ["Handover", "sprint"], ["FAQ", "faq"]];
  return (
    <header className={`fixed top-0 inset-x-0 z-[80] transition-all duration-500 ${scrolled ? "glass border-b border-white/10 py-3" : "bg-transparent py-5"}`}>
      <div className="max-w-7xl mx-auto px-5 md:px-8 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5 group">
          <span className="w-10 h-10 rounded-2xl overflow-hidden border border-[#FFB43A]/50 grid place-items-center bg-black shrink-0 group-hover:rotate-[-8deg] transition-transform">
            <img src="/images/bilby-hero.png" alt="Bilby mascot" className="w-full h-full object-cover" />
          </span>
          <span className="font-display text-2xl tracking-[0.08em] leading-none pt-0.5">BILBY<span className="text-[#FFB43A]">MOBILE</span></span>
          <span className="hidden md:inline font-monox text-[10px] tracking-[0.2em] text-white/40 border border-white/15 rounded-full px-2.5 py-1 ml-1">GLOBAL ESIM ’26</span>
        </Link>
        <nav className="hidden lg:flex items-center gap-7">
          {links.map(([l, id]) => (
            <button key={id} onClick={() => go(id)} className="font-monox text-[11px] tracking-[0.22em] text-white/60 hover:text-[#FFB43A] transition-colors uppercase">{l}</button>
          ))}
        </nav>
        <div className="hidden lg:flex items-center gap-3">
          <Link to="/app" className="font-monox text-[11px] tracking-[0.2em] uppercase text-white/70 hover:text-white border border-white/15 hover:border-white/40 rounded-full px-5 py-2.5 transition-all">Open console</Link>
          <button onClick={() => go("passes")} className="font-monox text-[11px] tracking-[0.15em] uppercase bg-[#FFB43A] text-black rounded-full px-5 py-2.5 font-bold hover:bg-[#ffd07a] transition-colors flex items-center gap-1.5">Get eSIM <ArrowUpRight className="w-3.5 h-3.5" /></button>
        </div>
        <button className="lg:hidden text-white" onClick={() => setOpen(!open)}>{open ? <X /> : <Menu />}</button>
      </div>
      {open && (
        <div className="lg:hidden glass border-t border-white/10 px-6 py-5 flex flex-col gap-4">
          {links.map(([l, id]) => (
            <button key={id} onClick={() => go(id)} className="text-left font-display text-2xl tracking-wider text-white/80">{l}</button>
          ))}
          <Link to="/app" onClick={() => setOpen(false)} className="bg-[#FFB43A] text-black font-bold rounded-full px-5 py-3 text-center">Open web console</Link>
        </div>
      )}
    </header>
  );
}
