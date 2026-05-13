/**
 * Date-range types + constants for the board report.
 *
 * Split from `lib/reports/data.ts` so the client-side <DateRangeSelector>
 * can import the labels + parser without dragging the `server-only`
 * data-fetch module across the RSC → Client boundary.
 */

export type RangeKey =
  | "last_30_days"
  | "last_90_days"
  | "this_year"
  | "all_time";

export const RANGE_OPTIONS: { key: RangeKey; label: string }[] = [
  { key: "last_30_days", label: "Last 30 days" },
  { key: "last_90_days", label: "Last 90 days" },
  { key: "this_year", label: "This year" },
  { key: "all_time", label: "All time" },
];

export function parseRange(input: string | undefined | null): RangeKey {
  switch (input) {
    case "last_30_days":
    case "last_90_days":
    case "this_year":
    case "all_time":
      return input;
    default:
      return "last_90_days";
  }
}

export function rangeLabel(range: RangeKey): string {
  return RANGE_OPTIONS.find((o) => o.key === range)?.label ?? "Last 90 days";
}

/**
 * Inclusive lower bound for the requested range. `null` means
 * unbounded ("All time"). Upper bound is always "now".
 */
export function rangeStart(
  range: RangeKey,
  now: Date = new Date(),
): Date | null {
  const today = new Date(now);
  switch (range) {
    case "last_30_days":
      return new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
    case "last_90_days":
      return new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000);
    case "this_year":
      return new Date(Date.UTC(today.getUTCFullYear(), 0, 1));
    case "all_time":
      return null;
  }
}
