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
  { id: "tokyo", city: "Tokyo", country: "Japan", region: "Asia-Pacific", img: "/images/dest-tokyo.jpg", price: 9.5, data: "10 GB", days: 15, tag: "NEON CUT", rating: 4.9, net: "Tier-1 5G" },
  { id: "santorini", city: "Santorini", country: "Greece", region: "Europe", img: "/images/dest-santorini.jpg", price: 7.0, data: "10 GB", days: 30, tag: "GOLDEN HOUR", rating: 4.9, net: "Tier-1 5G" },
  { id: "reykjavik", city: "Reykjavik", country: "Iceland", region: "Europe", img: "/images/dest-iceland.jpg", price: 8.0, data: "10 GB", days: 30, tag: "AURORA CUT", rating: 4.8, net: "5G / LTE" },
  { id: "marrakech", city: "Marrakech", country: "Morocco", region: "Middle East & Africa", img: "/images/dest-marrakech.jpg", price: 11.0, data: "5 GB", days: 15, tag: "DUST & AMBER", rating: 4.8, net: "5G / LTE" },
  { id: "bali", city: "Canggu", country: "Bali", region: "Asia-Pacific", img: "/images/traveler.jpg", price: 8.5, data: "20 GB", days: 30, tag: "SURF CUT", rating: 4.9, net: "Tier-1 5G" },
  { id: "patagonia", city: "Torres del Paine", country: "Chile", region: "Americas", img: "/images/dest-iceland.jpg", price: 14.0, data: "5 GB", days: 15, tag: "EDGE OF MAP", rating: 4.7, net: "4G / 5G" },
];

export type ComparisonRow = {
  f: string;
  typical: string;
  bilby: string;
};

export const comparisonRows: ComparisonRow[] = [
  { f: "Entry price", typical: "$10+ for a small pack", bilby: "From $4.99 · nothing added at checkout" },
  { f: "Coverage", typical: "Varies wildly by plan", bilby: "150+ countries · single, regional & global" },
  { f: "Validity start", typical: "Often ticks from purchase", bilby: "Starts at first use — buy early, lose nothing" },
  { f: "Refunds", typical: "Complicated or profile-locked", bilby: "Cancel & refund before activation" },
  { f: "Top-ups", typical: "Force a brand-new profile", bilby: "Top up the same profile — data + validity" },
  { f: "Plan types", typical: "Fixed packs only", bilby: "Fixed, day-pass unlimited & regional bundles" },
  { f: "Support", typical: "Bots & ticket queues", bilby: "Humans 24/7 · under a minute, day or night" },
  { f: "Fine print", typical: "Buried on page 14", bilby: "Fair-use policy shown before you pay" },
];

export const tiers = [
  {
    name: "JOEY", price: 9, tag: "Pay-per-trip · Global", desc: "For the weekend hop. Fixed packs in 150+ countries, guided by Bilby.",
    feats: ["Fixed data packs, 1–50 GB", "Validity 7–30 days", "Hotspot included", "5G where available", "Top up the same profile"],
    cta: "Start hopping", hot: false,
  },
  {
    name: "BILBY", price: 29, tag: "Most loved · Regional", desc: "Multi-country arcs on one profile. Regional bundles plus day passes.",
    feats: ["Regional & global bundles", "Day-pass unlimited options", "Cancel & refund before activation", "180 days to install", "Priority 5G routing"],
    cta: "Go Bilby", hot: true,
  },
  {
    name: "MOB", price: 59, tag: "Unlimited · Business-ready", desc: "One pass for the whole mob. Long-stay unlimited plus team tools.",
    feats: ["Unlimited day passes, 1–365 days", "FUP speed shown before you pay", "100 GB hotspot / month", "Team console + pooling — coming", "Cancel anytime"],
    cta: "Gather the mob", hot: false,
  },
];

export const planTabs = [
  { id: "global", label: "GLOBAL", blurb: "150+ countries, one eSIM. Land connected from $4.99 — live today." },
  { id: "regional", label: "REGIONAL", blurb: "Europe · Asia-Pacific · Americas bundles — one profile, every border in the region." },
  { id: "business", label: "BUSINESS", blurb: "Pooled data, team console, invoices & MDM — Mob tier. Early access opening soon." },
];

