import Link from "next/link";
import { currentUser } from "@/lib/session";
import { listCatalog } from "@/lib/platform";
import { DESTINATIONS, destinationName } from "@/lib/destinations";

export const dynamic = "force-dynamic";

/**
 * The shop.
 *
 * Reads the catalogue, not a supplier. The previous version called
 * `listPlans()` on every render and priced the result on the fly from wholesale
 * times a margin constant, which had three problems: the price could move
 * between this page and checkout, there was no stable identifier to write onto
 * an order, and a supplier outage took the shop down. A catalogue row is a
 * decision somebody made and it stays made until somebody changes it.
 *
 * Prices are in Australian dollars, GST inclusive, because that is what an
 * Australian consumer is entitled to see. Presentment in another currency is
 * Stripe's job at checkout and does not change what is printed here.
 */
export default async function PlansPage({
  searchParams,
}: {
  searchParams: Promise<{ country?: string }>;
}) {
  const { country } = await searchParams;
  const user = await currentUser();
  const iso = (country ?? user.destination ?? "JP").toUpperCase();

  const items = await listCatalog("esim", "AUD", { attribute: ["country", iso] });

  return (
    <>
      <section className="hero">
        <h1>Plans</h1>
        <p>
          Full speed, hotspot included, no contract. Pick the days you are
          actually away rather than a month you will not use.
        </p>
      </section>

      <div className="card">
        <h2>Destination</h2>
        <p className="sub">Showing {destinationName(iso)}.</p>
        <div className="row">
          {DESTINATIONS.map((d) => (
            <a
              key={d.iso}
              className={`btn ${d.iso === iso ? "" : "ghost"}`}
              href={`/plans?country=${d.iso}`}
            >
              {d.flag} {d.iso}
            </a>
          ))}
        </div>
      </div>

      <div className="card">
        {items.length === 0 ? (
          <>
            <h2>Nothing on sale for {destinationName(iso)} yet</h2>
            <p className="sub" style={{ margin: 0 }}>
              The catalogue is seeded but every item starts inactive, and an
              inactive item is not for sale. Activate the ones you have checked
              on a handset from the staff console. Nothing here is a fallback to
              a live supplier lookup on purpose: a shop that invents a price
              when the catalogue is empty is a shop that will one day sell at a
              loss.
            </p>
          </>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Plan</th>
                <th className="num">Data</th>
                <th className="num">Days</th>
                <th className="num">Price</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {items.map((p) => {
                const mb = Number(p.attributes.dataMb ?? 0);
                const days = Number(p.attributes.days ?? 0);
                return (
                  <tr key={p.sku}>
                    <td>
                      {p.title}
                      {p.subtitle ? (
                        <div style={{ color: "var(--muted)", fontSize: ".86em" }}>
                          {p.subtitle}
                        </div>
                      ) : null}
                    </td>
                    <td className="num">
                      {mb >= 1024 ? `${(mb / 1024).toFixed(mb % 1024 ? 1 : 0)} GB` : `${mb} MB`}
                    </td>
                    <td className="num">{days || "—"}</td>
                    <td className="num">
                      <strong>${p.sellAmount.toFixed(2)}</strong>
                    </td>
                    <td className="num">
                      <Link className="btn" href={`/checkout?sku=${encodeURIComponent(p.sku)}`}>
                        Buy
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <h2>Where payment happens</h2>
        <p className="sub" style={{ marginBottom: 0 }}>
          Google Play&apos;s Payments policy exempts purchases consumed outside a
          Play distributed app, and mobile connectivity is consumed by the
          handset&apos;s modem rather than inside this app, which is the basis on
          which eSIM apps take card payments directly. It is an interpretation,
          not a written carve out for eSIMs, so checkout stays on the web, the
          app links to it rather than embedding it, and no app feature is ever
          gated behind the purchase. That last part is what would turn a data
          plan into an in app digital good.
        </p>
      </div>
    </>
  );
}
