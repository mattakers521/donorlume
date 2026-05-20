"use client";

import { useMemo, useState } from "react";
import {
  Building2,
  ChevronDown,
  ChevronUp,
  Download,
  Sparkles,
  TrendingUp,
  UserCheck,
  Users,
} from "lucide-react";

import { C, shadow } from "@/lib/design";

export type AdminSummary = {
  totalUsers: number;
  totalOrganizations: number;
  signupsLast24h: number;
  signupsLast7Days: number;
  activeUsers7d: number;
};

export type AdminUserRow = {
  id: string;
  name: string;
  email: string;
  orgName: string;
  signupAt: string;
  lastActiveAt: string | null;
  plan: string;
  donorCount: number;
  campaignCount: number;
};

type SortKey =
  | "name"
  | "email"
  | "orgName"
  | "signupAt"
  | "lastActiveAt"
  | "plan"
  | "donorCount"
  | "campaignCount";

type Props = {
  summary: AdminSummary;
  rows: AdminUserRow[];
};

export function AdminClient({ summary, rows }: Props) {
  // Default: newest signups first (matches the server's initial order).
  const [sortKey, setSortKey] = useState<SortKey>("signupAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const sorted = useMemo(() => {
    const get = (r: AdminUserRow): string | number => {
      switch (sortKey) {
        case "name":
          return (r.name || r.email).toLowerCase();
        case "email":
          return r.email.toLowerCase();
        case "orgName":
          return r.orgName.toLowerCase();
        case "signupAt":
          // Sort by raw ISO so "desc" = newest first.
          return -new Date(r.signupAt).getTime();
        case "lastActiveAt":
          return r.lastActiveAt
            ? -new Date(r.lastActiveAt).getTime()
            : Number.POSITIVE_INFINITY;
        case "plan":
          return r.plan.toLowerCase();
        case "donorCount":
          return r.donorCount;
        case "campaignCount":
          return r.campaignCount;
      }
    };
    return [...rows].sort((a, b) => {
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
  }, [rows, sortKey, sortDir]);

  const setSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      // Default direction per column. Strings ascend (A→Z), numerics
      // descend (largest first). Recency columns descend (newest first
      // → handled via the negative-timestamp trick above).
      setSortDir(
        key === "name" || key === "email" || key === "orgName" || key === "plan"
          ? "asc"
          : "desc",
      );
    }
  };

  return (
    <div style={{ maxWidth: 1400 }}>
      {/* KPI strip */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 16,
          marginBottom: 28,
        }}
      >
        <SummaryCard
          icon={<Users size={18} color={C.amber} />}
          iconBg={C.amberLight}
          label="Total Users"
          value={summary.totalUsers.toLocaleString()}
        />
        <SummaryCard
          icon={<Building2 size={18} color={C.orange} />}
          iconBg={C.orangeLight}
          label="Organizations"
          value={summary.totalOrganizations.toLocaleString()}
        />
        <SummaryCard
          icon={<Sparkles size={18} color={C.amberDark} />}
          iconBg={C.goldLight}
          label="Signups · 24h"
          value={summary.signupsLast24h.toLocaleString()}
        />
        <SummaryCard
          icon={<TrendingUp size={18} color={C.purple} />}
          iconBg={C.purpleLight}
          label="Signups · 7 days"
          value={summary.signupsLast7Days.toLocaleString()}
        />
        <SummaryCard
          icon={<UserCheck size={18} color={C.green} />}
          iconBg={C.greenLight}
          label="Active · 7 days"
          value={summary.activeUsers7d.toLocaleString()}
          sub="Logged in"
        />
      </div>

      {/* Toolbar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
          marginBottom: 16,
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
            All users
          </h2>
          <p
            style={{
              fontSize: 13,
              color: C.textSecondary,
              fontWeight: 500,
              margin: 0,
            }}
          >
            {rows.length} user{rows.length === 1 ? "" : "s"} · click any
            column to sort
          </p>
        </div>
        <a
          href="/api/admin/export-emails"
          download
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "10px 18px",
            borderRadius: 12,
            background: `linear-gradient(135deg, ${C.amber}, ${C.orange})`,
            color: "#fff",
            fontSize: 13,
            fontWeight: 700,
            textDecoration: "none",
            boxShadow: "0 8px 20px rgba(232,134,12,0.25)",
            fontFamily: "var(--font-jakarta), -apple-system, sans-serif",
          }}
        >
          <Download size={15} /> Export Emails (CSV)
        </a>
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
        {sorted.length === 0 ? (
          <div
            style={{
              padding: 56,
              textAlign: "center",
              color: C.textTertiary,
              fontSize: 14,
              fontWeight: 500,
            }}
          >
            No users yet. The first signup will appear here.
          </div>
        ) : (
          <div className="app-scroll-x">
            <table
              style={{
                width: "100%",
                minWidth: 1240,
                borderCollapse: "collapse",
              }}
            >
              <thead>
                <tr>
                  <SortHeader
                    label="Name"
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
                    label="Organization"
                    sKey="orgName"
                    active={sortKey === "orgName"}
                    dir={sortDir}
                    onSort={setSort}
                  />
                  <SortHeader
                    label="Signed Up"
                    sKey="signupAt"
                    active={sortKey === "signupAt"}
                    dir={sortDir}
                    onSort={setSort}
                  />
                  <SortHeader
                    label="Last Active"
                    sKey="lastActiveAt"
                    active={sortKey === "lastActiveAt"}
                    dir={sortDir}
                    onSort={setSort}
                  />
                  <SortHeader
                    label="Plan"
                    sKey="plan"
                    active={sortKey === "plan"}
                    dir={sortDir}
                    onSort={setSort}
                  />
                  <SortHeader
                    label="Donors"
                    sKey="donorCount"
                    active={sortKey === "donorCount"}
                    dir={sortDir}
                    onSort={setSort}
                    align="right"
                  />
                  <SortHeader
                    label="Campaigns"
                    sKey="campaignCount"
                    active={sortKey === "campaignCount"}
                    dir={sortDir}
                    onSort={setSort}
                    align="right"
                  />
                </tr>
              </thead>
              <tbody>
                {sorted.map((r) => (
                  <UserRow key={r.id} row={r} />
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

function SummaryCard({
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
            width: 36,
            height: 36,
            borderRadius: 12,
            backgroundColor: iconBg,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {icon}
        </div>
        <span style={{ fontSize: 12, color: C.textTertiary, fontWeight: 600 }}>
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
  align = "left",
}: {
  label: string;
  sKey: SortKey;
  active: boolean;
  dir: "asc" | "desc";
  onSort: (k: SortKey) => void;
  align?: "left" | "right";
}) {
  return (
    <th
      onClick={() => onSort(sKey)}
      style={{
        fontSize: 11,
        fontWeight: 700,
        color: active ? C.amber : C.textTertiary,
        textAlign: align,
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

function UserRow({ row }: { row: AdminUserRow }) {
  return (
    <tr
      style={{ borderTop: `1px solid ${C.borderSubtle}` }}
      onMouseEnter={(e) =>
        (e.currentTarget.style.backgroundColor = C.surfaceHover)
      }
      onMouseLeave={(e) =>
        (e.currentTarget.style.backgroundColor = "transparent")
      }
    >
      <td style={{ padding: "14px 18px" }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>
          {row.name || <span style={{ color: C.textTertiary }}>—</span>}
        </div>
      </td>
      <td
        style={{
          padding: "14px 18px",
          fontSize: 13,
          color: C.textSecondary,
        }}
      >
        {row.email}
      </td>
      <td
        style={{
          padding: "14px 18px",
          fontSize: 13.5,
          fontWeight: 600,
          color: C.text,
        }}
      >
        {row.orgName}
      </td>
      <td
        style={{
          padding: "14px 18px",
          fontSize: 13,
          color: C.textSecondary,
          whiteSpace: "nowrap",
        }}
      >
        {fmtDate(row.signupAt)}
      </td>
      <td
        style={{
          padding: "14px 18px",
          fontSize: 13,
          color: C.textSecondary,
          whiteSpace: "nowrap",
        }}
      >
        {row.lastActiveAt ? (
          fmtRelative(row.lastActiveAt)
        ) : (
          <span style={{ color: C.textTertiary }}>—</span>
        )}
      </td>
      <td style={{ padding: "14px 18px" }}>
        <PlanPill plan={row.plan} />
      </td>
      <td
        style={{
          padding: "14px 18px",
          fontSize: 14,
          fontWeight: 700,
          color: C.text,
          textAlign: "right",
        }}
      >
        {row.donorCount.toLocaleString()}
      </td>
      <td
        style={{
          padding: "14px 18px",
          fontSize: 14,
          fontWeight: 700,
          color: C.text,
          textAlign: "right",
        }}
      >
        {row.campaignCount.toLocaleString()}
      </td>
    </tr>
  );
}

function PlanPill({ plan }: { plan: string }) {
  const palette: Record<string, { bg: string; fg: string }> = {
    Trial: { bg: C.amberLight, fg: C.amberDark },
    Starter: { bg: "#F2F2F7", fg: C.textSecondary },
    Growth: { bg: C.purpleLight, fg: C.purple },
    Scale: { bg: C.greenLight, fg: "#1B5E20" },
    Enterprise: { bg: C.goldLight, fg: C.amberDark },
  };
  const p = palette[plan] ?? { bg: "#F2F2F7", fg: C.textSecondary };
  return (
    <span
      style={{
        display: "inline-block",
        padding: "3px 10px",
        borderRadius: 100,
        fontSize: 11,
        fontWeight: 800,
        letterSpacing: 0.5,
        textTransform: "uppercase",
        backgroundColor: p.bg,
        color: p.fg,
      }}
    >
      {plan}
    </span>
  );
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function fmtRelative(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const ms = Date.now() - d.getTime();
  const minutes = Math.floor(ms / (60 * 1000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return fmtDate(iso);
}
