# Bilby: from eSIM to the travel app people keep

Research brief. The question was how to stand out against Airalo, Saily, Trip.com
and Hopper, what the app becomes beyond eSIM, and how to stop it feeling like a
dead static thing people open once and forget.

---

## 1. Why travel apps die, with numbers

Travel is the worst retention category in mobile and it is not close.

| Category | Day 30 retention |
|---|---|
| Social | 15 to 20% |
| Productivity | 12 to 18% |
| Fintech | 10 to 15% |
| Gaming | 5 to 8% |
| Ecommerce | 3 to 6% |
| **Travel** | **2.8%** |

Travel loses to ecommerce. An app people use to spend thousands of dollars
retains worse than an app people use to buy socks.

Three mechanics cause it:

* **Value is a spike, not a curve.** Two international trips a year gives you two
  windows of relevance. You cannot build a habit on two events a year.
* **The app is a means to an end that happens somewhere else.** You book on
  Trip.com, then land and use Google Maps. Airalo has the sharpest version of
  this problem: its success condition is its own irrelevance.
* **Slow death.** Notification permission decays, the icon moves to page four,
  deleted at the next phone upgrade.

### Hopper is the cautionary tale

Hopper hit **$850M revenue in 2024**, roughly 40% of it from fintech attachments
like price freeze and cancel for any reason, with over 60% of users attaching at
least one. World class monetisation of a single moment.

In that same period Hopper's users **fell from 45M to 35M** and downloads
**collapsed from 18.7M to 4.5M**.

Hopper solved revenue per user and never solved habit. It monetised the spike
and then had to keep buying new spikes. **Attach rate and retention are
different problems, and the second one is the expensive one.**

### The four states

Model every user as being in one of four states:

| State | Share of calendar | Who serves it today |
|---|---|---|
| Dreaming (no trip booked) | 70 to 80% | almost nobody |
| Booked | 8% | Trip.com |
| Travelling | 4% | Airalo, badly |
| Home (just returned) | 10% | almost nobody |

Every travel app builds for Booked and Travelling. That is 12% of the calendar.

**The whole opportunity is to own Dreaming and Home, using Travelling as the
moment that earns the right.**

---

## 2. What only Bilby can do

This is the part that matters. Bilby's asset is not that it sells data. It is
that Bilby sits **below the application layer**. Every other travel app asks the
operating system for permission to know where you are, then hopes background
refresh fires. Bilby knows because the radio told it.

### Arrival Autopilot

The instant the eSIM attaches to a foreign network, Bilby knows the device
landed, the country, the city, the local time, and that this is the first moment
of the trip. It knows this **before Google Maps has a fix, before the airline app
has synced, and without any location permission at all.**

So take the screen. One card, no menus: local time and time at home, the
emergency number here, the three ways out of this airport with real prices so the
taxi tout cannot rob you, an offline map already downloaded because we knew you
were coming, today's rate expressed as "this coffee costs you $4.20", and one
line on the scam that gets people in their first hour.

Trip.com knows your flight number but not that you landed. Airalo knows you
activated and does nothing with it. **Arrival is the highest emotion, highest
need, lowest competition moment in all of travel, and we own it structurally.**

### Megabytes as a universal reward currency

The most underrated asset in the business. Data costs us wholesale cents and is
worth an enormous amount to a traveller running low in a foreign country. That is
the best ratio of perceived value to real cost available to any travel app
anywhere.

So pay in megabytes for the things that normally cannot be bought: confirming the
airport taxi price you just paid, photographing a bus timetable, answering
another traveller's question, reporting the immigration queue right now.

That solves the cold start problem that kills every travel content startup,
**using a currency competitors cannot print.** Wanderlog cannot pay in data.
TripAdvisor cannot pay in data.

### Disruption detection with no booking

Every disruption product needs your booking reference. Bilby does not.

Still attached to the airport cell three hours after departure means something
went wrong. Attaching in Doha when the itinerary said Bangkok means a diversion.
Landing twelve hours late very likely means a claim worth up to 600 euros.

So Bilby can say "looks like your flight went badly, want us to check whether you
are owed money?" to users who never told Bilby anything. AirHelp cannot detect
it. The airline will not tell you. **We can see it from the network.**

### Behavioural help from the usage curve

Usage shape is behaviour. Sustained map usage at 11pm in an unfamiliar district
looks like lost. A burst of translation traffic looks like a struggle at a
counter. A flat line for six hours looks like the phone died.

