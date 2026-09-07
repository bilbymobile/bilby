# Going to production

The order below is the order. Each step makes the next one possible, and doing
them out of order mostly means doing them twice.

This replaces a document that described an ad funded free tier and an AdMob
sequencing constraint. Both are gone. Nothing in this file mentions ads.

---

## 0 · Two things to start today because they take weeks

Neither is code and neither is in your hands, so they run in parallel with
everything below. Start them before you read further.

**Stripe.** Apply at dashboard.stripe.com. Travel and telecommunications are
both elevated risk categories, so underwriting takes real time and can be
declined. Applying now means a decline arrives while there is still time to
arrange something else, rather than the week you planned to launch.

**Carriage service provider registration.** Under the 2025 amendments a
wholesale provider is prohibited from supplying an unregistered CSP. This is not
a launch formality that sits at the end. It sits in front of the supplier
agreement, which sits in front of selling anything at all.

---

## 1 · The database

Supabase, a new project, region **Sydney, `ap-southeast-2`**.

The region matters more than it looks: a Free plan project cannot be moved
between regions, so getting it wrong means recreating the project. That is free
today and a migration once there is data in it.

Take the connection string from **Settings, Database, Connection string,
Transaction pooler**. Port **6543**, not 5432.

```
postgresql://postgres.<ref>:<password>@<region>.pooler.supabase.com:6543/postgres
```

The direct connection on 5432 will fail under a serverless deployment, because
each instance opens its own pool and there are more instances than that port
will accept. The failure looks like the database being down.

### Check the string before you deploy it

```bash
cd web
DATABASE_URL="<your string>" npx tsx scripts/check-db.ts
```

PowerShell:

```powershell
cd web
$env:DATABASE_URL="<your string>"; npx tsx scripts/check-db.ts
```

It prints the username, host, port and database, names anything wrong, and then
connects. **It never prints the password**, not masked and not by length, so you
can paste its output to anybody. The instinct when a connection fails is to send
somebody the whole string, and the whole string is a credential to your
production database.

### The username is not decoration

Supabase's three connection strings differ in the **username**, not only the
host and port:

| | username | host | port |
|---|---|---|---|
| Direct connection | `postgres` | `db.<ref>.supabase.co` | 5432 |
| Session pooler | `postgres.<ref>` | `<region>.pooler.supabase.com` | 5432 |
| **Transaction pooler** | `postgres.<ref>` | `<region>.pooler.supabase.com` | **6543** |

The pooler finds your project from the username. A bare `postgres` against a
pooler host reaches no project at all, and the pooler reports that as
`password authentication failed for user "postgres"` — which sends you off to
check a password that was never the problem. If you ever see that error, read
the username in it first.

The application refuses both of the broken shapes at startup with a message
naming the fix, rather than letting Postgres describe it as an auth failure.

### Percent encode the password, always

If the password contains `@ : / ? # % [ ]` the string has to be encoded, and the
reason to do it even when you think you have got away with it is that different
tools disagree about the same string. Tested against a real Postgres with a
password of `@abcdefgh`:

| Parser | Raw `:@abcdefgh@host` | Encoded `:%40abcdefgh@host` |
|---|---|---|
| `pg`, the driver this app uses | connects | connects |
| the WHATWG URL parser | parses | parses |
| **`psql` and anything else on libpq** | **fails** | connects |

`pg` splits the authority on the LAST `@` and libpq splits it on the FIRST, so
an unencoded password produces an application that works and a `psql` session
that reports `could not translate host name "abcdefgh@host"`. That is the worst
shape a bug can take: it works until the moment you are trying to debug
something else.

The characters that matter:

```
@ → %40    : → %3A    / → %2F    ? → %3F
# → %23    % → %25    [ → %5B    ] → %5D
```

The better answer, while the project is new and empty, is to reset the database
password to letters and digits only. It costs a minute now and removes the whole
class of problem permanently.

