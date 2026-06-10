"use client";

/**
 * Attendee-list view — rendered by LapsedClient when the entire upload
 * has zero giving signal (event-only or contact-only CSV).
 *
 * Replaces the lapsed-scoring table + reactivation-threshold + tier
 * filters (none of which apply when nobody has given yet) with a
 * focused selection table:
 *
 *   • Stats strip: total · with-email · segments-found
 *   • Prominent "Generate Outreach for These Attendees" CTA at the
 *     top — pre-selects every visible attendee in /outreach/new
 *   • Cohort filter (segments derived from event-year tags)
 *   • Search by name/email
 *   • Simple table: select | Name | Email | Segments
 *
 * Selection state mirrors ScoredView's pattern so the Draft Outreach
 * button can hand off a comma-separated id list to /outreach/new.
 */

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Mail, Search, Sparkles, Upload, UserPlus, Users } from "lucide-react";
import type { CohortDefinition } from "@prisma/client";

import { C, brandGradient, shadow } from "@/lib/design";
import { CohortBadge, CohortOverflow } from "@/components/lapsed/cohort-badge";
import { CohortFilter } from "@/components/lapsed/cohort-filter";
import type { DonorWithCohorts } from "@/components/lapsed/lapsed-client";

type EngagementBlob = {
  score: number;
  yearsAttended: number;
  years: number[];
  mostRecentYear: number | null;
  longestStreak: number;
  components: {
    frequency: number;
    recency: number;
    consistency: number;
    contact: number;
  };
};

function getEngagement(d: DonorWithCohorts): EngagementBlob | null {
  const enrichment = d.enrichmentData as
    | { engagement?: EngagementBlob }
    | null;
  return enrichment?.engagement ?? null;
}

type Props = {
  donors: DonorWithCohorts[];
  cohorts: CohortDefinition[];
  totalUploaded: number;
  onNewUpload: () => void;
};

type SortKey = "score" | "name" | "years";

