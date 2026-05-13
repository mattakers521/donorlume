"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

import { C, brandGradient } from "@/lib/design";
import { RANGE_OPTIONS, type RangeKey } from "@/lib/reports/range";

type Props = {
  current: RangeKey;
};

/**
 * Segmented control for the report date range. Pushes the selection
 * into the URL (?range=...) so deep-linking + browser back/forward
 * work, and so the CSV export's date filter mirrors the on-screen view.
 */
export function DateRangeSelector({ current }: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  const select = (key: RangeKey) => {
    if (pending || key === current) return;
    const next = new URLSearchParams(params?.toString() ?? "");
    next.set("range", key);
    startTransition(() => router.push(`/reports?${next.toString()}`));
  };

  return (
    <div
      role="tablist"
      aria-label="Report date range"
      style={{
        display: "inline-flex",
        gap: 4,
        padding: 4,
        borderRadius: 14,
        backgroundColor: C.surfaceHover,
        border: `1px solid ${C.border}`,
        flexWrap: "wrap",
      }}
    >
      {RANGE_OPTIONS.map((opt) => {
        const active = opt.key === current;
        return (
          <button
            key={opt.key}
            type="button"
            role="tab"
            aria-selected={active}
            disabled={pending}
            onClick={() => select(opt.key)}
            style={{
              padding: "8px 14px",
              borderRadius: 10,
              border: "none",
              cursor: pending ? "default" : "pointer",
              fontSize: 13,
              fontWeight: 700,
              background: active ? brandGradient : "transparent",
              color: active ? "#fff" : C.text,
              boxShadow: active
                ? "0 4px 12px rgba(232,134,12,0.25)"
                : "none",
              fontFamily: "var(--font-jakarta), sans-serif",
              transition: "background 0.15s, color 0.15s",
              opacity: pending && !active ? 0.6 : 1,
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
