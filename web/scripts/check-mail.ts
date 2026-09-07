/**
 * Will an email actually leave the building?
 *
 *   cd web
 *   $env:RESEND_API_KEY="re_..."; $env:MAIL_FROM="Bilby <hello@bilbymobile.com>"; npx tsx scripts/check-mail.ts you@example.com
 *
 * ## Why this is worth a script rather than a glance at the dashboard
 *
 * A mail provider refusing a send is invisible from the outside. The person
 * waiting for a sign in link simply never gets one, assumes they mistyped the
 * address, and tries again. Nothing anywhere says no.
 *
 * That failure has teeth here, because the console's bootstrap window closes
 * the moment RESEND_API_KEY exists. Set the key with a MAIL_FROM on a domain
 * that is not verified and the console stops showing you the link on screen
 * AND cannot email it to you. Your current session keeps working until it
 * expires, and then you are locked out of your own console with no way back
 * except deleting every row from staff_sessions.
 *
 * So the order is: verify the domain, run this, then set the variables in
 * Vercel. Not the other way round.
 *
 * ## It never prints the key
 *
 * Not a masked version, not a length. It prints the sender, the recipient and
 * what Resend said, because those are the parts that are wrong when this fails.
 */

const key = process.env.RESEND_API_KEY;
const from = process.env.MAIL_FROM;
const to = process.argv[2];

console.log("");

if (!key) {
  console.error("  RESEND_API_KEY is not set in this shell.\n");
  process.exit(1);
}

if (!to) {
  console.error("  Give it an address to send to:\n");
  console.error("    npx tsx scripts/check-mail.ts you@example.com\n");
  console.error("  Use a mailbox you can actually open. A send that Resend");
  console.error("  accepts and the receiver silently bins still counts as");
  console.error("  broken, and this is the only way to find that out.\n");
  process.exit(1);
}

/* ---- Shape checks, before anything touches the network ----------------- */

const problems: string[] = [];

if (!from) {
  problems.push(
    "MAIL_FROM is not set. The code falls back to Bilby <hello@bilbymobile.com>,\n" +
      "   which only works if bilbymobile.com is a verified domain in Resend. Set\n" +
      "   it explicitly so the value you test is the value you deploy.",
  );
}

// Resend accepts either "someone@example.com" or "Name <someone@example.com>".
// Anything else comes back as a 422 that reads like a server fault.
const address = from?.match(/<([^>]+)>\s*$/)?.[1] ?? from ?? "";
if (from && !/^[^@\s]+@[^@\s.]+\.[^@\s]+$/.test(address)) {
  problems.push(
    `MAIL_FROM does not contain a usable address. Got "${from}".\n` +
      '   Use either  someone@example.com  or  Name <someone@example.com>',
  );
}

if (/@(gmail|outlook|hotmail|yahoo|icloud)\./i.test(address)) {
  problems.push(
    `You cannot send as ${address}. Resend only sends from a domain you have\n` +
      "   verified, and nobody can verify gmail.com. This has to be an address on\n" +
      "   your own domain.",
  );
}

if (problems.length) {
  console.log("  Problems");
  console.log("  " + "-".repeat(56));
  for (const p of problems) console.log(`  x  ${p}\n`);
  console.log("  Fix those first. Not sending.\n");
  process.exit(1);
}

/* ---- Then actually send ------------------------------------------------ */

const sender = from as string;

async function main() {
console.log("  Sending");
console.log("  " + "-".repeat(56));
console.log(`  from       ${sender}`);
console.log(`  to         ${to}`);
console.log("");

const res = await fetch("https://api.resend.com/emails", {
  method: "POST",
  headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
  body: JSON.stringify({
    from: sender,
    to,
    subject: "Bilby mail check",
    text:
      "This is scripts/check-mail.ts proving that Bilby can send email.\n\n" +
      "If you are reading it in your inbox rather than your spam folder, the\n" +
      "sign in links and the order delivery emails will arrive too.\n",
  }),
  signal: AbortSignal.timeout(15_000),
});

const body = await res.text();

if (res.ok) {
  console.log("  Resend accepted it.");
  console.log("");
  console.log("  That is half the answer. Now open the mailbox. An accepted send");
  console.log("  that lands in spam is still a customer who never got their eSIM,");
  console.log("  and Resend cannot tell you which happened.");
  console.log("");
  console.log("  If it is in spam, the usual cause is a missing DMARC record.");
  console.log("  Resend does not require one to verify the domain, but Gmail and");
  console.log("  Yahoo want one from anybody sending at volume.");
  console.log("");
  console.log("  Once it arrives, put RESEND_API_KEY and MAIL_FROM in Vercel and");
  console.log("  redeploy. Environment variables are baked in at build time, so");
  console.log("  adding them without a deployment changes nothing.\n");
  process.exit(0);
}

console.log(`  Resend refused it, HTTP ${res.status}.`);
console.log("");

// The message Resend returns is specific and useful, so it is shown verbatim
// rather than being replaced with a guess about what it means.
let fromResend = true;
try {
  const parsed = JSON.parse(body) as { message?: string; name?: string };
  if (parsed.message) console.log(`  "${parsed.message}"`);
  if (parsed.name) console.log(`  (${parsed.name})`);
} catch {
  // Resend answers in JSON. Anything else came from something in between: a
  // corporate proxy, a captive portal, an egress allowlist. Worth saying,
  // because the advice below is about Resend and would send you looking in
  // the wrong place entirely.
  fromResend = false;
  console.log(`  ${body.slice(0, 500)}`);
  console.log("");
  console.log("  That is not a Resend response. Something between this machine");
  console.log("  and api.resend.com answered instead, so the advice below may");
  console.log("  not apply. Check whatever sits on your network path first.");
}

console.log("");

switch (fromResend ? res.status : -1) {
  case 401:
  case 403:
    console.log("  Two causes, in order of likelihood:");
    console.log("");
    console.log(`  1. The domain ${address.split("@")[1] ?? "in MAIL_FROM"} is not verified.`);
    console.log("     Resend, Domains, and it must say Verified rather than Pending.");
    console.log("     DNS changes are not instant; pending is not the same as wrong.");
    console.log("  2. The API key is wrong, revoked, or belongs to another account.");
    console.log("     Resend cannot show you an existing key again, so make a new");
    console.log("     one rather than guessing at the old one.");
    break;
  case 422:
    console.log("  Resend understood the request and rejected its contents. Almost");
    console.log("  always the from address: it must be  Name <someone@example.com>");
    console.log("  or a bare  someone@example.com  and nothing else.");
    break;
  case 429:
    console.log("  Rate limited. The free plan is 100 emails a day and 3,000 a");
    console.log("  month, whichever runs out first.");
    break;
  case -1:
    break;
  default:
    console.log("  Not a failure this script has seen before. The message above is");
    console.log("  from Resend and is the thing to search for.");
}

console.log("");
console.log("  Nothing has been changed. Do not set RESEND_API_KEY in Vercel until");
console.log("  this passes: the console stops showing the sign in link on screen");
console.log("  the moment that key exists, so a key that cannot send is a locked");
console.log("  door with the key on the wrong side of it.\n");
process.exit(1);
}

main().catch((e: Error) => {
  // A thrown error here is the network, not Resend: a DNS failure, a proxy,
  // or the fifteen second timeout expiring. Resend refusing a send is a
  // response, and is handled above.
  console.log(`  Could not reach api.resend.com: ${e.message}`);
  console.log("");
  process.exit(1);
});

export {};
