"use client";

import { useEffect, useRef, useState } from "react";
import type { CohortDefinition, CohortFamily } from "@prisma/client";
import { ChevronDown, Filter, X } from "lucide-react";

import { C, shadow } from "@/lib/design";
import { CohortBadge } from "@/components/lapsed/cohort-badge";

type Props = {
  cohorts: CohortDefinition[];
  /** Set of cohort definition ids currently filtering the table. */
  selectedIds: Set<string>;
  onToggle: (cohortId: string) => void;
  onClear: () => void;
};

const FAMILY_LABEL: Record<CohortFamily, string> = {
  GIVING_BEHAVIOR: "Giving Behavior",
  ENGAGEMENT: "Engagement",
  ENTITY_TYPE: "Entity Type",
  TRAJECTORY: "Trajectory",
  CUSTOM: "Custom",
};

const FAMILY_ORDER: CohortFamily[] = [
  "GIVING_BEHAVIOR",
  "ENGAGEMENT",
  "ENTITY_TYPE",
  "TRAJECTORY",
  "CUSTOM",
];

export function CohortFilter({
  cohorts,
  selectedIds,
  onToggle,
  onClear,
}: Props) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (
        wrapRef.current &&
        !wrapRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  // Group cohorts by family in the spec-defined family order.
  const grouped = FAMILY_ORDER.map((family) => ({
    family,
    items: cohorts.filter((c) => c.family === family),
  })).filter((g) => g.items.length > 0);

  const selectedCohorts = cohorts.filter((c) => selectedIds.has(c.id));

  return (
    <div
      style={{
        backgroundColor: C.surface,
        borderRadius: 16,
        boxShadow: shadow.sm,
        padding: "14px 18px",
        marginBottom: 16,
        display: "flex",
        alignItems: "center",
        gap: 12,
        flexWrap: "wrap",
      }}
    >
      <div
        ref={wrapRef}
        style={{ position: "relative", display: "inline-block" }}
      >
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 14px",
            borderRadius: 10,
            border: `1.5px solid ${selectedIds.size > 0 ? C.amber : C.border}`,
            backgroundColor: selectedIds.size > 0 ? C.amberLight : C.surface,
            color: selectedIds.size > 0 ? C.amber : C.textSecondary,
            fontSize: 13,
            fontWeight: 700,
            cursor: "pointer",
            fontFamily: "var(--font-jakarta), -apple-system, sans-serif",
          }}
        >
          <Filter size={14} />
          Cohorts
          {selectedIds.size > 0 && (
            <span
              style={{
                marginLeft: 2,
                padding: "1px 7px",
                borderRadius: 100,
                backgroundColor: C.amber,
                color: "#fff",
                fontSize: 11,
                fontWeight: 800,
              }}
            >
              {selectedIds.size}
            </span>
          )}
          <ChevronDown
            size={14}
            style={{
              transform: open ? "rotate(180deg)" : "none",
              transition: "transform 0.15s",
            }}
          />
        </button>

        {open && (
          <div
            style={{
              position: "absolute",
              top: "calc(100% + 8px)",
              left: 0,
              minWidth: 320,
              maxHeight: 460,
              overflowY: "auto",
              backgroundColor: C.surface,
              borderRadius: 14,
              boxShadow: shadow.lg,
              border: `1px solid ${C.border}`,
              padding: "12px 0",
              zIndex: 20,
            }}
          >
            {grouped.map((g, gi) => (
              <div
                key={g.family}
                style={{
                  paddingBottom: gi < grouped.length - 1 ? 8 : 0,
                  marginBottom: gi < grouped.length - 1 ? 8 : 0,
                  borderBottom:
                    gi < grouped.length - 1
                      ? `1px solid ${C.borderSubtle}`
                      : "none",
                }}
              >
                <div
                  style={{
                    padding: "4px 16px 8px",
                    fontSize: 11,
                    fontWeight: 800,
                    color: C.amber,
                    textTransform: "uppercase",
                    letterSpacing: 1.2,
                  }}
                >
                  {FAMILY_LABEL[g.family]}
                </div>
                {g.items.map((c) => {
                  const checked = selectedIds.has(c.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => onToggle(c.id)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        width: "100%",
                        padding: "8px 16px",
                        border: "none",
                        background: checked
                          ? "rgba(232,134,12,0.06)"
                          : "transparent",
                        color: C.text,
                        fontSize: 14,
                        fontWeight: 500,
                        cursor: "pointer",
                        textAlign: "left",
                        fontFamily:
                          "var(--font-jakarta), -apple-system, sans-serif",
                      }}
                      onMouseEnter={(e) => {
                        if (!checked)
                          e.currentTarget.style.background =
                            C.surfaceHover;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = checked
                          ? "rgba(232,134,12,0.06)"
                          : "transparent";
                      }}
                    >
                      <span
                        aria-hidden
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: 3,
                          flexShrink: 0,
                          backgroundColor: c.color || C.amber,
                        }}
                      />
                      <span style={{ flex: 1 }}>{c.name}</span>
                      {checked && (
                        <span
                          style={{
                            fontSize: 11,
                            color: C.amber,
                            fontWeight: 800,
                          }}
                        >
                          ✓
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedCohorts.length > 0 && (
        <>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              flexWrap: "wrap",
              flex: 1,
            }}
          >
            {selectedCohorts.map((c) => (
              <span
                key={c.id}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "4px 4px 4px 10px",
                  borderRadius: 100,
                  backgroundColor: `${c.color}1F`,
                  color: c.color || C.amber,
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                {c.name}
                <button
                  type="button"
                  onClick={() => onToggle(c.id)}
                  aria-label={`Remove ${c.name} filter`}
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: "50%",
                    border: "none",
                    background: c.color || C.amber,
                    color: "#fff",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <X size={11} />
                </button>
              </span>
            ))}
          </div>
          <button
            type="button"
            onClick={onClear}
            style={{
              fontSize: 12,
              color: C.textTertiary,
              background: "none",
              border: "none",
              cursor: "pointer",
              fontWeight: 700,
              fontFamily:
                "var(--font-jakarta), -apple-system, sans-serif",
              textDecoration: "underline",
              textUnderlineOffset: 3,
            }}
          >
            Clear all
          </button>
        </>
      )}
    </div>
  );
}

export { CohortBadge };
