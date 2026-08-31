import { HOSTS, url } from "./hosts";

/**
 * Brand configuration.
 *
 * Every user-visible name, colour and string lives here so the brand is a
 * one-file change rather than a find-and-replace across forty components.
 * That matters more than it sounds: you will change the name at least once
 * before launch — after a trademark search, after a domain falls through, or
 * simply after saying it out loud to ten people — and a brand baked into
 * JSX is a brand you keep because renaming is too annoying.
 *
 * Change `name`, `domain` and `androidPackage`, re-run `npm run brand:icons`,
 * and the entire product and icon set follow.
 */

export const brand = {
  /** Display name. Appears in the UI, the Play listing, and every email. */
  name: "Bilby",

  /** Lowercase slug for URLs, package names and file names. */
  slug: "bilby",

  /**
   * Primary domain: the apex, which is the marketing face and the canonical
   * name. The product itself is served from `HOSTS.app` and the Android binary
   * talks to `HOSTS.api`. See `lib/hosts.ts` for why those are three names and
   * not one.
   */
  domain: HOSTS.marketing,

  /**
   * Reverse DNS package id. Immutable once published to Play.
   *
   * This MUST equal `applicationId` in `app/android/app/build.gradle.kts` and
   * the package in `MainActivity.kt`. It fed `/.well-known/assetlinks.json`
   * while saying `com.bilbymobile.app` and the app shipped as
   * `com.bilbymobile.bilby`, which is the quietest possible failure: Android
   * fetches the statement list, finds no entry for the installed package,
   * declines to verify the App Link, and every deep link opens the browser
   * instead of the app. Nothing errors. It simply never works.
   */
  androidPackage: "com.bilbymobile.bilby",

  tagline: "Big ears. Free data.",

  /** One-liner for the Play Store short description (80 char limit). */
  shortDescription: "Free data abroad. Watch an ad, get online. Pay only for the days you need speed.",

  /**
   * Voice. Written down because an ad-funded free tier lives or dies on
   * trust — the moment the copy sounds like it is hiding something, users
   * assume the free data is the bait in a trap.
   */
  voice: {
    is: ["plain", "specific", "unhurried", "honest about limits"],
    isNot: ["breathless", "salesy", "emoji-laden", "vague about what free means"],
  },

  colors: {
    bg: "#07090d",
    surface: "#0e1319",
    surface2: "#151c25",
    border: "#1e2833",
    text: "#e8eef5",
    muted: "#8b9aab",
    /** Signal green — reads as "connected", survives on dark and light. */
    accent: "#2ee6a8",
    accentDim: "#10a97a",
    warn: "#ffb347",
    danger: "#ff6b6b",
  },

  support: {
    email: `hello@${HOSTS.marketing}`,

    /**
     * Required by Play, and it must be reachable before you submit. These point
     * at the apex rather than at the app subdomain deliberately: the Play
     * listing, the app-ads.txt crawl and the legal pages should all agree on
     * one hostname, because every mismatch between them is a support ticket or
     * a rejection that arrives without an explanation.
     */
    privacyUrl: url("marketing", "/privacy"),
    termsUrl: url("marketing", "/terms"),
  },
} as const;

export type Brand = typeof brand;
