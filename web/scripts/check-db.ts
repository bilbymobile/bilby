/**
 * Is DATABASE_URL right, and if not, which part is wrong?
 *
 *   cd web
 *   DATABASE_URL="<your string>" npx tsx scripts/check-db.ts
 *
 * On Windows PowerShell:
 *
 *   cd web
 *   $env:DATABASE_URL="<your string>"; npx tsx scripts/check-db.ts
 *
 * ## It never prints the password
 *
 * Not a masked version, not a length, not a first character. It prints the
 * username, the host, the port and the database, because those are the parts
 * that are actually wrong when this fails and none of them is a secret. If the
 * password is the problem this says so without describing it.
 *
 * That matters more than it sounds. The instinct when a connection fails is to
 * paste the whole string somewhere for help, and the whole string is a
 * credential to your production database. This exists so you never have to.
 *
 * ## Why the username is the thing to look at
 *
 * Supabase offers three connection strings and they differ in the USERNAME, not
 * only in host and port. The pooler encodes the project in the username, so
 * postgres.<project ref> reaches your project and a bare postgres reaches
 * nothing at all. The pooler reports that as "password authentication failed
 * for user postgres", which sends you to check a password that was never the
 * problem.
 */

import { Client } from "pg";

const raw = process.env.DATABASE_URL;

if (!raw) {
  console.error("\nDATABASE_URL is not set in this shell.\n");
  process.exit(1);
}

console.log("");

let u: URL;
try {
  u = new URL(raw);
} catch {
  console.error("  The string is not a valid URL.\n");
  console.error("  Almost always a password containing one of  @ : / ? # % [ ]");
  console.error("  that has not been percent encoded.\n");
  console.error("  @ becomes %40    : becomes %3A    / becomes %2F");
  console.error("  # becomes %23    % becomes %25    ? becomes %3F\n");
  console.error("  Or reset the database password to letters and digits and");
  console.error("  delete the problem rather than encoding around it.\n");
  process.exit(1);
}

