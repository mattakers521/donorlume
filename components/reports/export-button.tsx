import { Download } from "lucide-react";

import { brandGradient } from "@/lib/design";
import type { RangeKey } from "@/lib/reports/data";

type Props = {
  range: RangeKey;
};

/**
 * "Export Board Report" — a plain <a> with `download` so the browser
 * grabs the CSV without an XHR (preserves the suggested filename from
 * the API's Content-Disposition header).
 */
export function ExportButton({ range }: Props) {
  return (
    <a
      href={`/api/reports/export?range=${encodeURIComponent(range)}`}
      download
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "12px 22px",
        borderRadius: 14,
        background: brandGradient,
        color: "#fff",
        fontSize: 14,
        fontWeight: 700,
        textDecoration: "none",
        boxShadow:
          "0 10px 28px rgba(232,134,12,0.30), 0 3px 8px rgba(212,74,26,0.18)",
        fontFamily: "var(--font-jakarta), sans-serif",
        whiteSpace: "nowrap",
      }}
    >
      <Download size={16} color="#fff" />
      Export Board Report
      <span
        style={{
          marginLeft: 4,
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: 0.8,
          padding: "2px 6px",
          borderRadius: 6,
          background: "rgba(255,255,255,0.18)",
        }}
      >
        CSV
      </span>
    </a>
  );
}
