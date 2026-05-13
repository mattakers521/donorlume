import type { CohortFamily } from "@prisma/client";
import { Layers } from "lucide-react";

import { C, shadow } from "@/lib/design";
import { getCohortInsights } from "@/lib/cohorts/insights";
import { getOrgContext } from "@/lib/with-org";
import { CohortCard } from "@/components/cohorts/cohort-card";

export const dynamic = "force-dynamic";

const FAMILY_LABEL: Record<CohortFamily, string> = {
  GIVING_BEHAVIOR: "Giving Behavior",
  ENGAGEMENT: "Engagement",
  ENTITY_TYPE: "Entity Type",
  TRAJECTORY: "Trajectory",
  CUSTOM: "Custom",
};

const FAMILY_DESC: Record<CohortFamily, string> = {
  GIVING_BEHAVIOR:
    "How much, how often, and how recently. Surfaces majors, mid-level, sustainers, and the lapsed.",
  ENGAGEMENT:
    "Tag-derived cohorts from your CSV — events, board, volunteers, peer-to-peer fundraisers.",
  ENTITY_TYPE:
    "Who's giving — individuals, corporations, foundations, donor-advised funds.",
  TRAJECTORY:
    "Computed movement — rising stars, churn risk, upgrade candidates. (Phase 3)",
  CUSTOM: "Cohorts you've created yourself. (Phase 3)",
};

const FAMILY_ORDER: CohortFamily[] = [
  "GIVING_BEHAVIOR",
  "ENGAGEMENT",
  "ENTITY_TYPE",
  "TRAJECTORY",
  "CUSTOM",
];

export default async function CohortsOverviewPage() {
  const { org } = await getOrgContext();
  const insights = await getCohortInsights(org.id);

  const totalDonors = await import("@/lib/prisma").then(({ prisma }) =>
    prisma.donor.count({
      where: { donorList: { orgId: org.id } },
    }),
  );

  // Empty-org guard — first-time orgs have system cohorts seeded (or
  // will be on first upload) but zero members.
  if (totalDonors === 0) {
    return <EmptyState />;
  }

  // Group by family in the spec-defined family order; drop families
  // with no defs entirely.
  const grouped = FAMILY_ORDER.map((family) => ({
    family,
    items: insights.filter((i) => i.cohort.family === family),
  })).filter((g) => g.items.length > 0);

  return (
    <div style={{ maxWidth: 1200 }}>
      <p
        style={{
          fontSize: 14,
          color: C.textSecondary,
          margin: "0 0 28px",
          maxWidth: 760,
        }}
      >
        Every donor in your org, classified into overlapping cohorts. Click
        any cohort to see its members, value, and outreach options.
      </p>

      {grouped.map((group, gi) => (
        <section
          key={group.family}
          style={{ marginBottom: gi < grouped.length - 1 ? 40 : 0 }}
        >
          <div
            style={{
              marginBottom: 16,
              display: "flex",
              alignItems: "baseline",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <h2
              style={{
                fontSize: 11,
                fontWeight: 800,
                color: C.amber,
                margin: 0,
                textTransform: "uppercase",
                letterSpacing: 1.5,
              }}
            >
              {FAMILY_LABEL[group.family]}
            </h2>
            <p
              style={{
                fontSize: 13,
                color: C.textTertiary,
                margin: 0,
                fontWeight: 500,
              }}
            >
              {FAMILY_DESC[group.family]}
            </p>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
              gap: 16,
            }}
          >
            {group.items.map((insight) => (
              <CohortCard key={insight.cohort.id} insight={insight} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: 480,
        textAlign: "center",
        padding: 40,
      }}
    >
      <div
        style={{
          width: 80,
          height: 80,
          borderRadius: 24,
          backgroundColor: C.amberLight,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 24,
          boxShadow: shadow.glow,
        }}
      >
        <Layers size={36} color={C.amber} />
      </div>
      <h2
        style={{
          fontSize: 26,
          fontWeight: 400,
          margin: 0,
          fontFamily: "var(--font-instrument-serif), Georgia, serif",
        }}
      >
        Upload a donor list to see your cohorts.
      </h2>
      <p
        style={{
          fontSize: 16,
          color: C.textSecondary,
          maxWidth: 460,
          marginTop: 14,
          lineHeight: 1.6,
        }}
      >
        Once you upload a CSV, every donor is auto-classified into the
        Giving Behavior and Entity Type cohorts. Engagement cohorts come
        from your CSV&rsquo;s tag columns.
      </p>
    </div>
  );
}
