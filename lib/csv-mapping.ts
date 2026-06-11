/**
 * CSV header auto-detection — ports `mapC` from donorluma-app.jsx:505.
 *
 * Given a CSV's actual header row, returns the column name (in the
 * original casing) that best matches each canonical field. Comparison
 * is case-insensitive and ignores all non-alphanumerics so
 * "Last Gift Date", "last_gift_date", and "LAST-GIFT-DATE" all match.
 */

import type { RawDonorRow } from "@/lib/scoring";

export type ColumnMap = {
  firstName: string | null;
  lastName: string | null;
  /**
   * Single-column fallback when the CSV has one "Name" / "Full Name" /
   * "Donor Name" column instead of first/last split. Many event
   * platforms (OneCause, GiveButter, etc.) export this way.
   */
  fullName: string | null;
  email: string | null;
  /** Optional contact-completeness fields — feed the engagement scorer. */
  phone: string | null;
  address: string | null;
  firstGift: string | null;
  lastGift: string | null;
  totalGifts: string | null;
  totalGiven: string | null;
  largestGift: string | null;
  donorType: string | null;
  notes: string | null;
};

export function detectColumns(headers: string[]): ColumnMap {
  const normalized = headers.map((h) =>
    h.toLowerCase().replace(/[^a-z0-9]/g, ""),
  );

  /**
   * Tracks headers that have already been claimed by a prior `find()`
   * call so generic needles (e.g. "address") don't double-bind to a
   * header that a more specific needle (e.g. "email" → "Email Address")
   * already took.
   *
   * Before this guard, VETLIFE-style CSVs with both an "Email Address"
   * column AND a separate "Address" column would map `email` and
   * `address` to the SAME header — the address-completeness score
   * undercounted by ~75% and the actual Address column was ignored.
   */
  const taken = new Set<string>();

  const find = (...needles: string[]): string | null => {
    for (const needle of needles) {
      const i = normalized.findIndex(
        (h, idx) => h.includes(needle) && !taken.has(headers[idx]),
      );
      if (i >= 0) {
        taken.add(headers[i]);
        return headers[i];
      }
    }
    return null;
  };

  const firstName = find("first", "fname");
  const lastName = find("last", "lname");
  // Only look for a full-name fallback when first/last weren't found;
  // otherwise a CRM that exports both "First Name" and "Donor Name"
  // would double-count via the fullName branch in projectRow.
  const fullName =
    !firstName && !lastName
      ? find("fullname", "donorname", "name", "contact")
      : null;

  return {
    firstName,
    lastName,
    fullName,
    email: find("email", "emailaddress"),
    // Phone matchers: "Phone", "Mobile", "Cell", "Telephone", "Phone Number".
    phone: find("phone", "mobile", "cell", "telephone"),
    // Address matchers: prefer a single full-address column, fall back
    // to a street-line column. We don't try to merge separate
    // street/city/state/zip columns into a single string — that's a
    // larger normalization job; for engagement scoring we just need
    // "is there ANY address field populated?", so a street column is
    // a useful proxy.
    address: find("address", "street", "mailing"),
    firstGift: find("firstgift", "firstdonat"),
    lastGift: find("lastgift", "lastdonat", "recentgift", "recentdate"),
    // totalGiven detection runs BEFORE totalGifts so "Total Donations"
    // gets bound to totalGiven via the specific "totaldonat" needle
    // before the broader "donations" needle on totalGifts can claim
    // it. The taken-Set above guarantees a header isn't double-bound.
    // "amount" lives at the very end of the totalGiven needle list
    // so it only catches columns like Givebutter's bare "Amount"
    // when nothing more specific (lifetime / total / cumulative)
    // matched — keeps the priority ordering the user requested.
    totalGiven: find(
      "totalgiven",
      "totalamount",
      "totaldonat",
      "lifetime",
      "cumulative",
      "amount",
    ),
    totalGifts: find(
      "totalgift",
      "numgift",
      "giftcount",
      "donationcount",
      "numberofdonations",
      "ofgifts",
      "donations",
      "frequency",
    ),
    largestGift: find("largest", "biggest", "maxgift"),
    donorType: find("type", "category", "segment"),
    notes: find("notes", "comment"),
  };
}

const parseNumber = (v: unknown): number => {
  if (v == null || v === "") return 0;
  const n = parseFloat(String(v).replace(/[$,]/g, ""));
  return Number.isNaN(n) ? 0 : n;
};

const parseDate = (v: unknown): Date | null => {
  if (!v) return null;
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d;
};

/**
 * Project a parsed CSV row through the detected column mapping into our
 * canonical RawDonorRow shape.
 *
 * Required fields: a name (first+last OR single full-name column) AND
 * an email address. Everything else — including last_gift_date — is
 * optional. Rows missing name or email are filtered at the call site.
 *
 * When giving columns are missing, the row still flows through: the
 * scorer recognizes it as an attendee (tier "Attendee", reactivation
 * score 0) and the AI prompt builder switches to first-time-conversion
 * framing instead of reactivation.
 */
export function projectRow(
  row: Record<string, unknown>,
  map: ColumnMap,
  index: number,
): RawDonorRow | null {
  const fn = map.firstName ? String(row[map.firstName] ?? "") : "";
  const ln = map.lastName ? String(row[map.lastName] ?? "") : "";
  const splitName = `${fn} ${ln}`.trim();
  const singleName = map.fullName
    ? String(row[map.fullName] ?? "").trim()
    : "";
  const name = splitName || singleName;
  const email = map.email
    ? String(row[map.email] ?? "").trim()
    : "";

  // Both name + email are required. Without them the row can't be
  // contacted via outreach, so persisting it costs storage without
  // unlocking the only thing this app does with a donor row.
  if (!name || !email) return null;

  const firstGiftRaw = map.firstGift ? String(row[map.firstGift] ?? "") : "";
  const lastGiftRaw = map.lastGift ? String(row[map.lastGift] ?? "") : "";

  return {
    name,
    email,
    phone: map.phone ? String(row[map.phone] ?? "").trim() : "",
    address: map.address ? String(row[map.address] ?? "").trim() : "",
    firstGiftDate: parseDate(firstGiftRaw),
    lastGiftDate: parseDate(lastGiftRaw),
    totalGifts: parseNumber(map.totalGifts ? row[map.totalGifts] : 0),
    totalGiven: parseNumber(map.totalGiven ? row[map.totalGiven] : 0),
    largestGift: parseNumber(map.largestGift ? row[map.largestGift] : 0),
    donorType: map.donorType
      ? String(row[map.donorType] ?? "Individual")
      : "Individual",
    notes: map.notes ? String(row[map.notes] ?? "") : "",
    firstGiftRaw,
    lastGiftRaw,
  };
}
