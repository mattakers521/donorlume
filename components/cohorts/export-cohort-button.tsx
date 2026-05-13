"use client";

import { Download } from "lucide-react";
import type { Donor } from "@prisma/client";

import { C } from "@/lib/design";

type Props = {
  cohortSlug: string;
  cohortName: string;
  donors: Donor[];
};

const CSV_COLUMNS = [
  "name",
  "email",
  "donor_type",
  "first_gift_date",
  "last_gift_date",
  "total_gifts",
  "total_given",
  "largest_gift",
  "reactivation_score",
  "tier",
  "notes",
] as const;

function csvEscape(v: unknown): string {
  if (v == null) return "";
  const s = String(v);
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function donorToCsvRow(d: Donor): string {
  const cells: string[] = [
    d.name,
    d.email ?? "",
    d.donorType ?? "",
    d.firstGiftDate ? new Date(d.firstGiftDate).toISOString().slice(0, 10) : "",
    d.lastGiftDate ? new Date(d.lastGiftDate).toISOString().slice(0, 10) : "",
    d.totalGifts?.toString() ?? "",
    d.totalGiven?.toString() ?? "",
    d.largestGift?.toString() ?? "",
    d.reactivationScore?.toString() ?? "",
    d.tier ?? "",
    d.notes ?? "",
  ];
  return cells.map(csvEscape).join(",");
}

export function ExportCohortButton({ cohortSlug, cohortName, donors }: Props) {
  const handleExport = () => {
    const header = CSV_COLUMNS.join(",");
    const rows = donors.map(donorToCsvRow);
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${cohortSlug}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <button
      type="button"
      onClick={handleExport}
      disabled={donors.length === 0}
      title={`Export ${cohortName} as CSV`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "10px 18px",
        borderRadius: 12,
        border: `1.5px solid ${C.border}`,
        backgroundColor: C.surface,
        color: donors.length > 0 ? C.text : C.textTertiary,
        fontSize: 13,
        fontWeight: 700,
        cursor: donors.length > 0 ? "pointer" : "default",
        fontFamily: "var(--font-jakarta), -apple-system, sans-serif",
      }}
    >
      <Download size={14} /> Export
    </button>
  );
}
