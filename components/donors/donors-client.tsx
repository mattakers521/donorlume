"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  ChevronUp,
  FileSpreadsheet,
  Heart,
  Layers,
  Mail,
  Search,
  Upload,
  UserCheck,
  Users,
  X,
} from "lucide-react";
import type {
  CohortDefinition,
  Donor,
  DonorCohort,
} from "@prisma/client";

import { C, brandGradient, shadow } from "@/lib/design";
import { fmt } from "@/lib/format";
import { ScoreRing } from "@/components/score-ring";
import { ClaimButton } from "@/components/donors/claim-button";
import {
  CohortBadge,
  CohortOverflow,
} from "@/components/lapsed/cohort-badge";
import { CohortFilter } from "@/components/lapsed/cohort-filter";

/**
 * One row of campaign history rendered inside the expanded donor view.
 * Subset of OutreachDraft + the campaign's name/date, projected
 * server-side so the wire payload stays compact.
 */
export type DonorCampaignEntry = {
  id: string;
  subject: string;
  /** OutreachDraft.status — drives the delivery-status pill. */
  status:
    | "DRAFT"
    | "APPROVED"
    | "SENT"
    | "OPENED"
    | "REPLIED"
    | "BOUNCED";
  sentAt: Date | string | null;
  deliveredAt: Date | string | null;
  openedAt: Date | string | null;
  openCount: number;
  clickedAt: Date | string | null;
  clickCount: number;
  repliedAt: Date | string | null;
  bouncedAt: Date | string | null;
  bounceReason: string | null;
  createdAt: Date | string;
  campaign: {
    id: string;
    name: string;
    createdAt: Date | string;
  };
};

export type DonorWithCohorts = Donor & {
  cohorts: (DonorCohort & { cohort: CohortDefinition })[];
  claimedBy: { id: string; name: string | null; email: string } | null;
  outreachDrafts: DonorCampaignEntry[];
};

type SortKey =
  | "name"
  | "email"
  | "donorType"
  | "totalGiven"
  | "lastGift"
  | "score";

/**
 * One row of the Upload History section — projected server-side from
 * each DonorList + its uploader join in `/donors/page.tsx`. We pass
 * only the data the section renders, not the full DonorList model, so
 * the client bundle stays small.
 */
export type UploadHistoryRow = {
  id: string;
  fileName: string;
  /** ISO 8601 string (Date doesn't serialize through some RSC paths). */
  createdAt: string;
  totalDonors: number;
  /** Number of distinct cohorts any donor on this list was classified into. */
  cohortCount: number;
  uploadedBy: { name: string | null; email: string } | null;
};

