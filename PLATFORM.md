# Platform

How Bilby is built so that eSIM is the first product rather than the only one.

Read `DECISIONS.md` first. That file records what is settled and why. This file
records the shape of the system those decisions imply, and the specific
refactor that has to happen before the first paying customer rather than after.

## 1. What this business actually is

Bilby is not an eSIM shop. It is a vending machine for digital entitlements
sold to Australian travellers:

> Take money in AUD, buy an entitlement from a supplier in USD, deliver a
> credential to a traveller, support them when it fails, and account for the
> difference.

Every sentence of that is true of an eSIM, a data top up, a VPN config, or a
gift card. None of it mentions an ICCID. That is the whole architecture: the
part that never mentions an ICCID is the platform, and everything that does is
a category.

eSIM is category one. There is no category two, and there must not be one until
category one has real customers. What this document buys is not a second
product. It is the right to add one later without a data migration on a live
ledger.

## 2. The layers

| Layer | Knows about | Must never know about |
|---|---|---|
| Identity | users, staff, sessions, roles | anything for sale |
| Catalogue | SKUs, prices, availability, attributes | how a thing is delivered |
| Commerce | cart, discount, tax, payment, order, refund | what an eSIM is |
| Fulfilment | suppliers, adapters, provisioning, retries | prices, tax, sessions |
| Entitlement | what a customer now owns and its state | how it was paid for |
| Category | ICCIDs, SM DP+ addresses, data allowances | any of the above |

The rule that keeps this honest, and it is worth taping to the wall:

> **Commerce must never learn what an eSIM is.**

The moment `orders` grows a column called `iccid`, the abstraction is gone, and
it is gone quietly, because everything still works. It has that column today.

## 3. Where the code is coupled right now

Not a criticism of past work. It was correct to build the shortest path to a
working eSIM. This is the inventory of what that path assumed.

| Place | Assumption baked in |
|---|---|
| `orders.plan_id`, `orders.iccid` | one order is one eSIM |
| `credit_ledger.delta_mb` | the unit of value is a megabyte |
| `esims.is_free_tier` | the free tier exists |
| `lib/suppliers/types.ts` | a supplier lists plans with `dataMb` and `validityDays` |
| `lib/suppliers/index.ts` | there are exactly two lanes, paid and free |
| `api/catalog/route.ts` | the catalogue is the supplier's plan list, priced live per request |
| `lib/pricing.ts` | the entire module is the ad to data exchange engine |
| `app/checkout/page.tsx` | a stub, with the Stripe flow written in a comment |

Two of those are worse than they look.

**The catalogue is not stored.** It is fetched from the supplier on every
request and priced on the fly from wholesale times a margin constant. That
means the price a customer sees can change between the plans page and the
checkout page, there is no stable SKU to put on an order, prices are in USD,
there is no GST anywhere, and you cannot sell anything the supplier does not
list. It blocks the second product, but it blocks the first one harder.

**`lib/pricing.ts` is dead and is also a liability.** It is the free tier
engine, and it is full of regional wholesale benchmarks that were seeded from
published estimates rather than from a signed rate card. The free tier is
dropped. Those numbers must not quietly become the basis of retail pricing.
Quarantine the file, do not repurpose it.

## 4. The five seams

These are the decisions that cost a day now and cost a data migration on live
customer records later. Nothing else in this document is urgent. These are.

### Seam 1: an order is money, an order item is a thing

```sql
-- Money. Product agnostic. Never grows a category column.
CREATE TABLE orders (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL REFERENCES users(id),
  status          TEXT NOT NULL,          -- pending paid fulfilled failed refunded
  sell_currency   TEXT NOT NULL DEFAULT 'AUD',
  sell_amount     NUMERIC(12,2) NOT NULL, -- what the customer paid, tax inclusive
  tax_code        TEXT NOT NULL,          -- 'GST' or 'GST_FREE', decided per order
  tax_amount      NUMERIC(12,2) NOT NULL, -- the component, recorded not derived
  discount_code   TEXT,
  discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  stripe_ref      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  paid_at         TIMESTAMPTZ
);

-- What was bought. One row per thing. Category lives here, never above.
CREATE TABLE order_items (
  id              TEXT PRIMARY KEY,
  order_id        TEXT NOT NULL REFERENCES orders(id),
  sku             TEXT NOT NULL REFERENCES catalog_items(sku),
  category        TEXT NOT NULL,          -- 'esim' today
  fulfiller_id    TEXT NOT NULL,          -- which adapter served it
  supplier_ref    TEXT,                   -- their order id, for support
  cost_currency   TEXT NOT NULL DEFAULT 'USD',
  cost_amount     NUMERIC(12,6) NOT NULL DEFAULT 0,
  fx_rate         NUMERIC(12,6),          -- AUD per unit of cost_currency, at order time
  status          TEXT NOT NULL,          -- pending fulfilled failed cancelled
  attempts        INTEGER NOT NULL DEFAULT 0,
  last_error      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  fulfilled_at    TIMESTAMPTZ
);
```

