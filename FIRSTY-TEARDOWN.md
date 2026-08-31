# How Firsty manages it, and what it means for Bilby

Written after the Airalo reply, because the answer explains why our supplier
conversation is hard and theirs probably was not.

## What Firsty actually does

From their own help pages and plan page, verified today:

| | Firsty |
|---|---|
| Free tier volume | **Up to 300 MB per 24 hours** |
| Free tier speed | **256 Kbps to 1 Mbps**, varying by location |
| What an ad buys | **Time online, not data.** "The number of ads you watch determines how long you stay online." Up to six hours banked at once. |
| Coverage | 170 countries, free tier in North America, Europe and APAC |
| Paid: Classic | from **€0.98 per GB**, 0.5 to 50 GB |
| Paid: Unlimited | from **€2 per day**, 5 GB at full speed then 512 Kbps |

## The mechanic, and why it matters more than the numbers

**Bilby sells megabytes. Firsty sells minutes.**

In our design an advertisement grants a quantity of data. Grants accumulate to a
threshold, and at the threshold we go and buy that quantity from a supplier.
Every part of the supplier problem follows from that one sentence. We need a
supplier who will sell 50 MB, because a 50 MB redemption is a purchase event.

In Firsty's design an advertisement grants a **window of access** to a throttled
lane. There is no redemption, no threshold, no purchase event. The user is
allowed onto a slow pipe for a few hours, and cost is controlled by two policy
levers rather than by procurement:

1. **The throttle.** At 256 Kbps a user cannot consume much even if they try.
2. **The daily ceiling.** 300 MB per 24 hours, regardless of how many
   advertisements they watch.

Those two numbers bound the worst case cost per user per day at 300 MB, which at
any plausible wholesale rate is somewhere between 20 and 60 US cents. That is the
whole economic model, and it never once requires a supplier to sell a small
packet.

## The uncomfortable part

Look at their Classic price: **€0.98 per GB retail**, roughly USD $1.60.

We model wholesale at $2.20 per GB. Firsty is retailing below our assumed
wholesale, in 170 countries. There is no rate desk conversation that closes that
gap through a reseller API, because a reseller API is a layer of margin sitting
on top of the carrier. Firsty is buying at a level we are not.

That has two consequences and they point in opposite directions.

**On paid plans, we cannot win on price.** Not now, possibly not ever, and
certainly not by negotiating harder with Airalo. Competing with Firsty on price
per gigabyte is a losing position and should be abandoned as a goal rather than
pursued more energetically.

**On the free tier, we are not actually competing with them.** Their free tier is
a throttled always on lane for messaging. Ours is metered data at full speed that
you earn and then spend. Those are different products for different moments. A
person using Firsty Free is checking WhatsApp. A person with a Bilby balance is
loading a map.

## What we would have to change to copy them

Throttling is the load bearing part, and it is the part a reseller API does not
give us. Airalo and eSIM Access sell bundles. They do not expose a policy layer
where we set a per user speed cap, because they are not the network.

Firsty can throttle because they sit closer to the carrier, through an MVNE or a
direct wholesale agreement. Going there means minimum monthly commitments, a
credit check and a contract, which is a different kind of business from buying
bundles through an API with a card on file.

So copying Firsty exactly is not a code change. It is a change of supplier tier,
and it is probably out of reach until there is revenue to point at.

## What is actually worth doing about it

**1. Add one question to all three supplier conversations.**

> Do you offer a speed capped bundle, or any policy control over throughput per
> profile? For example a 512 Kbps SKU rather than a full speed one.

If any reseller sells a throttled SKU, we get most of the Firsty mechanic without
an MVNE contract, because a slow bundle is cheap and a slow user consumes slowly.
This has not been asked yet and it may be the highest value question left.

**2. Consider decoupling the grant from the purchase.**

Even keeping our megabyte based product, there is no rule that says a 50 MB grant
must trigger a 50 MB purchase. We could buy the smallest available bundle once
per user, hold it as inventory on their ICCID, and let the ledger govern what
they are entitled to draw rather than what we have bought. The `FREE_TIER_SPEED_KBPS`
constant already exists in `pricing.ts` and is currently decorative.

The honest problem with that: once a profile holds 1 GB, the network will let the
user consume 1 GB. Our ledger cannot stop them, because the ledger is not in the
data path. This only works if the supplier can either sell small or cap speed,
which puts us back at the same question from a different angle. Worth naming so
nobody reinvents it later believing it is a way out.

**3. Stop treating the free tier as the differentiator.**

Firsty already owns "free data abroad", they own it in 170 countries, and they
were there first. Our defensible position is not that our free tier is free. It
is that ours is honest about what it costs, priced per destination, and attached
to a product that intends to become a whole travel companion rather than a SIM.
That is the claim in `STRATEGY.md` and this teardown strengthens it rather than
weakening it.

## The one thing this does not change

None of the above tells us whether a 50 MB or 500 MB top up exists. That is still
the gate, it is still unanswered by all three suppliers, and the calls are still
the way to find out. Firsty's model is useful context for those calls, not a
substitute for having them.
