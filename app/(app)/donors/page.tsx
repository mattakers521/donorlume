import Link from "next/link";
import { Heart, Upload } from "lucide-react";

import { C, brandGradient, shadow } from "@/lib/design";
import { prisma } from "@/lib/prisma";
import { getOrgContext } from "@/lib/with-org";
import { DonorsClient } from "@/components/donors/donors-client";

export const dynamic = "force-dynamic";

/**
 * Donor Intelligence — the unified "see all your donors in one place"
 * view. Lists every donor across every uploaded DonorList for the org,
 * scoped via `getOrgContext()` so the multi-tenant boundary is enforced
 * before any query runs.
 *
 * Why one query: a donor can be on many lists over time (an org might
 * upload quarterly), so the page flattens them into a single sortable
 * table rather than nesting by list. The `donorList.name` is still
 * available per-row for the expanded view if we want to surface
 * "which upload did this come from?" later.
 */
export default async function DonorsPage() {
  const { org } = await getOrgContext();

  const [donors, cohorts, listCount] = await Promise.all([
    prisma.donor.findMany({
      where: { donorList: { orgId: org.id } },
      orderBy: { reactivationScore: "desc" },
      include: { cohorts: { include: { cohort: true } } },
    }),
    prisma.cohortDefinition.findMany({
      where: { orgId: org.id, isArchived: false },
      orderBy: [{ family: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
    }),
    prisma.donorList.count({ where: { orgId: org.id } }),
  ]);

  // Empty state — no donors anywhere. Show a one-card CTA that funnels
  // straight to /lapsed (the upload flow). Keeping it server-rendered
  // here so it loads without the client bundle when there's nothing
  // to render anyway.
  if (donors.length === 0) {
    return <EmptyState />;
  }

  return (
    <DonorsClient donors={donors} cohorts={cohorts} listCount={listCount} />
  );
}

function EmptyState() {
  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "48px 0" }}>
      <div
        style={{
          backgroundColor: C.surface,
          borderRadius: 24,
          boxShadow: shadow.md,
          padding: "48px clamp(28px, 5vw, 56px)",
          textAlign: "center",
        }}
      >
        <div
          aria-hidden
          style={{
            width: 72,
            height: 72,
            borderRadius: 20,
            backgroundColor: C.amberLight,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 22px",
          }}
        >
          <Heart size={32} color={C.amber} />
        </div>
        <h1
          style={{
            fontFamily: "var(--font-instrument-serif), Georgia, serif",
            fontSize: "clamp(28px, 4vw, 36px)",
            fontWeight: 400,
            letterSpacing: -0.8,
            color: C.text,
            margin: "0 0 12px",
          }}
        >
          Your donors will live here.
        </h1>
        <p
          style={{
            fontSize: 15.5,
            lineHeight: 1.6,
            color: C.textBody,
            fontWeight: 500,
            margin: "0 auto 28px",
            maxWidth: 460,
          }}
        >
          Upload a CSV from any CRM and DonorLume will score every donor,
          classify them into cohorts, and surface them in one searchable
          place — no spreadsheet wrangling required.
        </p>
        <Link
          href="/lapsed"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "14px 26px",
            borderRadius: 14,
            background: brandGradient,
            color: "#fff",
            fontSize: 15,
            fontWeight: 700,
            textDecoration: "none",
            boxShadow: "0 10px 26px rgba(232,134,12,0.28)",
            fontFamily: "var(--font-jakarta), -apple-system, sans-serif",
          }}
        >
          <Upload size={16} /> Upload Your First List
        </Link>
      </div>
    </div>
  );
}
