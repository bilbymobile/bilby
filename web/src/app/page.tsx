import Link from "next/link";
import { currentUser, effectiveDestination } from "@/lib/session";
import { entitlementsFor } from "@/lib/platform";
import { DESTINATIONS, destinationName } from "@/lib/destinations";
import { brand } from "@/lib/brand";

export const dynamic = "force-dynamic";

/**
 * The product home, on the app host.
 *
 * This was the earn screen: watch an ad, accrue megabytes, redeem them onto a
 * profile. That whole tier is gone. What replaces it is not a smaller version
 * of the same idea, it is a different first question. The old page asked "how
 * much have you earned"; this one asks "where are you going", because that is
 * the only thing we need from someone before we can sell them anything.
 *
 * Deliberately server rendered with no client state. There is nothing here to
 * poll and nothing to keep in sync, which is what the earn screen's polling
 * loop existed for.
 */
export default async function HomePage() {
  const user = await currentUser();
  const dest = effectiveDestination(user);
  const ents = await entitlementsFor(user.id);

  const live = ents.filter((e) => e.status === "active" || e.status === "issued");

  return (
    <>
      <section className="hero">
        <h1>Data for where you are going</h1>
        <p>
          {brand.name} sells one thing today: a data plan you install before you
          fly and that works the moment you land. Pick the country, pick the
          days, pay once.
        </p>
      </section>

      {user.destination === null ? (
        <div className="card">
          <h2>Where are you going?</h2>
          <p className="sub">
            This sets what we show you. You can change it any time and it is not
            a booking.
          </p>
          <div className="row">
            {DESTINATIONS.map((d) => (
              <Link key={d.iso} className="btn ghost" href={`/plans?country=${d.iso}`}>
                {d.flag} {d.name}
              </Link>
            ))}
          </div>
        </div>
      ) : (
        <div className="card">
          <h2>{destinationName(dest)}</h2>
          <p className="sub">
            Your saved destination. Change it from the plans page whenever the
            trip changes.
          </p>
          <div className="row">
            <Link className="btn" href={`/plans?country=${dest}`}>
              See plans for {destinationName(dest)}
            </Link>
            <Link className="btn ghost" href="/plans">
              Somewhere else
            </Link>
          </div>
        </div>
      )}

      <div className="card">
        <h2>Your plans</h2>
        {live.length === 0 ? (
          <p className="sub" style={{ margin: 0 }}>
            Nothing yet. Anything you buy appears here with its install
            instructions, and stays here after the trip so you have the receipt.
          </p>
        ) : (
          <>
            <p className="sub">
              {live.length === 1 ? "One plan" : `${live.length} plans`} on this
              account.
            </p>
            <div className="row">
              <Link className="btn" href="/esims">
                Open and install
              </Link>
            </div>
          </>
        )}
      </div>
    </>
  );
}
