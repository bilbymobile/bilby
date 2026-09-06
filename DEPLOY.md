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

## 2 · Two secrets, generated by you

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

Run it twice. The first value is `SESSION_SECRET`, the second is
`ADMIN_SESSION_SECRET`. **They must be different.** A shared key would let a
customer session be replayed against the staff console, which is the exact thing
the separate admin domain exists to prevent.

`SESSION_SECRET` in particular cannot be rotated casually once there are
customers: it signs the cookie that identifies an anonymous buyer, so changing
it orphans everybody's order history.

---

## 3 · Deploy

Push the repository. Vercel is already connected to
`github.com/bilbymobile/bilby` and builds `main`.

Set these in **Vercel, Settings, Environment Variables**, for Production:

| Variable | Value |
|---|---|
| `DATABASE_URL` | the pooler string from step 1 |
| `SESSION_SECRET` | first value from step 2 |
| `ADMIN_SESSION_SECRET` | second value from step 2 |
| `OWNER_EMAIL` | a mailbox only you control |

`OWNER_EMAIL` creates the first staff account the first time somebody asks for a
sign in link at that address. Treat it as a control, not a label: it decides who
owns the console.

That is the minimum. With exactly those four the site serves, the console signs
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
| nextwave.au | CNAME | `bilby` | *from Vercel* |

The apex A record is the one value Vercel still publishes as a constant, and it
shows you that too. Trust the dashboard over this file in every case: these
change, and a markdown file does not find out.

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

- `RESEND_API_KEY` and `MAIL_FROM`, or nobody gets their eSIM link. Set this
  **on the first day**, not before the first sale. Until it is set, the console
  cannot email a sign in link, so it shows the link on screen instead. That is
  the only way into a console on the day it goes up, and it closes by itself the
  moment somebody signs in once. Sign in, then set the key. If you are locked
  out later with still no mail provider, deleting every row from
  `staff_sessions` reopens the window, and needing database access to do that is
  the point.
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