type Props = {
  donors: DonorWithCohorts[];
  cohorts: CohortDefinition[];
  listCount: number;
  uploads: UploadHistoryRow[];
  currentUser: { id: string; name: string | null; email: string };
  orgRole: "OWNER" | "ADMIN" | "MEMBER" | "VIEWER";
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
export function DonorsClient({
  donors,
  cohorts,
  listCount,
  uploads,
  currentUser,
  orgRole,
}: Props) {
  const router = useRouter();

  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("score");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [cohortFilter, setCohortFilter] = useState<Set<string>>(new Set());
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // When set, the table is filtered to donors from this DonorList only.
  // Cleared by clicking the upload row again or hitting the × on the
  // active-filter pill rendered above the search bar.
  const [uploadFilter, setUploadFilter] = useState<string | null>(null);
  // "My Donors" quick filter — the major gift officer's working list.
  // When true, the table scopes to donors claimed by the current user.
  const [myDonorsOnly, setMyDonorsOnly] = useState(false);
  // Expanded-row id. Click any cell on a row (except the checkbox or
  // the claim widget) to toggle the campaign-history detail panel.
  const [expandedId, setExpandedId] = useState<string | null>(null);

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

  // Apply upload filter → cohort filter (AND across selected cohorts,
  // same semantics as /lapsed) → donor-type filter → search. Sort runs
  // last on the result. Upload filter runs first because it's the
  // narrowest cut and keeps every downstream stat honest to "this
  // upload only".
  const filtered = useMemo(() => {
    let rows = donors;

    if (uploadFilter) {
      rows = rows.filter((d) => d.donorListId === uploadFilter);
    }

    if (myDonorsOnly) {
      rows = rows.filter((d) => d.claimedBy?.id === currentUser.id);
    }

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
  }, [donors, uploadFilter, myDonorsOnly, currentUser.id, cohortFilter, typeFilter, search, sortKey, sortDir]);

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

      {/* Upload History — every team member sees every list, regardless
          of who uploaded it. Rows are clickable to scope the table
          below to a single upload's donors. */}
      {uploads.length > 0 && (
        <UploadHistorySection
          uploads={uploads}
          activeUploadId={uploadFilter}
          onSelect={(id) =>
            setUploadFilter((prev) => (prev === id ? null : id))
          }
        />
      )}

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

        {/* My Donors quick filter — the major gift officer's working list.
            Toggle pill: when on, the table scopes to donors claimed by
            the current user. */}
        <button
          type="button"
          onClick={() => setMyDonorsOnly((v) => !v)}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "7px 14px",
            borderRadius: 10,
            border: `1.5px solid ${myDonorsOnly ? C.amber : C.border}`,
            backgroundColor: myDonorsOnly ? C.amberLight : C.surface,
            color: myDonorsOnly ? C.amber : C.textSecondary,
            fontSize: 13,
            fontWeight: 700,
            cursor: "pointer",
            fontFamily: "var(--font-jakarta), -apple-system, sans-serif",
            whiteSpace: "nowrap",
          }}
          title="Show only donors you've claimed"
        >
          <UserCheck size={14} strokeWidth={2.4} />
          My Donors
        </button>

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
                minWidth: 1180,
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
                  <th
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: C.textTertiary,
                      textAlign: "left",
                      padding: "12px 18px",
                      textTransform: "uppercase",
                      letterSpacing: 0.5,
                      whiteSpace: "nowrap",
                    }}
                  >
                    Claim
                  </th>
                  <th style={{ width: 40 }} />
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
                    currentUser={currentUser}
                    orgRole={orgRole}
                    expanded={expandedId === d.id}
                    onToggleExpand={() =>
                      setExpandedId((cur) => (cur === d.id ? null : d.id))
                    }
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
  currentUser,
  orgRole,
  expanded,
  onToggleExpand,
}: {
  donor: DonorWithCohorts;
  selected: boolean;
  onToggleSelect: () => void;
  onCohortClick: (cohortId: string) => void;
  currentUser: { id: string; name: string | null; email: string };
  orgRole: "OWNER" | "ADMIN" | "MEMBER" | "VIEWER";
  expanded: boolean;
  onToggleExpand: () => void;
}) {
  const baseBg = selected ? `${C.amberLight}44` : "transparent";
  const visibleCohorts = donor.cohorts.slice(0, 3);
  const overflow = Math.max(0, donor.cohorts.length - visibleCohorts.length);

  // Cell-level click handler — toggles expansion. Used on every cell
  // EXCEPT the checkbox + claim + chevron cells (those have their own
  // click semantics that need stopPropagation).
  const expandClick = { onClick: onToggleExpand, style: { cursor: "pointer" as const } };

  return (
    <>
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
        <td
          style={{ padding: "14px 18px" }}
          onClick={(e) => e.stopPropagation()}
        >
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggleSelect}
            aria-label={`Select ${donor.name}`}
            style={{ cursor: "pointer", accentColor: C.amber }}
          />
        </td>
        <td style={{ padding: "14px 18px", ...expandClick.style }} onClick={expandClick.onClick}>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>
            {donor.name}
          </div>
        </td>
        <td
          style={{
            padding: "14px 18px",
            fontSize: 13.5,
            color: C.textSecondary,
            ...expandClick.style,
          }}
          onClick={expandClick.onClick}
        >
          {donor.email || "—"}
        </td>
        <td style={{ padding: "14px 18px", ...expandClick.style }} onClick={expandClick.onClick}>
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
            ...expandClick.style,
          }}
          onClick={expandClick.onClick}
        >
          {fmt(donor.totalGiven ?? null)}
        </td>
        <td
          style={{
            padding: "14px 18px",
            fontSize: 13.5,
            color: C.textSecondary,
            whiteSpace: "nowrap",
            ...expandClick.style,
          }}
          onClick={expandClick.onClick}
        >
          {fmtDate(donor.lastGiftDate)}
        </td>
        <td style={{ padding: "14px 18px", ...expandClick.style }} onClick={expandClick.onClick}>
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
        <td
          style={{ padding: "14px 18px" }}
          onClick={(e) => e.stopPropagation()}
        >
          <ClaimButton
            donorId={donor.id}
            claimedBy={donor.claimedBy}
            currentUserId={currentUser.id}
            orgRole={orgRole}
          />
        </td>
        <td
          style={{ padding: "14px 12px", textAlign: "right" }}
          onClick={onToggleExpand}
        >
          <ChevronDown
            size={16}
            color={C.textTertiary}
            style={{
              transform: expanded ? "rotate(180deg)" : "none",
              transition: "transform 0.2s",
              cursor: "pointer",
            }}
          />
        </td>
      </tr>
      {expanded && <DonorExpandedRow donor={donor} />}
    </>
  );
}

