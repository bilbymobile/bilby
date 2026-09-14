export type Destination = {
  id: string;
  city: string;
  country: string;
  region: string;
  img: string;
  price: number;
  data: string;
  days: number;
  tag: string;
  rating: number;
  net: string;
};

export const destinations: Destination[] = [
  { id: "tokyo", city: "Tokyo", country: "Japan", region: "Asia-Pacific", img: "/images/dest-tokyo.jpg", price: 9.5, data: "10 GB", days: 15, tag: "NEON CUT", rating: 4.9, net: "SoftBank 5G" },
  { id: "santorini", city: "Santorini", country: "Greece", region: "Europe", img: "/images/dest-santorini.jpg", price: 7.0, data: "10 GB", days: 30, tag: "GOLDEN HOUR", rating: 4.9, net: "Cosmote 5G" },
  { id: "reykjavik", city: "Reykjavik", country: "Iceland", region: "Europe", img: "/images/dest-iceland.jpg", price: 8.0, data: "10 GB", days: 30, tag: "AURORA CUT", rating: 4.8, net: "Siminn 5G" },
  { id: "marrakech", city: "Marrakech", country: "Morocco", region: "Middle East & Africa", img: "/images/dest-marrakech.jpg", price: 11.0, data: "5 GB", days: 15, tag: "DUST & AMBER", rating: 4.8, net: "Maroc 5G" },
  { id: "bali", city: "Canggu", country: "Bali", region: "Asia-Pacific", img: "/images/traveler.jpg", price: 8.5, data: "20 GB", days: 30, tag: "SURF CUT", rating: 4.9, net: "Telkomsel 5G" },
  { id: "patagonia", city: "Torres del Paine", country: "Chile", region: "Americas", img: "/images/dest-iceland.jpg", price: 14.0, data: "5 GB", days: 15, tag: "EDGE OF MAP", rating: 4.7, net: "Entel 4G/5G" },
];

export type Competitor = {
  name: string;
  color: string;
  color2: string;
  founded: string;
  coverage: string;
  model: string;
  priceAnchor: string;
  rating: string;
  voice: string;
  palette: string[];
  strengths: string[];
  gaps: string[];
};

export const competitors: Competitor[] = [
  {
    name: "Airalo", color: "#0EA5E9", color2: "#F97316", founded: "2019 · Singapore/US",
    coverage: "190+ countries", model: "Fixed packs · pay-per-GB", priceAnchor: "USA 5 GB · $13 / 30 days",
    rating: "4.6 ★ (iOS)", voice: "Friendly, marketplace-simple. Illustrations, rounded cards, sky-blue + tangerine.",
    palette: ["#0B1E3B", "#0EA5E9", "#F97316", "#F4F6FB"],
    strengths: ["Largest store: 190+ countries", "Plug-and-play, first-timer friendly", "Loyalty credits + referral loop"],
    gaps: ["Higher per-GB cost at volume", "Speed varies by cheapest wholesale partner", "No in-app carrier comparison"],
  },
  {
    name: "Holafly", color: "#FF4D2E", color2: "#FFC531", founded: "2017 · Spain",
    coverage: "160+ countries", model: "Unlimited by duration", priceAnchor: "Unlimited 5-day · ~$18.50 · Monthly $64.90",
    rating: "4.6 ★ · 24/7 human support", voice: "Bold red + sunshine yellow. Loud, wanderlust, influencer-led video.",
    palette: ["#E8362A", "#FFC531", "#FFF6E9", "#1A1A1A"],
    strengths: ["True unlimited positioning", "Unlimited hotspot on monthly plan", "Strong 24/7 support reputation"],
    gaps: ["Premium price for light users", "Fair-use throttling fine print", "Fewer fixed-pack options"],
  },
  {
    name: "Nomad", color: "#00C389", color2: "#0B1E3B", founded: "LotusFlare · Silicon Valley",
    coverage: "170+ countries", model: "Fixed packs · volume value", priceAnchor: "10 GB · $23 · 50 GB · $35 · USA 5 GB $12",
    rating: "4.7 ★ · cheapest per-GB", voice: "Minimal telecom-chic. Deep navy + mint, clean data tables.",
    palette: ["#0B1E3B", "#00C389", "#E6F7F0", "#FFFFFF"],
    strengths: ["Best per-GB cost at volume", "Cheap USA packs ($12/5 GB)", "Day-pass throttled options"],
    gaps: ["Utilitarian brand, low emotion", "No unlimited flagship", "Thin lifestyle content"],
  },
  {
    name: "Saily", color: "#4D6BFF", color2: "#D9FF4B", founded: "Nord Security · 2024", coverage: "150+ countries",
    model: "Fixed packs + Ultra unlimited", priceAnchor: "1 GB · $4.99 · 5 GB $13.99 · Ultra ~$60/mo",
    rating: "4.7 ★ · security bundle", voice: "Nord-grade dark navy + electric blue + acid lime. Security-first.",
    palette: ["#0A1030", "#4D6BFF", "#D9FF4B", "#F2F4FF"],
    strengths: ["Ad-block + web protection + VPN", "Ultra plan: lounge access + NordVPN", "Sweet spot for light users"],
    gaps: ["Younger store, fewer regions", "Ultra throttles to ~1 Mbps after quota", "Security upsell can confuse"],
  },
  {
    name: "Ubigi", color: "#7C5CFF", color2: "#22D3EE", founded: "Transatel/NTT · France",
    coverage: "190+ countries", model: "Fixed + unlimited (EU)", priceAnchor: "Europe unlimited from $28",
    rating: "4.5 ★ · car/IoT heritage", voice: "Enterprise blue-violet. Trusted, technical, connected-car pedigree.",
    palette: ["#14122B", "#7C5CFF", "#22D3EE", "#FFFFFF"],
    strengths: ["Affordable EU unlimited from $28", "eSIM for cars + Windows + iOS", "Carrier-grade (NTT) backbone"],
    gaps: ["Consumer brand feels B2B", "App UX dated vs rivals", "Sparse lifestyle marketing"],
  },
];

