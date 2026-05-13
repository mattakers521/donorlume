"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  ChevronUp,
  Heart,
  Mail,
  Search,
  Upload,
  Users,
} from "lucide-react";
import type {
  CohortDefinition,
  Donor,
  DonorCohort,
} from "@prisma/client";

import { C, brandGradient, shadow } from "@/lib/design";
import { fmt } from "@/lib/format";
import { ScoreRing } from "@/components/score-ring";
import {
  CohortBadge,
  CohortOverflow,
} from "@/components/lapsed/cohort-badge";
import { CohortFilter } from "@/components/lapsed/cohort-filter";

export type DonorWithCohorts = Donor & {
  cohorts: (DonorCohort & { cohort: CohortDefinition })[];
};

type SortKey =
  | "name"
  | "email"
  | "donorType"
  | "totalGiven"
  | "lastGift"
  | "score";

type Props = {
  donors: DonorWithCohorts[];
  cohorts: CohortDefinition[];
  listCount: number;
};

/**
 * Unified "all donors across all lists" view for /donors.
 *
 * Key differences from /lapsed:
 *   • No isLapsed filter — shows every donor regardless of status.
 *   • Donor-type filter (built from distinct values in the data).
 *   • Table columns track the spec literally: Name / Email / Type /
 *     Total Given / Last Gift Date / Score / Cohorts.
 *
 * Reuses CohortFilter + CohortBadge + ScoreRing from /lapsed so the
 * visual language stays consistent across the app.
 */
