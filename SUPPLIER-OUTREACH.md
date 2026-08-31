# Supplier outreach

Three emails, ready to send, plus the reasoning behind the questions and a
scoring sheet for the replies.

**Send all three on the same day.** Three live accounts cost nothing, and a
competing quote is the only leverage you will ever have on a rate card.

**Sign up first, then send.** Arriving as an existing account asking a specific
technical question gets a materially better response than arriving cold as a
prospect. All three have self serve signup and it takes about ten minutes each.

| Supplier | Signup | Why they are on the list |
|---|---|---|
| eSIM Access | `console.esimaccess.com` | **The adapter is already written.** `web/src/lib/suppliers/esimaccess.ts` implements listPlans, listTopUpPlans, order, topUp, usage and balanceUsd against their open API. Integration cost with them is zero days. |
| Airalo Partners | `partners.airalo.com` | Largest catalogue in the category, 200 plus destinations. The name carries weight with a Play reviewer and with users. |
| eSIM Go | `esimgo.com` | Pay as you grow, no upfront commitment, 1,000 plus networks. The one most likely to say yes to a small operator. |

---

## What changed, and why it matters before you send

eSIM Access publishes plan sizes of **1 GB, 3 GB, 5 GB, 10 GB, 20 GB and 50 GB**.
Your redemption threshold is 50 MB. If 1 GB really is the floor, then every
redemption buys twenty times what it delivers, and `pricing.ts` becomes fiction.

That is not a reason to drop them. It is a reason the first question has to be
asked precisely, because a published retail catalogue is rarely the same thing
as a wholesale SKU list, and none of the three publishes their wholesale floor
anywhere. This is exactly the information that only exists in a reply.

It also means there is a fourth question worth asking all three, which was not
in the previous version of this document and is the most valuable one here.

**Is there a pooled data product?** If a supplier will sell you a shared balance
that you draw down in arbitrary amounts across many ICCIDs, the micro packet
problem disappears completely. You buy 100 GB once, hand out 50 MB at a time,
and the smallest SKU stops mattering. Pooled data is a normal enterprise product
in mobile wholesale and it is almost never on a public reseller page, so nobody
who does not ask will be offered it. If any one of the three says yes, that is
your supplier and the conversation with the other two becomes a price check.

---

## Email 1: eSIM Access

**To:** `team@esimaccess.com` (create the console account first)

**Subject:** Wholesale API, smallest purchasable volume and pooled data for an ad funded free tier

> Hi,
>
> I run Bilby, an Australian travel eSIM launching on Google Play shortly. Sole
> trader, ABN 78 625 669 361, organisation Play developer account, site live at
> bilbymobile.com.
>
> I have already built against your open API. Ordering, top up, usage and
> balance are integrated and working against a mock, so I am not asking whether
> we can integrate. I am asking whether the commercial shape fits, because the
> model is unusual and it puts weight on parts of your platform that most
> resellers never touch.
>
> Users watch a rewarded video advertisement and earn a small data grant, priced
> against the country they are travelling to. Grants accumulate, and only when a
> user crosses a threshold do we buy anything from a supplier. Paid plans sit
> alongside it in the ordinary way.
>
> Four questions.
>
> **1. What is the smallest volume I can actually purchase through the API, by
> region?** Your public plans start at 1 GB. My redemption threshold is 50 MB. If
> 1 GB is genuinely the floor then every redemption buys twenty times what it
> delivers and the free tier does not close, so this is a go or no go rather
> than a preference. If there is a wholesale SKU list that differs from the
> retail catalogue, that is the list I need.
>
> **2. Do you offer a pooled or balance based product?** Something where I
> prepay a bulk volume and draw it down in arbitrary amounts across many ICCIDs,
> rather than buying fixed bundles per user. If that exists, question 1 stops
> mattering and this is the fastest conversation either of us will have today.
>
> **3. What is your Oceania rate, and what monthly volume moves it?** I have
> modelled this precisely. At $2.20 per GB an Australian advertisement view
> funds 4.9 MB against a 5 MB floor, so an Australian free tier is not viable.
> At $2.157 per GB it is. I am not asking for a discount in the abstract. I am
> asking what volume gets me under $2.157, because that one number switches on a
> whole market.
>
> **4. Top up granularity on an existing ICCID.** I install one profile per user
> and top it up for the life of the account, which is both a product promise and
> a cost control since issuance is billable. Is the top up SKU list the same as
> the initial purchase list, or can top ups be smaller?
>
> Two smaller ones: what happens commercially when a profile fails to activate,
> and is there a sandbox I can run end to end before committing spend?
>
> Happy to share the traffic model. Australian outbound, initially Indonesia,
> Thailand, Japan, Vietnam and Pakistan.
>
> Thanks,
> Nav
> Bilby · bilbymobile.com

