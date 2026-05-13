"use client";

import { useRef, useState } from "react";
import {
  AlertCircle,
  Check,
  ChevronLeft,
  Download,
  Layers,
  Loader as LoaderIcon,
  Sparkles,
  Upload,
} from "lucide-react";
import Papa from "papaparse";

import { C, brandGradient, shadow } from "@/lib/design";
import { SAMPLE_CSV } from "@/lib/csv-template";
import {
  detectCohortColumns,
  extractCsvTags,
  type DetectedCohortColumn,
} from "@/lib/cohorts/csv-detection";
import {
  detectColumns,
  projectRow,
} from "@/lib/csv-mapping";
import type { RawDonorRow } from "@/lib/scoring";

type Props = {
  busy: boolean;
  errorMessage: string | null;
  onProcess: (
    donors: RawDonorRow[],
    fileName: string,
    cohortColumns: string[],
    perDonorTags: Record<string, string>[],
  ) => Promise<void>;
};

type PreviewState = {
  fileName: string;
  donors: RawDonorRow[];
  /** Original parsed CSV rows aligned by index with `donors`. */
  csvRows: Record<string, unknown>[];
  detected: DetectedCohortColumn[];
};

export function UploadZone({ busy, errorMessage, onProcess }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [selectedCohortCols, setSelectedCohortCols] = useState<Set<string>>(
    new Set(),
  );

  const processCSV = async (text: string, fileName: string) => {
    setParseError(null);
    try {
      const result = Papa.parse<Record<string, unknown>>(text.trim(), {
        header: true,
        skipEmptyLines: true,
      });
      if (result.data.length === 0) {
        setParseError("CSV is empty.");
        return;
      }
      const fields = result.meta.fields ?? [];
      const map = detectColumns(fields);
      if (!map.lastGift) {
        setParseError(
          "Couldn’t find a last-gift-date column. Try renaming a column to “last_gift_date”.",
        );
        return;
      }

      // Walk parsed rows once, keep aligned `raw` ↔ `csvRow` pairs for any
      // row the scorer can accept. This pairing is the source of truth for
      // engagement-cohort tag extraction.
      const survivors: {
        raw: RawDonorRow;
        csvRow: Record<string, unknown>;
      }[] = [];
      result.data.forEach((row, i) => {
        const projected = projectRow(row, map, i);
        if (projected) survivors.push({ raw: projected, csvRow: row });
      });

      if (survivors.length === 0) {
        setParseError(
          "No rows had a parseable date in the last-gift column.",
        );
        return;
      }

      // Cohort-column detection runs only on rows that will actually be
      // persisted — keeps cardinality counts honest.
      const detected = detectCohortColumns(
        survivors.map((s) => s.csvRow),
        fields,
        map,
      );

      // No categorical columns to import? Skip the preview, just upload.
      if (detected.length === 0) {
        await onProcess(
          survivors.map((s) => s.raw),
          fileName,
          [],
          survivors.map(() => ({})),
        );
        return;
      }

      // Enter preview mode — all detected columns checked by default.
      setPreview({
        fileName,
        donors: survivors.map((s) => s.raw),
        csvRows: survivors.map((s) => s.csvRow),
        detected,
      });
      setSelectedCohortCols(new Set(detected.map((d) => d.column)));
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to parse CSV.";
      setParseError(message);
    }
  };

  const handleFile = (file: File | undefined | null) => {
    if (!file) return;
    if (!file.name.match(/\.csv$/i)) {
      setParseError("Please upload a .csv file.");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = String(e.target?.result ?? "");
      processCSV(text, file.name);
    };
    reader.readAsText(file);
  };

  const downloadTemplate = () => {
    const blob = new Blob([SAMPLE_CSV], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "donor-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const submitPreview = async (cohortColumns: string[]) => {
    if (!preview) return;
    const tags = preview.csvRows.map((row) =>
      extractCsvTags(row, cohortColumns),
    );
    await onProcess(preview.donors, preview.fileName, cohortColumns, tags);
    setPreview(null);
    setSelectedCohortCols(new Set());
  };

  const error = errorMessage ?? parseError;

  // ─── Preview / confirmation step ──────────────────────────────────────
  if (preview) {
    return (
      <PreviewPanel
        preview={preview}
        selected={selectedCohortCols}
        busy={busy}
        error={error}
        onToggle={(col) =>
          setSelectedCohortCols((prev) => {
            const next = new Set(prev);
            if (next.has(col)) next.delete(col);
            else next.add(col);
            return next;
          })
        }
        onBack={() => {
          setPreview(null);
          setSelectedCohortCols(new Set());
        }}
        onSkip={() => submitPreview([])}
        onContinue={() => submitPreview([...selectedCohortCols])}
      />
    );
  }

  // ─── Default drop zone ────────────────────────────────────────────────
  return (
    <div style={{ maxWidth: 780 }}>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!busy) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (busy) return;
          handleFile(e.dataTransfer.files[0]);
        }}
        onClick={() => {
          if (!busy) fileRef.current?.click();
        }}
        style={{
          backgroundColor: dragOver ? C.amberLight : C.surface,
          border: `2px dashed ${dragOver ? C.amber : C.border}`,
          borderRadius: 24,
          padding: "64px 40px",
          textAlign: "center",
          cursor: busy ? "default" : "pointer",
          marginBottom: 24,
          boxShadow: shadow.sm,
          transition: "all 0.2s",
          opacity: busy ? 0.7 : 1,
        }}
      >
        <input
          ref={fileRef}
          type="file"
          accept=".csv"
          onChange={(e) => handleFile(e.target.files?.[0])}
          style={{ display: "none" }}
        />
        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: 20,
            backgroundColor: C.orangeLight,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 24px",
          }}
        >
          {busy ? (
            <LoaderIcon size={32} color={C.orange} className="spin" />
          ) : (
            <Upload size={32} color={C.orange} />
          )}
        </div>
        <h3 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>
          {busy ? "Scoring your donors…" : "Drop your donor CSV here"}
        </h3>
        <p style={{ fontSize: 15, color: C.textSecondary, marginTop: 10 }}>
          {busy
            ? "We’re running the RFM+ engine and saving your list."
            : "or click to browse — we auto-detect column names from any CRM export."}
        </p>
      </div>

      {error && (
        <div
          style={{
            backgroundColor: C.orangeLight,
            borderRadius: 16,
            padding: "16px 22px",
            marginBottom: 24,
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
          role="alert"
        >
          <AlertCircle size={18} color={C.orange} />
          <span
            style={{ fontSize: 14, color: C.orange, fontWeight: 600 }}
          >
            {error}
          </span>
        </div>
      )}

      <div style={{ display: "flex", gap: 12 }}>
        <button
          type="button"
          onClick={() => processCSV(SAMPLE_CSV, "sample-donors.csv")}
          disabled={busy}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "12px 24px",
            borderRadius: 14,
            border: "none",
            background: brandGradient,
            color: "#fff",
            fontSize: 14,
            fontWeight: 700,
            cursor: busy ? "default" : "pointer",
            opacity: busy ? 0.5 : 1,
            boxShadow: shadow.sm,
            fontFamily: "var(--font-jakarta), -apple-system, sans-serif",
          }}
        >
          <Sparkles size={16} /> Load Sample Data
        </button>
        <button
          type="button"
          onClick={downloadTemplate}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "12px 24px",
            borderRadius: 14,
            border: "none",
            backgroundColor: "#F2F2F7",
            color: C.textSecondary,
            fontSize: 14,
            fontWeight: 700,
            cursor: "pointer",
            fontFamily: "var(--font-jakarta), -apple-system, sans-serif",
          }}
        >
          <Download size={16} /> Template
        </button>
      </div>
    </div>
  );
}