"At your current rate you run out in about five hours, watch one ad now so you
are not stranded at midnight" is genuinely helpful and it is also our ad
inventory. **Run this as a data coach that saves people money, not as a scarcity
engine.** The first version builds a decade of trust. The second gets us deleted.

### The connectivity floor

Always reserve a small allowance that never expires and works even when the plan
is exhausted. Enough for a map, a message home, and an emergency call. It costs
almost nothing and it makes Bilby the app nobody deletes, because deleting it
feels like removing a safety net. Cheapest brand moat available.

---

## 3. The expansion map, ranked by value over effort

Scored as (value times retention) out of 100, divided by effort out of 10.

### Build first

| # | Surface | Ratio | Data | Earns |
|---|---|---|---|---|
| 1 | Document and expiry watchdog | 30 | free | retention plus affiliate |
| 2 | AI packing and prep checklist | 27.5 | free | retention plus gear affiliate |
| 3 | Currency converter and live spend tracker | 25 | free (ECB rates) | retention |
| 4 | Follow a friend's trip | 22.5 | ours | retention **and** growth |
| 5 | Auto trip timeline from forwarded email | 21 | user brings it | retention |

**Document watchdog** is the highest ratio on the list and it is two days of
work. "Your passport expires in five months and Thailand needs six months
validity" is the single most legitimate between trips notification that exists.
People screenshot it and thank you.

**Follow a friend's trip** is the engine. Polarsteps went from 10M to over 18M
users in about a year on this mechanic, and the detail worth reading twice is
that users invite **four or five close people**, and those followers return
repeatedly whether or not they are travelling themselves. One traveller generates
five retained non travellers. The retention mechanic and the growth mechanic are
the same feature.

**Trip timeline from email** is dramatically easier now than when TripIt built
it. An LLM parses a messy confirmation email reliably where fifteen years of
regex could not.

### Build second

| # | Surface | Ratio | Note |
|---|---|---|---|
| 6 | Visa and entry requirement checker | 20 | build is easy, maintenance is the work |
| 7 | "Where can I actually go" engine | 16 | the Dreaming state tool nobody serves |
| 8 | Flight tracking and disruption alerts | 15 | needs a paid feed, cheap tier is fine |
| 9 | Programmatic destination guides | 15 | acquisition disguised as a feature |
| 10 | Offline destination pack | 14 | useful exactly when data has run out |

### Later

Auto generated trip journal (11.7, and it is the compounding memory asset),
points tracker (11), compensation claim filing (9.2, highest revenue per user in
travel, start as an AirHelp referral), expense splitter (9), insurance (8.75),
airport intelligence (8).

### Do not build

* **Flight and hotel booking.** Ratio 6. This is where founders go to die.
  Trip.com has twenty years, thousands of engineers and direct supply contracts.
  Refer out, take the affiliate cut, own the layer above.
* **Offline translation.** Google Translate is free, excellent and offline. Deep
  link to it.
* **A public social feed of strangers.** Instagram exists. The Polarsteps insight
  is that the value is in close connections, and a public feed actively destroys
  the thing that makes following work.

---

## 4. Where AI is a moat rather than a chatbot

The test is simple: **does the automation consume a proprietary input?**

**Destination content with a proprietary ingredient.** Everybody can generate
pages from Wikivoyage, and Google is increasingly hostile to exactly that. What
nobody else can write is "travellers spend a median of two hours here and most
arrive between 4pm and 6pm", derived from real device presence. That fact exists
only in our database. It makes the pages factually unique, which is the only
durable defence in programmatic SEO, and it improves automatically as we grow.

**Itineraries grounded in movement, not reviews.** Every AI itinerary tool
generates the TripAdvisor top ten in a random order with impossible travel times,
because it is trained on reviews and blog posts. Reviews measure what people
write about. Our data measures what people do. Those differ enormously and ours
is the more useful signal. This is the most defensible AI feature available.

**Traveller archetype inference.** Countries, dwell times, data volumes, plan
sizes. Over a few trips this becomes the richest travel profile in the market and
it is built passively. Trip.com knows what you booked through Trip.com. We know
the actual shape of your travel life, including everything you booked elsewhere.

**Honest sizing advice.** "People on your kind of trip to Japan use about 4GB, do
not buy 20." Moderately copyable in theory, uncopyable in practice, because
Airalo will never tell you to buy less than you were about to. A positioning
weapon disguised as an algorithm.