---

## Email 2: Airalo Partners

**Subject:** Partner API, micro volumes and pooled data for an ad funded free tier

> Hi,
>
> I run Bilby, an Australian travel eSIM launching on Google Play in the next few
> weeks. Sole trader, ABN 78 625 669 361, organisation Play developer account.
>
> The model is unusual and it changes which parts of your API matter to me, so I
> want to check fit before I build against it rather than after.
>
> Users watch a rewarded video advertisement and earn a small amount of data,
> priced against where they are travelling. They accumulate to a threshold, and
> only then do we buy anything from a supplier. Paid plans sit alongside it in
> the normal way.
>
> That gives me four questions most resellers never need to ask.
>
> **1. What is the smallest packet I can purchase through the API, by region?**
> My redemption threshold is 50 MB. If the smallest SKU is 1 GB then I am buying
> twenty times what I hand out and the model does not work, so this is the
> question that decides whether we can work together at all.
>
> **2. Do you sell a pooled or balance based product?** A prepaid bulk volume I
> draw down in arbitrary amounts across many ICCIDs would remove the constraint
> in question 1 entirely. I understand this is not on the public partner pages,
> which is why I am asking directly.
>
> **3. Can I top up an existing ICCID through the API, or does every purchase
> issue a new profile?** The product promises one eSIM installed once and topped
> up forever. Issuing a new profile per redemption leaves users with a stack of
> profiles in their phone settings, which is a support problem and a churn
> problem.
>
> **4. What is your rate for Oceania, and what monthly volume moves it?** I have
> modelled this precisely. At $2.20 per GB an Australian advertisement view funds
> 4.9 MB against a 5 MB floor, so an Australian free tier is not viable. At
> $2.157 per GB it is. I am not asking for a discount in the abstract, I am
> asking what volume gets me under $2.157, because that number switches on a
> whole market for me.
>
> Two smaller ones: what happens commercially when a profile fails to activate,
> and do you have a sandbox I can build against before committing spend?
>
> Happy to share the traffic model. Australian outbound, initially Indonesia,
> Thailand, Japan, Vietnam and Pakistan.
>
> Thanks,
> Nav
> Bilby · bilbymobile.com

---

## Email 3: eSIM Go

**Subject:** Reseller API, smallest bundle size, pooled data and top up support

> Hi,
>
> I am launching Bilby, an Australian travel eSIM, on Google Play shortly. Sole
> trader, ABN 78 625 669 361, site live at bilbymobile.com. Your pay as you grow
> model with no upfront commitment is why you are on my shortlist, and I would
> rather ask five questions now than discover the answers after integration.
>
> Our free tier works by advertisement: a user watches a rewarded video, earns a
> small data grant priced against their destination, accrues to a threshold, and
> we buy from a supplier only at that point. Paid bundles run alongside it.
>
> **1. Smallest bundle available through the API, by region.** We redeem at
> 50 MB. If the floor is 1 GB the economics do not close, so this is a go or no
> go rather than a preference.
>
> **2. Pooled or balance based supply.** If you sell a bulk volume I can draw
> down in arbitrary amounts across many ICCIDs, question 1 becomes irrelevant and
> this is a much shorter conversation. Worth asking before anything else.
>
> **3. Top up on an existing ICCID.** We install one profile per user and top it
> up for the life of the account. Confirming there is a top up endpoint rather
> than only an issue endpoint is essential to the product design.
>
> **4. Oceania rate and the volume that moves it.** My model says an Australian
> free tier turns on below $2.157 per GB and is dead above it. What monthly
> activation volume gets me under that line?
>
> **5. Sandbox and time to live credentials.** I would like to build and test
> before spending anything.
>
> Also worth asking: your site mentions Breeze as an affiliate route alongside
> the direct API. For an app that provisions programmatically from its own
> backend, is the direct API the right product, or is there a reseller tier that
> fits better?
>
> Thanks,
> Nav
> Bilby · bilbymobile.com

