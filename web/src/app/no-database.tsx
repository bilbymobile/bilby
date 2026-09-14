import { brand } from "@/lib/brand";

/**
 * What the product surface shows when no database is configured.
 *
 * ## Why this is a page rather than an exception
 *
 * Every environment variable on this project is scoped to Production, so a
 * branch preview runs with none of them. The product routes called Postgres on
 * their first line, threw, and served a 500. The reviewer opening a preview URL
 * to look at a redesign saw "This page couldn't load".
 *
 * A 500 there is not wrong about the facts. It is just useless: it does not say
 * which of a dozen things is missing, and it cannot be distinguished from the
 * code being broken. This says exactly what is absent and what to do about it,
 * and it is the same answer whether the cause is a preview with no variables or
 * production with a database that has gone away.
 *
 * ## It never pretends
 *
 * No fake plans, no placeholder balance, no sample order. A page that invents
 * data to avoid an empty state is how a preview convinces somebody that a
 * feature works. This is the product being honest that it cannot answer.
 */
export function NoDatabase({ what }: { what: string }) {
  return (
    <>
      <section className="hero">
        <h1>{what} needs a database</h1>
        <p>
          This deployment has no <code className="inline">DATABASE_URL</code>, so
          there is nothing to read {what.toLowerCase()} from. Nothing is broken
          and nothing has been lost.
        </p>
      </section>

      <div className="card">
        <div className="note">
          <strong>If this is a branch preview.</strong> Every environment
          variable on this project is scoped to Production, so preview
          deployments start with none of them. Give Preview its own{" "}
          <code className="inline">DATABASE_URL</code> pointing at a separate
          database. Do not point it at the production one: preview code writes
          orders.
        </div>
        <p className="sub" style={{ marginTop: 16, marginBottom: 0 }}>
          The marketing pages do not need a database and work here already.
          {" "}
          <a href="/home">The landing page</a>,{" "}
          <a href="/terms">terms</a>, <a href="/privacy">privacy</a> and{" "}
          <a href="/refunds">refunds</a> are all readable on this deployment.
        </p>
      </div>

      <div className="card">
        <h2>If this is production</h2>
        <p className="sub" style={{ margin: 0 }}>
          Then {brand.name} cannot reach its database and no order can be taken
          or fulfilled right now. Check the connection string and the pooler
          before anything else.
        </p>
      </div>
    </>
  );
}
