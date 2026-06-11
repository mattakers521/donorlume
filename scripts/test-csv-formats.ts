/* eslint-disable no-console */
/**
 * Runs each test CSV through the EXACT same client+server pipeline
 * the production upload uses:
 *   1. Papaparse (with BOM strip + transformHeader + skipEmptyLines)
 *   2. detectColumns
 *   3. projectRow per row → drop rows missing name OR email
 *   4. findYearBearingColumns + buildTagBag (year tags ALWAYS sent)
 *   5. Email dedup (lowercased)
 *   6. scoreAll (RFM+) for donors with giving signal
 *   7. extractAttendeeYears + scoreEngagement for attendees
 *
 * Server-only modules (lib/cohorts/attendee.ts marked "server-only")
 * are inlined to mirror the patterns scripts/seed-existing-orgs.ts
 * + scripts/reload-vetlife.ts use.
 *
 * Reports PASS/FAIL per file against four hard criteria:
 *   • Parses without Papaparse errors
 *   • Name + email columns detected
 *   • At least 80% of rows project (name + email)
 *   • Score variance > 0 (i.e. the pipeline actually computes
 *     something meaningful, not a constant fingerprint)
 */

import fs from "node:fs";
import path from "node:path";

import Papa from "papaparse";

import {
  type ColumnMap,
  detectColumns,
  projectRow,
} from "@/lib/csv-mapping";
import { scoreAll, scoreEngagement } from "@/lib/scoring";

// ─── Inlined from lib/cohorts/attendee.ts (server-only) ────────────

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

// ─── Inlined from components/lapsed/upload-zone.tsx ────────────────

function findYearBearingColumns(
  rows: Record<string, unknown>[],
  headers: string[],
  map: ColumnMap,
): string[] {
  const mapped = new Set(
    Object.values(map).filter((v): v is string => typeof v === "string"),
  );
  const yearRe = /\b(20\d{2})\b/;
  const found: string[] = [];
  for (const h of headers) {
    if (mapped.has(h)) continue;
    let scanned = 0;
    let hits = 0;
    for (const r of rows) {
      const v = r[h];
      if (v == null) continue;
      const s = String(v).trim();
      if (!s) continue;
      scanned++;
      if (yearRe.test(s)) hits++;
      if (scanned >= 50 || hits >= 5) break;
    }
    if (hits > 0) found.push(h);
  }
  return found;
}

function buildTagBag(
  row: Record<string, unknown>,
  cohortColumns: readonly string[],
  yearCols: readonly string[],
): Record<string, string> {
  const out: Record<string, string> = {};
  const merged = new Set<string>([...cohortColumns, ...yearCols]);
  for (const col of merged) {
    const v = row[col];
    if (v == null) continue;
    const s = String(v).trim();
    if (s) out[col] = s;
  }
  return out;
}

// ─── Per-file runner ──────────────────────────────────────────────

type TestResult = {
  file: string;
  parsed: boolean;
  papaErrors: number;
  headers: string[];
  detected: ColumnMap;
  rowsTotal: number;
  rowsProjected: number;
  rowsAfterDedup: number;
  yearCols: string[];
  emailCoverage: number; // pct of original rows with an email
  scoreVariance: number;
  scoreRange: { min: number; max: number };
  sampleScored: {
    name: string;
    email: string;
    hasGivingHistory: boolean;
    score: number;
    tier?: string;
    yearsAttended?: number;
    years?: number[];
  }[];
  errors: string[];
};

function runTest(filePath: string): TestResult {
  const fileName = path.basename(filePath);
  const errors: string[] = [];

  const raw = fs.readFileSync(filePath, "utf8");
  const cleaned = raw.replace(/^﻿/, "").trim();
  const papa = Papa.parse<Record<string, unknown>>(cleaned, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });
  if (papa.errors.length > 0) {
    errors.push(
      `papaparse: ${papa.errors.length} errors — ${JSON.stringify(papa.errors.slice(0, 3))}`,
    );
  }

  const headers = papa.meta.fields ?? [];
  const detected = detectColumns(headers);

  if (!detected.firstName && !detected.lastName && !detected.fullName) {
    errors.push("no name column detected");
  }
  if (!detected.email) {
    errors.push("no email column detected");
  }

  const rowsTotal = papa.data.length;
  let originalWithEmail = 0;
  const projected: {
    raw: ReturnType<typeof projectRow>;
    csvRow: Record<string, unknown>;
  }[] = [];

  papa.data.forEach((row, i) => {
    const emailRaw = detected.email
      ? String(row[detected.email] ?? "").trim()
      : "";
    if (emailRaw) originalWithEmail++;
    const p = projectRow(row, detected, i);
    if (p) projected.push({ raw: p, csvRow: row });
  });

  // Dedup by email (lowercased) — server does the same.
  const seenEmails = new Set<string>();
  const deduped: typeof projected = [];
  for (const r of projected) {
    const key = r.raw!.email.trim().toLowerCase();
    if (!key || seenEmails.has(key)) continue;
    seenEmails.add(key);
    deduped.push(r);
  }

  // Year-bearing columns
  const yearCols = findYearBearingColumns(
    deduped.map((d) => d.csvRow),
    headers,
    detected,
  );

  // Build tag bags (year cols only; no user-selected cohort columns
  // in this simulation).
  const tags = deduped.map((d) => buildTagBag(d.csvRow, [], yearCols));

  // Score
  const now = new Date();
  const scored = scoreAll(
    deduped.map((d) => d.raw!),
    now,
  );

  const finalScores: number[] = [];
  const sampleScored: TestResult["sampleScored"] = [];
  for (let i = 0; i < scored.length; i++) {
    const s = scored[i]!;
    if (s.hasGivingHistory) {
      finalScores.push(s.reactivationScore);
      if (sampleScored.length < 3) {
        sampleScored.push({
          name: s.name,
          email: s.email,
          hasGivingHistory: true,
          score: s.reactivationScore,
          tier: s.tier,
        });
      }
    } else {
      const years = extractAttendeeYears(tags[i] ?? {});
      const eng = scoreEngagement(
        years,
        {
          hasEmail: !!s.email,
          hasPhone: !!deduped[i]?.raw!.phone,
          hasAddress: !!deduped[i]?.raw!.address,
        },
        now,
      );
      finalScores.push(eng.totalScore);
      if (sampleScored.length < 3) {
        sampleScored.push({
          name: s.name,
          email: s.email,
          hasGivingHistory: false,
          score: eng.totalScore,
          yearsAttended: eng.yearsAttended,
          years: eng.years,
        });
      }
    }
  }

  const mean =
    finalScores.length > 0
      ? finalScores.reduce((a, b) => a + b, 0) / finalScores.length
      : 0;
  const variance =
    finalScores.length > 0
      ? finalScores.reduce((a, b) => a + (b - mean) ** 2, 0) /
        finalScores.length
      : 0;
  const min = finalScores.length > 0 ? Math.min(...finalScores) : 0;
  const max = finalScores.length > 0 ? Math.max(...finalScores) : 0;

  return {
    file: fileName,
    parsed: papa.errors.length === 0,
    papaErrors: papa.errors.length,
    headers,
    detected,
    rowsTotal,
    rowsProjected: projected.length,
    rowsAfterDedup: deduped.length,
    yearCols,
    emailCoverage:
      rowsTotal > 0
        ? Math.round((originalWithEmail / rowsTotal) * 100)
        : 0,
    scoreVariance: Math.round(variance * 10) / 10,
    scoreRange: { min, max },
    sampleScored,
    errors,
  };
}