// ─── Preview panel sub-component ────────────────────────────────────────

function PreviewPanel({
  preview,
  selected,
  busy,
  error,
  onToggle,
  onBack,
  onSkip,
  onContinue,
}: {
  preview: PreviewState;
  selected: Set<string>;
  busy: boolean;
  error: string | null;
  onToggle: (col: string) => void;
  onBack: () => void;
  onSkip: () => void;
  onContinue: () => void;
}) {
  return (
    <div style={{ maxWidth: 780 }}>
      <button
        type="button"
        onClick={onBack}
        disabled={busy}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          fontSize: 14,
          color: C.amber,
          background: "none",
          border: "none",
          cursor: busy ? "default" : "pointer",
          marginBottom: 20,
          padding: 0,
          fontWeight: 600,
          fontFamily: "var(--font-jakarta), -apple-system, sans-serif",
        }}
      >
        <ChevronLeft size={18} /> Back to upload
      </button>

      <div
        style={{
          backgroundColor: C.surface,
          borderRadius: 24,
          boxShadow: shadow.md,
          padding: 32,
          marginBottom: 16,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginBottom: 14,
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 14,
              backgroundColor: C.amberLight,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Layers size={20} color={C.amber} />
          </div>
          <div>
            <h2
              style={{
                fontFamily: "var(--font-instrument-serif), Georgia, serif",
                fontSize: 24,
                fontWeight: 400,
                margin: 0,
                lineHeight: 1.15,
                letterSpacing: -0.5,
              }}
            >
              We spotted donor segments in your file.
            </h2>
            <p
              style={{
                fontSize: 13,
                color: C.textTertiary,
                margin: "4px 0 0",
              }}
            >
              {preview.donors.length.toLocaleString()} rows from{" "}
              <strong style={{ color: C.text }}>{preview.fileName}</strong>{" "}
              · {preview.detected.length} candidate column
              {preview.detected.length === 1 ? "" : "s"}
            </p>
          </div>
        </div>

        <p
          style={{
            fontSize: 14,
            lineHeight: 1.65,
            color: C.textSecondary,
            margin: "0 0 22px",
          }}
        >
          Each unique value becomes its own cohort. Uncheck any column you
          don&rsquo;t want as cohorts — they&rsquo;ll still upload as donor
          data, just not as segments.
        </p>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          {preview.detected.map((d) => {
            const isOn = selected.has(d.column);
            const sampleValues = d.uniqueValues.slice(0, 6);
            const remaining = d.uniqueValues.length - sampleValues.length;
            return (
              <button
                key={d.column}
                type="button"
                onClick={() => onToggle(d.column)}
                style={{
                  textAlign: "left",
                  border: `2px solid ${isOn ? C.amber : C.border}`,
                  backgroundColor: isOn ? C.amberLight : C.surface,
                  borderRadius: 14,
                  padding: "14px 16px 14px 14px",
                  cursor: "pointer",
                  fontFamily:
                    "var(--font-jakarta), -apple-system, sans-serif",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 12,
                  transition: "border-color 0.15s, background 0.15s",
                }}
              >
                <div
                  aria-hidden
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: 6,
                    border: `1.5px solid ${isOn ? C.amber : C.border}`,
                    background: isOn ? C.amber : "transparent",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    marginTop: 2,
                  }}
                >
                  {isOn && <Check size={13} color="#fff" />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "baseline",
                      gap: 8,
                      marginBottom: 6,
                      flexWrap: "wrap",
                    }}
                  >
                    <span
                      style={{
                        fontSize: 15,
                        fontWeight: 700,
                        color: C.text,
                      }}
                    >
                      {d.column}
                    </span>
                    <span
                      style={{
                        fontSize: 12,
                        color: C.textTertiary,
                        fontWeight: 600,
                      }}
                    >
                      {d.uniqueValues.length} unique value
                      {d.uniqueValues.length === 1 ? "" : "s"}
                    </span>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 5,
                    }}
                  >
                    {sampleValues.map((v) => (
                      <span
                        key={v}
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          padding: "3px 9px",
                          borderRadius: 8,
                          backgroundColor: isOn
                            ? "rgba(232,134,12,0.18)"
                            : "#F2F2F7",
                          color: isOn ? C.amberDark : C.textSecondary,
                        }}
                      >
                        {v}
                      </span>
                    ))}
                    {remaining > 0 && (
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          padding: "3px 9px",
                          borderRadius: 8,
                          backgroundColor: "#F2F2F7",
                          color: C.textTertiary,
                        }}
                      >
                        +{remaining} more
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {error && (
        <div
          style={{
            backgroundColor: C.orangeLight,
            borderRadius: 16,
            padding: "14px 22px",
            marginBottom: 16,
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
          role="alert"
        >
          <AlertCircle size={18} color={C.orange} />
          <span style={{ fontSize: 14, color: C.orange, fontWeight: 600 }}>
            {error}
          </span>
        </div>
      )}

      <div
        style={{
          display: "flex",
          gap: 12,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <button
          type="button"
          onClick={onContinue}
          disabled={busy}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "12px 24px",
            borderRadius: 14,
            border: "none",
            background: brandGradient,
            color: "#fff",
            fontSize: 14,
            fontWeight: 700,
            cursor: busy ? "default" : "pointer",
            opacity: busy ? 0.6 : 1,
            boxShadow: shadow.md,
            fontFamily: "var(--font-jakarta), -apple-system, sans-serif",
          }}
        >
          {busy ? (
            <>
              <LoaderIcon size={16} className="spin" /> Uploading…
            </>
          ) : (
            <>
              <Sparkles size={16} /> Continue with {selected.size} cohort
              column{selected.size === 1 ? "" : "s"}
            </>
          )}
        </button>
        <button
          type="button"
          onClick={onSkip}
          disabled={busy}
          style={{
            padding: "12px 22px",
            borderRadius: 14,
            border: "none",
            backgroundColor: "#F2F2F7",
            color: C.textSecondary,
            fontSize: 14,
            fontWeight: 700,
            cursor: busy ? "default" : "pointer",
            fontFamily: "var(--font-jakarta), -apple-system, sans-serif",
          }}
        >
          Skip — upload without engagement cohorts
        </button>
      </div>
    </div>
  );
}
