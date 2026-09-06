/**
 * The console's bootstrap window, and that it shuts.
 *
 * With no mail provider the sign in link is shown on screen instead of sent,
 * because otherwise there is no way into a console on the day it first goes up.
 * That is a door, and a door needs a test that proves it closes.
 */
import crypto from "node:crypto";

import { run, one } from "../src/lib/db";
import { requestLogin, inBootstrapWindow } from "../src/lib/staff";

let passed = 0, failed = 0;
function check(name: string, ok: boolean, detail?: unknown) {
  if (ok) { passed++; console.log(`  ok    ${name}`); }
  else { failed++; console.log(`  FAIL  ${name}`, detail ?? ""); }
}

async function main() {
  const email = `owner-${crypto.randomBytes(4).toString("hex")}@example.com`;
  process.env.OWNER_EMAIL = email;
  delete process.env.RESEND_API_KEY;

  // Nobody has ever signed in on this database.
  await run(`DELETE FROM staff_sessions`);
  await run(`DELETE FROM staff_login_tokens`);
  await run(`DELETE FROM rate_limits`);

  console.log("\nBootstrap window\n");

  check("the window reports open", await inBootstrapWindow());

  const first = await requestLogin(email);
  check("the first request hands back a link", !!first.devLink, first);

  // Somebody signs in. The token exchange is not exercised here; what matters
  // to this guard is only that a session row exists.
  const staff = await one<{ id: string }>(`SELECT id FROM staff WHERE email = ?`, [email]);
  check("the owner account was created", !!staff);
  await run(
    `INSERT INTO staff_sessions (token_hash, staff_id, expires_at) VALUES (?,?, now() + interval '30 days')`,
    [crypto.randomBytes(16).toString("hex"), staff!.id],
  );

  console.log("\nAfter the first sign in\n");

  check("the window reports closed", !(await inBootstrapWindow()));

  const second = await requestLogin(email);
  check("a later request hands back nothing", !second.devLink, second);
  check("and still reports sent, so it leaks nothing", second.sent === true);

  const stranger = await requestLogin(`nobody-${crypto.randomBytes(3).toString("hex")}@example.com`);
  check("an unknown address never gets a link", !stranger.devLink, stranger);

  console.log("\nWith a mail provider configured\n");

  process.env.RESEND_API_KEY = "re_not_a_real_key";
  await run(`DELETE FROM staff_sessions`);
  check(
    "a configured key closes the window even with no sessions",
    !(await inBootstrapWindow()),
  );
  delete process.env.RESEND_API_KEY;

  await run(`DELETE FROM staff_sessions`);
  await run(`DELETE FROM staff_login_tokens WHERE email = ?`, [email]);
  await run(`DELETE FROM staff WHERE email = ?`, [email]);

  console.log(`\n${passed} passed, ${failed} failed\n`);
}

main().then(() => process.exit(failed === 0 ? 0 : 1), (e) => { console.error(e); process.exit(1); });