/**
 * Expanded panel revealed beneath a donor row. Houses the campaign
 * history list — every outreach campaign this donor has been included
 * in, newest-first, with the subject + delivery state pill + link to
 * the full campaign report. Empty state shown when there are zero
 * drafts.
 */
function DonorExpandedRow({ donor }: { donor: DonorWithCohorts }) {
  const drafts = donor.outreachDrafts;
  return (
    <tr style={{ borderTop: `1px solid ${C.borderSubtle}` }}>
      <td
        colSpan={10}
        style={{
          padding: "20px 24px 26px 56px",
          backgroundColor: C.surfaceHover,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginBottom: 14,
          }}
        >
          <h4
            style={{
              fontSize: 11,
              fontWeight: 800,
              color: C.textTertiary,
              textTransform: "uppercase",
              letterSpacing: 1,
              margin: 0,
            }}
          >
            Campaign History
          </h4>
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              padding: "2px 8px",
              borderRadius: 6,
              backgroundColor:
                drafts.length > 0 ? C.amberLight : "#F2F2F7",
              color: drafts.length > 0 ? C.amberDark : C.textTertiary,
            }}
          >
            {drafts.length}
          </span>
        </div>

        {drafts.length === 0 ? (
          <div
            style={{
              padding: "16px 18px",
              borderRadius: 12,
              backgroundColor: C.surface,
              fontSize: 14,
              color: C.textSecondary,
              fontWeight: 500,
            }}
          >
            This donor hasn&rsquo;t been included in any outreach campaigns yet.
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            {drafts.map((d) => (
              <CampaignHistoryRow key={d.id} entry={d} />
            ))}
          </div>
        )}
      </td>
    </tr>
  );
}

/**
 * One campaign-history row inside the expanded donor view. Shows the
 * campaign name + date, the email subject that was sent, the latest
 * delivery state, and a link to the full campaign report.
 */
function CampaignHistoryRow({ entry }: { entry: DonorCampaignEntry }) {
  const status = computeDonorDraftStatus(entry);
  return (
    <Link
      href={`/outreach/campaigns/${entry.campaign.id}`}
      style={{
        display: "grid",
        gridTemplateColumns: "1fr auto auto",
        alignItems: "center",
        gap: 16,
        padding: "12px 16px",
        borderRadius: 12,
        backgroundColor: C.surface,
        textDecoration: "none",
        boxShadow: shadow.sm,
        transition: "transform 0.12s, box-shadow 0.12s",
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 4,
            flexWrap: "wrap",
          }}
        >
          <span
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: C.text,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              maxWidth: 320,
            }}
            title={entry.campaign.name}
          >
            {entry.campaign.name}
          </span>
          <span
            style={{
              fontSize: 11.5,
              color: C.textTertiary,
              fontWeight: 600,
              whiteSpace: "nowrap",
            }}
          >
            · {fmtDate(entry.campaign.createdAt)}
          </span>
        </div>
        <div
          style={{
            fontSize: 13,
            color: C.textSecondary,
            fontStyle: "italic",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
          title={entry.subject}
        >
          &ldquo;{entry.subject || "(no subject)"}&rdquo;
        </div>
      </div>
      <DonorDeliveryPill state={status} entry={entry} />
      <span
        style={{
          fontSize: 13,
          color: C.amber,
          fontWeight: 700,
          whiteSpace: "nowrap",
        }}
      >
        View →
      </span>
    </Link>
  );
}