**Support deflection with device diagnostics.** eSIM support is dominated by
activation failures, and they are miserable, repetitive and device specific. An
LLM that can see actual device state at ticket time resolves most of them
automatically. **This is the automation that decides whether one person can run
this business at 100,000 users.** Build it before you need it.

---

## 5. Ten mechanics that keep the app alive

An app feels dead when nothing has changed since you last opened it. That is the
whole definition. The fix is not more features, it is making sure that on any
random Tuesday there is something in the app that was not there yesterday and
that nobody put there by hand.

| Mechanic | Cost | Why it works |
|---|---|---|
| Someone you love is somewhere right now | cheap | content that generates itself, and it is also the growth channel |
| This day, one year ago | very cheap | we already have it from attachment logs, no photo permission needed |
| Passport and visa watchdog | very cheap | the most legitimate notification a travel app can send |
| One destination card a day | cheap | serves the Dreaming state, one card to consider rather than a feed to scroll |
| A streak that measures travel, not attendance | cheap | countries and days abroad, verified by the network so the number is true |
| Live data balance on the home screen | cheap | a widget means we are visible without being opened |
| The friends abroad board | cheap | updates by itself, faintly addictive, people show it to other people |
| Weekly deal digest from your home airport | medium | a weekly touch during Dreaming, converts to affiliate |
| Earn data by helping travellers | medium | makes the app a place with people in it rather than a database |
| Your Year in Travel, printed | medium | Spotify Wrapped is the most effective annual retention event in software, and Polarsteps proved travellers pay for the physical object |

Do not build a daily login streak. It is transparently cynical and it insults the
user. Build countries visited and days abroad, verified automatically, so the
number is earned rather than self reported. Duolingo's numbers say make it
social: a third of their daily actives are on a Friend Streak and that social
variant drove DAU over MAU to 34.7%.

**The principle underneath all ten: every mechanic changes without the founder
doing anything. An app dies when its content has a human bottleneck.**

---

## 6. Position

Three candidates were tested.

**"Watch an ad, get data anywhere in the world, free."** Rejected. It positions
us as a cheaper Airalo, which is a fight on their terms, on price, against a
company with 30 million users and far better wholesale rates. Never take a
position a larger competitor can copy with a spreadsheet change.

**"The only travel app worth keeping when you are not travelling."** Strategically
the truest sentence of the three, and it answers the boredom worry head on. But
it is aimed at investors, not travellers. Nobody wakes up wanting an app that
persists.

**"Bilby is the travel app that switches on the moment you land."** This is the
pick, for three reasons.

* **It is structurally uncopyable.** Airalo could give away free data tomorrow.
  Trip.com could build every feature in section 3 within a quarter. Neither can
  be the connection at the moment of arrival without becoming a different
  company.
* **It is an event, not a state.** "Switches on when you land" implies motion and
  timing. It is the opposite of a dead static app, in the positioning itself.
* **It earns the right to everything else.** Be genuinely brilliant in the first
  hour on the ground and the user grants permission for all of section 5. You
  cannot lead with "keep me between trips" because nobody wants that.

**Position on the moment, retain on the relationship.** Lead externally with
arrival. Keep "the only one worth keeping" as the internal strategy on the wall.

---

## 7. Build order

1. **Arrival Autopilot.** The positioning made real, and mostly one well designed
   screen fired by an event we already detect.
2. **Document watchdog, packing checklist, currency tracker.** Three weekends,
   and they turn a single purpose utility into an app with reasons to exist.
3. **Follow a friend's trip.** The retention and growth engine. Nothing else on
   the list comes close.
4. **Support deflection automation.** Build it before you need it, because it
   decides whether one person can run this.
5. **Megabytes as reward currency.** Then the content flywheel turns on its own.

The biggest risk is not that the app is boring. It is building outward into
features before building the one mechanic that brings people back when they are
not travelling. **Hopper had $850M of revenue and still lost ten million users in
a year.** Do not repeat that order of operations.

---

### Sources

Business of Apps (travel retention benchmarks, Hopper revenue and user figures),
UXCam (cross industry retention), Duolingo Q4 and FY2024 shareholder letter
(DAU/MAU, streaks), Startuprad.io (Polarsteps growth and monetisation interview),
Airalo (30 million user milestone), AirHelp (EU261 values and claim economics),
Flighty and TechCrunch (Live Activities engagement), Trip.com (Trip Coins).
