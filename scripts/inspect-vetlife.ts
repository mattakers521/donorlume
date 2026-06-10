/* eslint-disable no-console */
/**
 * Step 1: print the raw VETLIFE CSV as Papaparse would deliver it to
 * the client, then run our detector + projector + year-extractor over
 * the first 10 rows so we can see exactly where the pipeline drops
 * data.
 *
 * Usage: npx tsx scripts/inspect-vetlife.ts
 */

import fs from "node:fs";

import Papa from "papaparse";

import { detectColumns, projectRow } from "@/lib/csv-mapping";

// Inlined from lib/cohorts/attendee.ts (which imports "server-only"
// and can't be loaded by a plain tsx script).
const YEAR_MIN = 2000;
const YEAR_MAX = 2099;
const TAG_VALUE_SPLIT = /[;,|/\n]+/;
function extractAttendeeYears(tags: Record<string, string>): Set<number> {
  const years = new Set<number>();
  for (const raw of Object.values(tags)) {
    if (!raw) continue;
    for (const piece of String(raw).split(TAG_VALUE_SPLIT)) {
      const re = /\b(20\d{2})\b/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(piece)) !== null) {
        const y = Number(m[1]);
        if (y >= YEAR_MIN && y <= YEAR_MAX) years.add(y);
      }
    }
  }
  return years;
}

const CSV_PATH =
  "/Users/mattakers521/Downloads/Vet Fest Combined List (2).csv";

const raw = fs.readFileSync(CSV_PATH, "utf8");
const cleaned = raw.replace(/^﻿/, "").trim();

const result = Papa.parse<Record<string, unknown>>(cleaned, {
  header: true,
  skipEmptyLines: true,
  transformHeader: (h) => h.trim(),
});

const headers = result.meta.fields ?? [];
console.log("─── HEADERS ───");
console.log(JSON.stringify(headers, null, 2));

console.log("\n─── PAPAPARSE ERRORS (first 10) ───");
console.log(JSON.stringify(result.errors.slice(0, 10), null, 2));

console.log("\n─── COLUMN DETECTION ───");
const map = detectColumns(headers);
console.log(JSON.stringify(map, null, 2));

console.log("\n─── FIRST 10 ROWS — RAW + PROJECTED + YEAR EXTRACTION ───");
for (let i = 0; i < Math.min(10, result.data.length); i++) {
  const row = result.data[i]!;
  const projected = projectRow(row, map, i);
  console.log(`\n──── ROW ${i + 1} ────`);
  console.log("RAW (every column):");
  for (const [k, v] of Object.entries(row)) {
    const display = typeof v === "string" ? JSON.stringify(v) : String(v);
    console.log(`  ${k}: ${display}`);
  }

  // Pull whichever column maps to TAGS-like data so we can see exactly
  // what value the year extractor receives.
  const candidateTagCols = headers.filter((h) =>
    /tag|note|event|attend/i.test(h),
  );
  console.log(`\nTAG-LIKE COLUMNS DETECTED: ${JSON.stringify(candidateTagCols)}`);
  for (const col of candidateTagCols) {
    const v = row[col];
    console.log(`  ${col} value: ${JSON.stringify(v)}`);
  }

  if (!projected) {
    console.log("PROJECTED: null — row dropped by projector");
    continue;
  }

  console.log(`PROJECTED.name: ${JSON.stringify(projected.name)}`);
  console.log(`PROJECTED.email: ${JSON.stringify(projected.email)}`);

  // Build the csvTags map the upload route passes to the year
  // extractor. The user-facing TAGS column is the first candidate
  // when the detector classifies it as categorical — but for the
  // diagnostic we feed everything tag-like.
  const csvTags: Record<string, string> = {};
  for (const col of candidateTagCols) {
    const v = row[col];
    if (v != null && String(v).trim()) csvTags[col] = String(v);
  }
  const years = extractAttendeeYears(csvTags);
  console.log(`YEARS EXTRACTED: ${JSON.stringify([...years].sort())}`);
}

console.log("\n─── AGGREGATE TAG-COLUMN STATS (all rows) ───");
const tagCols = headers.filter((h) => /tag|note|event|attend/i.test(h));
console.log(`tag-like columns: ${JSON.stringify(tagCols)}`);
for (const col of tagCols) {
  const populated = result.data.filter((r) => {
    const v = r[col];
    return v != null && String(v).trim().length > 0;
  });
  const sample = populated.slice(0, 5).map((r) => r[col]);
  console.log(
    `\n  ${col} — populated ${populated.length}/${result.data.length}`,
  );
  console.log(`  sample: ${JSON.stringify(sample)}`);
}

console.log("\n─── ROW COUNT SANITY ───");
console.log(`Papaparse rows: ${result.data.length}`);
console.log(
  `Rows with name+email after projection: ${result.data.filter((r, i) => !!projectRow(r, map, i)).length}`,
);