/**
 * Engagement priority: bounced > replied > clicked > opened > delivered
 * > sent > approved > draft. Matches the priority rule documented in
 * CLAUDE.md so the donor page agrees with the campaign report's
 * per-row badge.
 */
type DonorDraftState =
  | "draft"
  | "approved"
  | "sent"
  | "delivered"
  | "opened"
  | "clicked"
  | "replied"
  | "bounced";

function computeDonorDraftStatus(entry: DonorCampaignEntry): DonorDraftState {
  if (entry.bouncedAt) return "bounced";
  if (entry.repliedAt) return "replied";
  if (entry.clickedAt || entry.clickCount > 0) return "clicked";
  if (entry.openedAt || entry.openCount > 0) return "opened";
  if (entry.deliveredAt) return "delivered";
  if (entry.sentAt || entry.status === "SENT") return "sent";
  if (entry.status === "APPROVED") return "approved";
  return "draft";
}

function DonorDeliveryPill({
  state,
  entry,
}: {
  state: DonorDraftState;
  entry: DonorCampaignEntry;
}) {
  const palette: Record<
    DonorDraftState,
    { bg: string; fg: string; label: string }
  > = {
    draft: { bg: "#F2F2F7", fg: C.textSecondary, label: "Draft" },
    approved: { bg: "#F2F2F7", fg: C.textSecondary, label: "Approved" },
    sent: { bg: C.amberLight, fg: C.amberDark, label: "Sent" },
    delivered: { bg: C.amberLight, fg: C.amberDark, label: "Delivered" },
    opened: {
      bg: C.purpleLight,
      fg: C.purple,
      label:
        entry.openCount > 1 ? `Opened ×${entry.openCount}` : "Opened",
    },
    clicked: {
      bg: C.goldLight,
      fg: C.amberDark,
      label:
        entry.clickCount > 1 ? `Clicked ×${entry.clickCount}` : "Clicked",
    },
    replied: { bg: C.greenLight, fg: "#1B5E20", label: "Replied" },
    bounced: { bg: C.orangeLight, fg: C.orange, label: "Bounced" },
  };
  const p = palette[state];
  return (
    <span
      style={{
        display: "inline-block",
        padding: "4px 12px",
        borderRadius: 100,
        fontSize: 11.5,
        fontWeight: 800,
        letterSpacing: 0.4,
        backgroundColor: p.bg,
        color: p.fg,
        whiteSpace: "nowrap",
      }}
      title={entry.bounceReason ?? undefined}
    >
      {p.label}
    </span>
  );
}

/**
 * Upload History — surface every DonorList for the org with provenance
 * (who uploaded, when, how many records, how many cohorts the upload
 * produced). Click any row to scope the table below to that upload's
 * donors; click again (or the × on the active row) to clear.
 *
 * Visible to ALL team members, not just the uploader — useful for
 * "wait, who imported this?" questions and for tracing why a donor
 * count jumped between meetings.
 */