Nothing else needs doing in Supabase. No SQL to run, no extensions to enable,
no row level security to configure, and you will never need the anon key or the
service role key: this application connects to Postgres directly as a normal
client rather than through PostgREST.

The schema builds itself on the first request. `migrate()` runs once per process
and every statement in it is idempotent, which matters more than it sounds under
serverless: a cold start storm means a dozen instances run it at the same
moment against the same database.

That path is tested rather than assumed. `scripts/firstrun.test.ts` runs the
migration against a genuinely empty database and checks all seventeen tables,
the four partial indexes carrying real invariants, that no extension is
required, and that a second run changes nothing. Every other check in this
repository runs against a database that has been migrated before, which hides
the one failure that matters here: a statement that only works because an older
version of the schema was already there.

### If an older build reached the database first

It will heal itself. The build that was live before this one creates an older
shape: a `credit_ledger` table, a `daily_budget` table, `esims.is_free_tier`, and
`orders.plan_id` and `orders.kind` as NOT NULL columns. That last pair is the
dangerous one, because the current code inserts an order without them and every
checkout would fail.

The current migration drops all of it. Verified by building the old schema on an
empty database, running the new migration over it, and then running the full
first run check against the result: legacy tables gone, legacy columns gone,
`rate_limits` and `error_events` created, 23 checks passing. Nothing to do by
hand.

**Leave "Enforce SSL on incoming connections" alone until the first deploy
works.** The application already connects over TLS. Turning it on at the same
time as everything else just means a connection failure with two possible
causes instead of one.

---

## 2 · One secret, generated by you

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

That value is `SESSION_SECRET`. It signs the cookie that identifies an anonymous
buyer, which means it cannot be rotated casually once there are customers:
changing it orphans everybody's order history.

There is no second secret for the staff console, and an earlier version of this
file was wrong to ask for one. It named an `ADMIN_SESSION_SECRET` that nothing in
the codebase reads, with a plausible sounding reason about replaying a customer
session against the console. The reason does not hold, because there is no key
involved on that side at all: a staff session is a random token, the browser
holds the only copy, and the database stores nothing but its SHA-256 digest.
There is no signature to forge and therefore no key to keep apart.

If you already set it, it is harmless and you can leave it or delete it. What
matters is not spending an afternoon wondering why it seems to have no effect.

---

## 3 · Deploy

Push the repository. Vercel is already connected to
`github.com/bilbymobile/bilby` and builds `main`.

Set these in **Vercel, Settings, Environment Variables**, for Production:

| Variable | Value |
|---|---|
| `DATABASE_URL` | the pooler string from step 1 |
| `SESSION_SECRET` | the value from step 2 |
| `OWNER_EMAIL` | a mailbox only you control |

`OWNER_EMAIL` creates the first staff account the first time somebody asks for a
sign in link at that address. Treat it as a control, not a label: it decides who
owns the console.

That is the minimum. With exactly those three the site serves, the console signs
you in, and the shop renders an empty catalogue. Nothing can be charged, which
is correct: the buy button says so in plain words rather than throwing.

Everything else in `.env.example` is optional and each one is off by default,
including Stripe. Add them as they become real.

---

## 4 · Hostnames

Five names, one deployment. The apex is the brand and the canonical; the product
lives on `app.`; the staff console lives on a **different registrable domain** so
that a cross site scripting bug in the customer app has no path to a staff
session.

Add all five names as domains in the Vercel project **first**, then copy the
records it gives you into GoDaddy. Do it in that order, because the CNAME value
is no longer a shared hostname: Vercel now issues a per project one that looks
like `d1d4fc829fe7bc7c.vercel-dns-017.com`, and the old generic
`cname.vercel-dns.com` that half the internet still repeats will not work.

The shape you are aiming for, with the CNAME value being whatever Vercel hands
you rather than what is written here:

| Domain | Type | Name | Value |
|---|---|---|---|
| bilbymobile.com | A | `@` | `76.76.21.21` |
| bilbymobile.com | CNAME | `www` | *from Vercel* |
| bilbymobile.com | CNAME | `app` | *from Vercel* |
| bilbymobile.com | CNAME | `api` | *from Vercel* |
| nextwave.au | CNAME | `bilbymobile` | *from Vercel* |

The apex A record is the one value Vercel still publishes as a constant, and it
shows you that too. Trust the dashboard over this file in every case: these
change, and a markdown file does not find out.

### The console host is computed, not written

The staff console host is not a string anybody types. It is derived in
`src/lib/hosts.ts` as the first label of the apex, joined to the corporate
domain:

```
bilbymobile.com  ->  bilbymobile  ->  bilbymobile.nextwave.au
```

So the record above is `bilbymobile`, not `bilby`. This file said `bilby` until
the day somebody tried to sign in, and the failure gives you nothing to work
with: middleware serves a bare 404 for `/console` on every host that is not an
exact match, on purpose, because a console that explains where it lives to a
stranger is worse than one that does not.

If you would rather the console lived at a shorter name, change the derivation
in `hosts.ts`. Do not add a second DNS record and hope, and do not add the
console host to the customer domain: the split across two registrable domains is
what stops a scripting bug in the shop reaching a staff session.

To print what the code believes, rather than what this file claims:

```bash
cd web
npx tsx -e "import {HOSTS} from './src/lib/hosts'; console.log(HOSTS)"
```

### Functions run in Sydney

`web/vercel.json` pins `regions: ["syd1"]`. Vercel defaults every new project to
`iad1`, Washington D.C., on the theory that most external data sources sit on the
US east coast. Ours does not: the database is in `ap-southeast-2` and the
customers are Australian.

Left at the default, every database query would cross the Pacific twice, and this
application makes several sequential ones per page — a shop row looks up an item,
a price and a source before it renders. That is most of a second of network time
on a page where nothing in the code looks slow.

It lives in the repository rather than the dashboard because a region that exists
only in a settings page is a region nobody knows about until it is wrong.

**Do not put comments in that file.** A `"//"` key is the usual JSON comment
convention and Vercel rejects it outright:

```
The `vercel.json` schema validation failed with the following message:
should NOT have additional property `//`
```

The build fails before it starts. Vercel validates against a closed list of
properties, so the file cannot carry its own reasoning; that is what this section
is for. `scripts/vercel-json.test.ts` checks it, and runs first in `check.sh`
because it is the cheapest possible failure to catch and the most annoying one to
discover from a deployment log.

`status.bilbymobile.com` is deliberately **not** in that list. A status page
hosted on the platform it reports on has already failed at the only moment it
exists for. Point it at anything else.

### The first sign in

There is no password and no sign up form. You type an address, you get a single
use link, the link becomes a session that lasts twelve hours. The mailbox is the
credential, which is why `OWNER_EMAIL` must be a mailbox only you control with
two factor authentication on it.

Four things have to be true before it will work, and each fails differently:

1. `OWNER_EMAIL` is set in Vercel for Production, and there has been a
   **deployment since you set it**. Vercel bakes environment variables in at
   build time, so adding one and reloading the page changes nothing.
2. `bilbymobile.nextwave.au` is added as a domain in the Vercel project and its
   CNAME is live. Until then the console is a 404 on every host, including the
   `.vercel.app` preview URL.
3. `DATABASE_URL` works, because the staff account is a row.

Then:

```
https://bilbymobile.nextwave.au
```

The root of that host rewrites to `/console`, no cookie means a redirect to
`/console/login`, and you enter `OWNER_EMAIL`. The account does not exist yet and
is created at that moment, which is the only account that is ever created without
an invitation.

With no `RESEND_API_KEY` the link cannot be sent, so the page prints it on screen
under a red warning. That is deliberate and it is the only way into a console on
the day the mail provider is not signed up for yet. **It is also a door.** Anyone
who reaches that page and types the owner address, which is not a secret, gets a
working link.

The window closes by itself the moment one session exists, whatever the mail
configuration says. So: sign in immediately, then set `RESEND_API_KEY` and
`MAIL_FROM` before that twelve hour session expires. If you let it expire with no
mail provider you are locked out, and the way back in is `DELETE FROM
staff_sessions` from the Supabase SQL editor, which reopens the window. That
escape hatch needs database access on purpose.

### Signing in on your own machine

`localhost` resolves to the product, not the console, so `/console` is a 404
there too. If you need the console locally, point the console name at your own
machine in `C:\Windows\System32\drivers\etc\hosts`, as Administrator:

```
127.0.0.1 bilbymobile.nextwave.au
```

Then `http://bilbymobile.nextwave.au:3000`. The port is stripped before the host
is matched, so it resolves to the console the same way production does.