---

## Why these questions and not the usual ones

Most reseller onboarding asks about coverage and price per gigabyte. Neither is
your constraint.

**Smallest packet is the one that can kill the product.** The free tier hands out
between 5 and 13 MB per advertisement and redeems at 50. If a supplier's floor is
1 GB, every redemption buys 1 GB to deliver 50 MB, the effective cost per
delivered megabyte is twenty times the rate card, and `pricing.ts` becomes
fiction.

**Pooled data is the escape hatch nobody advertises.** It is a standard product
in mobile wholesale and it is essentially never on a public reseller page,
because public reseller pages are written for people selling 1 GB bundles to
tourists. You are not doing that. A yes here makes the packet size question moot
and is worth more than any rate concession you will get.

**Top up decides the shape of the whole app.** "Install once, keep forever" is
the promise on the home screen and it is also a cost control, because profile
issuance is billable on most platforms. Without a top up endpoint the design
collapses into "a new eSIM every time you redeem", and nobody wants nine
profiles in their settings.

**Naming $2.157 changes the conversation.** A rate desk can ignore "can you do
better". It cannot ignore a specific number attached to a specific decision. It
also tells them you have modelled the business, which changes how they treat you.

**Activation failure policy is the hidden operating cost.** Failed installs are
the dominant support burden in this category. Knowing who absorbs the cost tells
you whether support is an annoyance or a line item.

---

## Scoring the replies

Put them side by side and score in this order. The first two are gates, the rest
are preferences.

1. Pooled or balance based supply available. **If yes, stop, this is your
   supplier.**
2. Smallest packet at or below 100 MB. **Gate.**
3. Top up on an existing ICCID. **Gate.**
4. Oceania rate, and the volume that moves it.
5. Sandbox available before spend.
6. Rates for Indonesia, Thailand, Japan, Vietnam and Pakistan.
7. Failed activation policy.

If more than one passes the gates, take the better Southeast Asia rate, because
that is where your first users are going, and keep the others warm for the next
negotiation.

**If none passes on packet size**, that is genuinely important information and it
changes the product rather than the vendor. Raise `REDEMPTION_THRESHOLD_MB` to
match the smallest real SKU, then re-run the day one reachability check, because
a higher threshold has to stay earnable inside a single day or new users get
nothing on the day they install. The invariant in `ledger.ts` throws if it does
not, which is exactly what it is there for. At a 1 GB floor and 9 MB per
advertisement, a user would need over a hundred views to redeem once, which is
not a product. In that case the free tier has to be re-thought rather than
re-tuned, and it is much better to learn that from an email than from a launch.

---

## Backups, if all three disappoint

Not researched in depth, listed so you are not starting from zero:
2SkyMobile (wholesale mobile data platform), eSIM Card partner API, LotusFlare
(enterprise wholesale, likely too large for a first contract but they do sell
pooled capacity, which is the thing you want).

---

## Rough economics to expect

Wholesale $0.50 to $2.00 per GB by region. Retail in this market $2 to $8 per GB.
Gross margin 50 to 75 percent, net 30 to 45 percent after payment fees, refunds
and support.

`pricing.ts` already models the pessimistic end of every published range, which
is the correct direction to be wrong in. If a supplier comes back better than the
table, the free tier gets more generous automatically and nothing needs changing
except one variable.