function UploadHistorySection({
  uploads,
  activeUploadId,
  onSelect,
}: {
  uploads: UploadHistoryRow[];
  activeUploadId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <section
      style={{
        backgroundColor: C.surface,
        borderRadius: 20,
        boxShadow: shadow.sm,
        marginBottom: 24,
        overflow: "hidden",
      }}
    >
      {/* Section header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
          padding: "18px 22px",
          borderBottom: `1px solid ${C.borderSubtle}`,
        }}
      >
        <div>
          <h2
            style={{
              fontFamily: "var(--font-instrument-serif), Georgia, serif",
              fontSize: 22,
              fontWeight: 400,
              letterSpacing: -0.5,
              color: C.text,
              margin: "0 0 2px",
              lineHeight: 1.15,
            }}
          >
            Upload History
          </h2>
          <p
            style={{
              fontSize: 13,
              color: C.textSecondary,
              fontWeight: 500,
              margin: 0,
            }}
          >
            {uploads.length} upload{uploads.length === 1 ? "" : "s"}
            {activeUploadId ? " · click row again to clear filter" : " · click any row to filter the table below"}
          </p>
        </div>
        <Link
          href="/lapsed"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "9px 16px",
            borderRadius: 12,
            background: brandGradient,
            color: "#fff",
            fontSize: 13,
            fontWeight: 700,
            textDecoration: "none",
            boxShadow: "0 8px 20px rgba(232,134,12,0.25)",
            fontFamily: "var(--font-jakarta), -apple-system, sans-serif",
          }}
        >
          <Upload size={14} /> Upload New List
        </Link>
      </div>

      {/* Rows */}
      <div className="app-scroll-x">
        <table
          style={{
            width: "100%",
            minWidth: 820,
            borderCollapse: "collapse",
          }}
        >
          <thead>
            <tr>
              <UploadHeader label="File" />
              <UploadHeader label="Uploaded" />
              <UploadHeader label="By" />
              <UploadHeader label="Records" align="right" />
              <UploadHeader label="Cohorts" align="right" />
              <th style={{ width: 36 }} />
            </tr>
          </thead>
          <tbody>
            {uploads.map((u) => {
              const isActive = u.id === activeUploadId;
              return (
                <tr
                  key={u.id}
                  onClick={() => onSelect(u.id)}
                  style={{
                    borderTop: `1px solid ${C.borderSubtle}`,
                    backgroundColor: isActive
                      ? `${C.amberLight}66`
                      : "transparent",
                    cursor: "pointer",
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive)
                      e.currentTarget.style.backgroundColor = C.surfaceHover;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = isActive
                      ? `${C.amberLight}66`
                      : "transparent";
                  }}
                >
                  <td style={{ padding: "12px 18px" }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                      }}
                    >
                      <div
                        aria-hidden
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: 8,
                          backgroundColor: isActive
                            ? C.amberLight
                            : "#F2F2F7",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                        }}
                      >
                        <FileSpreadsheet
                          size={16}
                          color={isActive ? C.amber : C.textSecondary}
                        />
                      </div>
                      <div
                        style={{
                          fontSize: 14,
                          fontWeight: 600,
                          color: C.text,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          maxWidth: 280,
                        }}
                        title={u.fileName}
                      >
                        {u.fileName}
                      </div>
                    </div>
                  </td>
                  <td
                    style={{
                      padding: "12px 18px",
                      fontSize: 13,
                      color: C.textSecondary,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {fmtUploadDate(u.createdAt)}
                  </td>
                  <td
                    style={{
                      padding: "12px 18px",
                      fontSize: 13,
                      color: C.textSecondary,
                    }}
                  >
                    {u.uploadedBy ? (
                      <span title={u.uploadedBy.email}>
                        {u.uploadedBy.name || u.uploadedBy.email}
                      </span>
                    ) : (
                      <span style={{ color: C.textTertiary }}>—</span>
                    )}
                  </td>
                  <td
                    style={{
                      padding: "12px 18px",
                      fontSize: 14,
                      fontWeight: 700,
                      color: C.text,
                      textAlign: "right",
                    }}
                  >
                    {u.totalDonors.toLocaleString()}
                  </td>
                  <td
                    style={{
                      padding: "12px 18px",
                      textAlign: "right",
                    }}
                  >
                    {u.cohortCount > 0 ? (
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 5,
                          padding: "3px 10px",
                          borderRadius: 8,
                          fontSize: 12,
                          fontWeight: 700,
                          backgroundColor: C.purpleLight,
                          color: C.purple,
                        }}
                      >
                        <Layers size={11} /> {u.cohortCount}
                      </span>
                    ) : (
                      <span style={{ color: C.textTertiary, fontSize: 13 }}>
                        —
                      </span>
                    )}
                  </td>
                  <td style={{ padding: "12px 12px", textAlign: "right" }}>
                    {isActive ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelect(u.id);
                        }}
                        aria-label="Clear upload filter"
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          width: 24,
                          height: 24,
                          borderRadius: 6,
                          border: "none",
                          background: C.amber,
                          color: "#fff",
                          cursor: "pointer",
                        }}
                      >
                        <X size={14} />
                      </button>
                    ) : (
                      <ChevronDown size={16} color={C.textTertiary} />
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function UploadHeader({
  label,
  align = "left",
}: {
  label: string;
  align?: "left" | "right";
}) {
  return (
    <th
      style={{
        fontSize: 11,
        fontWeight: 700,
        color: C.textTertiary,
        textAlign: align,
        padding: "12px 18px",
        textTransform: "uppercase",
        letterSpacing: 0.5,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </th>
  );
}

function fmtUploadDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const now = Date.now();
  const ms = now - d.getTime();
  const minutes = Math.floor(ms / (60 * 1000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
