import { Link } from "react-router-dom";
import { ArrowLeft, FileText, ShieldCheck } from "lucide-react";

const sections = [
  {
    h: "1. What Bilby is",
    body: [
      "Bilby resells mobile data via eSIM profiles. We are not a mobile network operator. We buy connectivity wholesale and pass it on to you; the network in each country is owned and operated by a third party.",
      "Bilby is the telecommunications division of Nextwave.au, Australia. These terms are governed by the laws of Australia.",
    ],
  },
  {
    h: "2. What you are buying",
    body: [
      "A prepaid data allowance on a roaming eSIM profile, valid for one country or region and for a fixed period. This is not a subscription: nothing renews automatically and there is nothing to cancel.",
    ],
    list: [
      "The full price, data allowance, validity period and partner networks are shown before you pay. There is no activation fee and nothing is added at checkout.",
      "Validity runs from first use, not from purchase, so buying early costs you nothing.",
      "When your data is exhausted or the validity period ends, the plan simply stops. We will not bill you again or charge you a higher rate.",
      "Unused data does not roll over and has no cash value.",
      "You can top up an existing profile instead of installing a new one, subject to the underlying network's rules.",
      "Your eSIM profile does not last indefinitely. As is standard across the industry, a profile must be activated within a set window after issue and is reclaimed by the network after a prolonged period of inactivity. If yours lapses before you travel, contact us and we will reissue it free of charge.",
    ],
  },
  {
    h: "3. Discounts and promotional codes",
    body: ["We occasionally issue discount codes. Unless the offer states otherwise:"],
    list: [
      "One code per order; codes do not stack.",
      "Codes have no cash value, cannot be exchanged for money, and cannot be sold or transferred.",
      "Codes carry an expiry date and may be subject to usage limits, a minimum spend, or restrictions on destinations or plan sizes. Any such limits are shown with the code.",
      "We may withdraw a code at any time. Withdrawal does not affect orders already placed with it.",
      "If a refund is due on a discounted order, we refund the amount you actually paid — not the undiscounted price.",
      "We may void a code and cancel the associated order where it has clearly been obtained or used contrary to its intended purpose — for example, creating multiple accounts to reuse a single-use code.",
    ],
  },
  {
    h: "4. Fair use, and when we may suspend or refuse service",
    body: [
      "We may suspend an account, cancel an order, or refuse service where we have reasonable grounds to believe a user has:",
    ],
    list: [
      "Resold Bilby data or eSIM profiles;",
      "Created multiple accounts to reuse a single-use discount code;",
      "Misrepresented their location to obtain regional pricing;",
      "Used a payment method they were not entitled to use; or",
      "Used the connection in a way that would put our supplier in breach of the laws of the country where the data is used.",
    ],
    after: "If you believe we got this wrong, email us and a human will review the decision. We would rather reinstate a wrongly flagged account than leave it suspended.",
  },
  {
    h: "5. Your eSIM",
    list: [
      "You need an eSIM-capable, carrier-unlocked phone. We cannot verify compatibility in advance, so please check with your carrier first.",
      "Your Bilby eSIM is a roaming profile. Data roaming must be switched on for it to connect.",
      "It is data only: no calls, no SMS, no phone number, and no emergency calling. Please keep a working SIM or another way to contact emergency services.",
      "Coverage, speed and availability depend on the local network operator and are outside our control.",
      "An eSIM profile can normally be installed only once. Reinstalling on a new phone may require a new profile, for which we may charge a fee.",
    ],
  },
  {
    h: "6. Plans and payment",
    body: [
      "All plans are prepaid. Prices shown before purchase include any applicable GST. Data expires at the end of the plan's validity period, whether used or not — this is how wholesale data is sold to us, and we are unable to change it.",
      "Refunds are covered in our refund policy, which forms part of these terms and operates in addition to your rights under section 7.",
    ],
  },
  {
    h: "7. Australian Consumer Law",
    body: [
      "Nothing in these terms excludes, restricts or modifies any guarantee, right or remedy you have under the Australian Consumer Law that cannot lawfully be excluded.",
      "Our services come with guarantees that cannot be excluded. You are entitled to a replacement or refund for a major failure, and to compensation for any other reasonably foreseeable loss or damage. Where a failure is not major, you are entitled to have the problem fixed within a reasonable time — or, failing that, to a refund.",
    ],
  },
  {
    h: "8. Liability",
    body: [
      "Subject to section 7, and to the extent permitted by law, our total liability to you for any claim is limited to the greater of: (a) the amount you paid us in the 12 months before the claim; or (b) AUD $100.",
      "To the extent permitted by law, we are not liable for indirect or consequential loss — including missed flights, bookings or business opportunities — arising from a loss of connectivity. Mobile networks can and do fail. Please do not rely on Bilby as your only means of connectivity for anything critical.",
    ],
  },
  {
    h: "9. Changes, privacy and contact",
    body: [
      "We may update these terms from time to time. Where a change is material, we will notify you in the app before it takes effect. Continued use of Bilby after that point constitutes acceptance of the updated terms.",
      "We handle personal information in accordance with our privacy policy, available at bilbymobile.com/privacy.",
      "Questions or complaints: hello@bilbymobile.com",
    ],
  },
];