Today every order has exactly one item, so this costs nothing. It is the row
shape that makes a bundle possible, and it is the row shape that makes a
partially failed order describable. Right now, if provisioning fails after
Stripe has captured, there is nowhere to write that fact.

### Seam 2: money is four currencies, a rate, and a tax code

`cost_usd` and `revenue_usd` are not enough, for four reasons that all arrive at
once:

- You sell in AUD and buy in USD. The margin on an order is not knowable unless
  the FX rate used that day is on the order.
- GST is roughly one eleventh of an Australian retail sale. That is larger than
  the payment fee and the FX spread combined. Adding the column after you have
  sales means restating figures you have already reported.
- Whether a sale is GST free is a real question with a real answer, and the
  answer is your accountant's, not the code's. So the code stores `tax_code`
  per order rather than assuming one.
- The customer may see and pay a different currency from the one you record.
  See section 7. Without the presented amount on the order, a customer who
  writes in saying they paid EUR 18.40 cannot be reconciled against an order
  that says AUD 29.00, and support has no way to answer them.

```sql
ALTER TABLE orders ADD COLUMN presentment_currency TEXT;  -- what they saw
ALTER TABLE orders ADD COLUMN presentment_amount   NUMERIC(12,2);
ALTER TABLE orders ADD COLUMN tax_country          TEXT;  -- which regime applied
ALTER TABLE orders ADD COLUMN tax_evidence         JSONB NOT NULL DEFAULT '{}';
```

`tax_evidence` is not paperwork for its own sake. Establishing a consumer's
location for VAT on digital services takes **two pieces of non contradictory
evidence**, from a list that includes billing address, IP or geolocation, bank
details and the mobile country code of the SIM. Collect them at the moment of
sale or you cannot collect them at all.

The rule from `DECISIONS.md` extends unchanged: **record, never recompute.**
Cost, FX rate, tax, discount and what the customer actually saw are facts about
that order, frozen at the moment it was placed.

### Seam 3: a stored catalogue with stable SKUs

```sql
CREATE TABLE catalog_items (
  sku             TEXT PRIMARY KEY,       -- ours, stable forever, e.g. 'esim-jp-3gb-15d'
  category        TEXT NOT NULL,
  title           TEXT NOT NULL,
  subtitle        TEXT,
  tax_code        TEXT NOT NULL DEFAULT 'GST',
  active          BOOLEAN NOT NULL DEFAULT false,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  -- Category specific shape lives here, not in columns. For an eSIM:
  -- {"countries":["JP"],"dataMb":3072,"validityDays":15,"topUp":true}
  attributes      JSONB NOT NULL DEFAULT '{}',
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One row per SKU per PRICING currency. Today exactly one row per SKU, in AUD.
-- A second row is a price a person decided on for a market, never an FX
-- conversion of the first. This is also the shape Stripe's currency_options
-- wants, so the mapping stays one to one.
CREATE TABLE catalog_prices (
  sku             TEXT NOT NULL REFERENCES catalog_items(sku),
  currency        TEXT NOT NULL,
  sell_amount     NUMERIC(12,2) NOT NULL, -- tax inclusive, set by a human
  is_default      BOOLEAN NOT NULL DEFAULT false,
  PRIMARY KEY (sku, currency)
);

-- Which fulfiller serves this SKU, in what order of preference.
CREATE TABLE catalog_sources (
  sku             TEXT NOT NULL REFERENCES catalog_items(sku),
  fulfiller_id    TEXT NOT NULL,          -- 'esimaccess', 'airalo'
  external_id     TEXT NOT NULL,          -- their plan id
  cost_amount     NUMERIC(12,6) NOT NULL, -- last known wholesale, for margin display
  cost_currency   TEXT NOT NULL DEFAULT 'USD',
  priority        INTEGER NOT NULL DEFAULT 100,
  enabled         BOOLEAN NOT NULL DEFAULT true,
  checked_at      TIMESTAMPTZ,
  PRIMARY KEY (sku, fulfiller_id)
);
```

