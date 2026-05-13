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
  tier: "High" | "Medium" | "Low" | "Cold";
  recencyScore: number;
  frequencyScore: number;
  monetaryScore: number;
  tenureScore: number;
  /** Placeholder enrichment signals — replace with real FEC/intent data later. */
  activeElsewhere: boolean;
  searchIntent: boolean;
};

export const DEFAULT_LAPSED_THRESHOLD_MONTHS = 12;

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

  const recency = Math.max(0, 30 - (daysSinceLast / 30) * 1.5);
  const frequency = Math.min(25, totalGifts * 2.5);
  const monetary = Math.min(25, (avgGift / 200) * 2.5);
  const tenure = Math.min(20, (tenureDays / 365) * 4);

  const score = Math.round(
    Math.min(100, Math.max(0, recency + frequency + monetary + tenure)),
  );

  const tier: ScoredDonor["tier"] =
    score >= 80 ? "High" : score >= 55 ? "Medium" : score >= 30 ? "Low" : "Cold";

  return {
    ...donor,
    isLapsed: !!ld && ld < cutoff,
    daysSinceLast,
    reactivationScore: score,
    tier,
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