export default function Terms() {
  return (
    <div className="grain min-h-screen bg-[#060913] text-[#f4efe6]">
      <header className="sticky top-0 z-[70] glass border-b border-white/10">
        <div className="max-w-4xl mx-auto px-5 md:px-8 py-4 flex items-center gap-4">
          <Link to="/" className="w-10 h-10 rounded-full border border-white/15 grid place-items-center hover:border-[#FFB43A] hover:text-[#FFB43A] transition-colors shrink-0"><ArrowLeft className="w-5 h-5" /></Link>
          <div className="flex items-center gap-3 min-w-0">
            <span className="w-10 h-10 rounded-2xl overflow-hidden border border-[#FFB43A]/50 shrink-0"><img src="/images/bilby-hero.png" alt="Bilby mascot" className="w-full h-full object-cover" /></span>
            <div className="min-w-0"><div className="font-display text-2xl tracking-[0.08em] leading-none">BILBY<span className="text-[#FFB43A]">MOBILE</span></div><div className="font-monox text-[10px] tracking-[0.25em] text-white/40">TERMS OF SERVICE</div></div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-5 md:px-8 py-14">
        <div className="flex items-center gap-3 mb-3">
          <span className="w-11 h-11 rounded-2xl grid place-items-center bg-[#FFB43A]/10 border border-[#FFB43A]/40 shrink-0"><FileText className="w-5 h-5 text-[#FFB43A]" /></span>
          <div className="font-monox text-[11px] tracking-[0.3em] text-[#FFB43A]">THE FINE PRINT, IN BIG TYPE</div>
        </div>
        <h1 className="font-display text-6xl md:text-7xl leading-[0.9] mb-4">TERMS OF SERVICE</h1>
        <p className="font-monox text-[11px] tracking-[0.2em] text-white/40 mb-2">EFFECTIVE 16 AUGUST 2026 · GOVERNED BY THE LAWS OF AUSTRALIA</p>
        <p className="text-sm text-white/60 leading-relaxed mb-12 max-w-2xl">By using Bilby, you agree to these terms. No asterisks, no page-14 surprises — if a sentence here could cost you money, it is written in plain English.</p>

        <div className="space-y-8">
          {sections.map((s) => (
            <section key={s.h} className="rounded-3xl border border-white/10 bg-[#0c1220] p-7 md:p-8">
              <h2 className="font-display text-3xl tracking-wide text-[#FFB43A] mb-4">{s.h.toUpperCase()}</h2>
              {s.body?.map((p, i) => (<p key={i} className="text-sm md:text-[15px] text-white/70 leading-relaxed mb-3">{p}</p>))}
              {s.list && (
                <ul className="space-y-2.5 mt-1">
                  {s.list.map((li, i) => (
                    <li key={i} className="flex gap-3 text-sm md:text-[15px] text-white/70 leading-relaxed">
                      <span className="w-1.5 h-1.5 bg-[#FFB43A] rotate-45 shrink-0 mt-2" />{li}
                    </li>
                  ))}
                </ul>
              )}
              {s.after && <p className="text-sm md:text-[15px] text-white/70 leading-relaxed mt-4">{s.after}</p>}
            </section>
          ))}
        </div>

        <div className="mt-10 rounded-3xl border border-white/10 bg-black p-6 flex flex-col sm:flex-row items-center gap-4">
          <ShieldCheck className="w-8 h-8 text-emerald-400 shrink-0" />
          <p className="text-sm text-white/55 leading-relaxed text-center sm:text-left">These terms operate in addition to your rights under the Australian Consumer Law, which cannot be excluded. Questions or complaints: <span className="text-[#FFB43A] font-semibold">hello@bilbymobile.com</span></p>
          <Link to="/" className="sm:ml-auto shrink-0 font-monox text-[11px] tracking-[0.2em] border border-white/20 hover:border-[#FFB43A] hover:text-[#FFB43A] rounded-full px-5 py-2.5 transition-colors">← BACK TO BILBY</Link>
        </div>
      </main>
    </div>
  );
}
