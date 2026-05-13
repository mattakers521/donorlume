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
  email: string | null;
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

  const find = (...needles: string[]): string | null => {
    for (const needle of needles) {
      const i = normalized.findIndex((h) => h.includes(needle));
      if (i >= 0) return headers[i];
    }
    return null;
  };

  return {
    firstName: find("first", "fname"),
    lastName: find("last", "lname"),
    email: find("email"),
    firstGift: find("firstgift", "firstdonat"),
    lastGift: find("lastgift", "lastdonat", "recentgift", "recentdate"),
    totalGifts: find("totalgift", "numgift", "giftcount", "frequency"),
    totalGiven: find(
      "totalgiven",
      "totalamount",
      "totaldonat",
      "lifetime",
      "cumulative",
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
 * canonical RawDonorRow shape. Rows without a parseable last-gift date
 * are filtered out at the call site since they can't be scored.
 */
export function projectRow(
  row: Record<string, unknown>,
  map: ColumnMap,
  index: number,
): RawDonorRow | null {
  const lastGiftRaw = map.lastGift ? String(row[map.lastGift] ?? "") : "";
  const lastGiftDate = parseDate(lastGiftRaw);
  if (!lastGiftDate) return null;

  const firstGiftRaw = map.firstGift ? String(row[map.firstGift] ?? "") : "";
  const fn = map.firstName ? String(row[map.firstName] ?? "") : "";
  const ln = map.lastName ? String(row[map.lastName] ?? "") : "";
  const fullName = `${fn} ${ln}`.trim() || `Donor ${index + 1}`;

  return {
    name: fullName,
    email: map.email ? String(row[map.email] ?? "") : "",
    firstGiftDate: parseDate(firstGiftRaw),
    lastGiftDate,
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