### Sending email

Two variables, `RESEND_API_KEY` and `MAIL_FROM`, and they carry two things: the
sign in links for the console, and the message that tells a customer their plan
is ready. The second one is the product. An order that is paid for, provisioned
and never announced is indistinguishable from a theft, from where the customer
is sitting.

**Do this before you set the key in Vercel, not after.** The bootstrap window
closes the moment `RESEND_API_KEY` exists, whatever that key turns out to do. Set
a key that cannot send and the console stops showing the link on screen and
cannot email it either. Your current session keeps working until it expires, and
then you are locked out of your own console.

**1. Verify a domain.** Resend will only send from a domain you have proved you
control, so `hello@bilbymobile.com` needs `bilbymobile.com` added under Resend,
Domains. It hands you three records to put in GoDaddy:

| Type | Name | What it is for |
|---|---|---|
| MX | `send` | the return path for bounces |
| TXT | `send` | SPF, which says Resend may send as you |
| TXT | `resend._domainkey` | DKIM, which signs each message |

Copy the values from the Resend dashboard rather than from anywhere else; the
DKIM value in particular is unique to your domain. Then wait for the dashboard to
say **Verified** rather than Pending. Pending is not the same as wrong, and DNS
is not instant.

Consider a subdomain, `send.bilbymobile.com`, rather than the root. It isolates
the sending reputation, so a bad month on marketing mail cannot stop a customer
receiving the eSIM they paid for. The tradeoff is that the from address reads
slightly less cleanly.

**2. Add DMARC.** Resend does not require it to verify the domain, and Gmail and
Yahoo increasingly do want one. A TXT record at `_dmarc` with `v=DMARC1; p=none;`
is the monitoring only version and is enough to start. `p=none` asks nobody to
reject anything, so it cannot break delivery while you find out what your own
domain is actually sending.

**3. Prove it works, from your machine, before Vercel.**

```powershell
cd web
$env:RESEND_API_KEY="re_..."; $env:MAIL_FROM="Bilby <hello@bilbymobile.com>"; npx tsx scripts/check-mail.ts you@example.com
```

It sends one real message and decodes what comes back. It never prints the key.
A 403 is almost always an unverified domain rather than a bad key, which is worth
knowing because the two look identical from the outside.

Then open the mailbox. Resend accepting a send and the receiver binning it as
spam are different outcomes and only one of them is visible from the API.

**4. Set both in Vercel** for Production and redeploy. Environment variables are
baked in at build time, so adding them without a deployment changes nothing.

**5. Sign out and sign back in**, while you still have a working session. That is
the whole point of doing it in this order: the failure you are checking for is
one you can only recover from with database access.

The free plan is 100 emails a day and 3,000 a month, whichever runs out first.
That is comfortable now and is a thing to watch rather than a thing to solve,
since every order sends one.

---

## 5 · Seed the catalogue

Once `DATABASE_URL` points at the real database:

```bash
cd web
DATABASE_URL="<the pooler string>" npx tsx scripts/seed-catalog.ts
```

