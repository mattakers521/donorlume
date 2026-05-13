/**
 * CSV serializer for the board report.
 *
 * One CSV file with multiple stacked "sections" (Overview / Outreach /
 * Cohort Health / Pipeline) separated by blank rows + section header
 * rows. Excel, Numbers, and Google Sheets all handle this layout — each
 * section auto-fits its own columns.
 */

import type { ReportData } from "@/lib/reports/data";

/**
 * Escapes a single CSV cell. Quotes the value when it contains a
 * separator, quote, or newline; doubles internal quotes per RFC 4180.
 */
function escapeCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (s.length === 0) return "";
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function row(...cells: (string | number | null | undefined)[]): string {
  return cells.map(escapeCell).join(",");
}

function formatDate(d: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(d);
}

function formatPct(v: number | null): string {
  if (v === null) return "—";
  return `${(v * 100).toFixed(1)}%`;
}

function formatMoney(n: number): string {
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

export function buildReportCsv(report: ReportData): string {
  const lines: string[] = [];

  // ─── Header block ───
  lines.push(row("DonorLume Board Report"));
  lines.push(row("Organization", report.orgName));
  lines.push(row("Date range", report.rangeLabel));
  lines.push(row("Generated", formatDate(report.generatedAt)));
  lines.push("");

  // ─── Overview ───
  lines.push(row("OVERVIEW"));
  lines.push(row("Metric", "Value"));
  lines.push(row("Total prospects saved", report.overview.prospectsSaved));
  lines.push(row("Total donors scored", report.overview.donorsScored));
  lines.push(row("Total outreach sent", report.overview.outreachSent));
  lines.push(row("Overall open rate", formatPct(report.overview.openRate)));
  lines.push(row("Overall click rate", formatPct(report.overview.clickRate)));
  lines.push(row("Donors reactivated", report.overview.donorsReactivated));
  lines.push("");

  // ─── Outreach Performance ───
  lines.push(row("OUTREACH PERFORMANCE"));
  if (report.campaigns.length === 0) {
    lines.push(row("No campaigns in this date range."));
  } else {
    lines.push(
      row(
        "Campaign",
        "Date",
        "Sent",
        "Opens",
        "Open rate",
        "Clicks",
        "Click rate",
        "Replies",
        "Reply rate",
      ),
    );
    for (const c of report.campaigns) {
      lines.push(
        row(
          c.name,
          formatDate(c.createdAt),
          c.sentCount,
          c.openedCount,
          formatPct(c.openRate),
          c.clickedCount,
          formatPct(c.clickRate),
          c.repliedCount,
          formatPct(c.replyRate),
        ),
      );
    }
  }
  lines.push("");

  // ─── Cohort Health ───
  lines.push(row("COHORT HEALTH"));
  if (report.cohorts.length === 0) {
    lines.push(row("No cohorts yet — upload a donor list to populate."));
  } else {
    lines.push(
      row(
        "Cohort",
        "Family",
        "Members",
        "Lifetime value",
        "Avg score",
        "New in range",
        "Trend",
      ),
    );
    for (const c of report.cohorts) {
      lines.push(
        row(
          c.name,
          c.family,
          c.memberCount,
          formatMoney(c.totalLifetimeValue),
          c.averageScore ?? "—",
          c.newMembersInRange,
          c.trend === "growing"
            ? "Growing"
            : c.trend === "stable"
              ? "Stable"
              : "—",
        ),
      );
    }
  }
  lines.push("");

  // ─── Prospect Pipeline ───
  lines.push(row("PROSPECT PIPELINE"));
  lines.push(row("Stage", "Count", "Total revenue (annual)"));
  for (const stage of report.pipeline) {
    lines.push(
      row(stage.label, stage.count, formatMoney(stage.totalRevenue)),
    );
  }
  if (report.otherStageCount > 0) {
    lines.push(
      row(
        `Other stages (Asked/Committed/etc.)`,
        report.otherStageCount,
        "",
      ),
    );
  }

  // RFC 4180 prefers CRLF line endings; Excel handles either, but CRLF
  // is the safer default for Windows clients.
  return lines.join("\r\n") + "\r\n";
}

/**
 * URL-safe filename like `donorlume-report-hope-foundation-2026-05-11.csv`.
 */
export function reportFilename(report: ReportData): string {
  const safeName = report.orgName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  const date = report.generatedAt.toISOString().slice(0, 10);
  return `donorlume-report-${safeName || "org"}-${date}.csv`;
}