This is the piece that turns "suppliers are a registry, not a choice" from a
sentence in `DECISIONS.md` into something that exists. A SKU is yours. A source
is theirs. Switching supplier for Japan is an update to one row of
`catalog_sources`, and last month's orders still point at what actually served
them.

It also means the price on the plans page and the price at checkout are the
same number, read from one place, set deliberately by a person, rather than
computed twice from a margin constant.

### Seam 4: entitlements

```sql
CREATE TABLE entitlements (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id),
  order_item_id TEXT NOT NULL REFERENCES order_items(id),
  category      TEXT NOT NULL,
  status        TEXT NOT NULL,   -- issued active depleted expired revoked
  external_ref  TEXT,            -- the ICCID for an eSIM; whatever it is for the next one
  label         TEXT NOT NULL,   -- what the customer sees in a list
  expires_at    TIMESTAMPTZ,
  payload       JSONB NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

The `esims` table stays. It is the right home for ICCID, activation code,
SM DP+ address and install state. The entitlement points at it by
`external_ref`. What this buys is a customer dashboard that lists *things you
have* rather than *your eSIMs*, and it buys it before there is anything else in
the list, which is the only time the change is free.

### Seam 5: idempotency

There is none today, and this is the seam that will cost real money if it is
skipped.

Stripe retries webhooks. Suppliers time out after doing the work. Users double
click. Every one of those paths currently ends at "provision an eSIM", and two
of them can run twice.

```sql
CREATE TABLE idempotency_keys (
  key         TEXT PRIMARY KEY,    -- e.g. 'fulfil:' || order_item_id
  scope       TEXT NOT NULL,
  result      JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

Every fulfilment is keyed on the order item id, claimed with a conditional
insert, and the supplier adapter is handed that key to pass through as its own
idempotency reference where the API supports one. This is the eighth question
on the eSIM Access list for exactly this reason.

The failure this prevents is provisioning two eSIMs against one payment. You
eat the wholesale cost of the second, and you cannot get it back, because it is
activated.

## 5. The fulfiller contract

The existing `Supplier` interface in `lib/suppliers/types.ts` is good work and
is the right shape for eSIM. It becomes a category adapter underneath a
narrower, product agnostic contract:

```ts
export interface Fulfiller {
  readonly id: string;
  readonly category: string;          // 'esim' today
  readonly displayName: string;

  /** Confirm a SKU can be served right now and at what cost. */
  quote(externalId: string): Promise<Quote>;

  /** Do the thing. MUST be idempotent on key. */
  fulfil(input: {
    externalId: string;
    key: string;                      // order_item_id
    userRef: string;
  }): Promise<Fulfilment>;

  /** Current state of a delivered entitlement. */
  status(externalRef: string): Promise<EntitlementState>;

  /** Give it back if the supplier allows it. Null when they do not. */
  cancel?(externalRef: string): Promise<{ refundedAmount: number } | null>;

  readonly capabilities: {
    topUp: boolean;
    usage: boolean;
    cancelWindowMinutes: number | null;
  };
}
```

Three things are deliberate.

`cancel` is optional and returns null rather than throwing, because whether an
unactivated profile can be handed back is the single biggest input to net
margin, it differs per supplier, and the console has to be able to show an
operator whether it is even worth trying.

`capabilities` is declared rather than discovered, because the current code
already learned this lesson once: the free lane hard fails on a supplier that
cannot do micro top ups rather than silently provisioning a whole bundle. Same
principle, made general.

`quote` exists so that a stored catalogue can be reconciled against the live
rate card on a schedule, and the console can show an operator "your Japan SKU
now costs 12 percent more than when you priced it".

## 6. Bundles, or kits

A kit is a catalogue item whose fulfilment fans out to more than one fulfiller.
"Japan 5 GB plus VPN for the trip" is one SKU, one price, one tax line, two
order items, two entitlements.

```sql
CREATE TABLE catalog_bundle_items (
  bundle_sku  TEXT NOT NULL REFERENCES catalog_items(sku),
  child_sku   TEXT NOT NULL REFERENCES catalog_items(sku),
  quantity    INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (bundle_sku, child_sku)
);
```

Nothing else changes, because seam 1 already made an order a list of items.
That is the entire payoff of doing seam 1 now: bundles stop being a project and
become a join table.

Bundling is also the only defensible commercial position available, since
competing on the price of a commodity data plan against companies with more
capital is a losing game. So the architecture should make bundles trivial even
though there is nothing to bundle yet.

**Do not build the bundle table yet.** Build seam 1 so that this table is
possible. That distinction is the whole discipline of this document.

## 7. Currency, presentment and markets

Bilby must not be architecturally stuck as an Australian only business. It is
not, and the reason is that "currency" is four separate decisions that get
collapsed into one word. Keeping them separate is what makes the market
question cheap.

| | What it is | Who decides | Cost to change |
|---|---|---|---|
| **Settlement** | What lands in the bank | Your bank and your entity | High. A banking and entity decision, not a code one. |
| **Pricing** | The currency a price is *set* in | A person, per market | Medium. It is a price list somebody maintains. |
| **Presentment** | What the customer sees and is charged | Detected at checkout | **Near zero.** A setting. |
| **Market** | Whose customers you serve | Tax registration and law | The real one. See below. |

### Presentment is nearly free, so it is not an architecture problem

Stripe Adaptive Pricing presents and charges in the customer's local currency
across more than 150 countries, Australia included as a merchant country. It
picks the currency, converts at a rate guaranteed through settlement, and
unlocks the local payment methods that only work in local currency, such as
iDEAL in the Netherlands.

The commercial shape of it, from Stripe's own documentation: **you pay nothing.
The customer pays a 2 to 4 percent conversion fee built into the rate shown to
them.** They avoid it by choosing to pay in your currency instead. Refunds go
back at the original rate, so a refund costs you nothing extra either.

Two mechanical points that matter for our schema:

- The Checkout Session and PaymentIntent still report **your** currency and
  amount. What the customer actually saw arrives in a `presentment_details`
  hash carrying `presentment_amount` and `presentment_currency`. That is the
  source for the two columns added in seam 2.
- It requires your price currency to be one of your settlement currencies, and
  it does not apply to Elements with the Payment Intents API. Since we are
  using Checkout, this is fine, but it does mean the checkout implementation
  choice in Phase 1 quietly decides whether this option stays open. Use
  Checkout.

Manual multi currency prices are the other route: set explicit amounts per
currency, override Adaptive Pricing for those currencies, and carry the
exchange rate risk yourself. That is the right tool for a deliberate price
point in a market you have chosen, and the wrong tool for breadth.

### The rule for geo detection

Detect once, at the start of the checkout session, and pin it. **Never let a
detected location change a price the customer has already been shown.** Use
detection for currency and language only. Never use it to gate access, and
never use it alone as tax evidence, because one signal is not two.

### The thing that actually gates a second market

Not the currency and not the code. **Tax registration and consumer law, per
country.** Selling digital services to consumers abroad pulls you into that
country's regime on its own terms: the EU requires two pieces of non
contradictory evidence of where the consumer is, and the United Kingdom, New
Zealand, Singapore, Japan and others each run their own scheme with their own
thresholds and their own registration.

There is a second, less obvious consequence. Australian GST treatment is not
the same for a sale to a non resident as it is for a sale to an Australian.
That is precisely why `tax_code` sits on the order rather than being a constant
in the code, and it is a question for the accountant before the first non
Australian sale, not after.

### So what is actually Australian about Bilby

The support hours, the trust story, and the copy. Those are marketing
decisions and they are the right ones for launch, because the whole positioning
rests on a person answering in Australian hours. None of them are baked into
the schema. Serving a second market later is a tax registration, a support
roster and a rewrite of some page copy. It is not a rebuild, and after Phase 0
it will not be one.

## 8. Explicit non goals

Written down so they can be pointed at when the temptation arrives.

- **No second category** until eSIM has paying customers, a signed supplier and
  a refund process that has survived a real refund.
- **No cart.** One item per order until somebody asks for two.
- **One pricing currency and one settlement currency**, both AUD, until a
  second market is actually tax registered. Presentment in local currency is
  not covered by this and may be switched on whenever it helps, because it
  changes nothing structural. Adding a *pricing* currency means a price list a
  person maintains, never an FX conversion at request time.
- **No microservices.** One Next.js application on Vercel, one Postgres.
- **No automatic supplier failover.** A human flips `catalog_sources.enabled` in
  the console. Automatic failover on a supplier that is half up provisions half
  a catalogue against the wrong rate card.
- **No user wallet or stored value.** Issuing stored value is a regulated
  activity in Australia. Discounts and refunds only.
- **No plugin system, no per tenant theming, no white labelling.** Bilby is one
  brand.

## 9. Dead weight to remove in a named commit

All of it is free tier residue and all of it is currently reachable:

- the `free` lane and `freeSupplier()` in `lib/suppliers/index.ts`
- `esims.is_free_tier`
- `api/ads/ssv`, `api/redeem`, `api/dev/simulate-ad`
- `lib/pricing.ts` and `lib/ads.ts`
- `credit_ledger` — freeze rather than drop, it is append only history
- `web/android/` and `web/capacitor-shell/`, per `DECISIONS.md`
- the app host home screen, which is still the earn page

## 10. Phases

**Phase 0, now, before any supplier credentials arrive.** The five seams. No
new features, nothing a customer can see, no second product. Estimated two to
three working sessions. This is the only phase in this document that is urgent,
and it is urgent precisely because there are no customers yet.

**Phase 1, eSIM end to end.** eSIM Access adapter against their sandbox,
catalogue seeded by hand for the launch destinations, Stripe Checkout, not
Elements, so that local currency presentment stays available later,
webhook driven fulfilment, entitlement written, credential delivered. The
definition of done is a real card charging a real dollar and a real profile
installing on a real handset.

**Phase 2, operations.** The things that decide whether this survives contact
with customers: refund and cancel flow in the console, failed order retry,
usage view, and a margin calculator that takes the rate card, the Stripe fee,
an FX buffer, GST and a refund reserve and tells you what a SKU actually earns.

**Phase 3, the Android app** against `api.bilbymobile.com`, which is already the
frozen origin. The R8 bisect is still open.

**Phase 4, second supplier.** Airalo as a second row in `catalog_sources`.
This phase exists to prove the registry works while the stakes are low, not
because a second supplier is needed.

**Phase 5, and only with revenue.** A second category. Data top ups first, on
the reasoning already recorded: same customer, no new regulator.

## 11. The acceptance test

An architecture claim that cannot fail is worth nothing, so here is the one
that can:

> Adding a second category must touch exactly four kinds of file: one new
> fulfiller adapter, one attributes shape, one detail panel component, and one
> console tab.
>
> If it touches commerce, tax, authentication, the order pipeline or the
> entitlement table, the abstraction failed and the fix is here, not there.

Run that test on paper against data top ups before writing any of Phase 0. If
it fails on paper, the seams above are wrong and it is cheaper to find out now.

### The test, run on paper against data top ups

Done before writing any code, which is the point of it.

| Would it touch | Verdict |
|---|---|
| A new fulfiller adapter | yes, expected |
| An attributes shape | yes, expected: operator, country, face value |
| A detail panel | yes, expected: the receipt and confirmation code |
| A console tab | yes, expected |
| Commerce | no. AUD price, `tax_code` already per order |
| Entitlements | no. `external_ref` holds the supplier transaction id, `status` goes straight to issued |
| Auth, order pipeline | no |

**It failed on one point, which is why the test exists.** A top up needs
something from the customer at purchase time: the phone number being topped up.
An eSIM needs nothing. Nothing in the model above carries a customer supplied
input from the checkout form to the fulfiller, so a second category would have
had to bolt one on, and would probably have bolted it onto the order.

The fix is two columns, added in Phase 0 while they are free:

```sql
ALTER TABLE catalog_items ADD COLUMN input_schema JSONB NOT NULL DEFAULT '{}';
ALTER TABLE order_items   ADD COLUMN input        JSONB NOT NULL DEFAULT '{}';
```

`input_schema` describes what to ask for and how to validate it. `input` records
what the customer actually gave, on the item, frozen, because "we sent it to the
wrong number" is a support conversation that needs evidence.

A second, smaller finding: gift cards and top ups deliver a secret, a PIN or a
code, where an eSIM delivers an activation string that is not really secret. The
`payload` column can hold either, but the reveal rule differs. That is a category
concern and can wait, and it is noted here so it is not a surprise.
