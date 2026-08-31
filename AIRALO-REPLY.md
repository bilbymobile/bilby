# Airalo reply, ticket 5515794

## Read the answer before you send anything

Score it against the gates in SUPPLIER-OUTREACH.md.

| Question | Their answer | Verdict |
|---|---|---|
| Smallest packet | Not answered. "Varies by destination, check the catalog once your account is enabled." | **Still open.** This is the gate. |
| Pooled data | "Our standard Partner API model is based on purchasing eSIM packages and eligible top-ups, rather than drawing arbitrary MB amounts from a shared prepaid data pool." | **Soft no**, with a door left open to Partnerships. |
| Top up on existing ICCID | Yes, with the three step flow, and it matches the adapter we already wrote. | **Passed**, with a new caveat. |
| Oceania rate | Deflected to Partnerships, needs a volume forecast. | Open, and now actionable. |
| Failed activation | Case by case, no blanket policy. | Noted. Treat support as a line item, not an annoyance. |
| Sandbox | Yes. | Passed. |

Two gates were meant to be answered and neither was. That is normal for a first
reply from a support desk rather than a rate desk, and the way through is to
give them the volume forecast they asked for so the ticket can escalate.

## The important thing buried in their answer

> "if an eSIM has been recycled after the applicable window, it can no longer be
> topped up and a new eSIM would be required"

**eSIM profiles get recycled after a period of inactivity.** Nobody mentions this
until you ask, and it directly attacks the promise on your home screen: install
once, keep forever. Your free tier is slow by design, so an idle user is the
normal case, not the edge case. If the window is 30 days you have a serious
product problem. If it is 12 months you have a housekeeping job.

That number is now the third gate and it was not on the list before, because
nothing in public documentation says the mechanic exists.

## The volume forecast, and why you do not invent one

They asked for a monthly volume forecast. You have zero users, so any number you
make up is either fiction or, worse, becomes a minimum commitment in a contract.

You do not need to invent one, because **your free tier is bounded in code, not
by demand.** `DAILY_BUDGET_USD` in `ledger.ts` is a hard ceiling on free tier
spend per day, enforced inside the grant transaction. That converts directly to
gigabytes at whatever rate they quote, and it is a far more credible answer than
a user projection, because it is arithmetic rather than optimism.

At a $2.00 per GB working assumption:

| Daily budget | GB per day | GB per month | Redemptions per day at 50 MB |
|---|---|---|---|
| $5 (launch setting) | 2.5 | 75 | 50 |
| $25 (target once ad revenue is proven) | 12.5 | 375 | 250 |
| $100 (12 month target) | 50 | 1,500 | 1,000 |

Paid plan volume sits on top and is genuinely unknown. Say so.

---

## The reply to send

**Reply to the existing thread so it stays on ticket 5515794.**

> Hi Dom,
>
> Thank you, that is a genuinely useful answer and it moves three of the six
> questions to closed. Answers to your three below, then the two numbers I still
> need and one new question your reply raised.
>
> **Launch countries.** Home market Australia. Destinations at launch are
> Indonesia, Thailand, Japan, Vietnam, Pakistan and China, with New Zealand and
> the rest of Southeast Asia following.
>
> **Free tier scope on day one.** Multi destination from launch, not Australia
> first. Australia is the exception and the reason is arithmetic: at $2.20 per GB
> an Australian ad view funds 4.9 MB against a 5 MB floor, so the free tier is
> switched off for Australia in code until the rate clears $2.157. Every other
> launch destination is viable at published rates today. So Australia is not a
> phase two market for me, it is a market that switches on the day a rate desk
> gives me a number starting with 2.15.
>
> **Volume forecast.** I would rather give you a bounded figure than a
> projection, because my free tier is capped in code rather than by demand. There
> is a hard daily spend ceiling enforced inside the grant transaction, so free
> tier consumption cannot exceed it no matter how many users I have. At a $2.00
> per GB working assumption that gives:
>
> | Daily budget | GB per month | Phase |
> |---|---|---|
> | $5 | 75 | launch setting |
> | $25 | 375 | once ad revenue is proven, target months 4 to 6 |
> | $100 | 1,500 | 12 month target |
>
> Paid plan volume sits on top of that and I am not going to pretend I can
> forecast it before launch. What I can tell you is that the free tier is the
> acquisition channel for it, so the two move together.
>
> I am happy for the commercial team to treat the $25 per day tier as the
> realistic near term planning number.
>
> **The two numbers I still need.**
>
> 1. The smallest **top up** package by size, for Indonesia, Thailand, Japan,
> Vietnam and Australia. Your answer distinguished eSIM packages from eligible
> top up packages, which suggests they are different lists. Since I top up far
> more often than I issue, the top up floor is the number that decides this, and
> it may well be smaller than the initial package floor. If the top up floor is
> 500 MB or below the model works with a threshold adjustment. If it is 1 GB the
> free tier does not close at any rate.
>
> 2. Whether Partnerships can reach $2.157 per GB for Oceania at the volumes
> above, and if not, what volume would.
>
> **The new question, from your own answer.** You mentioned that an eSIM recycled
> after the applicable window can no longer be topped up. What is that window,
> and is it measured from issuance, from last activation, or from last data
> usage?
>
> This matters more to me than to a normal reseller. My users accrue data slowly
> by design, so a dormant profile is the ordinary case rather than the edge case.
> If the recycle window is short, "install once and top up forever" is not a
> promise I can make, and I would rather redesign around that now than discover
> it from a support ticket after launch. If there is a way to keep a profile
> alive through a minimal top up, that is worth knowing too, because I would
> build it.
>
> Happy to get on a call with the commercial team if that is faster than the
> ticket.
>
> Thanks,
> Nav
> Bilby · bilbymobile.com

---

## What to do with the answer when it comes

**If the smallest top up is 500 MB or below.** Raise `REDEMPTION_THRESHOLD_MB` to
match it and re-run the day one reachability check in `ledger.ts`. At 9 MB per ad
and a 10 ad daily cap, a 500 MB threshold takes about six days to reach, which is
survivable but changes the onboarding story: a new user has to be told plainly
that the first redemption takes a week, or they will assume the app is broken and
uninstall on day two.

**If it is 1 GB with no pooled option.** Airalo is out for the free tier. That is
not a disaster, it is the answer arriving cheaply. The free tier would then need
either a supplier who sells small, or a different mechanic entirely, and you would
still want Airalo for paid plans where 1 GB SKUs are exactly right.

**Either way, chase the recycle window.** It is a product design input regardless
of which supplier you end up with, and every one of them will have the same
mechanic under a different name.
