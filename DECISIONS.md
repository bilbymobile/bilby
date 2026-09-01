# Decisions

Everything settled, with the reason attached. If code contradicts this file, one
of the two is wrong and it is worth finding out which before changing either.

## Identity

| | |
|---|---|
| Brand | Bilby |
| Website | **bilbymobile.com** |
| Legal line | Bilby is the telecommunications division of Nextwave.au, Australia. |
| Corporate contact | ns@nextwave.au and nextwave.au |
| Product support | hello@bilbymobile.com |
| Telephone | none, by decision |
| Android package | `com.bilbymobile.bilby`, immutable once published |

`bilby.com` was investigated and dropped: registered December 2003 to a third
party, on Route 53 nameservers. An acquisition, not a registration.

**The ABN is not printed on any page.** It is still required on tax invoices,
in the Play Console, and for `.au` domain eligibility. Do not remove it from the
invoice template believing it is decorative.

## Hosts

Five names, two registrable domains, one deployment. All derived from `APEX` in
`web/src/lib/hosts.ts` and `--dart-define=APEX` in Flutter.

| Host | Serves | Auth |
|---|---|---|
| `bilbymobile.com` | Landing, legal, `app-ads.txt` | none |
| `app.bilbymobile.com` | Web app, same origin `/api/*` | first party cookie |
| `api.bilbymobile.com` | The API frozen into mobile binaries | bearer token, no cookies |
| `status.bilbymobile.com` | Status page | none |
| `bilbymobile.nextwave.au` | Staff console | staff session, second factor |

**The staff console is on a different registrable domain deliberately.** Cookies
scope to a registrable domain, so a cross site scripting bug in the customer web
app has no path to a staff session. Never move it to `admin.bilbymobile.com`;
that would undo the entire benefit for the sake of a shorter name.

`status` must not be hosted on the same platform as the rest. A status page that
goes down with the thing it reports on has failed at the one moment it exists
for.

## Commercial

**The free tier is dropped.** A 50 MB redemption can bear about $0.11 of ad
revenue. The best published wholesale price found was $0.25 for the same volume,
and Airalo's floor forces $8.00. It does not close at any rate, which is why
three other operators independently sell throttled *time* rather than metered
data. Launch is paid first.

**Stripe, not a merchant of record.** Cheaper and better API than Paddle, at the
cost that GST and every foreign tax question belongs to Nextwave rather than to
the processor.

**Suppliers are a registry, not a choice.** All adapters are built; which one
serves which country is a row in the database, changed from the staff console
rather than by deploying. Two rules keep it honest:

- **Wholesale cost is written onto the order, never looked up.** The rate paid on
  the day is a fact about that order. Recomputing margin from today's rate card
  makes last month's numbers move, and a dashboard whose history changes is one
  nobody trusts twice.
- **No supplier response reaches a customer verbatim.** Their error strings are
  written for a reseller integrator, not for a person standing at an airport.

**Catalogue is separate from fulfilment.** A catalogue item is a thing with a
price; a fulfiller is whoever provisions it. Nothing in that sentence is specific
to eSIMs, which is what makes a second product category cheap later.

**All three monetisation routes are built behind switches, default off.** Google
Ads conversion tracking is worth wiring at zero budget, because retrofitting it
loses the history needed to judge the first campaign. AdMob is worth wiring for
lead time. AdSense is recommended off: on a page where someone is about to spend
twenty dollars, a display unit earns fractions of a cent and can hand the buyer
to a competitor.

## Database

**Supabase, Postgres.** It replaced libSQL, which is SQLite with a remote
protocol and was a good fit for a single operator product.

What Postgres buys that mattered enough to move: real constraints and partial
indexes for the discount rules, `SELECT ... FOR UPDATE` and conditional updates
so two simultaneous redemptions of a single use code cannot both win, a managed
backup story, and a console someone who is not an engineer can look at when an
order goes wrong at midnight.

What it cost, and it is a real cost: **there is no zero configuration path any
more.** A fresh clone used to run against a local file with no account
anywhere. Now `DATABASE_URL` has to be set before anything works.

Two operational rules:

- **Use the transaction pooler on port 6543**, never the direct connection on
  5432. A serverless deployment opens far more connections than direct Postgres
  accepts, and the failure looks like the database being down.
- **Never give a query a prepared statement name.** A transaction mode pooler
  hands your connection to someone else between statements, so named prepared
  statements do not survive. node-postgres uses unnamed portals unless you pass
  a `name`, so the default is correct and the mistake is adding one.

## Design

Single light theme, by decision, not by omission. The hero is a golden hour
render and a dark inversion fights the photograph. The reader is usually mid
worry rather than nocturnal.

| Token | Value | Rule |
|---|---|---|
| Ground | `#F7EFE4` | |
| Ink | `#0B2038` | Also the primary action colour. The darkest thing on screen is the thing you press. |
| Sand | `#EEBF8B` | Secondary action, and the only action colour legible on a navy surface. |
| Teal | `#35857A` | **Confirmation only.** Never decoration. |
| Sky | `#5EA9CE` | **Signal only.** The connection animation and nothing else. |

Teal means yes and sky means signal. The moment either becomes a decorative
accent the palette collapses into generic warm minimalism, because ink and sand
cannot carry meaning alone.

Type: Outfit for display, Plus Jakarta Sans for body, IBM Plex Mono for labels
and anything tabular.

## Positioning, from evidence

Complaint number one in this category is activation failure at the airport, not
price. Airalo scores 1.3 out of 5 on ProductReview.com.au. TravelKon holds 5.0
across 1,055 reviews and the reviews credit support that answers. Category review
methodologies weight support, activation and transparency at 40 to 50 percent and
price at 10 to 20 percent.

So every step moves earlier: install at home, land connected, and a person
answers in Australian hours.

## Known dead weight

`web/android/` and `web/capacitor-shell/` are left from an abandoned Capacitor
approach. The mobile app is Flutter, in `app/`. They are still in the first
commit rather than being deleted silently; remove them in a named commit.
