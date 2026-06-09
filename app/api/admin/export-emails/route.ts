import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/export-emails
 *
 * Admin-only CSV download. Returns one row per user with their
 * primary-org context — exactly the columns a marketing tool wants
 * for a first-pass import (name, email, organization, signup date).
 *
 * Gated by `requireAdmin()` which redirects non-admins to /dashboard
 * (same policy as the page itself).
 */
export async function GET() {
  await requireAdmin();

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      email: true,
      name: true,
      createdAt: true,
      orgs: {
        orderBy: { createdAt: "asc" },
        take: 1,
        select: { org: { select: { name: true } } },
      },
    },
  });

  const header = ["Name", "Email", "Organization", "Signup Date"];
  const lines = [
    header.map(csvCell).join(","),
    ...users.map((u) =>
      [
        u.name ?? "",
        u.email,
        u.orgs[0]?.org.name ?? "",
        u.createdAt.toISOString(),
      ]
        .map(csvCell)
        .join(","),
    ),
  ];
  const body = `${lines.join("\r\n")}\r\n`;

  const filename = `donorlume-users-${new Date()
    .toISOString()
    .slice(0, 10)}.csv`;

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      // Marketing tools occasionally re-fetch this URL to refresh —
      // don't let any layer cache the result.
      "Cache-Control": "no-store",
    },
  });
}

/**
 * RFC 4180 quoting: wrap any field that contains a comma, quote, or
 * line break in double quotes; double-up internal quotes. Empty
 * fields render as bare empty strings.
 *
 * CSV-injection defense (CWE-1236): prefix cells that start with `=`,
 * `+`, `-`, `@`, `\t`, or `\r` with an apostrophe so spreadsheet
 * software treats them as literal text instead of formulas. A user
 * named `=cmd|'/c calc'!A1` would otherwise weaponize this export
 * when the admin opens it.
 */
const FORMULA_PREFIXES = ["=", "+", "-", "@", "\t", "\r"];

function csvCell(value: string): string {
  if (value === "") return "";
  let s = value;
  if (FORMULA_PREFIXES.includes(s[0]!)) {
    s = `'${s}`;
  }
  const needsQuoting = /[",\r\n]/.test(s);
  if (!needsQuoting) return s;
  return `"${s.replace(/"/g, '""')}"`;
}
