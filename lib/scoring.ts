/**
 * RFM+ donor reactivation scoring — canonical implementation.
 *
 * Mirrors Spec §6 and the prototype's `scoreAll` (donorluma-app.jsx:506).
 * Used by the client for instant feedback and (re-)applied server-side
 * during persistence so the value in the DB is the authoritative one.
 *
 * Score components (max 100 total):
 *   Recency   ≤ 30   less time since last gift = higher
 *   Frequency ≤ 25   more gifts = higher
 *   Monetary  ≤ 25   higher avg gift = higher
 *   Tenure    ≤ 20   longer giving relationship = higher
 *
 * Tiers:  80+ High | 55+ Medium | 30+ Low | else Cold
 */

export type RawDonorRow = {
  name: string;
  email: string;
  /**
   * Optional contact-completeness fields. Not persisted as columns on
   * Donor today (kept in `enrichmentData` JSON instead), but threaded
   * through the upload pipeline so the engagement scorer can read
   * them. Empty string when the CSV had no matching column.
   */
  phone: string;
  address: string;
  firstGiftDate: Date | null;
  lastGiftDate: Date | null;
  totalGifts: number;
  totalGiven: number;
  largestGift: number;
  donorType: string;
  notes: string;
  /** Original strings preserved for display (e.g. "Jan 2024"). */
  firstGiftRaw: string;
  lastGiftRaw: string;
};

export type ScoredDonor = RawDonorRow & {
  daysSinceLast: number;
  isLapsed: boolean;
  reactivationScore: number;
  tier: "High" | "Medium" | "Low" | "Cold" | "Attendee";
  recencyScore: number;
  frequencyScore: number;
  monetaryScore: number;
  tenureScore: number;
  /**
   * True when the row carries any giving signal at all (last gift date OR
   * non-zero totalGifts/totalGiven). When false, the row is an event
   * attendee or contact-only record — reactivation framing doesn't apply
   * and the AI prompt switches to first-time-conversion mode. The tier
   * collapses to "Attendee" instead of "Cold".
   */
  hasGivingHistory: boolean;
  /** Placeholder enrichment signals — replace with real FEC/intent data later. */
  activeElsewhere: boolean;
  searchIntent: boolean;
};

export const DEFAULT_LAPSED_THRESHOLD_MONTHS = 12;

/**
 * Recency component for the lifetime-only RFM branch (0-50). Banded
 * rather than linear because most CRM-export "Last Donation Date"
 * fields are sparse and the smooth penalty in the standard branch
 * collapses to 0 by ~24 months — too aggressive when monetary is the
 * only other signal we have.
 */
function lifetimeRecencyComponent(daysSinceLast: number): number {
  if (daysSinceLast <= 90) return 50;
  if (daysSinceLast <= 365) return 40;
  if (daysSinceLast <= 730) return 25;
  if (daysSinceLast <= 1095) return 15;
  return 5;
}

/**
 * Monetary component for the lifetime-only RFM branch (0-50). Direct
 * banding on total giving (not avgGift, which is unavailable without
 * gift count). Tuned so a small first-time donor still gets a non-zero
 * monetary signal and major donors near the top of the band.
 */
function lifetimeMonetaryComponent(totalGiven: number): number {
  if (totalGiven >= 25_000) return 50;
  if (totalGiven >= 10_000) return 40;
  if (totalGiven >= 5_000) return 30;
  if (totalGiven >= 1_000) return 20;
  if (totalGiven >= 250) return 10;
  if (totalGiven > 0) return 5;
  return 0;
}

