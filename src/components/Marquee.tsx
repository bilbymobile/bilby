export default function Marquee({ items, fast = false, outline = false }: { items: string[]; fast?: boolean; outline?: boolean }) {
  const row = [...items, ...items];
  return (
    <div className="relative overflow-hidden border-y border-white/10 bg-black py-4 select-none">
      <div className={`flex whitespace-nowrap w-max ${fast ? "animate-marquee-fast" : "animate-marquee"}`}>
        {row.map((t, i) => (
          <span key={i} className={`font-display text-2xl md:text-3xl tracking-[0.1em] mx-6 ${outline && i % 2 ? "text-stroke" : "text-white/90"}`}>
            {t} <span className="text-[#FFB43A] mx-4">✦</span>
          </span>
        ))}
      </div>
    </div>
  );
}