export const reviews = [
  { name: "Maya Chen", role: "DP · shot in 31 countries", text: "Landed in Tokyo, Bilby scanned before the seatbelt sign went off. My producer thought it was a camera trick. It wasn't.", stars: 5 },
  { name: "Jonas Weber", role: "Overland biker, Lisbon→Hanoi", text: "Crossed 14 borders on one Bilby profile. A mid-desert top-up kept the same eSIM alive all the way to the mountains.", stars: 5 },
  { name: "Amara Okafor", role: "Remote surgeon of spreadsheets", text: "Hotspot carried a 4-hour client workshop from a Santorini rooftop. Zero freezes. Client asked for my 'office'.", stars: 5 },
  { name: "Diego Fuentes", role: "Festival circuit, 8 cities", text: "The burn meter is brutally honest — I finally know TikTok costs me 1.2 GB per encore.", stars: 5 },
  { name: "Sofia Marchetti", role: "Honeymoon, Patagonia", text: "Aurora alert pinged, we tethered the laptop at a black-sand beach and filed our vows from nowhere.", stars: 4 },
  { name: "Ken T.", role: "Flies weekly, naps rarely", text: "Support answered at 3:12 AM in Reykjavik in 40 seconds. A human. With jokes. At 3 AM.", stars: 5 },
];

