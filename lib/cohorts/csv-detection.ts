/**
 * CSV cohort-column detection (Spec §3 "CSV Column Detection for
 * Engagement Cohorts").
 *
 * Inspects the parsed rows + headers and returns columns that look
 * categorical — repeated values, low cardinality, not numeric or date,
 * not already mapped to a known donor field.
 *
 * Pure client-side. The user picks which detected columns to import as
 * engagement cohorts; the selection is sent to /api/donors/upload along
 * with the per-donor tag values.
 */

import type { ColumnMap } from "@/lib/csv-mapping";

export type DetectedCohortColumn = {
  column: string;
  uniqueValues: string[];
  sampleSize: number;
};

const NUMERIC_RE = /^-?\$?\s*[\d,]+(\.\d+)?\s*%?$/;
const DATE_RE =
  /^\d{4}[-/]\d{1,2}[-/]\d{1,2}|^\d{1,2}[-/]\d{1,2}[-/]\d{2,4}|^\w+ \d{1,2},? \d{4}$/i;

const allMatch = (vals: string[], re: RegExp) =>
  vals.length > 0 && vals.every((v) => re.test(v.trim()));

function isMappedField(header: string, map: ColumnMap): boolean {
  return Object.values(map).some((m) => m === header);
}

/**
 * Cardinality bounds: ≥2 unique values (otherwise it's a constant),
 * ≤50 (above that we're probably looking at free-text like a notes
 * column). Match the spec's bounds exactly.
 */
const MIN_UNIQUE = 2;
const MAX_UNIQUE = 50;

export function detectCohortColumns(
  rows: Record<string, unknown>[],
  headers: string[],
  map: ColumnMap,
): DetectedCohortColumn[] {
  const out: DetectedCohortColumn[] = [];

  for (const header of headers) {
    if (isMappedField(header, map)) continue;

    const values = rows
      .map((r) => {
        const raw = r[header];
        return raw == null ? "" : String(raw).trim();
      })
      .filter(Boolean);

    if (values.length === 0) continue;

    const unique = new Set(values);
    if (unique.size < MIN_UNIQUE || unique.size > MAX_UNIQUE) continue;
    if (allMatch(values, NUMERIC_RE)) continue;
    if (allMatch(values, DATE_RE)) continue;

    out.push({
      column: header,
      uniqueValues: [...unique].sort((a, b) => a.localeCompare(b)),
      sampleSize: values.length,
    });
  }

  return out;
}

/**
 * Project a parsed row to the subset of values for selected cohort columns.
 * Used at upload time so the server can build (column, value) → donor
 * assignments without re-parsing.
 */
export function extractCsvTags(
  row: Record<string, unknown>,
  selectedColumns: string[],
): Record<string, string> {
  const tags: Record<string, string> = {};
  for (const col of selectedColumns) {
    const raw = row[col];
    if (raw == null) continue;
    const v = String(raw).trim();
    if (v) tags[col] = v;
  }
  return tags;
}
