/**
 * Hostnames.
 *
 * Five names across two registrable domains, one deployment, and the split
 * between those two domains is a security boundary rather than a preference.
 *
 * ## The apex is one constant
 *
 * Everything customer facing hangs off [APEX]. Change that one string and the
 * marketing site, the web app, the API origin and the status page all follow,
 * because nothing anywhere else in this codebase writes a hostname as a
 * literal. If a string in this repo contains a domain and did not come from
 * here, it is a bug waiting for the day one of these moves.
 *
 * The apex is `bilbymobile.com` and that is settled. It is the brand, the name
 * on the Play listing and the name a person says out loud, so nothing here is
 * waiting on a domain acquisition. The environment override stays because the
 * Android binary pins its API origin at build time and a name that can only be
 * changed by editing source is a name that cannot be changed at all.
 *
 * ## `marketing` — the apex, and the canonical
 *
 * `app-ads.txt` has to sit at the root of whatever URL the Play listing
 * declares as the developer website, and it has to be reachable there without a
 * redirect. The IAB spec tolerates one hop and AdMob usually follows it, but
 * when the crawl fails the console does not tell you why: the app simply stays
 * in limited serving and the eCPM stays depressed. So the apex serves directly
 * and www redirects to it rather than the other way round.
 *
 * The apex is also the name a person says out loud, which is the other half of
 * why marketing lives here and the product does not.
 *
 * ## `app` — the browser product
 *
 * Serves its own `/api/*` routes on its own origin, so the customer session is
 * an ordinary first party cookie. No CORS preflights, no `SameSite=None`, no
 * partitioned cookie work when browsers tighten third party rules again. That
 * is an entire category of bug that never has to be owned.
 *
 * ## `api` — the origin compiled into the mobile binaries
 *
 * A published Android build carries its API origin as a string in every
 * installed copy, and Android users update slowly, so whatever hostname ships
 * is a hostname that must answer for years. The iOS build will inherit the same
 * name. Pinning the binaries to a name that serves nothing but the API means
 * the marketing site can be rebuilt on anything and the web app can move hosts
 * without stranding an install.
 *
 * This origin is token authenticated and sets no cookies. That is not an
 * implementation detail, it is what keeps the mobile surface immune to CSRF.
 *
 * ## `status` — the incident page
 *
 * Deliberately the one name that is not part of the main deployment. A status
 * page that goes down with the thing it reports on is worse than no status page
 * at all, because the silence gets read as indifference.
 *
 * ## `admin` — staff only, and on the corporate domain on purpose
 *
 * The admin console lives at `bilbymobile.nextwave.au`, a different **registrable**
 * domain from everything customers touch. That is the entire point. Cookies
 * cannot cross a registrable domain boundary, so a cross site scripting bug in
 * the customer web app has no path to a staff session, and a stolen customer
 * session is worthless against operations, costing or refunds. The cost is that
 * staff auth is its own system on its own origin rather than a role flag on the
 * customer session, and that cost is worth paying.
 *
 * Nothing customer facing is ever served from this host, and nothing on this
 * host is ever reachable without a staff session. Both halves are enforced in
 * middleware and both fail closed.
 */

/** The customer brand apex. One string, everything follows. */
const APEX = process.env.NEXT_PUBLIC_APEX ?? "bilbymobile.com";

/** The corporate domain. Staff surfaces only, never a customer one. */
const CORP = process.env.NEXT_PUBLIC_CORP_APEX ?? "nextwave.au";

/**
 * The brand label used to name the staff console under [CORP].
 *
 * Derived deliberately rather than written twice: the console is the admin face
 * of this brand, so if the brand is ever renamed the console follows in the
 * same edit instead of being found six months later still called something
 * nobody recognises.
 */
const BRAND_LABEL = APEX.split(".")[0];

export const HOSTS = {
  /** Apex. Marketing, legal pages, app-ads.txt. Canonical for search. */
  marketing: APEX,

  /** The browser product and the API it calls same origin. */
  app: `app.${APEX}`,

  /** The API origin the mobile binaries are pinned to. Never retire this name. */
  api: `api.${APEX}`,

  /** Incident and network status. Hosted apart from everything else. */
  status: `status.${APEX}`,

  /** Staff console. Separate registrable domain, separate session, fail closed. */
  admin: `${BRAND_LABEL}.${CORP}`,
} as const;

export type HostRole = keyof typeof HOSTS;

/** `https://bilbymobile.com/privacy` from `("marketing", "/privacy")`. */
export function url(role: HostRole, path = "/"): string {
  return `https://${HOSTS[role]}${path.startsWith("/") ? path : `/${path}`}`;
}

/**
 * Which role is serving this request?
 *
 * Preview deployments arrive on `*.vercel.app` and local work on `localhost`,
 * neither of which is any of the five. Both answer `app`, because a preview is
 * a preview of the product, and because guessing `marketing` would make a
 * preview quietly emit canonical tags pointing at production.
 *
 * The admin host is matched first and exactly. It must never be reachable by
 * fallback, and a preview must never resolve to it, because the difference
 * between those two answers is the difference between a staff console and a
 * public one.
 */
export function roleForHost(host: string | null | undefined): HostRole {
  const h = (host ?? "").toLowerCase().split(":")[0];
  if (h === HOSTS.admin) return "admin";
  if (h === HOSTS.marketing || h === `www.${HOSTS.marketing}`) return "marketing";
  if (h === HOSTS.api) return "api";
  if (h === HOSTS.status) return "status";
  return "app";
}

/** True when this request arrived on the staff console host. */
export function isAdminHost(host: string | null | undefined): boolean {
  return roleForHost(host) === "admin";
}