export function scoreReactivation(
  donor: RawDonorRow,
  now: Date,
  thresholdMonths = DEFAULT_LAPSED_THRESHOLD_MONTHS,
): ScoredDonor {
  const cutoff = new Date(now);
  cutoff.setMonth(cutoff.getMonth() - thresholdMonths);

  const ld = donor.lastGiftDate;
  const fd = donor.firstGiftDate;

  const daysSinceLast = ld
    ? Math.floor((now.getTime() - ld.getTime()) / 86_400_000)
    : 9999;
  const tenureDays =
    fd && ld ? Math.floor((ld.getTime() - fd.getTime()) / 86_400_000) : 0;

  const totalGifts = donor.totalGifts || 0;
  const totalGiven = donor.totalGiven || 0;
  const avgGift = totalGifts > 0 ? totalGiven / totalGifts : 0;
  const hasGivingHistory = !!ld || totalGifts > 0 || totalGiven > 0;

  // Lifetime mode handles export shapes where the gift-count column
  // is missing (Salesforce: Total Donations + Last Donation Date;
  // Givebutter: per-donation rows with Amount + Date; manual sheets
  // with just "amount given"). Standard RFM+ degenerates badly here —
  // frequency and avgGift-derived monetary both collapse to 0 — which
  // made entire uploads tier as Cold with scores 0-2.
  //
  // The branch reweights to recency (0-50) + lifetime-monetary (0-50)
  // using totalGiven directly. Either component is 0 when its signal
  // is missing, so a monetary-only row (no lastGiftDate) still scores
  // 5-50 based on size, and a recency-only row (no totalGiven) still
  // scores 5-50 based on freshness.
  const isLifetimeMode = totalGifts === 0 && (!!ld || totalGiven > 0);

  let recency: number;
  let frequency: number;
  let monetary: number;
  let tenure: number;

  if (isLifetimeMode) {
    recency = ld ? lifetimeRecencyComponent(daysSinceLast) : 0;
    frequency = 0;
    monetary = lifetimeMonetaryComponent(totalGiven);
    tenure = 0;
  } else {
    recency = Math.max(0, 30 - (daysSinceLast / 30) * 1.5);
    frequency = Math.min(25, totalGifts * 2.5);
    monetary = Math.min(25, (avgGift / 200) * 2.5);
    tenure = Math.min(20, (tenureDays / 365) * 4);
  }

  const score = hasGivingHistory
    ? Math.round(
        Math.min(100, Math.max(0, recency + frequency + monetary + tenure)),
      )
    : 0;

  // Attendees (no giving signal at all) skip the High/Medium/Low/Cold
  // ladder — those tiers are reactivation-priority bands and don't
  // apply to first-time-conversion candidates.
  const tier: ScoredDonor["tier"] = !hasGivingHistory
    ? "Attendee"
    : score >= 80
      ? "High"
      : score >= 55
        ? "Medium"
        : score >= 30
          ? "Low"
          : "Cold";

  return {
    ...donor,
    isLapsed: !!ld && ld < cutoff,
    daysSinceLast,
    reactivationScore: score,
    tier,
    hasGivingHistory,
    recencyScore: Math.round(recency),
    frequencyScore: Math.round(frequency),
    monetaryScore: Math.round(monetary),
    tenureScore: Math.round(tenure),
    activeElsewhere: score > 50 ? Math.random() > 0.3 : Math.random() > 0.6,
    searchIntent: score > 60 ? Math.random() > 0.4 : Math.random() > 0.8,
  };
}

export function scoreAll(
  donors: RawDonorRow[],
  now: Date,
  thresholdMonths = DEFAULT_LAPSED_THRESHOLD_MONTHS,
): ScoredDonor[] {
  return donors.map((d) => scoreReactivation(d, now, thresholdMonths));
}

// ─── Attendee engagement scoring ─────────────────────────────────────

/**
 * 0–100 engagement score for contacts WITHOUT recorded giving — the
 * parallel to RFM+ for attendees. Answers "who on this list is most
 * likely to become a first-time donor?" so fundraisers know which
 * names to call first.
 *
 * Component caps (sum to 100):
 *   • Frequency  (0–40) — 10 points per distinct event year, capped at 4 years.
 *   • Recency    (0–30) — current year 30, 1y ago 25, 2y ago 15, 3y 5, older 0.
 *   • Consistency(0–15) — longest streak of consecutive years × 5, capped.
 *   • Contact    (0–15) — 5 points each for email + phone + address.
 */

export type EngagementComponents = {
  frequencyScore: number;
  recencyScore: number;
  consistencyScore: number;
  contactScore: number;
};

export type EngagementResult = EngagementComponents & {
  totalScore: number;
  yearsAttended: number;
  /** Sorted ascending — useful for tooltips like "2022, 2023, 2024". */
  years: number[];
  mostRecentYear: number | null;
  longestStreak: number;
};

export function scoreEngagement(
  yearSet: Set<number>,
  contact: { hasEmail: boolean; hasPhone: boolean; hasAddress: boolean },
  now: Date = new Date(),
): EngagementResult {
  const years = [...yearSet].sort((a, b) => a - b);
  const yearsAttended = years.length;

  // Frequency — 10 per year, capped at 4 years for the full 40.
  const frequencyScore = Math.min(40, yearsAttended * 10);

  // Recency — banded.
  const currentYear = now.getUTCFullYear();
  const mostRecentYear =
    years.length > 0 ? years[years.length - 1] : null;
  let recencyScore = 0;
  if (mostRecentYear != null) {
    const gap = currentYear - mostRecentYear;
    if (gap <= 0) recencyScore = 30;
    else if (gap === 1) recencyScore = 25;
    else if (gap === 2) recencyScore = 15;
    else if (gap === 3) recencyScore = 5;
    else recencyScore = 0;
  }

  // Consistency — longest run of consecutive years.
  let longestStreak = 0;
  let runningStreak = 0;
  let prev: number | null = null;
  for (const y of years) {
    if (prev !== null && y === prev + 1) runningStreak += 1;
    else runningStreak = 1;
    if (runningStreak > longestStreak) longestStreak = runningStreak;
    prev = y;
  }
  const consistencyScore =
    yearsAttended === 0 ? 0 : Math.min(15, longestStreak * 5);

  // Contact completeness — 5 each, max 15.
  let contactScore = 0;
  if (contact.hasEmail) contactScore += 5;
  if (contact.hasPhone) contactScore += 5;
  if (contact.hasAddress) contactScore += 5;

  const totalScore =
    frequencyScore + recencyScore + consistencyScore + contactScore;

  return {
    frequencyScore,
    recencyScore,
    consistencyScore,
    contactScore,
    totalScore,
    yearsAttended,
    years,
    mostRecentYear,
    longestStreak,
  };
}