export const tiers = [
  {
    name: "JOEY", price: 9, tag: "Pay-per-trip · Global", desc: "For the weekend hop. Fixed packs in 190+ countries, guided by Bilby.",
    feats: ["10 GB high-speed data", "30-day validity", "Hotspot included", "5G where available", "Keep your WhatsApp number"],
    cta: "Start hopping", hot: false,
  },
  {
    name: "BILBY", price: 29, tag: "Most loved · Regional", desc: "Regional passports + rollover. One burrow across multi-country arcs.",
    feats: ["50 GB across 3 regions", "Rollover unused data", "1 virtual number included", "Priority 5G routing", "2 devices per pass"],
    cta: "Go Bilby", hot: true,
  },
  {
    name: "MOB", price: 59, tag: "Unlimited · Business-ready", desc: "One subscription for the whole mob. 120+ countries + team console.",
    feats: ["Unlimited data, 120+ countries", "100 GB hotspot / month", "VPN + ad-block built in", "Team console + pooled data", "Cancel anytime"],
    cta: "Gather the mob", hot: false,
  },
];

export const planTabs = [
  { id: "global", label: "GLOBAL", blurb: "190+ countries, one eSIM. Land connected from $4.99 — live today." },
  { id: "regional", label: "REGIONAL", blurb: "Europe · Asia-Pacific · Americas bundles with rollover — Bilby tier, live today." },
  { id: "business", label: "BUSINESS", blurb: "Pooled data, team console, invoices & MDM — Mob tier. Early access in the handover." },
];

export const reviews = [
  { name: "Maya Chen", role: "DP · shot in 31 countries", text: "Landed in Tokyo, Bilby scanned before the seatbelt sign went off. My producer thought it was a camera trick. It wasn't.", stars: 5 },
  { name: "Jonas Weber", role: "Overland biker, Lisbon→Hanoi", text: "Crossed 14 borders on one Bilby pass. Rollover meant the desert miles I'd saved paid for the mountains.", stars: 5 },
  { name: "Amara Okafor", role: "Remote surgeon of spreadsheets", text: "Hotspot carried a 4-hour client workshop from a Santorini rooftop. Zero freezes. Client asked for my 'office'.", stars: 5 },
  { name: "Diego Fuentes", role: "Festival circuit, 8 cities", text: "The app's data-burn meter is brutally honest — I finally know TikTok costs me 1.2 GB per encore.", stars: 5 },
  { name: "Sofia Marchetti", role: "Honeymoon, Patagonia", text: "Aurora alert pinged, we tethered the laptop at a black-sand beach and filed our vows from nowhere.", stars: 4 },
  { name: "Ken T.", role: "Flies weekly, naps rarely", text: "Support answered at 3:12 AM in Reykjavik in 40 seconds. A human. With jokes. At 3 AM.", stars: 5 },
];

