# eSIM Access, as observed

Read from the partner console on **5 September 2026**. Nothing here is from
marketing copy or from a blog; every number came out of the endpoint the
dashboard's own plan table calls.

Account state that day: Naveed Saqib, credit balance **USD 0.00**, no orders.

## The API, as it actually behaves

| | |
|---|---|
| Console endpoint | `POST /allianceApi/v1/manager/hedy/package/list` |
| Auth | a `token` header, plus `RT-EA-CLIENT`. Not a cookie. |
| Money | integers in **ten thousandths of a USD**. `47000` is `USD 4.70`. |
| Stable id | `slug`, e.g. `AU_10_30`. `packageNo` (`JC101`) is their catalogue code. |
| Paging | `pageParam: {pageSize, pageNum}`. **Caps at 1000 rows**, and the token expires between calls, so a long crawl fails partway. |
| Catalogue size | 3046 packages. 104 of them single country across our launch markets. |

Two fields that matter and are easy to miss:

- **`duration`** is days once activated. **`validity`** is how long you have to
  activate at all, and it was 180 on every plan seen.
- **`dataType`** 1 is a fixed bundle, 2 is a daily allowance.
  **`supportTopUpType`** 2 can be topped up in place, 3 is a daily plan.

## The economics, from real numbers

**Their suggested retail is exactly twice wholesale, on every single plan.** Not
approximately: `retailPrice` is `price * 2` throughout. So their whole pricing
model assumes a 50 percent gross margin, and that is the number to start from
rather than the 45 percent constant currently sitting in the code.

Representative wholesale, 5 Sep 2026, single country, in USD:

| Plan | JP | TH | AU | SG | ID | US | VN | CN |
|---|---|---|---|---|---|---|---|---|
| 1 GB / 7 days | 0.70 | 0.70 | 0.70 | 0.55 | 0.70 | 0.90 | 0.85 | 0.70 |
| 3 GB / 15 days | 1.70 | 1.70 | 1.70 | — | 1.70 | 2.20 | 2.26 | 1.90 |
| 5 GB / 30 days | 2.70 | 2.70 | 2.70 | 2.41 | 2.70 | 3.40 | 3.77 | 2.96 |
| 10 GB / 30 days | 4.70 | 4.70 | 4.70 | 4.70 | — | 6.63 | 6.88 | 5.85 |
| 20 GB / 30 days | 8.20 | 8.20 | 8.20 | 8.20 | — | — | 12.63 | 10.25 |

Most of Asia is priced identically. **The United States and Vietnam are the
expensive ones**, and Vietnam 20 GB at 12.63 is half again what Japan costs.

Sanity check against the earlier AI generated proposal, which claimed roughly
USD 9.00 wholesale for a 10 GB Europe regional plan and about 50 percent margin
at USD 20 retail. Europe regional is not in this capture, but a 10 GB single
country plan here is 4.70 to 6.88. That proposal was in the right order of
magnitude and wrong on the specifics, which is exactly why it was marked
unsourced rather than used.

## The finding that is a product decision, not a footnote

There are two versions of many plans, and the cheaper one has a catch.

| Same plan | wholesale |
|---|---|
| `AU_10_30` | **4.70** |
| `AU_10_30_nonhkip` | **8.49** |
| `AU_20_30` | 8.20 |
| `AU_20_30_nonhkip` | 15.84 |

`nonhkip` means no Hong Kong IP. The default plans route the customer's traffic
out through a foreign IP: the sample record for the Australian plan reported
`ipExport: "SG"`.

**That is 80 percent cheaper and it will generate refunds.** A traveller whose
phone appears to be in Singapore hits bank app blocks, streaming that thinks
they are somewhere else, and government services that refuse a foreign address.
Every one of those becomes a support ticket, and under Australian Consumer Law
"it worked, just not for your bank" is not obviously a service that was fit for
purpose.

This is a decision to make deliberately before pricing, not to discover from
tickets. The whole Bilby position is that someone answers when it goes wrong;
choosing the plan that reliably goes wrong to save four dollars would be
choosing against the product.

## Not captured

**GB, IT, AE, NZ and PK.** The list endpoint caps at 1000 rows and its token
expires between calls, so the later pages were unreachable from a crawl. The
console has a CSV export button on the plans page that will produce the lot in
one file. Get those five before pricing them.

Also not established, and all of it belongs in writing from them rather than
from a dashboard:

- **The cancellation window.** Whether an unprovisioned or unactivated profile
  can be handed back, and for how long. This is the single biggest input to net
  margin and nothing on the dashboard answers it.
- Deposit mechanics and behaviour at zero balance. The account is at USD 0.00,
  so nothing can be ordered yet.
- Which SM-DP+ addresses profiles are issued from, and whether they are stable.
- Whether the production API takes an idempotency key on an order.
- Sandbox credentials, and whether sandbox prices match production.
