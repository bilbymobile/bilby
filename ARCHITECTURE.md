# Bilby architecture

Four surfaces, one API, two registrable domains. Written down because the
decisions below are the expensive ones to reverse and every one of them is
cheap to make now.

---

## 1. The host map

| Host | Serves | Auth | Why it exists as its own name |
|---|---|---|---|
| `bilbymobile.com` | Landing page, legal pages, `app-ads.txt` | none | Canonical for search. `app-ads.txt` must resolve here without a redirect or AdMob sits in limited serving and never says why. |
| `app.bilbymobile.com` | The web app, and its own `/api/*` | First party session cookie | Same origin as the API it calls, so no CORS, no `SameSite=None`, no partitioned cookie work when browsers tighten again. |
| `api.bilbymobile.com` | The API the mobile binaries call | Bearer token, no cookies | Compiled into every installed Android and iOS build. Users update slowly, so this name must answer for years. Token only means the mobile surface has no CSRF surface at all. |
| `status.bilbymobile.com` | Incident and network status | none | Hosted apart from everything else. A status page that goes down with the thing it reports on is worse than none. |
| `bilbymobile.nextwave.au` | Staff console | Staff session, second factor | Different registrable domain, on purpose. See below. |

**Two domains, two jobs.** `bilbymobile.com` is the brand and the settled apex:
the name on the Play listing, the name a person says out loud, and the name every
customer host hangs off. `nextwave.au` is the business behind it, carries nothing
a customer touches, and is therefore the right home for the staff console and the
right address in the footer for anyone who needs the company rather than the
support queue. The legal line reads *Bilby is the telecommunications division of
Nextwave.au, Australia*, with `ns@nextwave.au` and `nextwave.au` printed beneath it.

Each host is still derived from one constant in `web/src/lib/hosts.ts` and one
build flag in Flutter. That override is not there for an anticipated rename; it
is there because the Android binary freezes its API origin at compile time, and
a hostname that can only be changed by editing source is a hostname that cannot
be changed at all.

### Why the admin console sits on a different domain

Cookies cannot cross a registrable domain boundary. Putting the staff console on
`nextwave.au` rather than on `admin.bilbymobile.com` means:

* A cross site scripting bug anywhere in the customer web app has **no path** to
  a staff session.
* A stolen customer session is worthless against operations, costing or refunds.
* A leaked staff session cannot be replayed against the customer product.

The cost is that staff authentication is its own system rather than a role flag
on the customer session. That cost is worth paying and it is not close. The
alternative, a single session with an `is_admin` column, is how most small
products get their first serious incident.

Two rules, both enforced in middleware, both failing closed:

1. Nothing customer facing is ever served from the admin host.
2. Nothing on the admin host is reachable without a staff session.

---

## 2. One codebase, routed by host

All five names are domains on a single Next.js deployment. `roleForHost()` in
`hosts.ts` resolves the incoming host to a role and the middleware branches on
it. Preview deployments and `localhost` resolve to `app`, never to `admin` and
never to `marketing`, because a preview that resolves to `marketing` quietly
emits canonical tags pointing at production, and a preview that resolves to
`admin` is a public admin console.

```
                    ┌─────────────────────────────┐
  bilbymobile.com ───────▶│                             │
  app.bilbymobile.com ───▶│      one Next.js app        │──▶ Supabase  (customer, orders,
  api.bilbymobile.com ───▶│   middleware routes by host │           ledger, audit)
  bilbymobile.nextwave.au▶│                             │──▶ supplier adapter ──▶ wholesaler
                    └─────────────────────────────┘
  status.bilbymobile.com ──▶ separate host, deliberately
```

The Flutter app talks only to `api.bilbymobile.com`. The web app talks only to its own
origin. The staff console talks only to its own origin. No surface talks to two.

---

## 3. The API

One versioned surface, three audiences, three authentication schemes. Version in
the path from day one, because the mobile binaries cannot be asked to migrate.

### Customer, `/v1/*`

| Method | Path | Notes |
|---|---|---|
| POST | `/v1/session` | Creates an anonymous identity. Cookie on the web, bearer token on mobile. |
| GET | `/v1/me` | Identity, balance, eSIM list. The one call the app makes on launch. |
| GET | `/v1/catalog?country=ID` | Plans available for a destination, priced, with the wholesale cost never exposed. |
| POST | `/v1/orders` | Buy a plan. Returns a checkout handoff, not a charge. |
| GET | `/v1/orders/:id` | Order state, including provisioning failures in plain words. |
| GET | `/v1/esims/:iccid` | Install material: activation code, SM-DP+ address, QR payload. |
| GET | `/v1/esims/:iccid/usage` | Remaining data and expiry. Cached, because suppliers rate limit this hard. |
| POST | `/v1/esims/:iccid/topup` | Adds a package to an existing profile rather than issuing a new one. |
| GET | `/v1/notes?airport=DPS` | Field notes for a destination. |
| POST | `/v1/notes` | Submit a field note after a trip. |
| POST | `/v1/support/tickets` | Written support. There is no telephone channel by decision. |

### Staff, `/api/admin/*`, admin host only

| Area | Endpoints |
|---|---|
| Dashboard | `GET /metrics/overview`, `GET /metrics/series` |
| Operations | `GET /orders`, `GET /orders/:id`, `POST /orders/:id/retry`, `GET /provisioning/failures` |
| Costing | `GET /costing/margins`, `PATCH /costing/plans/:id`, `GET /suppliers/balance` |
| Discounts | `GET /promos`, `POST /promos`, `PATCH /promos/:code`, `POST /promos/:code/disable` |
| Management | `GET /customers/:id`, `POST /customers/:id/credit`, `POST /refunds`, `GET /audit` |