export const faqs = [
  { q: "Will BilbyMobile work on my phone?", a: "Any eSIM-capable phone from the last 5 years: iPhone 11 and newer, Pixel 3+, Galaxy S20+, plus most Motorolas and Huaweis. The web app runs a 10-second compatibility scan before you pay — if your device can't do eSIM, Bilby tells you free." },
  { q: "How is BilbyMobile different from Airalo or Holafly?", a: "Airalo sells fixed packs cheap and simple; Holafly sells unlimited by the day at a premium; Nomad wins per-GB at volume; Saily bundles security. BilbyMobile fuses all four: fixed packs, an unlimited Mob tier, rollover data, and VPN + ad-block built in — with Bilby the mascot guiding every step instead of a dry settings screen." },
  { q: "Do I keep my number and WhatsApp?", a: "Yes. BilbyMobile is data-only and rides alongside your home SIM (dual-SIM). Your number, WhatsApp, iMessage and 2FA codes keep working. Add a virtual number for $0.99/mo if you need local calls." },
  { q: "When does my plan start?", a: "Only when you land. Plans activate on first connection to a supported network — not at purchase. Buy Tokyo today, fly in November, the countdown starts at touchdown." },
  { q: "What about regional and business plans?", a: "Global is live first: 190+ countries from $4.99. Regional passports (Europe, Asia-Pacific, Americas) ride on the Bilby tier with rollover. Business — pooled data, a team console, invoices and MDM — ships next on the Mob tier; join the waitlist in the console and Kimi + Claude will draft your rollout docs." },
  { q: "Can I share data / hotspot?", a: "Every tier includes hotspot. Mob includes 100 GB of hotspot per month; Bilby covers 2 devices per pass. The app shows a live per-device burn meter so there are no surprises." },
];

export type Agent = {
  tool: string;
  icon: string;
  color: string;
  role: string;
  mission: string;
  outputs: string[];
  prompt: string;
};

