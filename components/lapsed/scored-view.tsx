"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  ChevronUp,
  DollarSign,
  Eye,
  Mail,
  Search,
  TrendingUp,
  Upload,
  UserX,
} from "lucide-react";
import type { CohortDefinition } from "@prisma/client";

import { C, brandGradient, shadow } from "@/lib/design";
import { fmt } from "@/lib/format";
import { ScoreRing } from "@/components/score-ring";
import { TierBadge } from "@/components/tier-badge";
import {
  CohortBadge,
  CohortOverflow,
} from "@/components/lapsed/cohort-badge";
import { CohortFilter } from "@/components/lapsed/cohort-filter";
import type { DonorWithCohorts } from "@/components/lapsed/lapsed-client";

type SortKey = "score" | "name" | "totalGiven" | "daysSinceLast";
type Tier = "all" | "High" | "Medium" | "Low" | "Cold";

type Props = {
  donors: DonorWithCohorts[];
  cohorts: CohortDefinition[];
  totalUploaded: number;
  thresholdMonths: number;
  onThresholdChange: (months: number) => void;
  onNewUpload: () => void;
};

export function ScoredView({
  donors,
  cohorts,
  totalUploaded,
  thresholdMonths,
  onThresholdChange,
  onNewUpload,
}: Props) {
  const router = useRouter();

  const [sortKey, setSortKey] = useState<SortKey>("score");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [tierFilter, setTierFilter] = useState<Tier>("all");
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // Spec §5.1: AND across selected cohorts — narrows the list as you
  // stack filters. Empty set = no cohort filter active.
  const [cohortFilter, setCohortFilter] = useState<Set<string>>(new Set());

  const [now] = useState(() => Date.now());

  // Lapsed donors only — that's the whole point of this page.
  const lapsed = useMemo(() => donors.filter((d) => d.isLapsed), [donors]);

  // Apply cohort filter ON TOP of the lapsed filter so stat cards
  // recompute to the active filter (Spec §6).
  const cohortFiltered = useMemo(() => {
    if (cohortFilter.size === 0) return lapsed;
    return lapsed.filter((d) => {
      const ids = new Set(d.cohorts.map((c) => c.cohortDefinitionId));
      for (const id of cohortFilter) if (!ids.has(id)) return false;
      return true;
    });
  }, [lapsed, cohortFilter]);

  const filtered = useMemo(() => {
    let rows = cohortFiltered;
    if (tierFilter !== "all") rows = rows.filter((d) => d.tier === tierFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter(
        (d) =>
          d.name.toLowerCase().includes(q) ||
          (d.email ?? "").toLowerCase().includes(q),
      );
    }
    const sorted = [...rows].sort((a, b) => {
      const get = (d: DonorWithCohorts): string | number => {
        switch (sortKey) {
          case "name":
            return d.name;
          case "totalGiven":
            return d.totalGiven ?? 0;
          case "daysSinceLast":
            return d.lastGiftDate
              ? -new Date(d.lastGiftDate).getTime()
              : Number.POSITIVE_INFINITY;
          case "score":
          default:
            return d.reactivationScore ?? 0;
        }
      };
      const va = get(a);
      const vb = get(b);
      if (typeof va === "string" && typeof vb === "string") {
        return sortDir === "asc"
          ? va.localeCompare(vb)
          : vb.localeCompare(va);
      }
      const na = Number(va);
      const nb = Number(vb);
      return sortDir === "asc" ? na - nb : nb - na;
    });
    return sorted;
  }, [cohortFiltered, tierFilter, search, sortKey, sortDir]);

  const stats = useMemo(() => {
    const base = cohortFiltered;
    const tv = base.reduce((sum, d) => sum + (d.totalGiven ?? 0), 0);
    return {
      lapsedCount: base.length,
      lapsedValue: tv,
      highPriority: base.filter((d) => d.tier === "High").length,
      activeElsewhere: base.filter((d) => d.activeElsewhere).length,
    };
  }, [cohortFiltered]);

  const toggleCohort = (id: string) => {
    setCohortFilter((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const clearCohorts = () => setCohortFilter(new Set());

  const toggleSel = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelAll = () => {
    setSelected((prev) =>
      prev.size === filtered.length
        ? new Set()
        : new Set(filtered.map((d) => d.id)),
    );
  };

  const setSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const draftOutreach = () => {
    const ids = [...selected].join(",");
    router.push(`/outreach/new?donors=${encodeURIComponent(ids)}`);
  };

  return (
    <div style={{ maxWidth: 1200 }}>
      {/* Header row */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
          marginBottom: 24,
        }}
      >
        <p style={{ fontSize: 14, color: C.textSecondary, margin: 0 }}>
          {totalUploaded} uploaded · {stats.lapsedCount} lapsed (
          {thresholdMonths}+ months)
        </p>
        <div style={{ display: "flex", gap: 10 }}>
          <button
            type="button"
            onClick={onNewUpload}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "10px 20px",
              borderRadius: 12,
              border: "none",
              backgroundColor: "#F2F2F7",
              color: C.textSecondary,
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: "var(--font-jakarta), -apple-system, sans-serif",
            }}
          >
            <Upload size={15} /> New Upload
          </button>
          {selected.size > 0 && (
            <button
              type="button"
              onClick={draftOutreach}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "10px 20px",
                borderRadius: 12,
                border: "none",
                background: brandGradient,
                color: "#fff",
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
                fontFamily: "var(--font-jakarta), -apple-system, sans-serif",
              }}
            >
              <Mail size={15} /> Draft Outreach ({selected.size})
            </button>
          )}
        </div>
      </div>

      {/* Stat cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 16,
          marginBottom: 24,
        }}
      >
        <StatCard
          icon={<UserX size={18} color={C.orange} />}
          iconBg={C.orangeLight}
          label="Lapsed"
          value={String(stats.lapsedCount)}
          sub={`of ${totalUploaded}`}
        />
        <StatCard
          icon={<DollarSign size={18} color={C.amber} />}
          iconBg={C.amberLight}
          label="Lapsed Value"
          value={fmt(stats.lapsedValue)}
        />
        <StatCard
          icon={<TrendingUp size={18} color={C.green} />}
          iconBg={C.greenLight}
          label="High Priority"
          value={String(stats.highPriority)}
          sub="80+"
        />
        <StatCard
          icon={<Eye size={18} color={C.purple} />}
          iconBg={C.purpleLight}
          label="Active Elsewhere"
          value={String(stats.activeElsewhere)}
        />
      </div>

      {/* Cohort filter bar (Spec §5.1) */}
      <CohortFilter
        cohorts={cohorts}
        selectedIds={cohortFilter}
        onToggle={toggleCohort}
        onClear={clearCohorts}
      />

      {/* Filter bar */}
      <div
        style={{
          backgroundColor: C.surface,
          borderRadius: 16,
          boxShadow: shadow.sm,
          padding: "14px 20px",
          marginBottom: 20,
          display: "flex",
          alignItems: "center",
          gap: 14,
          flexWrap: "wrap",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            flex: 1,
            minWidth: 200,
            padding: "8px 14px",
            borderRadius: 10,
            backgroundColor: "#F2F2F7",
          }}
        >
          <Search size={15} color={C.textTertiary} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search donors…"
            style={{
              border: "none",
              background: "none",
              fontSize: 14,
              color: C.text,
              outline: "none",
              width: "100%",
              fontFamily:
                "var(--font-jakarta), -apple-system, sans-serif",
            }}
          />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span
            style={{ fontSize: 12, color: C.textTertiary, fontWeight: 600 }}
          >
            After
          </span>
          <select
            value={thresholdMonths}
            onChange={(e) => onThresholdChange(Number(e.target.value))}
            style={{
              padding: "6px 10px",
              borderRadius: 8,
              border: `1px solid ${C.border}`,
              fontSize: 13,
              backgroundColor: C.surface,
              cursor: "pointer",
              fontFamily:
                "var(--font-jakarta), -apple-system, sans-serif",
            }}
          >
            {[6, 9, 12, 18, 24].map((m) => (
              <option key={m} value={m}>
                {m}mo
              </option>
            ))}
          </select>
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          {(["all", "High", "Medium", "Low", "Cold"] as Tier[]).map((t) => {
            const active = tierFilter === t;
            return (
              <button
                key={t}
                type="button"
                onClick={() => setTierFilter(t)}
                style={{
                  padding: "6px 14px",
                  borderRadius: 10,
                  fontSize: 12,
                  fontWeight: 700,
                  border: "none",
                  backgroundColor: active ? C.amberLight : "#F2F2F7",
                  color: active ? C.amber : C.textTertiary,
                  cursor: "pointer",
                  fontFamily:
                    "var(--font-jakarta), -apple-system, sans-serif",
                }}
              >
                {t === "all" ? "All" : t}
              </button>
            );
          })}
        </div>
      </div>

      {/* Table */}
      <div
        style={{
          backgroundColor: C.surface,
          borderRadius: 20,
          boxShadow: shadow.sm,
          overflow: "hidden",
        }}
      >
        {filtered.length === 0 ? (
          <div
            style={{
              padding: 48,
              textAlign: "center",
              color: C.textTertiary,
            }}
          >
            No matching donors.
          </div>
        ) : (
          <div className="app-scroll-x">
          <table
            style={{
              width: "100%",
              minWidth: 880,
              borderCollapse: "collapse",
            }}
          >
            <thead>
              <tr>
                <th style={{ padding: "12px 18px", width: 36 }}>
                  <input
                    type="checkbox"
                    checked={
                      selected.size === filtered.length && filtered.length > 0
                    }
                    onChange={toggleSelAll}
                    style={{ cursor: "pointer", accentColor: C.amber }}
                  />
                </th>
                <SortHeader
                  label="Donor"
                  sKey="name"
                  active={sortKey === "name"}
                  dir={sortDir}
                  onSort={setSort}
                />
                <SortHeader
                  label="Last Gift"
                  sKey="daysSinceLast"
                  active={sortKey === "daysSinceLast"}
                  dir={sortDir}
                  onSort={setSort}
                />
                <SortHeader
                  label="Lifetime"
                  sKey="totalGiven"
                  active={sortKey === "totalGiven"}
                  dir={sortDir}
                  onSort={setSort}
                />
                <th
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: C.textTertiary,
                    textAlign: "left",
                    padding: "12px 18px",
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                  }}
                >
                  Signals
                </th>
                <SortHeader
                  label="Score"
                  sKey="score"
                  active={sortKey === "score"}
                  dir={sortDir}
                  onSort={setSort}
                />
                <th
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: C.textTertiary,
                    textAlign: "left",
                    padding: "12px 18px",
                    textTransform: "uppercase",
                  }}
                >
                  Tier
                </th>
                <th style={{ width: 36 }} />
              </tr>
            </thead>
            <tbody>
              {filtered.map((d) => (
                <DonorRow
                  key={d.id}
                  donor={d}
                  now={now}
                  expanded={expandedId === d.id}
                  selected={selected.has(d.id)}
                  onToggleSelect={() => toggleSel(d.id)}
                  onToggleExpand={() =>
                    setExpandedId((cur) => (cur === d.id ? null : d.id))
                  }
                  onCohortClick={toggleCohort}
                />
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── helpers ────────────────────────────────────────────────────────────────

function StatCard({
  icon,
  iconBg,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  iconBg: string;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div
      style={{
        backgroundColor: C.surface,
        borderRadius: 20,
        boxShadow: shadow.sm,
        padding: "20px 22px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 12,
        }}
      >
        <div
          style={{
            width: 38,
            height: 38,
            borderRadius: 12,
            backgroundColor: iconBg,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {icon}
        </div>
        <span
          style={{ fontSize: 12, color: C.textTertiary, fontWeight: 600 }}
        >
          {label}
        </span>
      </div>
      <div
        style={{
          fontSize: 28,
          fontWeight: 400,
          fontFamily: "var(--font-instrument-serif), Georgia, serif",
          lineHeight: 1.1,
        }}
      >
        {value}
      </div>
      {sub && (
        <div
          style={{ fontSize: 12, color: C.textTertiary, marginTop: 4 }}
        >
          {sub}
        </div>
      )}
    </div>
  );
}

function SortHeader({
  label,
  sKey,
  active,
  dir,
  onSort,
}: {
  label: string;
  sKey: SortKey;
  active: boolean;
  dir: "asc" | "desc";
  onSort: (k: SortKey) => void;
}) {
  return (
    <th
      onClick={() => onSort(sKey)}
      style={{
        fontSize: 11,
        fontWeight: 700,
        color: active ? C.amber : C.textTertiary,
        textAlign: "left",
        padding: "12px 18px",
        textTransform: "uppercase",
        letterSpacing: 0.5,
        cursor: "pointer",
        userSelect: "none",
        whiteSpace: "nowrap",
      }}
    >
      {label}
      {active &&
        (dir === "desc" ? (
          <ChevronDown size={12} style={{ verticalAlign: "middle" }} />
        ) : (
          <ChevronUp size={12} style={{ verticalAlign: "middle" }} />
        ))}
    </th>
  );
}

function DonorRow({
  donor,
  now,
  expanded,
  selected,
  onToggleSelect,
  onToggleExpand,
  onCohortClick,
}: {
  donor: DonorWithCohorts;
  now: number;
  expanded: boolean;
  selected: boolean;
  onToggleSelect: () => void;
  onToggleExpand: () => void;
  onCohortClick: (cohortId: string) => void;
}) {
  const months = donor.lastGiftDate
    ? Math.round(
        (now - new Date(donor.lastGiftDate).getTime()) / (30 * 86_400_000),
      )
    : null;

  const baseBg = selected ? `${C.amberLight}44` : "transparent";

  // Show up to 3 badges; overflow into "+N more". Spec §5.2.
  const visibleCohorts = donor.cohorts.slice(0, 3);
  const overflow = Math.max(0, donor.cohorts.length - visibleCohorts.length);

  return (
    <>
      <tr
        style={{
          borderTop: `1px solid ${C.borderSubtle}`,
          backgroundColor: baseBg,
          cursor: "pointer",
        }}
        onMouseEnter={(e) => {
          if (!selected) e.currentTarget.style.backgroundColor = C.surfaceHover;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = baseBg;
        }}
      >
        <td style={{ padding: "14px 18px" }}>
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggleSelect}
            style={{ cursor: "pointer", accentColor: C.amber }}
          />
        </td>
        <td style={{ padding: "14px 18px" }}>
          <div onClick={onToggleExpand} style={{ cursor: "pointer" }}>
            <div style={{ fontSize: 15, fontWeight: 700 }}>{donor.name}</div>
            <div style={{ fontSize: 12, color: C.textTertiary }}>
              {donor.email || donor.donorType || "—"}
            </div>
          </div>
          {donor.cohorts.length > 0 && (
            <div
              style={{
                display: "flex",
                gap: 5,
                marginTop: 7,
                flexWrap: "wrap",
                alignItems: "center",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {visibleCohorts.map((dc) => (
                <CohortBadge
                  key={dc.id}
                  cohort={dc.cohort}
                  onClick={() => onCohortClick(dc.cohortDefinitionId)}
                />
              ))}
              {overflow > 0 && <CohortOverflow count={overflow} />}
            </div>
          )}
        </td>
        <td style={{ padding: "14px 18px" }} onClick={onToggleExpand}>
          {months != null ? (
            <span
              style={{
                fontSize: 14,
                color: months >= 18 ? C.orange : C.textSecondary,
                fontWeight: months >= 18 ? 700 : 500,
              }}
            >
              {months}mo
            </span>
          ) : (
            "—"
          )}
        </td>
        <td
          style={{ padding: "14px 18px", fontSize: 15, fontWeight: 700 }}
          onClick={onToggleExpand}
        >
          {fmt(donor.totalGiven ?? null)}
        </td>
        <td style={{ padding: "14px 18px" }} onClick={onToggleExpand}>
          <div style={{ display: "flex", gap: 6 }}>
            {donor.activeElsewhere && (
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  padding: "3px 10px",
                  borderRadius: 8,
                  backgroundColor: C.purpleLight,
                  color: C.purple,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 3,
                }}
              >
                <Eye size={11} /> Active
              </span>
            )}
            {donor.searchIntent && (
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  padding: "3px 10px",
                  borderRadius: 8,
                  backgroundColor: C.goldLight,
                  color: C.amberDark,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 3,
                }}
              >
                <Search size={11} /> Intent
              </span>
            )}
          </div>
        </td>
        <td style={{ padding: "14px 18px" }} onClick={onToggleExpand}>
          <ScoreRing score={donor.reactivationScore ?? 0} size={38} />
        </td>
        <td style={{ padding: "14px 18px" }} onClick={onToggleExpand}>
          <TierBadge tier={donor.tier} />
        </td>
        <td style={{ padding: "14px 18px" }}>
          <ChevronDown
            size={16}
            color={C.textTertiary}
            style={{
              transform: expanded ? "rotate(180deg)" : "none",
              transition: "transform 0.2s",
              cursor: "pointer",
            }}
            onClick={onToggleExpand}
          />
        </td>
      </tr>
      {expanded && <ExpandedRow donor={donor} />}
    </>
  );
}

function ExpandedRow({ donor }: { donor: DonorWithCohorts }) {
  const breakdown = [
    {
      label: "Recency",
      score: donor.recencyScore ?? 0,
      max: 30,
      color: C.amber,
    },
    {
      label: "Frequency",
      score: donor.frequencyScore ?? 0,
      max: 25,
      color: C.purple,
    },
    {
      label: "Monetary",
      score: donor.monetaryScore ?? 0,
      max: 25,
      color: C.gold,
    },
    {
      label: "Tenure",
      score: donor.tenureScore ?? 0,
      max: 20,
      color: C.orange,
    },
  ];

  const fmtDate = (d: Date | string | null) => {
    if (!d) return "—";
    const date = d instanceof Date ? d : new Date(d);
    return Number.isNaN(date.getTime())
      ? "—"
      : date.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        });
  };

  return (
    <tr style={{ borderTop: `1px solid ${C.borderSubtle}` }}>
      <td
        colSpan={8}
        style={{
          padding: "0 18px 20px 56px",
          backgroundColor: C.surfaceHover,
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: 28,
            paddingTop: 20,
          }}
        >
          <div>
            <h4
              style={{
                fontSize: 11,
                fontWeight: 800,
                color: C.textTertiary,
                textTransform: "uppercase",
                letterSpacing: 1,
                margin: "0 0 14px",
              }}
            >
              Score Breakdown
            </h4>
            {breakdown.map((b) => (
              <div key={b.label} style={{ marginBottom: 10 }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: 5,
                  }}
                >
                  <span style={{ fontSize: 13, color: C.textSecondary }}>
                    {b.label}
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 700 }}>
                    {b.score}/{b.max}
                  </span>
                </div>
                <div
                  style={{
                    height: 5,
                    backgroundColor: C.border,
                    borderRadius: 3,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      width: `${(b.score / b.max) * 100}%`,
                      backgroundColor: b.color,
                      borderRadius: 3,
                      transition: "width 0.5s",
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div>
            <h4
              style={{
                fontSize: 11,
                fontWeight: 800,
                color: C.textTertiary,
                textTransform: "uppercase",
                letterSpacing: 1,
                margin: "0 0 14px",
              }}
            >
              Details
            </h4>
            <div
              style={{
                fontSize: 14,
                lineHeight: 2.2,
                color: C.textSecondary,
              }}
            >
              <div>
                <strong style={{ color: C.text }}>Type:</strong>{" "}
                {donor.donorType || "—"}
              </div>
              <div>
                <strong style={{ color: C.text }}>First gift:</strong>{" "}
                {fmtDate(donor.firstGiftDate)}
              </div>
              <div>
                <strong style={{ color: C.text }}>Last gift:</strong>{" "}
                {fmtDate(donor.lastGiftDate)}
              </div>
              <div>
                <strong style={{ color: C.text }}>Largest:</strong>{" "}
                {donor.largestGift ? fmt(donor.largestGift) : "—"}
              </div>
              {donor.notes && (
                <div>
                  <strong style={{ color: C.text }}>Notes:</strong>{" "}
                  {donor.notes}
                </div>
              )}
            </div>
          </div>
        </div>
      </td>
    </tr>
  );
}