const user = decodeURIComponent(u.username);
const host = u.hostname;
const port = u.port || "5432";
const database = u.pathname.replace(/^\//, "") || "(none)";
const hasPassword = u.password.length > 0;

console.log("  What the string parses to");
console.log("  " + "-".repeat(56));
console.log(`  username   ${user || "(none)"}`);
console.log(`  host       ${host}`);
console.log(`  port       ${port}`);
console.log(`  database   ${database}`);
console.log(`  password   ${hasPassword ? "present, not shown" : "MISSING"}`);
console.log("");

/* ---- The shape checks, before anything touches the network ------------- */

const problems: string[] = [];
const notes: string[] = [];

// Loopback is exempt. A local Postgres on trust auth legitimately has no
// password, and flagging that would train you to ignore this output, which is
// the fastest way to make a check like this worthless.
const loopback = ["localhost", "127.0.0.1", "::1"].includes(host);

if (!hasPassword && !loopback) {
  problems.push(
    "There is no password in the string. If you pasted the Supabase template,\n" +
      "   the [YOUR-PASSWORD] placeholder still needs replacing.",
  );
}

if (raw.includes("[YOUR-PASSWORD]") || raw.includes("%5BYOUR-PASSWORD%5D")) {
  problems.push(
    "The [YOUR-PASSWORD] placeholder is still in the string. Replace it with\n" +
      "   the real password, percent encoded if it has punctuation in it.",
  );
}

if (host.endsWith(".pooler.supabase.com") && !user.includes(".")) {
  problems.push(
    `The host is the pooler but the username is "${user}".\n` +
      "   The pooler finds your project from the username, so it must be\n" +
      "   postgres.<project ref>. A bare postgres reaches no project, and the\n" +
      '   pooler reports that as "password authentication failed", which is\n' +
      "   why this is the first thing to check rather than the password.\n" +
      "   Copy the Transaction pooler string whole: Supabase, Connect,\n" +
      "   Transaction pooler.",
  );
}

if (/^db\..*\.supabase\.co$/.test(host)) {
  problems.push(
    `The host is ${host}, which is the Direct connection.\n` +
      "   It is IPv6 only on the free plan and gives one real connection per\n" +
      "   client, which is the wrong shape for serverless. Use the Transaction\n" +
      "   pooler string instead.",
  );
}

if (host.endsWith(".pooler.supabase.com") && port === "5432") {
  notes.push(
    "Port 5432 on the pooler is session mode. It works, but transaction mode\n" +
      "   on 6543 is the one built for serverless.",
  );
}

if (database !== "postgres") {
  notes.push(`The database name is "${database}". Supabase expects postgres.`);
}

if (problems.length) {
  console.log("  Problems");
  console.log("  " + "-".repeat(56));
  for (const p of problems) console.log(`  x  ${p}\n`);
  console.log("  Fix those first. Not connecting.\n");
  process.exit(1);
}

if (notes.length) {
  console.log("  Worth knowing");
  console.log("  " + "-".repeat(56));
  for (const n of notes) console.log(`  ~  ${n}\n`);
}

/* ---- Then actually connect --------------------------------------------- */

console.log("  Connecting");
console.log("  " + "-".repeat(56));

const client = new Client({
  connectionString: raw,
  ssl: loopback ? false : { rejectUnauthorized: false },
  connectionTimeoutMillis: 10_000,
});

client
  .connect()
  .then(async () => {
    const r = await client.query(
      "select current_user, current_database(), version()",
    );
    const row = r.rows[0] as {
      current_user: string;
      current_database: string;
      version: string;
    };
    console.log(`  connected as   ${row.current_user}`);
    console.log(`  database       ${row.current_database}`);
    console.log(`  server         ${row.version.split(" ").slice(0, 2).join(" ")}`);

    const t = await client.query(
      "select count(*)::int as n from information_schema.tables where table_schema = 'public'",
    );
    const n = (t.rows[0] as { n: number }).n;
    console.log(`  tables         ${n}`);
    console.log("");
    if (n === 0) {
      console.log("  Empty, which is correct before the first request. The schema");
      console.log("  builds itself when the application first touches it.\n");
    }
    console.log("  This string works. Put it in Vercel and redeploy.\n");
    await client.end();
    process.exit(0);
  })
  .catch(async (e: Error & { code?: string }) => {
    console.log("");
    switch (e.code) {
      case "28P01":
        console.log("  The server rejected the password.");
        console.log("");
        console.log("  Two causes, in order of likelihood:");
        console.log("  1. The password has punctuation that is not percent encoded,");
        console.log("     so the string parses into a different password than you");
        console.log("     think. Encode it, or reset it to letters and digits.");
        console.log("  2. It is genuinely the wrong password. Supabase cannot show");
        console.log("     it to you again, so reset it rather than guessing.");
        break;
      case "ENOTFOUND":
      case "EAI_AGAIN":
        console.log(`  The host ${host} does not resolve.`);
        console.log("  Check it against what Supabase shows under Connect.");
        break;
      case "ETIMEDOUT":
      case "ECONNREFUSED":
        console.log(`  Nothing answered on ${host}:${port}.`);
        if (/^db\..*\.supabase\.co$/.test(host)) {
          console.log("  Expected for the direct connection: it is IPv6 only.");
          console.log("  Use the Transaction pooler string.");
        } else if (loopback) {
          console.log("  Nothing is listening there. Is your local Postgres running?");
        } else {
          console.log("  Reachable host, closed port. Check the port against what");
          console.log("  Supabase shows under Connect: 6543 for transaction mode.");
        }
        break;
      case "3D000":
        console.log(`  The server has no database called "${database}".`);
        break;
      default:
        console.log(`  ${e.message}`);
        if (e.code) console.log(`  Postgres code ${e.code}`);
    }
    console.log("");
    await client.end().catch(() => {});
    process.exit(1);
  });