export const agents: Agent[] = [
  {
    tool: "Perplexity", icon: "Radar", color: "#22D3EE",
    role: "Research lead — market truth", mission: "Own every volatile fact: live pricing, coverage counts, ratings, promo pages for the handover.",
    outputs: ["Competitor price sheet (CSV)", "Source log with URLs + dates", "Weekly price-drift alerts"],
    prompt: "Act as a telecom pricing analyst for BilbyMobile (global travel eSIM, Sept 2026). For Airalo, Holafly, Nomad eSIM, Saily, Ubigi and Mobimatter: list their cheapest USA 5GB plan, cheapest Europe 10GB plan, any unlimited monthly plan with price + hotspot allowance, coverage count, iOS rating. Return a markdown table with source URLs and retrieval dates. Flag anything older than 60 days as STALE.",
  },
  {
    tool: "Claude", icon: "Clapperboard", color: "#FF9E5A",
    role: "Creative director — story + copy", mission: "Turn research into the Bilby narrative: mascot voice, acts, microcopy, store listings.",
    outputs: ["Bilby voice guide + narrative", "Full page copy deck", "App Store + Play Store listings"],
    prompt: "You are the creative director for BilbyMobile, a cinematic travel-eSIM brand starring Bilby — a cream-and-navy robot bilby with long outback ears who hops over Australia beaming 5G (dawn-gold #FFB43A, ice-cyan #6EE7FF, void-black #060913; Bebas Neue + Instrument Serif italic). Given this competitor research [PASTE PERPLEXITY TABLE], write: 1) Bilby's voice guide (5 do / 5 don't + 3 sample greetings), 2) hero headline options x5 under 6 words featuring hopping/landing, 3) a comparison section positioning BilbyMobile vs Airalo/Holafly/Nomad/Saily without lying, 4) App Store subtitle + 3 screenshot captions. Tone: film-trailer meets friendly marsupial, zero roaming clichés.",
  },
  {
    tool: "Codex", icon: "SquareCode", color: "#D9FF4B",
    role: "Build engine — ships the code", mission: "Turn the locked Bilby design system into the landing page, web app, and both mobile shells.",
    outputs: ["Landing page (this build)", "Web-app console (/app)", "iOS + Android prototypes"],
    prompt: "Vite + React 19 + TS + Tailwind v4. Build route /app for BilbyMobile: an eSIM console with (a) destination search over this JSON [PASTE DESTINATIONS], (b) cart + checkout modal, (c) QR-activation simulator with 3 states (pending/active/topped-up), (d) SVG usage chart with 7-day bars, (e) Bilby mascot header using /images/bilby-hero.png. Dark cinematic theme: bg #060913, accent #FFB43A, bilby cream #E8D5B5, font Space Grotesk. No placeholders — every button must work with local state.",
  },
  {
    tool: "Kimi", icon: "MoonStar", color: "#C4B5FD",
    role: "Context engine — long-memory QA", mission: "Hold the entire BilbyMobile repo + research in context; catch drift, dead links, stale prices before handover.",
    outputs: ["Nightly repo audit", "Price-drift diff vs sheet", "Handover readiness checklist"],
    prompt: "Here is the full BilbyMobile repo [PASTE FILE TREE + KEY FILES] and the price sheet [PASTE CSV]. Audit: 1) every price shown in UI vs sheet — list mismatches, 2) every external link (incl. bilbymobile.com) — flag dead/redirected, 3) every 'unlimited' claim — verify fine-print exists within 1 click, 4) mascot usage — confirm /images/bilby-hero.png renders with alt text everywhere it appears, 5) TODO/placeholder scan. Return a handover checklist ordered by launch-blocking risk first.",
  },
  {
    tool: "Antigravity", icon: "Orbit", color: "#6EE7FF",
    role: "Agentic IDE — parallel execution", mission: "Run the multi-surface handover: web, iOS, Android tracks side-by-side with live preview.",
    outputs: ["Native shells (Swift/Kotlin)", "Shared design tokens", "Store-ready screenshots"],
    prompt: "Monorepo handover task for BilbyMobile, 3 parallel tracks sharing tokens.json [PASTE TOKENS]: TRACK-A web responsive QA of /app at 390/768/1440px with screenshots; TRACK-B SwiftUI activation flow mirroring the web QR states with the Bilby mascot header; TRACK-C Kotlin (Jetpack Compose) mirror with Material You dynamic color mapped from tokens. Report per-track: files changed, screenshots, failing states. Do not alter token values without approval.",
  },
];

export const sprint = [
  { d: "Step 1", t: "PREVIEW", x: "This landing page. Review Bilby, plans & intel — approve before anything else ships." },
  { d: "Step 2", t: "TRUTH", x: "Perplexity sweeps all 5 rivals; Claude locks Bilby voice; tokens frozen in tokens.json." },
  { d: "Step 3", t: "BUILD", x: "Codex ships /app console; Antigravity opens iOS + Android tracks in parallel." },
  { d: "Step 4", t: "CINEMA", x: "Claude directs motion pass (hero film, Bilby float, grain); Kimi audits nightly." },
  { d: "Step 5", t: "HANDOVER", x: "Kimi + Claude pack docs, store listings & team guides. Measure: activation < 3 min, NPS, CAC." },
];

export const sources = [
  { label: "TripProf · Airalo vs Holafly vs Saily vs Nomad cost 2026", url: "https://tripprof.com/en/blog/airalo-vs-holafly-vs-saily-nomad-esim-2026/" },
  { label: "TechRadar · Best eSIMs tested 2026", url: "https://www.techradar.com/pro/best-esims-for-international-travel" },
  { label: "PCMag · Best eSIMs 2026", url: "https://www.pcmag.com/picks/the-best-esim" },
  { label: "MobiMatter · Definitive eSIM comparison 2026", url: "https://mobimatter.com/blog/best-esims-for-travel-definitive-esim-comparison-guide/" },
  { label: "Saily blog · Airalo vs Holafly 2026", url: "https://saily.com/blog/airalo-vs-holafly/" },
  { label: "DataMintelligence · Travel eSIM market 2035 forecast", url: "https://www.datamintelligence.com/research-report/travel-esim-market" },
];
