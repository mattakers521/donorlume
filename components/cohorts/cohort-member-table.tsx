"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Search } from "lucide-react";
import type { Donor } from "@prisma/client";

import { C, shadow } from "@/lib/design";
import { fmt } from "@/lib/format";
import { ScoreRing } from "@/components/score-ring";
import { TierBadge } from "@/components/tier-badge";

type Props = {
  donors: Donor[];
};

type SortKey = "score" | "name" | "totalGiven" | "daysSinceLast";

export function CohortMemberTable({ donors }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("score");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [search, setSearch] = useState("");
  const [now] = useState(() => Date.now());

  const filtered = useMemo(() => {
    let rows = donors;
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter(
        (d) =>
          d.name.toLowerCase().includes(q) ||
          (d.email ?? "").toLowerCase().includes(q),
      );
    }
    const sorted = [...rows].sort((a, b) => {
      const get = (d: Donor): string | number => {
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
      return sortDir === "asc"
        ? Number(va) - Number(vb)
        : Number(vb) - Number(va);
    });
    return sorted;
  }, [donors, search, sortKey, sortDir]);

  const setSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  return (
    <>
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
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            flex: 1,
            padding: "8px 14px",
            borderRadius: 10,
            backgroundColor: "#F2F2F7",
          }}
        >
          <Search size={15} color={C.textTertiary} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search members…"
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
        <div style={{ fontSize: 13, color: C.textTertiary, fontWeight: 600 }}>
          {filtered.length}
          {filtered.length === donors.length ? "" : ` of ${donors.length}`}{" "}
          members
        </div>
      </div>

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
            }}
          >
            No matching members.
          </div>
        ) : (
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
                <SortHeader
                  label="Donor"
                  sKey="name"
                  active={sortKey === "name"}
                  dir={sortDir}
                  onSort={setSort}
                />
                <SortHeader
                  label="Last gift"
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
                  Tier
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((d) => {
                const months = d.lastGiftDate
                  ? Math.round(
                      (now - new Date(d.lastGiftDate).getTime()) /
                        (30 * 86_400_000),
                    )
                  : null;
                return (
                  <tr
                    key={d.id}
                    style={{ borderTop: `1px solid ${C.borderSubtle}` }}
                  >
                    <td style={{ padding: "14px 18px" }}>
                      <div style={{ fontSize: 15, fontWeight: 700 }}>{d.name}</div>
                      <div style={{ fontSize: 12, color: C.textTertiary }}>
                        {d.email || d.donorType || "—"}
                      </div>
                    </td>
                    <td style={{ padding: "14px 18px" }}>
                      {months != null ? (
                        <span
                          style={{
                            fontSize: 14,
                            color:
                              months >= 18 ? C.orange : C.textSecondary,
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
                      style={{
                        padding: "14px 18px",
                        fontSize: 15,
                        fontWeight: 700,
                      }}
                    >
                      {fmt(d.totalGiven ?? null)}
                    </td>
                    <td style={{ padding: "14px 18px" }}>
                      <ScoreRing
                        score={d.reactivationScore ?? 0}
                        size={36}
                      />
                    </td>
                    <td style={{ padding: "14px 18px" }}>
                      <TierBadge tier={d.tier} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        )}
      </div>
    </>
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