### Checkout, and the one non obvious problem

The mobile app hands checkout to a real browser, which is a different origin
carrying no session. A checkout link with no identity lands the payment on a
fresh anonymous user. The fix is a **signed single use handoff token** on the
URL with a short expiry, exchanged once at the checkout origin for a session.
Not a shared cookie domain, which would undo the isolation the host split buys.

---

## 4. Authentication

| Audience | Mechanism | Notes |
|---|---|---|
| Web customer | `HttpOnly`, `Secure`, `SameSite=Lax` first party cookie on `app.bilbymobile.com` | Rotates on privilege change. Never readable by script. |
| Mobile customer | Opaque bearer token in Keystore or Keychain, short lived, with a refresh token | `api.bilbymobile.com` sets no cookies, so there is nothing for a browser to send automatically and no CSRF surface. |
| Staff | Separate origin, email plus passkey or TOTP, twelve hour session | Second factor re-prompted for anything that moves money: refunds, manual credit, promo creation, supplier credential changes. |

Account recovery for customers is a magic link, since there is no password. That
is also why there is no phone number in the product: no channel exists that a
social engineer can call.

---

## 5. Staff roles

Five roles. Least privilege, and the split follows who actually does the job
rather than seniority.

| | Owner | Operations | Finance | Support | Read only |
|---|:--:|:--:|:--:|:--:|:--:|
| Dashboard | ● | ● | ● | ● | ● |
| Orders, read | ● | ● | ● | ● | ● |
| Retry provisioning | ● | ● | | | |
| Customer lookup | ● | ● | ● | ● | |
| Manual credit | ● | ● | | capped | |
| Refunds | ● | | ● | capped | |
| Costing, read | ● | ● | ● | | |
| Costing, edit | ● | | ● | | |
| Discount codes | ● | | ● | | |
| Supplier credentials | ● | | | | |
| Audit log | ● | | ● | | |

**Every mutation writes an audit row**: actor, role, action, target, before,
after, IP, timestamp. The audit log is append only and no role can delete from
it, including owner. That is the point of an audit log and it is worth being
inflexible about, because the first thing anyone does after a mistake is try to
tidy it away.

---

## 6. Many suppliers, and room for what comes after eSIMs

Signing a wholesaler is a configuration change, and so is signing the next four.
The design separates **what you sell** from **who delivers it**. A catalogue item
is a thing with a price and a description. A fulfiller is whoever provisions it.
An eSIM plan happens to be a catalogue item fulfilled by a wholesale eSIM
provider, and nothing in that sentence is specific to eSIMs, which is what makes
a second product category cheap rather than a rewrite.

```ts
interface Fulfiller {
  readonly id: string;              // "esimaccess", "airalo", "resellportal"
  readonly kind: "esim" | string;   // the category, so a future product is not a special case
  health(): Promise<Health>;        // polled, and surfaced in the console
  balance(): Promise<Money | null>; // prepaid wallet, where the provider has one
  quote(item: CatalogItem): Promise<Quote>;
  fulfil(order: Order): Promise<Fulfilment>;
}
```

Four tables carry the registry:

| Table | Holds |
|---|---|
| `providers` | id, kind, enabled, priority, health, credential reference |
| `provider_offerings` | provider, country, remote plan ref, size, days, wholesale cost, fetched at |
| `routing_rules` | country, preferred provider, fallback provider, note |
| `orders` | the provider used, and the wholesale cost **as paid on the day** |

Three rules make this work rather than merely look tidy.

**Routing lives in the database, not in code.** One row per country naming a
preferred and a fallback provider. Changing who serves Indonesia is a click in
the console rather than a deploy, which matters the first time a provider has an
outage on a Friday night.

**Cost is captured on the order, never looked up.** The rate paid on the day is a
fact about that order. Recomputing margin from today's rate card makes last
month's numbers move, and a dashboard whose history changes is one nobody trusts
twice.

**A provider failing health checks stops receiving orders automatically**, and
the console says so, rather than silently failing customer purchases until
somebody notices. No supplier response ever reaches a customer verbatim either;
their error strings are written for a reseller integrator, not for a person
standing at an airport.

## 7. iOS, later

The mobile app is Flutter, so iOS is the same Dart against the same
`api.bilbymobile.com`, and the design tokens in `brand.dart` already carry across. The
work that is genuinely iOS only:

* eSIM install. iOS uses a universal link to the carrier entitlement flow rather
  than a QR scan, which is a better experience and a different code path.
* **The App Store payment question, and it needs answering before any iOS work
  starts.** Apple requires in app purchase for digital goods and services
  consumed within the app. Whether a mobile data plan counts is not obvious, and
  the pattern the incumbents use is checkout in an external browser. Getting this
  wrong is a rejection, not a warning, and if in app purchase is required then
  Apple's commission has to be inside the pricing model rather than discovered
  after launch.

---

## 8. Open items, in the order they can stop you

1. **CSP registration.** Under the 2025 telecommunications amendments, wholesale
   providers are prohibited from supplying an unregistered carriage service
   provider. This gates supply, not just launch, so it sits ahead of everything
   commercial on this list.
2. **Payment provider underwriting.** Travel and telecommunications are both
   elevated risk categories for acquirers. A new business in either can wait
   weeks for a decision or be declined. Start it in parallel with the supplier
   contract, because it blocks revenue completely and no amount of code changes
   the answer.
3. **Apple's payment rules**, before any iOS effort is spent.
4. **Written only support and the TCP Code.** No telephone channel is a
   defensible product decision. Confirm it survives registration.
5. **The unsubstantiated numbers on the landing page.** 190+ countries and 200+
   carriers are representations about future matters until a supplier is signed,
   and the burden of showing reasonable grounds sits with you.