export function AttendeeView({
  donors,
  cohorts,
  totalUploaded,
  onNewUpload,
}: Props) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [cohortFilter, setCohortFilter] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // Default sort: engagement descending so the most-likely-to-convert
  // attendees rise to the top. The fundraiser calls down from there.
  const [sortKey, setSortKey] = useState<SortKey>("score");

  // Filter chain: cohort filter (AND across selected ids) → search →
  // sort. Sort runs last so toggling search keeps the user looking at
  // the same conceptual ordering.
  const filtered = useMemo(() => {
    let rows = donors;
    if (cohortFilter.size > 0) {
      rows = rows.filter((d) => {
        const ids = new Set(d.cohorts.map((c) => c.cohortDefinitionId));
        for (const id of cohortFilter) if (!ids.has(id)) return false;
        return true;
      });
    }
    if (search.trim()) {
      const needle = search.trim().toLowerCase();
      rows = rows.filter(
        (d) =>
          d.name.toLowerCase().includes(needle) ||
          (d.email?.toLowerCase().includes(needle) ?? false),
      );
    }
    const sorted = [...rows];
    if (sortKey === "score") {
      sorted.sort(
        (a, b) =>
          (getEngagement(b)?.score ?? -1) - (getEngagement(a)?.score ?? -1),
      );
    } else if (sortKey === "years") {
      sorted.sort(
        (a, b) =>
          (getEngagement(b)?.yearsAttended ?? 0) -
          (getEngagement(a)?.yearsAttended ?? 0),
      );
    } else {
      sorted.sort((a, b) => a.name.localeCompare(b.name));
    }
    return sorted;
  }, [donors, cohortFilter, search, sortKey]);

  const withEmail = useMemo(
    () => donors.filter((d) => !!d.email && d.email.trim().length > 0).length,
    [donors],
  );

  const distinctSegments = useMemo(() => {
    const set = new Set<string>();
    for (const d of donors) for (const c of d.cohorts) set.add(c.cohortDefinitionId);
    return set.size;
  }, [donors]);

  const toggleCohort = (id: string) =>
    setCohortFilter((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const clearCohorts = () => setCohortFilter(new Set());

  const toggleRow = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const allVisibleSelected =
    filtered.length > 0 && filtered.every((d) => selected.has(d.id));
  const toggleAll = () => {
    if (allVisibleSelected) {
      setSelected((prev) => {
        const next = new Set(prev);
        for (const d of filtered) next.delete(d.id);
        return next;
      });
    } else {
      setSelected((prev) => {
        const next = new Set(prev);
        for (const d of filtered) next.add(d.id);
        return next;
      });
    }
  };

  // Hand off to /outreach/new. When selection is non-empty, ship just
  // those ids. When empty, ship every visible (filtered) attendee with
  // an email — the "Generate Outreach for These Attendees" headline
  // CTA reads as "everything I'm looking at right now".
  const handoffIds = (): string[] => {
    const target =
      selected.size > 0
        ? donors.filter((d) => selected.has(d.id))
        : filtered;
    return target
      .filter((d) => !!d.email && d.email.trim().length > 0)
      .map((d) => d.id);
  };

  const generateOutreach = () => {
    const ids = handoffIds();
    if (ids.length === 0) return;
    router.push(`/outreach/new?donors=${ids.join(",")}`);
  };

  const ctaCount =
    selected.size > 0
      ? selected.size
      : filtered.filter((d) => !!d.email).length;

  return (
    <div>
      {/* Header — counts + New Upload */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 14,
          marginBottom: 24,
        }}
      >
        <p style={{ fontSize: 14, color: C.textSecondary, margin: 0 }}>
          {totalUploaded.toLocaleString()} attendees uploaded ·{" "}
          {withEmail.toLocaleString()} ready for outreach ·{" "}
          {distinctSegments.toLocaleString()} segment
          {distinctSegments === 1 ? "" : "s"} found
        </p>
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
      </div>

      {/* Primary CTA — pinned above the table so it's the first thing
          a user sees after the upload-insights cards. Wide gradient
          bar with a one-line subtext explaining what happens next. */}
      <div
        style={{
          marginBottom: 20,
          padding: 2,
          borderRadius: 18,
          background: brandGradient,
          boxShadow:
            "0 14px 36px rgba(232,134,12,0.22), 0 4px 12px rgba(212,74,26,0.12)",
        }}
      >
        <button
          type="button"
          onClick={generateOutreach}
          disabled={ctaCount === 0}
          style={{
            width: "100%",
            border: "none",
            background: C.surface,
            borderRadius: 16,
            padding: "18px clamp(20px, 3vw, 28px)",
            display: "flex",
            alignItems: "center",
            gap: 16,
            cursor: ctaCount === 0 ? "default" : "pointer",
            opacity: ctaCount === 0 ? 0.55 : 1,
            textAlign: "left",
            fontFamily: "var(--font-jakarta), -apple-system, sans-serif",
          }}
        >
          <div
            aria-hidden
            style={{
              width: 48,
              height: 48,
              borderRadius: 14,
              background: brandGradient,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              boxShadow: "0 6px 16px rgba(232,134,12,0.30)",
            }}
          >
            <UserPlus size={22} color="#fff" strokeWidth={2.4} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 17,
                fontWeight: 800,
                color: C.text,
                marginBottom: 2,
                letterSpacing: -0.2,
              }}
            >
              Generate Outreach for{" "}
              {selected.size > 0 ? "These " : "All "}
              Attendees
            </div>
            <div
              style={{
                fontSize: 13,
                color: C.textSecondary,
                fontWeight: 500,
              }}
            >
              {ctaCount === 0
                ? "Select at least one attendee — or remove filters to include the full list."
                : `Pre-selects ${ctaCount.toLocaleString()} ${ctaCount === 1 ? "attendee" : "attendees"} in the AI Outreach studio. Claude drafts a first-time-donor invitation for each.`}
            </div>
          </div>
          <span
            aria-hidden
            style={{
              padding: "10px 18px",
              borderRadius: 12,
              background: brandGradient,
              color: "#fff",
              fontSize: 14,
              fontWeight: 800,
              flexShrink: 0,
              whiteSpace: "nowrap",
            }}
          >
            Continue →
          </span>
        </button>
      </div>

      {/* Stat strip — keep simple, reactivation tier cards don't apply */}
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
          label="Total attendees"
          value={totalUploaded.toLocaleString()}
        />
        <StatCard
          icon={<Mail size={18} color="#0F766E" />}
          iconBg="rgba(15,118,110,0.12)"
          label="With email"
          value={withEmail.toLocaleString()}
          sub={withEmail === totalUploaded ? "100% reachable" : undefined}
        />
        <StatCard
          icon={<Users size={18} color={C.purple} />}
          iconBg="rgba(175,82,222,0.14)"
          label="Selected"
          value={selected.size.toLocaleString()}
          sub={selected.size > 0 ? "ready to draft" : "or send all"}
        />
      </div>

      {/* Segment filter — only meaningful filter for attendee data */}
      <CohortFilter
        cohorts={cohorts}
        selectedIds={cohortFilter}
        onToggle={toggleCohort}
        onClear={clearCohorts}
      />

      {/* Search bar */}
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
            placeholder="Search attendees…"
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
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span
            style={{
              fontSize: 11,
              color: C.textSecondary,
              fontWeight: 700,
              letterSpacing: 0.6,
              textTransform: "uppercase",
            }}
          >
            Sort by
          </span>
          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
            style={{
              padding: "6px 10px",
              borderRadius: 8,
              border: `1px solid ${C.border}`,
              fontSize: 13,
              backgroundColor: C.surface,
              color: C.text,
              cursor: "pointer",
              fontFamily:
                "var(--font-jakarta), -apple-system, sans-serif",
            }}
          >
            <option value="score">Engagement Score</option>
            <option value="years">Years Attended</option>
            <option value="name">Name (A–Z)</option>
          </select>
        </div>
        <span
          style={{
            fontSize: 12,
            color: C.textSecondary,
            fontWeight: 600,
          }}
        >
          Showing {filtered.length.toLocaleString()} of{" "}
          {donors.length.toLocaleString()}
        </span>
      </div>

      {/* Table */}
      <div
        style={{
          backgroundColor: C.surface,
          borderRadius: 16,
          boxShadow: shadow.sm,
          overflow: "hidden",
        }}
      >
        <div className="app-scroll-x">
          <table
            style={{
              width: "100%",
              minWidth: 880,
              borderCollapse: "collapse",
            }}
          >
            <thead>
              <tr style={{ backgroundColor: C.bg }}>
                <Th width={48}>
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={toggleAll}
                    aria-label="Select all visible attendees"
                    style={{ cursor: "pointer", width: 16, height: 16 }}
                  />
                </Th>
                <Th>Name</Th>
                <Th>Email</Th>
                <Th width={160}>Engagement</Th>
                <Th width={140}>Years Attended</Th>
                <Th>Segments</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    style={{
                      padding: "48px 24px",
                      textAlign: "center",
                      color: C.textSecondary,
                      fontSize: 14,
                    }}
                  >
                    No attendees match the active filters.
                  </td>
                </tr>
              ) : (
                filtered.map((d, i) => {
                  const isSel = selected.has(d.id);
                  const engagement = getEngagement(d);
                  const visibleCohorts = d.cohorts.slice(0, 3);
                  const overflow = Math.max(
                    0,
                    d.cohorts.length - visibleCohorts.length,
                  );
                  return (
                    <tr
                      key={d.id}
                      onClick={() => toggleRow(d.id)}
                      style={{
                        borderTop:
                          i > 0 ? `1px solid ${C.borderSubtle}` : "none",
                        cursor: "pointer",
                        backgroundColor: isSel
                          ? "rgba(232,134,12,0.05)"
                          : "transparent",
                      }}
                    >
                      <Td>
                        <input
                          type="checkbox"
                          checked={isSel}
                          onChange={() => toggleRow(d.id)}
                          onClick={(e) => e.stopPropagation()}
                          aria-label={`Select ${d.name}`}
                          style={{
                            cursor: "pointer",
                            width: 16,
                            height: 16,
                          }}
                        />
                      </Td>
                      <Td>
                        <span
                          style={{
                            fontWeight: 700,
                            color: C.text,
                            fontSize: 14,
                          }}
                        >
                          {d.name}
                        </span>
                      </Td>
                      <Td>
                        <span
                          style={{
                            fontSize: 13.5,
                            color: d.email ? C.textBody : C.textTertiary,
                            fontStyle: d.email ? "normal" : "italic",
                          }}
                        >
                          {d.email ?? "no email"}
                        </span>
                      </Td>
                      <Td>
                        <EngagementCell engagement={engagement} />
                      </Td>
                      <Td>
                        <YearsCell engagement={engagement} />
                      </Td>
                      <Td>
                        <div
                          style={{
                            display: "flex",
                            gap: 4,
                            flexWrap: "wrap",
                          }}
                        >
                          {visibleCohorts.length === 0 ? (
                            <span
                              style={{
                                fontSize: 12,
                                color: C.textTertiary,
                                fontStyle: "italic",
                              }}
                            >
                              —
                            </span>
                          ) : (
                            visibleCohorts.map((dc) => (
                              <CohortBadge
                                key={dc.id}
                                cohort={dc.cohort}
                                onClick={() =>
                                  toggleCohort(dc.cohortDefinitionId)
                                }
                                active={cohortFilter.has(
                                  dc.cohortDefinitionId,
                                )}
                              />
                            ))
                          )}
                          {overflow > 0 && (
                            <CohortOverflow count={overflow} />
                          )}
                        </div>
                      </Td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Engagement display cells ───────────────────────────────────────

/**
 * Score badge with a horizontal bar fill + numeric value. Tiered color
 * (high/mid/low) matches the same palette the lapsed view uses for
 * reactivation tiers so the visual language stays consistent. Native
 * `title` attribute carries the component breakdown for tooltips.
 */
function EngagementCell({
  engagement,
}: {
  engagement: EngagementBlob | null;
}) {
  if (!engagement) {
    return (
      <span
        style={{
          fontSize: 12,
          color: C.textTertiary,
          fontStyle: "italic",
        }}
      >
        —
      </span>
    );
  }
  const score = engagement.score;
  const { components } = engagement;
  const fillColor =
    score >= 70 ? C.green : score >= 45 ? C.amber : C.textSecondary;
  const title = [
    `Engagement ${score}/100`,
    `• Frequency ${components.frequency}/40`,
    `• Recency ${components.recency}/30`,
    `• Consistency ${components.consistency}/15`,
    `• Contact ${components.contact}/15`,
  ].join("\n");
  return (
    <div title={title}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <Sparkles size={13} color={fillColor} />
        <span
          style={{
            fontSize: 15,
            fontWeight: 800,
            color: C.text,
            letterSpacing: -0.2,
            minWidth: 28,
          }}
        >
          {score}
        </span>
      </div>
      <div
        aria-hidden
        style={{
          marginTop: 4,
          width: 110,
          height: 4,
          borderRadius: 100,
          backgroundColor: "rgba(0,0,0,0.06)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${score}%`,
            height: "100%",
            backgroundColor: fillColor,
            borderRadius: 100,
          }}
        />
      </div>
    </div>
  );
}

function YearsCell({
  engagement,
}: {
  engagement: EngagementBlob | null;
}) {
  if (!engagement || engagement.yearsAttended === 0) {
    return (
      <span
        style={{
          fontSize: 12,
          color: C.textTertiary,
          fontStyle: "italic",
        }}
      >
        —
      </span>
    );
  }
  const { years, yearsAttended, mostRecentYear } = engagement;
  // Show the year list (capped at the most-recent 4 for table width)
  // so the fundraiser sees the actual pattern at a glance, not just
  // the count.
  const display =
    years.length <= 4
      ? years.join(", ")
      : `${years.slice(-4).join(", ")}`;
  return (
    <div>
      <div
        style={{
          fontSize: 14,
          fontWeight: 700,
          color: C.text,
        }}
      >
        {yearsAttended} {yearsAttended === 1 ? "year" : "years"}
      </div>
      <div
        style={{
          fontSize: 11.5,
          color: C.textSecondary,
          fontWeight: 500,
          marginTop: 2,
        }}
        title={
          mostRecentYear ? `Most recent attendance: ${mostRecentYear}` : ""
        }
      >
        {display}
      </div>
    </div>
  );
}

// ─── helpers ─────────────────────────────────────────────────────────

function Th({
  children,
  width,
}: {
  children: React.ReactNode;
  width?: number;
}) {
  return (
    <th
      style={{
        fontSize: 11,
        fontWeight: 800,
        color: C.textSecondary,
        textAlign: "left",
        padding: "12px 18px",
        textTransform: "uppercase",
        letterSpacing: 1.0,
        width,
      }}
    >
      {children}
    </th>
  );
}

function Td({ children }: { children: React.ReactNode }) {
  return (
    <td
      style={{
        padding: "14px 18px",
        verticalAlign: "middle",
      }}
    >
      {children}
    </td>
  );
}

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
        borderRadius: 14,
        padding: "16px 18px",
        boxShadow: shadow.sm,
        display: "flex",
        alignItems: "center",
        gap: 12,
      }}
    >
      <div
        aria-hidden
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          backgroundColor: iconBg,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {icon}
      </div>
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 800,
            color: C.textSecondary,
            textTransform: "uppercase",
            letterSpacing: 1.0,
            marginBottom: 2,
          }}
        >
          {label}
        </div>
        <div
          style={{
            fontSize: 22,
            fontWeight: 800,
            color: C.text,
            letterSpacing: -0.5,
            lineHeight: 1.1,
          }}
        >
          {value}
        </div>
        {sub && (
          <div
            style={{
              fontSize: 11.5,
              color: C.textSecondary,
              fontWeight: 600,
              marginTop: 2,
            }}
          >
            {sub}
          </div>
        )}
      </div>
    </div>
  );
}
