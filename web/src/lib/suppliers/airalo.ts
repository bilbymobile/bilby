import {
  CatalogPlan,
  InsufficientSupplierBalance,
  OrderResult,
  Supplier,
  UsageSnapshot,
} from "./types";

/**
 * Airalo Partner API adapter.
 *
 * Airalo is the right FIRST supplier and the wrong LAST one, and it is worth
 * being clear about why before you wire it up.
 *
 * Right first: onboarding is €0 setup / €0 monthly, the catalogue is 900+
 * packages across 200+ destinations, there is a real sandbox, and the brand is
 * strong enough that your own support burden drops.
 *
 * Wrong last: Airalo enforces a MINIMUM SELLING PRICE equal to Airalo's own
 * retail price. You are contractually forbidden from undercutting the company
 * you are reselling. That is fine for a bundle-resale business and fatal for an
 * ad-funded free tier, because "free" is definitionally below their floor.
 *
 * So the architecture is: Airalo powers the PAID catalogue on day one while you
 * have no wallet and no volume, and a micro-top-up-capable supplier powers the
 * FREE tier. `supportsMicroTopUp = false` here is what makes the router refuse
 * to fund ad grants from this supplier. Do not "fix" that flag.
 *
 * Docs: https://developers.partners.airalo.com/
 */

const BASE = process.env.AIRALO_BASE_URL ?? "https://sandbox-partners-api.airalo.com/v2";

interface TokenCache {
  token: string;
  expiresAt: number;
}
let tokenCache: TokenCache | null = null;

async function accessToken(): Promise<string> {
  if (tokenCache && tokenCache.expiresAt > Date.now() + 60_000) {
    return tokenCache.token;
  }
  const clientId = requiredEnv("AIRALO_CLIENT_ID");
  const clientSecret = requiredEnv("AIRALO_CLIENT_SECRET");

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "client_credentials",
  });

  const res = await fetch(`${BASE}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body,
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Airalo token request failed: ${res.status} ${await res.text()}`);

  const json = (await res.json()) as { data: { access_token: string; expires_in: number } };
  tokenCache = {
    token: json.data.access_token,
    expiresAt: Date.now() + json.data.expires_in * 1000,
  };
  return tokenCache.token;
}

async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await accessToken();
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });

  // 402 is the wallet-empty signal. It must not surface as a generic 500,
  // because the operational response is completely different: top up, don't debug.
  if (res.status === 402) throw new InsufficientSupplierBalance("airalo");
  if (!res.ok) throw new Error(`Airalo ${path} failed: ${res.status} ${await res.text()}`);
  return (await res.json()) as T;
}

export class AiraloSupplier implements Supplier {
  readonly id = "airalo";
  readonly displayName = "Airalo Partners";
  /**
   * Airalo publishes no setup or monthly fee. It does run on a prepaid balance,
   * so treat this as "fund it before you need it" rather than "zero".
   */
  readonly minimumWalletUsd = 0;
  /** See the class doc: minimum-selling-price rules make free grants impossible. */
  readonly supportsMicroTopUp = false;

  async listPlans(opts?: { country?: string }): Promise<CatalogPlan[]> {
    const qs = new URLSearchParams({ "filter[type]": "sim", limit: "200" });
    if (opts?.country) qs.set("filter[country]", opts.country.toUpperCase());

    const json = await api<{ data: AiraloPackageCountry[] }>(`/packages?${qs}`);

    const out: CatalogPlan[] = [];
    for (const country of json.data ?? []) {
      for (const op of country.operators ?? []) {
        for (const pkg of op.packages ?? []) {
          out.push({
            planId: pkg.id,
            name: `${country.title} · ${pkg.title}`,
            countries: (op.countries ?? [{ country_code: country.country_code }]).map(
              (c) => c.country_code
            ),
            dataMb: pkg.amount ?? 0,
            validityDays: pkg.day ?? 0,
            // `net_price` is what you pay; `price` is Airalo's retail, which is
            // simultaneously your minimum legal selling price.
            wholesaleUsd: Number(pkg.net_price ?? pkg.price ?? 0),
            minSellUsd: Number(pkg.price ?? 0),
            topUpSupported: true,
          });
        }
      }
    }
    return out;
  }

