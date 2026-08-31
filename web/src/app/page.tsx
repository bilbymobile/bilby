"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { adEnvironment, awaitCredit, showRewardedAd } from "@/lib/ads";
import { brand } from "@/lib/brand";

interface Me {
  country: string;
  balanceMb: number;
  mbPerAd: number;
  adsWatchedToday: number;
  dailyAdCap: number;
  adsRemainingToday: number;
  redemptionThresholdMb: number;
  canRedeem: boolean;
  freeTierAvailable: boolean;
  budgetExhausted: boolean;
  ssvUserId: string;
}

export default function EarnPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "bad" | "warn"; text: string } | null>(null);

  const load = useCallback(async () => {
    const r = await fetch("/api/me", { cache: "no-store" });
    setMe(await r.json());
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  /**
   * Show an ad, then WAIT for the server to be told about it.
   *
   * The client never credits anything. It asks for an ad; Google's servers
   * independently call our SSV endpoint; we poll until the balance moves. The
   * polling is not decoration — the callback lands after the ad closes, so
   * without it the user sees a finished ad and a static balance and concludes
   * they were cheated.
   */
  async function watchAd() {
    if (!me) return;
    setBusy(true);
    setMsg(null);
    try {
      const before = me.balanceMb;
      const outcome = await showRewardedAd(me.ssvUserId);

      if (!outcome.completed) {
        setMsg({
          kind: outcome.reason === "unsupported" ? "warn" : "bad",
          text: outcome.message ?? "The ad didn't finish, so nothing was credited.",
        });
        return;
      }

      setMsg({ kind: "warn", text: "Confirming with the ad network…" });
      const { credited, balanceMb } = await awaitCredit(before);

      setMsg(
        credited
          ? { kind: "ok", text: `+${balanceMb - before} MB credited.` }
          : {
              kind: "warn",
              text:
                "The ad network hasn't confirmed yet. This usually lands within a minute, and your balance will update on its own.",
            }
      );
    } catch (e) {
      setMsg({ kind: "bad", text: (e as Error).message });
    } finally {
      await load();
      setBusy(false);
    }
  }

  async function redeem() {
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch("/api/redeem", { method: "POST" });
      const j = await r.json();
      if (j.ok) {
        setMsg({
          kind: "ok",
          text: j.isNewProfile
            ? `${j.redeemedMb} MB loaded onto a new eSIM. Install it from My eSIMs.`
            : `${j.redeemedMb} MB added to your existing eSIM, nothing to reinstall.`,
        });
      } else {
        setMsg({ kind: "bad", text: explain(j.reason) });
      }
      await load();
    } finally {
      setBusy(false);
    }
  }

  if (!me) return <p style={{ color: "var(--muted)" }}>Loading…</p>;

  const pct = Math.min(100, (me.balanceMb / me.redemptionThresholdMb) * 100);
  const env = adEnvironment();

  return (
    <>
      <section className="hero">
        <h1>{brand.tagline} Free data, anywhere you go.</h1>
        <p>
          Install one eSIM, once. Watch a short ad, get data credited straight to
          it. Pay only on the days you actually want full speed. Nothing else,
          ever.
        </p>
      </section>

      <div className="grid two">
        <div className="card">
          <h2>Your data balance</h2>
          <p className="sub">
            Detected region <strong>{me.country}</strong> · each ad is worth{" "}
            <strong>{me.mbPerAd} MB</strong> here
          </p>

          <div className="balance">
            <span className="n">{me.balanceMb}</span>
            <span className="u">MB</span>
          </div>

          <div className="meter">
            <i style={{ width: `${pct}%` }} />
          </div>
          <p className="sub" style={{ margin: 0, fontSize: 13 }}>
            {me.canRedeem
              ? "Ready to load onto your eSIM."
              : `${me.redemptionThresholdMb - me.balanceMb} MB to go before you can load it onto an eSIM.`}
          </p>

          <div className="stat-row">
            <div className="stat">
              <span className="k">Ads left today</span>
              <span className="v">
                {me.adsRemainingToday}
                <span style={{ color: "var(--muted)", fontSize: 14 }}>/{me.dailyAdCap}</span>
              </span>
            </div>
            <div className="stat">
              <span className="k">Per ad</span>
              <span className="v">{me.mbPerAd} MB</span>
            </div>
            <div className="stat">
              <span className="k">Max today</span>
              <span className="v">{me.mbPerAd * me.dailyAdCap} MB</span>
            </div>
          </div>

          <div className="row" style={{ marginTop: 20 }}>
            <button onClick={watchAd} disabled={busy || me.adsRemainingToday === 0 || !me.freeTierAvailable}>
              {me.adsRemainingToday === 0 ? "Back tomorrow" : "Watch ad · earn data"}
            </button>
            <button className="ghost" onClick={redeem} disabled={busy || !me.canRedeem}>
              Load onto eSIM
            </button>
          </div>

          {msg && <div className={`note ${msg.kind === "ok" ? "ok" : msg.kind === "bad" ? "bad" : ""}`}>{msg.text}</div>}

          {env === "web" && (
            <div className="note">
              Rewarded ads run in the Android app, because mobile browsers have no
              rewarded ad inventory. You can still browse and buy plans here.
            </div>
          )}
          {env === "dev" && (
            <div className="note">
              Development build: ads are simulated locally. Real builds show an
              AdMob rewarded ad and credit via server-side verification.
            </div>
          )}

          {me.budgetExhausted && (
            <div className="note">
              Today&apos;s free-data pool is fully allocated. Ads will credit again
              from 00:00 UTC. Paid plans are unaffected.
            </div>
          )}

          {!me.freeTierAvailable && !me.budgetExhausted && (
            <div className="note">
              Free data isn&apos;t offered in {me.country}, because wholesale rates here
              cost more than an ad view earns, and we&apos;d rather say so than
              quietly hand you 2 MB. <Link href="/plans">Paid plans</Link> work
              normally.
            </div>
          )}
        </div>

        <div className="card">
          <h2>Why the number moves</h2>
          <p className="sub">
            Most free-eSIM apps grant a flat 20 MB per ad everywhere. That
            silently loses money in expensive regions and leaves money on the
            table in cheap ones.
          </p>
          <p className="sub">
            We price every grant against two live numbers: what a rewarded ad
            actually earns in your market, and what a megabyte actually costs us
            there. You get more data in Bangkok than in Suva because that is
            genuinely what the economics support.
          </p>
          <div className="note ok">
            Every grant is contribution-positive by construction. That is what
            lets the free tier survive a growth spike instead of being switched
            off the week it works.
          </div>
          <p className="sub" style={{ marginTop: 18, marginBottom: 0 }}>
            <Link href="/ops">See the live economics →</Link>
          </p>
        </div>
      </div>
    </>
  );
}

function explain(reason?: string) {
  switch (reason) {
    case "daily_cap":
      return "You've hit today's ad limit. It resets at 00:00 UTC.";
    case "budget_exhausted":
      return "Today's free-data pool is fully allocated. Try again tomorrow.";
    case "duplicate":
      return "That ad view was already credited.";
    case "region_blocked":
      return "Free data isn't available in your current region.";
    case "below_threshold":
      return "Earn a little more before loading it onto an eSIM.";
    case "temporarily_unavailable":
      return "We can't provision right now. Your credits are safe, so try again shortly.";
    case "no_fundable_plan":
      return "No data packet small enough to match your balance. Earn a bit more.";
    default:
      return "Something went wrong. Your balance is unchanged.";
  }
}