That is a dry run and writes nothing. It prints all 52 SKUs with cost, retail,
margin and contribution per sale. Read it. Then:

```bash
DATABASE_URL="<the pooler string>" npx tsx scripts/seed-catalog.ts --apply
```

Everything lands **inactive**. Nothing is for sale until a person puts it on
sale, one plan at a time, at `/console/catalog`. That is not caution for its own
sake: no supplier account is funded, nothing has been installed on a handset,
and the routing decision is still open.

Flags worth knowing:

- `--margin 0.40` targets a different contribution margin
- `--fx 1.42` prices against a different USD to AUD rate
- `--routing local` seeds the local breakout variants instead

Re running it updates future prices and never touches past orders, because an
order carries the price it was sold at.

---

## 6 · Stripe, once you are approved

Two values, both from the Stripe dashboard:

- `STRIPE_SECRET_KEY` — Developers, API keys
- `STRIPE_WEBHOOK_SECRET` — Developers, Webhooks, after adding the endpoint

Add the endpoint first:

```
https://app.bilbymobile.com/api/webhooks/stripe
```

Subscribe it to exactly these events:

```
checkout.session.completed
checkout.session.async_payment_succeeded
checkout.session.async_payment_failed
checkout.session.expired
charge.dispute.created
```

**The webhook secret is not optional.** With a secret key set and no webhook
secret, every event is refused rather than trusted. That is deliberate: an
endpoint that skips signature verification is an endpoint where anybody who
finds the URL can mint paid orders, and the way that ships to production is a
development shortcut nobody remembered to remove.

Test with a real card in test mode before switching to live keys. The one thing
to watch: the order should become `paid` in `/console/orders` within a second or
two of the payment. If it stays `draft`, the webhook is not arriving, and
Stripe's own event log will say why.

---

## 7 · The supplier

The eSIM Access account exists with a zero balance. Before funding it, get one
thing in writing:

> Can an unactivated profile be cancelled, and within what window?

Whether an issued but uninstalled eSIM can be handed back is the single largest
input to net margin on refunds, and nothing in their dashboard answers it. Until
there is a number, `esimFulfiller.capabilities.cancelWindowMinutes` stays `null`
and the console tells an operator plainly that a refund means moving money in
Stripe and writing off the profile.

You also need the **partner integration API** documentation and a sandbox key.
What was captured from the dashboard is its own internal API: real prices and
real plan identifiers, which is what the catalogue needed, but ordering is a
different surface. The adapter is one file once those exist.

---

## 8 · Before the first real dollar

- `RESEND_API_KEY` and `MAIL_FROM`, or nobody gets their eSIM link. Set these
  **on the first day**, not before the first sale. Section 4 has the order to do
  it in, and the order matters: getting it wrong locks you out of the console.
- `SENTRY_DSN` if you want failures somewhere other than `/console/health`
- An inbox a person actually watches, in Australian hours. This is the product,
  not an operational detail.
- ABN and GST registration. You cannot issue a compliant tax invoice without an
  ABN, and the pricing model already treats GST as one eleventh of every sale.

---

## Checks

```bash
cd web
DATABASE_URL="<a database you can write to>" ./scripts/check.sh
```

Types, the first run migration, the rate limiter and error store, the console
bootstrap window, the money path, the webhook, and the build. 124 checks. Run it
before every deploy.

The first run check is skipped unless you also set `VIRGIN_DATABASE_URL` to a
database that is genuinely empty, because that is the only way to test it:

```bash
VIRGIN_DATABASE_URL="postgresql://.../empty" \
DATABASE_URL="<a database you can write to>" ./scripts/check.sh
```

**Do not point it at production.** It writes and deletes rows.

---

## Done means

A real card charges a real dollar, a real profile installs on a real handset in
another country, and a refund can be issued from the console without anybody
opening the database.

Until all three are true on the same day it is not production, whatever the
deployment log says.