export function DonorsClient({ donors, cohorts, listCount }: Props) {
  const router = useRouter();

  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("score");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [cohortFilter, setCohortFilter] = useState<Set<string>>(new Set());
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Distinct donor-type values straight from the data. We don't hardcode
  // the list because donorType is a free-form CSV field — orgs upload
  // "Individual" / "Corporate" / "Foundation" / "recurring" / "monthly" /
  // anything else. Sorted alphabetically for predictability.
  const typeOptions = useMemo(() => {
    const set = new Set<string>();
    for (const d of donors) {
      const t = d.donorType?.trim();
      if (t) set.add(t);
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [donors]);

  // Apply cohort filter (AND across selected cohorts — same semantics as
  // /lapsed) → donor-type filter → search. Sort runs last on the result.
  const filtered = useMemo(() => {
    let rows = donors;

    if (cohortFilter.size > 0) {
      rows = rows.filter((d) => {
        const ids = new Set(d.cohorts.map((c) => c.cohortDefinitionId));
        for (const id of cohortFilter) if (!ids.has(id)) return false;
        return true;
      });
    }

    if (typeFilter !== "all") {
      rows = rows.filter((d) => (d.donorType ?? "") === typeFilter);
    }

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
            return d.name.toLowerCase();
          case "email":
            return (d.email ?? "").toLowerCase();
          case "donorType":
            return (d.donorType ?? "").toLowerCase();
          case "totalGiven":
            return d.totalGiven ?? 0;
          case "lastGift":
            // Newest first under desc → use negative timestamp.
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
  }, [donors, cohortFilter, typeFilter, search, sortKey, sortDir]);

  const stats = useMemo(() => {
    const totalGiven = filtered.reduce(
      (sum, d) => sum + (d.totalGiven ?? 0),
      0,
    );
    const lapsed = filtered.filter((d) => d.isLapsed).length;
    const highPriority = filtered.filter((d) => d.tier === "High").length;
    return {
      donorCount: filtered.length,
      totalGiven,
      lapsed,
      highPriority,
    };
  }, [filtered]);

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
      // Default direction per column — descending for the numeric/
      // recency-style columns where "biggest first" reads naturally,
      // ascending for the alphabetic ones.
      setSortDir(
        key === "name" || key === "email" || key === "donorType"
          ? "asc"
          : "desc",
      );
    }
  };

  const generateOutreach = () => {
    if (selected.size === 0) return;
    const ids = [...selected].join(",");
    router.push(`/outreach/new?donors=${encodeURIComponent(ids)}`);
  };

  return (
    <div style={{ maxWidth: 1200 }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 12,
          alignItems: "flex-end",
          justifyContent: "space-between",
          marginBottom: 24,
        }}
      >
        <div>
          <h1
            style={{
              fontFamily: "var(--font-instrument-serif), Georgia, serif",
              fontSize: "clamp(28px, 4vw, 36px)",
              fontWeight: 400,
              letterSpacing: -1,
              color: C.text,
              margin: "0 0 4px",
              lineHeight: 1.1,
            }}
          >
            Donor Intelligence
          </h1>
          <p
            style={{
              fontSize: 14.5,
              color: C.textSecondary,
              fontWeight: 500,
              margin: 0,
            }}
          >
            {donors.length} donor{donors.length === 1 ? "" : "s"} across{" "}
            {listCount} list{listCount === 1 ? "" : "s"} · every record in
            one searchable view.
          </p>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Link
            href="/lapsed"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "10px 18px",
              borderRadius: 12,
              backgroundColor: "#F2F2F7",
              color: C.textSecondary,
              fontSize: 13,
              fontWeight: 700,
              textDecoration: "none",
              fontFamily: "var(--font-jakarta), -apple-system, sans-serif",
            }}
          >
            <Upload size={15} /> Upload More Donors
          </Link>
          {selected.size > 0 && (
            <button
              type="button"
              onClick={generateOutreach}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "10px 18px",
                borderRadius: 12,
                border: "none",
                background: brandGradient,
                color: "#fff",
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
                boxShadow: "0 8px 20px rgba(232,134,12,0.25)",
                fontFamily:
                  "var(--font-jakarta), -apple-system, sans-serif",
              }}
            >
              <Mail size={15} /> Generate Outreach ({selected.size})
            </button>
          )}
        </div>
      </div>

      {/* Stat strip — recomputes against the active filter set */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 16,
          marginBottom: 24,
        }}
      >
        <StatCard
          icon={<Users size={18} color={C.amber} />}
          iconBg={C.amberLight}
          label="Donors"
          value={String(stats.donorCount)}
          sub={
            stats.donorCount !== donors.length
              ? `of ${donors.length} total`
              : undefined
          }
        />
        <StatCard
          icon={<Heart size={18} color={C.orange} />}
          iconBg={C.orangeLight}
          label="Lifetime Giving"
          value={fmt(stats.totalGiven)}
        />
        <StatCard
          icon={<Users size={18} color={C.purple} />}
          iconBg={C.purpleLight}
          label="Lapsed"
          value={String(stats.lapsed)}
        />
        <StatCard
          icon={<Heart size={18} color={C.green} />}
          iconBg={C.greenLight}
          label="High Priority"
          value={String(stats.highPriority)}
          sub="Score 80+"
        />
      </div>

      {/* Cohort filter — same dropdown component the lapsed view uses */}
      <CohortFilter
        cohorts={cohorts}
        selectedIds={cohortFilter}
        onToggle={toggleCohort}
        onClear={clearCohorts}
      />

      {/* Search + donor-type filter row */}
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
            placeholder="Search by name or email…"
            style={{
              border: "none",
              background: "none",
              fontSize: 14,
              color: C.text,
              outline: "none",
              width: "100%",
              fontFamily: "var(--font-jakarta), -apple-system, sans-serif",
            }}
          />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span
            style={{
              fontSize: 12,
              color: C.textTertiary,
              fontWeight: 700,
              letterSpacing: 0.4,
              textTransform: "uppercase",
            }}
          >
            Type
          </span>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            disabled={typeOptions.length === 0}
            style={{
              padding: "7px 12px",
              borderRadius: 10,
              border: `1.5px solid ${
                typeFilter !== "all" ? C.amber : C.border
              }`,
              backgroundColor:
                typeFilter !== "all" ? C.amberLight : C.surface,
              color: typeFilter !== "all" ? C.amber : C.textSecondary,
              fontSize: 13,
              fontWeight: 700,
              cursor: typeOptions.length === 0 ? "default" : "pointer",
              fontFamily: "var(--font-jakarta), -apple-system, sans-serif",
            }}
          >
            <option value="all">All types</option>
            {typeOptions.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
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
              padding: 56,
              textAlign: "center",
              color: C.textTertiary,
              fontSize: 14,
              fontWeight: 500,
            }}
          >
            No donors match the current filters.
          </div>
        ) : (
          <div className="app-scroll-x">
            <table
              style={{
                width: "100%",
                minWidth: 980,
                borderCollapse: "collapse",
              }}
            >
              <thead>
                <tr>
                  <th style={{ padding: "12px 18px", width: 36 }}>
                    <input
                      type="checkbox"
                      aria-label="Select all visible donors"
                      checked={
                        selected.size === filtered.length &&
                        filtered.length > 0
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
                    label="Email"
                    sKey="email"
                    active={sortKey === "email"}
                    dir={sortDir}
                    onSort={setSort}
                  />
                  <SortHeader
                    label="Type"
                    sKey="donorType"
                    active={sortKey === "donorType"}
                    dir={sortDir}
                    onSort={setSort}
                  />
                  <SortHeader
                    label="Total Given"
                    sKey="totalGiven"
                    active={sortKey === "totalGiven"}
                    dir={sortDir}
                    onSort={setSort}
                  />
                  <SortHeader
                    label="Last Gift"
                    sKey="lastGift"
                    active={sortKey === "lastGift"}
                    dir={sortDir}
                    onSort={setSort}
                  />
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
                      letterSpacing: 0.5,
                    }}
                  >
                    Cohorts
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((d) => (
                  <DonorRow
                    key={d.id}
                    donor={d}
                    selected={selected.has(d.id)}
                    onToggleSelect={() => toggleSel(d.id)}
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

// ─── Helpers ──────────────────────────────────────────────────────────

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
        <div style={{ fontSize: 12, color: C.textTertiary, marginTop: 4 }}>
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

function fmtDate(d: Date | string | null): string {
  if (!d) return "—";
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function DonorRow({
  donor,
  selected,
  onToggleSelect,
  onCohortClick,
}: {
  donor: DonorWithCohorts;
  selected: boolean;
  onToggleSelect: () => void;
  onCohortClick: (cohortId: string) => void;
}) {
  const baseBg = selected ? `${C.amberLight}44` : "transparent";
  const visibleCohorts = donor.cohorts.slice(0, 3);
  const overflow = Math.max(0, donor.cohorts.length - visibleCohorts.length);

  return (
    <tr
      style={{
        borderTop: `1px solid ${C.borderSubtle}`,
        backgroundColor: baseBg,
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
          aria-label={`Select ${donor.name}`}
          style={{ cursor: "pointer", accentColor: C.amber }}
        />
      </td>
      <td style={{ padding: "14px 18px" }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>
          {donor.name}
        </div>
      </td>
      <td
        style={{
          padding: "14px 18px",
          fontSize: 13.5,
          color: C.textSecondary,
        }}
      >
        {donor.email || "—"}
      </td>
      <td style={{ padding: "14px 18px" }}>
        {donor.donorType ? (
          <span
            style={{
              fontSize: 12,
              fontWeight: 700,
              padding: "3px 10px",
              borderRadius: 8,
              backgroundColor: "#F2F2F7",
              color: C.textSecondary,
            }}
          >
            {donor.donorType}
          </span>
        ) : (
          <span style={{ color: C.textTertiary, fontSize: 13 }}>—</span>
        )}
      </td>
      <td
        style={{
          padding: "14px 18px",
          fontSize: 15,
          fontWeight: 700,
          color: C.text,
        }}
      >
        {fmt(donor.totalGiven ?? null)}
      </td>
      <td
        style={{
          padding: "14px 18px",
          fontSize: 13.5,
          color: C.textSecondary,
          whiteSpace: "nowrap",
        }}
      >
        {fmtDate(donor.lastGiftDate)}
      </td>
      <td style={{ padding: "14px 18px" }}>
        <ScoreRing score={donor.reactivationScore ?? 0} size={38} />
      </td>
      <td style={{ padding: "14px 18px" }}>
        {donor.cohorts.length === 0 ? (
          <span style={{ color: C.textTertiary, fontSize: 13 }}>—</span>
        ) : (
          <div
            style={{
              display: "flex",
              gap: 5,
              flexWrap: "wrap",
              alignItems: "center",
              maxWidth: 280,
            }}
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
    </tr>
  );
}