  async order(planId: string, ref: string): Promise<OrderResult> {
    const body = new URLSearchParams({
      package_id: planId,
      quantity: "1",
      type: "sim",
      description: ref,
    });
    const json = await api<{ data: AiraloOrder }>("/orders", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });

    const sim = json.data.sims?.[0];
    if (!sim) throw new Error("Airalo order returned no SIM");

    const { smdp, matchingId } = splitLpa(sim.lpa, sim.matching_id, sim.qrcode);

    return {
      supplierOrderId: String(json.data.id),
      planId,
      costUsd: Number(json.data.price ?? 0),
      profile: {
        iccid: sim.iccid,
        smdpAddress: smdp,
        matchingId,
        activationCode: `LPA:1$${smdp}$${matchingId}`,
        qrCodeUrl: sim.qrcode_url,
        confirmationCode: sim.confirmation_code ?? undefined,
      },
    };
  }

  async topUp(iccid: string, planId: string, ref: string) {
    const body = new URLSearchParams({
      package_id: planId,
      iccid,
      description: ref,
    });
    const json = await api<{ data: { price?: number } }>("/orders/topups", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    return { costUsd: Number(json.data.price ?? 0) };
  }

  async usage(iccid: string): Promise<UsageSnapshot> {
    const json = await api<{ data: AiraloUsage }>(`/sims/${iccid}/usage`);
    const d = json.data;
    return {
      iccid,
      totalMb: d.total ?? 0,
      usedMb: (d.total ?? 0) - (d.remaining ?? 0),
      remainingMb: d.remaining ?? 0,
      expiresAt: d.expired_at ?? null,
      status: mapStatus(d.status, d.remaining ?? 0),
    };
  }

  async balanceUsd(): Promise<number> {
    // Airalo exposes balance on the partner platform rather than a documented
    // public endpoint. Until you confirm one with partner.support@airalo.com,
    // treat balance as unknown rather than inventing a number the ops dashboard
    // would then trust.
    return Number.NaN;
  }
}

function mapStatus(s: string | undefined, remaining: number): UsageSnapshot["status"] {
  switch ((s ?? "").toUpperCase()) {
    case "NOT_ACTIVE":
      return "not_installed";
    case "ACTIVE":
      return remaining > 0 ? "active" : "depleted";
    case "FINISHED":
      return "depleted";
    case "EXPIRED":
      return "expired";
    default:
      return "installed";
  }
}

/**
 * Airalo returns the activation material in more than one shape depending on
 * package and account age: sometimes a full `lpa` string, sometimes a bare
 * SM-DP+ host plus `matching_id`, sometimes only a `qrcode` payload that itself
 * contains the LPA string. Normalise all three here so nothing downstream has
 * to care.
 */
function splitLpa(
  lpa: string | undefined,
  matchingId: string | undefined,
  qrcode: string | undefined
): { smdp: string; matchingId: string } {
  const candidate = lpa ?? qrcode ?? "";
  const m = candidate.match(/^LPA:1\$([^$]+)\$([^$]+)/i);
  if (m) return { smdp: m[1], matchingId: m[2] };
  if (lpa && matchingId) return { smdp: lpa, matchingId };
  throw new Error("Could not derive LPA activation code from Airalo response");
}

function requiredEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var ${name}`);
  return v;
}

interface AiraloPackageCountry {
  title: string;
  country_code: string;
  operators?: Array<{
    countries?: Array<{ country_code: string }>;
    packages?: Array<{
      id: string;
      title: string;
      amount?: number;
      day?: number;
      price?: number;
      net_price?: number;
    }>;
  }>;
}

interface AiraloOrder {
  id: number | string;
  price?: number;
  sims?: Array<{
    iccid: string;
    lpa?: string;
    matching_id?: string;
    qrcode?: string;
    qrcode_url?: string;
    confirmation_code?: string | null;
  }>;
}

interface AiraloUsage {
  total?: number;
  remaining?: number;
  expired_at?: string | null;
  status?: string;
}