export const faqs = [
  { q: "Will BilbyMobile work on my phone?", a: "Any eSIM-capable, carrier-unlocked phone: iPhone 11 and newer, Pixel 3+, Galaxy S20+, plus most modern Motorolas, OPPOs and Huaweis. The console runs a free 10-second compatibility scan before you pay." },
  { q: "Is BilbyMobile data-only?", a: "Yes — every plan is data-only: no calls, no SMS, no phone number and no emergency calling. Your Bilby eSIM rides alongside your home SIM (dual-SIM), so your number, WhatsApp and 2FA codes keep working. Please keep another way to reach emergency services." },
  { q: "When does my plan start?", a: "Only when you land. Validity runs from first connection to a supported network — not from purchase. Buy Tokyo today, fly in November, the countdown starts at touchdown." },
  { q: "What if my plans change?", a: "Every plan can be cancelled for a full refund before it is activated. And if your eSIM profile expires before you travel (profiles must be installed within 180 days of issue), contact us and we will reissue it free of charge." },
  { q: "What plan types are there?", a: "Global fixed packs are live first: 150+ countries from $4.99. Regional bundles (Europe, Asia-Pacific, Americas) and day-pass unlimited plans ride the same profile. Business pooling with a team console opens next." },
  { q: "Can I share data / hotspot?", a: "Every tier includes hotspot — Mob includes 100 GB of hotspot per month. You can also top up an active profile with more data and validity instead of installing a new eSIM." },
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
    role: "Research lead — market truth", mission: "Own every volatile fact: live market pricing, coverage counts, ratings and promo pages for launch planning.",
    outputs: ["Market price sheet (CSV)", "Source log with URLs + dates", "Weekly price-drift alerts"],
    prompt: "Act as a telecom pricing analyst for BilbyMobile (global travel eSIM, Sept 2026). Sweep the travel-eSIM market: find the going rate for entry-level 1–5 GB packs, 10 GB plans for USA / Europe / Asia, unlimited day-pass pricing tiers, typical coverage counts and app-store ratings across the leading brands. Return a markdown table with source URLs and retrieval dates. Flag anything older than 60 days as STALE.",
  },
  {
    tool: "Claude", icon: "Clapperboard", color: "#FF9E5A",
    role: "Creative director — story + copy", mission: "Turn research into the Bilby narrative: mascot voice, acts, microcopy, store listings.",
    outputs: ["Bilby voice guide + narrative", "Full page copy deck", "App Store + Play Store listings"],
    prompt: "You are the creative director for BilbyMobile, a cinematic travel-eSIM brand starring Bilby — a cream-and-navy robot bilby with long outback ears who hops over Australia beaming 5G (dawn-gold #FFB43A, ice-cyan #6EE7FF, void-black #060913; Bebas Neue + Instrument Serif italic). Given this market research [PASTE PERPLEXITY TABLE], write: 1) Bilby's voice guide (5 do / 5 don't + 3 sample greetings), 2) hero headline options x5 under 6 words featuring hopping/landing, 3) a comparison section positioning BilbyMobile against the typical travel-eSIM experience (no naming rivals), 4) App Store subtitle + 3 screenshot captions. Tone: film-trailer meets friendly marsupial, zero roaming clichés.",
  },
  {
    tool: "Codex", icon: "SquareCode", color: "#D9FF4B",
    role: "Build engine — ships the code", mission: "Turn the locked Bilby design system into the landing page, web app, and both mobile shells.",
    outputs: ["Landing page (this build)", "Web-app console (/app)", "iOS + Android prototypes"],
    prompt: "Vite + React 19 + TS + Tailwind v4. Build route /app for BilbyMobile: an eSIM console with (a) destination search over this JSON [PASTE DESTINATIONS], (b) cart + checkout modal, (c) QR-activation simulator with 3 states (pending/active/topped-up), (d) SVG usage chart with 7-day bars, (e) Bilby mascot header using /images/bilby-hero.png. Dark cinematic theme: bg #060913, accent #FFB43A, bilby cream #E8D5B5, font Space Grotesk. No placeholders — every button must work with local state.",
  },
  {
    tool: "Kimi", icon: "MoonStar", color: "#C4B5FD",
    role: "Context engine — long-memory QA", mission: "Hold the entire BilbyMobile repo + research in context; catch drift, dead links and stale prices before launch.",
    outputs: ["Nightly repo audit", "Price-drift diff vs sheet", "Launch readiness checklist"],
    prompt: "Here is the full BilbyMobile repo [PASTE FILE TREE + KEY FILES] and the price sheet [PASTE CSV]. Audit: 1) every price shown in UI vs sheet — list mismatches, 2) every external link (incl. bilbymobile.com) — flag dead/redirected, 3) every 'unlimited' claim — verify fine-print exists within 1 click, 4) mascot usage — confirm /images/bilby-hero.png renders with alt text everywhere it appears, 5) TODO/placeholder scan. Return a launch checklist ordered by launch-blocking risk first.",
  },
  {
    tool: "Antigravity", icon: "Orbit", color: "#6EE7FF",
    role: "Agentic IDE — parallel execution", mission: "Run the multi-surface launch: web, iOS, Android tracks side-by-side with live preview.",
    outputs: ["Native shells (Swift/Kotlin)", "Shared design tokens", "Store-ready screenshots"],
    prompt: "Monorepo launch task for BilbyMobile, 3 parallel tracks sharing tokens.json [PASTE TOKENS]: TRACK-A web responsive QA of /app at 390/768/1440px with screenshots; TRACK-B SwiftUI activation flow mirroring the web QR states with the Bilby mascot header; TRACK-C Kotlin (Jetpack Compose) mirror with Material You dynamic color mapped from tokens. Report per-track: files changed, screenshots, failing states. Do not alter token values without approval.",
  },
];

export const sprint = [
  { d: "Step 1", t: "PREVIEW", x: "This landing page. Review Bilby, plans & comparisons — approve before anything else ships." },
  { d: "Step 2", t: "TRUTH", x: "Perplexity sweeps the market; Claude locks Bilby voice; tokens frozen in tokens.json." },
  { d: "Step 3", t: "BUILD", x: "Codex ships /app console; Antigravity opens iOS + Android tracks in parallel." },
  { d: "Step 4", t: "CINEMA", x: "Claude directs motion pass (hero film, Bilby float, grain); Kimi audits nightly." },
  { d: "Step 5", t: "LAUNCH", x: "Kimi + Claude pack docs, store listings & team guides. Measure: activation < 3 min, NPS, CAC." },
];
