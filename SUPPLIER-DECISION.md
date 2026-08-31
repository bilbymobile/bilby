# Supplier decision, after research

Two research passes, one across travel eSIM reseller APIs and one across the
MVNE and IoT connectivity layer beneath them. Every fact below has a source.
Where something is unknown it says so, because a guess here costs months.

## The headline

**All three suppliers you are currently talking to are structurally
incompatible with the metered megabyte model, and the evidence was public.**

| Supplier | What closes it | Source |
|---|---|---|
| Airalo | Smallest documented top up package is **3 GB** (`bonbon-mobile-30days-3gb-topup`, $8 net). Not 500 MB, not 1 GB. Three emails of "check the catalogue once your account is enabled", and the answer was in their public developer docs the whole time. | developers.partners.airalo.com |
| eSIM Access | **An eSIM can be topped up a maximum of 10 times.** A drip fed free tier is nothing but top ups, so this is a hard ceiling on the entire product, not a pricing detail. | esimaccess.com/docs |
| eSIM Go | **$1,000 per month minimum commitment** on the entry tier, rising to $25k. | esimgo.com/product/pricing |

Stop spending time on all three for the free tier. Airalo and eSIM Access remain
perfectly good for **paid plans**, where 1 GB and 3 GB SKUs are exactly right.

## The deeper finding, which matters more

Granularity costs money, everywhere, without exception.

| Source | Smallest unit | Effective per GB |
|---|---|---|
| Bilby needs | 9 MB per ad view | **$2.20 or less** |
| Simbase, Europe | per kilobyte | $5.00 |
| Simbase, Oceania | per kilobyte | $20.00 |
| Keepgo | 100 MB | $30.00 retail |
| Airalo | 3 GB | $2.67 net |

Every provider that will sell you small units charges a large premium for the
privilege, and the premium is between two and fourteen times. The one provider
whose per gigabyte rate works only sells in three gigabyte blocks.

**This is not a negotiation problem. It is the shape of the market.** No amount
of talking to rate desks closes a gap that exists because selling small is
genuinely more expensive to operate.

## Which means the metered model is the wrong model

Not because it is badly built. `pricing.ts` is correct and the arbitrage insight
behind it stands. But it depends on buying megabytes in the sizes we hand them
out, and nobody sells those at a price the free tier can support.

Firsty's own terms and conditions now confirm exactly how they avoided this:

> "a time-limited internet session of up to thirty (30) minutes", stackable
> "up to a maximum total of six (6) hours of connectivity time"

And Ookla measured the lane at **0.21 Mbps**. Do the arithmetic that makes it
work: 0.21 Mbps for 1800 seconds is a theoretical ceiling of roughly 47 MB, and
real messaging use is a small fraction of that. Selling time on a throttled lane
converts an unbounded megabyte liability into a bounded one, and **the throttle
does the cost control that procurement cannot.**

Firsty's terms also say plainly that they buy from MVNEs rather than owning
infrastructure. So the thing separating you from them is a commercial
arrangement, and their €5.1M seed and 1.2M users are what bought it. That is a
funding gap, not a knowledge gap, and the product trick itself is copyable at
any layer.

## The new shortlist

The question changes from "who will sell me 50 MB" to **"who will let me set a
speed cap"**. Different suppliers answer that.

**1. emnify.** The only provider documenting pooling and throttling together.
Plan types include "Pooled"; on quota exhaustion you choose "Block" or
"Throttle, the service is throttled to a defined peak", configured through a
Service Policy. Consumer eSIM is a listed form factor. Pricing is not published,
which is the open question.

**2. Maya Mobile.** Publishes true per megabyte billing and explicit traffic
policies in one sentence: "fixed limit, time limited, unlimited, throttled, or
any combination". Requires an NDA before API docs. Confirm the per MB model is
still current, because that detail lives on their legacy site.

**3. Soracom.** The only provider anywhere publishing a per SIM speed class API:
32 kbps, 128 kbps, 512 kbps, 2 Mbps, changeable programmatically. **The catch is
$0.06 per active SIM per day**, which is $1.80 a month per user regardless of
usage and would bankrupt a free tier. Only viable if profiles can be held
inactive and activated on demand, which is the first question to ask them.

**4. Telna Connect Flex.** Claims "free registration, no credit is required to
onboard" and "self onboarding", which is the lowest published barrier at the
MVNE layer. Their API lists "Policy and Charging Rules". Whether that covers
throughput or only volume is not published.

Keepgo is worth keeping warm as the best metered option if the model survives:
100 MB is both their smallest bundle and their refill unit, they run a prepaid
money balance drawn down across any ICCID, and their Lifetime line genuinely
does not expire, which solves the dormancy problem. The price is the issue.

## The question that decides everything, and it is not about price

Every one of the cheap, flexible, self serve providers is selling to **machines,
not handsets**. Simbase targets "rugged tablets, mobile computers, smart POS
terminals". Soracom, emnify and KORE are IoT platforms.

**Do their terms permit these profiles in consumer smartphones, resold to retail
consumers?** Nobody publishes an answer. If it is yes, the cheapest path in the
whole market opens. If it is no, that entire tier closes and Maya and Telna are
what remain. It is one email and it should go out before anything else.

Ask alongside it: are there permanent roaming restrictions or per country dwell
limits, and can thousands of provisioned but inactive profiles be held without
paying a per SIM daily fee until first attach.

## The regulatory thing, which is now urgent rather than someday

This is not legal advice and it needs a telecommunications lawyer. But the
research turned up something that changes the timing.

Reselling mobile connectivity under your own brand appears to make you a
**Carriage Service Provider** in Australia. TIO membership is then mandatory,
with a minimum fixed fee of $400 excluding GST, and the TCP Code C628 applies
and is enforceable by ACMA.

More pressing: the **Telecommunications Amendment (Enhancing Consumer
Safeguards) Bill 2025** introduces a CSP registration scheme, and under it
**carriers and wholesale CSPs will be prohibited from supplying listed carriage
services to an unregistered CSP.** Maximum penalties reach around $10 million.

Read that consequence carefully. It means a future supplier may be legally
unable to sell to you until you are registered. The lawyer conversation has
moved from a launch prerequisite to a **supplier contract prerequisite**, and it
should happen before you sign anything.

Firsty contracts through a Singapore entity, Firsty B2C Pte. Ltd., which may or
may not be relevant to your structure. Worth asking the lawyer, not worth
copying blindly.

## What I would do this week

1. Email the four IoT and MVNE candidates the consumer handset question. It is
   one paragraph and it gates the cheapest path in the market.
2. Book the Australian telecommunications lawyer. It is now blocking supply, not
   just launch.
3. Keep Airalo and eSIM Access alive for **paid plans only**, and say so to them
   plainly. It is an honest position and it keeps both relationships warm.
4. Finish the entitlement abstraction. It was the right call before this research
   and it is now the only thing that lets the product survive the answer.