function printResult(r: TestResult) {
  // PASS/FAIL gates
  const projectionRate =
    r.rowsTotal > 0 ? r.rowsProjected / r.rowsTotal : 0;
  const gates = {
    "Parses without Papaparse errors": r.parsed,
    "Name column detected":
      !!r.detected.firstName ||
      !!r.detected.lastName ||
      !!r.detected.fullName,
    "Email column detected": !!r.detected.email,
    "≥80% of rows project (name + email)":
      projectionRate >= 0.8 || r.rowsTotal === 0,
    "Score variance > 0":
      r.scoreVariance > 0 || r.rowsAfterDedup === 0,
  };
  const passAll = Object.values(gates).every(Boolean);
  console.log(`\n${"═".repeat(70)}`);
  console.log(`${passAll ? "✅ PASS" : "❌ FAIL"} — ${r.file}`);
  console.log("─".repeat(70));
  console.log(`headers: ${JSON.stringify(r.headers)}`);
  console.log(`detected columns:`);
  for (const [k, v] of Object.entries(r.detected)) {
    if (v) console.log(`  ${k}: ${v}`);
  }
  console.log(`year-bearing columns: ${JSON.stringify(r.yearCols)}`);
  console.log(
    `rows: parsed=${r.rowsTotal} projected=${r.rowsProjected} afterDedup=${r.rowsAfterDedup}  (${Math.round(projectionRate * 100)}% projection rate)`,
  );
  console.log(`email coverage of source rows: ${r.emailCoverage}%`);
  console.log(
    `score range: [${r.scoreRange.min}, ${r.scoreRange.max}]  variance=${r.scoreVariance}`,
  );
  console.log("sample (first 3 scored):");
  for (const s of r.sampleScored) {
    if (s.hasGivingHistory) {
      console.log(
        `  · ${s.name} <${s.email}>  RFM=${s.score} tier=${s.tier}`,
      );
    } else {
      console.log(
        `  · ${s.name} <${s.email}>  engagement=${s.score} years=[${s.years?.join(", ") ?? ""}] (${s.yearsAttended ?? 0} yr${(s.yearsAttended ?? 0) === 1 ? "" : "s"})`,
      );
    }
  }
  console.log("gates:");
  for (const [name, ok] of Object.entries(gates)) {
    console.log(`  [${ok ? "✓" : "✗"}] ${name}`);
  }
  if (r.errors.length > 0) {
    console.log("errors:");
    for (const e of r.errors) console.log(`  - ${e}`);
  }
}

// ─── MAIN ────────────────────────────────────────────────────────

const TEST_DIR = path.join(process.cwd(), "test-data");
const files = [
  "onecause-export.csv",
  "givebutter-export.csv",
  "salesforce-export.csv",
  "spreadsheet-manual.csv",
  "mailchimp-export.csv",
];

const results = files.map((f) => runTest(path.join(TEST_DIR, f)));
for (const r of results) printResult(r);

console.log(`\n${"═".repeat(70)}`);
console.log("SUMMARY");
console.log("─".repeat(70));
let passCount = 0;
for (const r of results) {
  const projectionRate =
    r.rowsTotal > 0 ? r.rowsProjected / r.rowsTotal : 0;
  const ok =
    r.parsed &&
    (!!r.detected.firstName ||
      !!r.detected.lastName ||
      !!r.detected.fullName) &&
    !!r.detected.email &&
    (projectionRate >= 0.8 || r.rowsTotal === 0) &&
    (r.scoreVariance > 0 || r.rowsAfterDedup === 0);
  if (ok) passCount++;
  console.log(
    `  ${ok ? "✅ PASS" : "❌ FAIL"}  ${r.file.padEnd(28)}  ${r.rowsProjected}/${r.rowsTotal} rows  score-range [${r.scoreRange.min},${r.scoreRange.max}]`,
  );
}
console.log(`\n${passCount}/${results.length} files passed`);
